/* =========================================================================
   Whisper — process principal

   Une seule fenêtre : une icône ronde, flottante, toujours au premier plan, qui
   ne prend JAMAIS le focus — le texte dicté doit arriver dans l'application où
   est le curseur, pas ici. Maintenir le clic dicte, glisser déplace, clic droit
   ouvre le menu (langue, micro, son, bulle, micro Discord, lecture à voix
   haute, dossier whisper, quitter).

   À la fin d'une dictée, une BULLE montre le texte à côté de l'icône (réglage
   `showText`) ; un clic dessus le copie.

   Linux et Windows : pendant l'enregistrement, le micro Discord et le son des
   autres applications peuvent être coupés puis rétablis (réglages
   `discordMute`, `muteOthers`, cf. mute.js).

   Un petit bouton accolé à l'icône lit à voix haute le texte sélectionné (ou
   le presse-papiers), en local : Pocket TTS, sur le processeur (réglage
   `speak`, cf. tts.js).

   Des agents Claude Code (un par dossier de projet, réglage `agentsEnabled`,
   cf. agents.js) : un robot sélectionné reçoit la dictée au lieu du curseur ;
   sa conversation s'affiche dans un panneau contre l'icône (réduit : le
   dernier échange ; agrandi : tout le fil), avec un champ de saisie où arrive
   la dictée, à relire (réglage `agentReview`), et le contexte joint (images,
   fichiers, texte sélectionné).

   Ce qui est collé est TOUJOURS ce que whisper vient de rendre, jamais un texte
   fourni par le renderer. Le collage automatique peut être désactivé (réglage
   `autoPaste`) : le texte reste alors dans le presse-papiers. Seule exception
   pour un agent : le texte relu, qui vient du champ du panneau et de lui seul.
   ========================================================================= */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app, BrowserWindow, ipcMain, clipboard, shell, screen, Menu, dialog, nativeImage } = require('electron');
const whisper = require('./whisper');
const paste = require('./paste');
const mute = require('./mute');
const tts = require('./tts');
const selection = require('./selection');
const agents = require('./agents');
const windows = require('./windows');

// Fenêtre transparente sous Linux (X11) : sans ce drapeau, fond noir.
if (process.platform === 'linux') app.commandLine.appendSwitch('enable-transparent-visuals');

if (!app.requestSingleInstanceLock()) app.quit();

/* ---- Configuration (userData/config.json) -------------------------------- */

const DEFAULTS = {
  lang: 'fr', vocabulary: '', sound: true, showText: true, discordMute: false,
  // Agents Claude Code : un par dossier ({ id, dir, name, model, effort, mode,
  // sessionId }). `agentFolders` : les dossiers déjà choisis ({ dir, color }),
  // proposés par le bouton « + » ; la couleur appartient au DOSSIER, l'agent
  // qu'on y crée la porte. `agentCommand` : la commande qui lance Claude Code
  // ('' : `claude` ; ex. « distrobox enter dev -- mise exec -- claude »).
  agentsEnabled: false, agentCommand: '', agents: [], agentFolders: [], agentSelected: null,
  agentReview: true,                 // dictée vers un agent : dans le champ du panneau, à relire ; false : envoyée aussitôt
  onTop: true,                       // icône, bulles et panneau au-dessus de toutes les fenêtres
  muteOthers: false,                 // couper le son des autres applications pendant la dictée
  autoPaste: true,                   // coller là où est le curseur ; sinon le texte reste dans le presse-papiers
  speak: 'selection', speakVolume: 1,
  speakLang: 'auto',                 // 'auto' : français ou anglais, détecté sur le texte entier
  speakVoices: { fr: 'estelle', en: 'jane' },   // cf. tts.LANGS
  deviceId: '', deviceLabel: '', size: 64, pos: null,
};
const LANGS = { fr: 'Français', en: 'English', auto: 'Détection auto', es: 'Español', de: 'Deutsch', it: 'Italiano', pt: 'Português', nl: 'Nederlands' };
const configFile = () => path.join(app.getPath('userData'), 'config.json');

// Relu à chaque usage : une retouche à la main du fichier (vocabulaire) prend
// effet à la dictée suivante, sans relancer.
function loadConfig() {
  try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(configFile(), 'utf8')) }; } catch { return { ...DEFAULTS }; }
}

function saveConfig(patch) {
  const cfg = { ...loadConfig(), ...patch };
  fs.mkdirSync(path.dirname(configFile()), { recursive: true });
  fs.writeFileSync(configFile(), JSON.stringify(cfg, null, 2));
  return cfg;
}

// Binaires livrés avec le paquet (whisper-cli, uv : cf. scripts/, CI) ; en
// développement, ceux que scripts/ a compilés ou téléchargés.
const bundledBinDir = () => (app.isPackaged
  ? path.join(process.resourcesPath, 'bin')
  : path.join(__dirname, '..', 'resources', 'bin'));

// Le nôtre d'abord ; puis le binaire du paquet ; puis l'installation de
// Cockpit, pour réutiliser son modèle.
const ownWhisperDir = () => path.join(app.getPath('userData'), 'whisper');
const whisperDirs = () => [ownWhisperDir(), bundledBinDir(), path.join(app.getPath('appData'), 'cockpit', 'whisper')];

// Ce que lit le bouton : 'selection', 'clipboard' ou 'off'. La sélection se
// lit sous Linux et Windows (cf. selection.js) ; ailleurs, le presse-papiers.
const canReadSelection = process.platform === 'linux' || process.platform === 'win32';
function speakMode(cfg) {
  if (cfg.speak === 'off') return 'off';
  return cfg.speak === 'clipboard' || !canReadSelection ? 'clipboard' : 'selection';
}

// 0 à 1 : au-delà, la voix saturerait.
const speakVolume = (cfg) => {
  const v = Number(cfg.speakVolume);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
};

/* ---- Fenêtre ------------------------------------------------------------- */

// Au-dessus de toutes les fenêtres (réglage `onTop`, par défaut) : l'icône, sa
// bulle, le panneau des conversations. Décoché (une vidéo en
// plein écran…) : des fenêtres comme les autres, que les autres recouvrent.
const onTop = () => loadConfig().onTop !== false;
function applyOnTop() {
  for (const w of [win, bubble, conv]) if (w && !w.isDestroyed()) w.setAlwaysOnTop(onTop(), 'floating');
}

let win = null;
let winSize = 0; // taille voulue de l'icône, en px logiques

let speakShown = false; // bouton de lecture montré (réglage `speak` ≠ 'off')
let agentSlots = 0;     // robots montrés + le bouton « + » (0 : agents désactivés)

// Les petits boutons (lecture, agents, ajout), moitié moins grands, s'alignent
// à droite de l'icône : la fenêtre s'élargit d'autant (cf. style.css).
const winWidth = () => winSize + ((speakShown ? 1 : 0) + agentSlots) * (Math.round(winSize / 2) + 4);

// Une position mémorisée peut pointer hors écran (moniteur débranché) : on ne
// la retient que si l'icône reste visible.
function isVisible(pos, size) {
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false;
  return screen.getAllDisplays().some(({ workArea: a }) => (
    pos.x + size > a.x && pos.x < a.x + a.width && pos.y + size > a.y && pos.y < a.y + a.height
  ));
}

function createWindow() {
  const cfg = loadConfig();
  const size = Math.max(32, Math.min(200, Math.round(cfg.size) || DEFAULTS.size));
  winSize = size;
  speakShown = speakMode(cfg) !== 'off';
  agentSlots = agentSlotCount(cfg);
  const wa = screen.getPrimaryDisplay().workArea;
  const pos = isVisible(cfg.pos, size) ? cfg.pos : { x: wa.x + wa.width - size - 24, y: wa.y + wa.height - size - 24 };

  win = new BrowserWindow({
    x: Math.round(pos.x), y: Math.round(pos.y), width: winWidth(), height: size,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: onTop(),
    // Clé du dispositif : cliquer l'icône laisse le focus à l'application cible.
    focusable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  win.setAlwaysOnTop(onTop(), 'floating');
  win.setVisibleOnAllWorkspaces(true);
  win.loadFile(path.join(__dirname, 'index.html'), { query: { size: String(size) } });
  // Page (re)chargée : elle n'a pas encore l'état du bouton de lecture.
  win.webContents.on('did-finish-load', () => { speakKey = ''; pollSpeak(); pushAgents(); });
}

// Seule permission accordée : le micro, pour notre propre page.
function setupPermissions(ses) {
  const isOwn = (url) => typeof url === 'string' && url.startsWith('file://');
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    const types = (details && details.mediaTypes) || [];
    callback(permission === 'media' && isOwn(details && details.requestingUrl)
      && types.length > 0 && types.every((t) => t === 'audio'));
  });
  ses.setPermissionCheckHandler((_wc, permission, origin, details) => (
    permission === 'media' && isOwn(origin) && details && details.mediaType === 'audio'));
}

/* ---- Bulle du texte transcrit ------------------------------------------- */

// La petite bulle au-dessus de l'icône : le texte dicté pour ailleurs (un clic
// le copie), un message de l'appli, le curseur du volume. Les agents ont leur
// panneau (plus bas) ; quand il est ouvert, il occupe cette place et c'est lui
// qui montre ces messages (cf. showBubble).
const BUBBLE_SIZE = { width: 340, maxHeight: 240 };
const BUBBLE_GAP = 6;
const BUBBLE_MS = 10000;         // affichage avant masquage automatique
const BUBBLE_COPIED_MS = 1200;   // le temps de lire « Copié »

let bubble = null;
let bubbleText = '';
let bubbleKind = 'text';         // 'text' : transcription, cliquable ; 'notice' : simple message…
let bubbleH = 80;                // hauteur mesurée par le renderer de la bulle
let bubbleTimer = null;
let recording = false;

// Créée une fois, cachée : la montrer ensuite est instantané.
function createBubble() {
  bubble = new BrowserWindow({
    width: BUBBLE_SIZE.width, height: 80, show: false,
    frame: false, transparent: true, resizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, hasShadow: false, alwaysOnTop: onTop(),
    // Comme l'icône : la cliquer ne vole pas le focus à l'application cible.
    focusable: false,
    webPreferences: { preload: path.join(__dirname, 'bubble-preload.js'), contextIsolation: true, sandbox: true },
  });
  bubble.setAlwaysOnTop(onTop(), 'floating');
  bubble.setVisibleOnAllWorkspaces(true);
  bubble.webContents.on('will-navigate', (e) => e.preventDefault());
  bubble.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  bubble.loadFile(path.join(__dirname, 'bubble.html'));
}

function hideBubble() {
  clearTimeout(bubbleTimer);
  if (bubble && bubble.isVisible()) bubble.hide();
}

function scheduleHide(ms) {
  clearTimeout(bubbleTimer);
  bubbleTimer = setTimeout(hideBubble, ms);
}

// Le texte part au renderer de la bulle, qui mesure sa hauteur et répond
// `bubble:ready` : c'est là qu'on la place et qu'on la montre. Une « notice »
// (le temps d'un enregistrement) ou un « status » (téléchargement…) n'ont rien
// à copier ; `volume` montre le curseur du volume de lecture (`text` est alors
// le volume, 0 à 1). Panneau des conversations ouvert : le message s'y affiche,
// ni par-dessus ni à côté (sauf le volume, demandé au menu).
function showBubble(text, kind = 'text') {
  if (!bubble || !win) return;
  if (conversationShown() && kind !== 'volume') { conversationNotice(text, kind); return; }
  bubbleKind = kind;
  bubbleText = kind === 'text' ? text : '';
  bubble.webContents.send('bubble:show', text, kind, BUBBLE_SIZE);
}

// Au-dessus de l'icône, centrée sur elle ; en dessous si le haut de l'écran
// manque de place ; toujours dans la zone de travail de l'écran de l'icône.
// Rappelée à chaque pas du glisser : la bulle suit l'icône.
function placeBubble() {
  const icon = win.getBounds();
  const a = screen.getDisplayMatching(icon).workArea;
  const { width } = BUBBLE_SIZE;
  let x = icon.x + Math.round(winSize / 2 - width / 2); // centrée sur le micro, pas sur les petits boutons
  x = Math.max(a.x, Math.min(a.x + a.width - width, x));
  let y = icon.y - bubbleH - BUBBLE_GAP;
  if (y < a.y) y = Math.min(icon.y + icon.height + BUBBLE_GAP, a.y + a.height - bubbleH);
  bubble.setBounds({ x, y, width, height: bubbleH });
}

ipcMain.on('bubble:ready', (_e, height) => {
  if (!bubble || !win) return;
  // Notice arrivée après la fin de l'enregistrement : elle n'a plus lieu d'être.
  if (bubbleKind === 'notice' && !recording) return;
  bubbleH = Math.max(40, Math.min(BUBBLE_SIZE.maxHeight, Math.round(Number(height)) || 80));
  placeBubble();
  bubble.showInactive();
  scheduleHide(BUBBLE_MS);
});

// Survolée : on la laisse lire ; quittée : le délai repart.
ipcMain.on('bubble:hover', (_e, inside) => {
  if (!bubble || !bubble.isVisible()) return;
  if (inside) clearTimeout(bubbleTimer); else scheduleHide(BUBBLE_MS);
});

ipcMain.on('bubble:close', hideBubble);

// Curseur du volume : appliqué aussitôt, y compris à une lecture en cours.
ipcMain.on('bubble:volume', (_e, value) => {
  const v = Number(value);
  if (!Number.isFinite(v)) return;
  saveConfig({ speakVolume: Math.max(0, Math.min(1, v)) });
  pollSpeak();
});

ipcMain.handle('bubble:copy', () => {
  if (!bubbleText) return false;
  clipboard.writeText(bubbleText);
  scheduleHide(BUBBLE_COPIED_MS);
  return true;
});

/* ---- IPC : fenêtre ------------------------------------------------------- */

ipcMain.handle('win:getBounds', () => (win ? win.getBounds() : null));
// setBounds et non setPosition : avec une échelle d'affichage fractionnaire
// (1,1 sous KDE…), chaque setPosition arrondit la taille vers le haut et
// l'icône grossit à chaque pas du glisser. On réimpose donc la taille.
ipcMain.on('win:setPosition', (_e, x, y) => {
  if (!win) return;
  win.setBounds({ x: Math.round(x), y: Math.round(y), width: winWidth(), height: winSize });
  if (bubble && bubble.isVisible()) placeBubble();
  if (conversationShown()) placeConversation();
});
ipcMain.on('win:savePosition', (_e, x, y) => saveConfig({ pos: { x: Math.round(x), y: Math.round(y) } }));

// Bouton de lecture montré ou masqué : on élargit ou rétrécit la fenêtre.
function applyWidth() {
  if (!win) return;
  const { x, y } = win.getBounds();
  win.setBounds({ x, y, width: winWidth(), height: winSize });
}

/* ---- IPC : dictée -------------------------------------------------------- */

ipcMain.handle('config:get', () => {
  const { lang, vocabulary, sound, deviceId, deviceLabel } = loadConfig();
  return { lang, vocabulary, sound, deviceId, deviceLabel };
});
// Le micro, retrouvé par son nom quand son identifiant a changé.
ipcMain.on('config:setDevice', (_e, deviceId, deviceLabel) => {
  saveConfig({ deviceId: String(deviceId || ''), deviceLabel: String(deviceLabel || '') });
});

// Appelé quand le micro est ouvert : on prépare le collage.
ipcMain.handle('dictation:warmUp', () => { paste.warmUp(); return true; });

// Les processus de l'appli : leurs flux audio (les bips) ne sont jamais coupés.
const ownPids = () => [process.pid, ...app.getAppMetrics().map((m) => m.pid)];

// Début (dès le seuil de maintien, avant l'ouverture du micro) et fin de
// l'enregistrement. Au début, la bulle de la dictée précédente s'efface ; le
// son des autres applications et le micro Discord sont coupés si c'est
// autorisé, et « Micro Discord coupé » s'affiche une fois la coupure confirmée
// (celle du son s'entend, elle). La fin rétablit toujours : réglage décoché en
// cours de route ou non, rien ne doit rester coupé.
ipcMain.on('dictation:recording', (_e, on) => {
  recording = !!on;
  if (on) {
    const cfg = loadConfig();
    hideBubble(); // le panneau, lui, reste : on y relit la conversation en dictant
    if (cfg.muteOthers === true) mute.mute('others', ownPids());
    if (cfg.discordMute === true) {
      mute.mute('discord').then((n) => { if (n > 0 && recording) showBubble('Micro Discord coupé', 'notice'); });
    }
  } else {
    if (bubbleKind === 'notice') hideBubble();
    if (convNotice && convNotice.kind === 'notice') conversationNotice(null); // elle n'a plus lieu d'être
    mute.restore('others');
    mute.restore('discord');
  }
});

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

// Résout true si le texte a été collé. Collage automatique désactivé (réglage
// `autoPaste`) : aucune touche n'est simulée — sous KDE Wayland, chaque
// injection demande une autorisation —, le texte reste dans le presse-papiers.
async function pasteText(text, autoPaste) {
  if (!autoPaste) {
    clipboard.writeText(text);
    return false;
  }
  const snap = selection.snapshotClipboard();
  clipboard.writeText(text);
  const ok = await paste.sendPaste();
  // Collage raté (outil absent sous Linux…) : le texte RESTE dans le
  // presse-papiers, l'utilisateur le colle à la main.
  if (!ok) return false;
  // L'application cible lit le presse-papiers APRÈS avoir reçu Ctrl+V, et à
  // son rythme : restaurer tout de suite lui ferait coller l'ancien contenu.
  await delay(400);
  selection.restoreClipboard(snap);
  return true;
}

/* ---- Modèle whisper : téléchargé au premier lancement --------------------- */

// Le paquet livre whisper-cli, pas le modèle (548 Mo) : on le télécharge dans
// nos données s'il n'est trouvé nulle part. Bon en français ; ~0,3 s par
// dictée sur GPU, quelques secondes sur processeur.
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-large-v3-turbo-q5_0.bin';
let modelDownload = null; // { percent } pendant le téléchargement

async function ensureModel() {
  if (modelDownload || whisper.locateWhisper(whisperDirs()).model) return;
  const dest = path.join(ownWhisperDir(), path.basename(MODEL_URL));
  const part = `${dest}.part`;
  modelDownload = { percent: 0 };
  showBubble('Téléchargement du modèle de dictée (548 Mo)… Une seule fois.', 'status');
  try {
    const res = await fetch(MODEL_URL);
    if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);
    const total = Number(res.headers.get('content-length')) || 0;
    fs.mkdirSync(ownWhisperDir(), { recursive: true });
    const out = fs.createWriteStream(part);
    let received = 0;
    for await (const chunk of res.body) {
      if (!out.write(chunk)) await new Promise((r) => out.once('drain', r));
      received += chunk.length;
      if (total) modelDownload.percent = Math.floor((received / total) * 100);
    }
    await new Promise((resolve, reject) => out.end((err) => (err ? reject(err) : resolve())));
    fs.renameSync(part, dest);
    showBubble('Modèle de dictée prêt : maintenir l\'icône pour dicter.', 'status');
  } catch (err) {
    console.error(`Téléchargement du modèle whisper : ${err.message}`);
    fs.rmSync(part, { force: true });
    showBubble('Téléchargement du modèle de dictée impossible : il sera retenté au prochain lancement.', 'status');
  } finally {
    modelDownload = null;
  }
}

const MESSAGES = {
  notInstalled: 'whisper.cpp introuvable : placez whisper-cli et un modèle ggml-*.bin dans le dossier whisper (clic droit → Ouvrir le dossier whisper).',
  badAudio: 'Enregistrement trop court ou trop long.',
  timeout: 'La transcription a pris trop de temps.',
  failed: 'La transcription a échoué.',
};

// `pcm` = ArrayBuffer PCM 16 bits mono 16 kHz.
ipcMain.handle('dictation:transcribe', async (_e, pcm) => {
  const cfg = loadConfig();
  let text;
  try {
    const buf = pcm instanceof ArrayBuffer || ArrayBuffer.isView(pcm) ? Buffer.from(pcm.buffer || pcm) : null;
    text = await whisper.transcribe(whisperDirs(), buf, { lang: cfg.lang, prompt: cfg.vocabulary });
  } catch (err) {
    const code = MESSAGES[err && err.message] ? err.message : 'failed';
    if (code === 'notInstalled' && modelDownload) {
      return { ok: false, code, error: `Modèle de dictée en cours de téléchargement (${modelDownload.percent} %).` };
    }
    return { ok: false, code, error: MESSAGES[code] };
  }
  if (!text) return { ok: true, text: '', pasted: false };
  // Un agent est sélectionné : la dictée lui est destinée, rien n'est collé.
  // Elle arrive dans le champ de saisie de son panneau (ouvert au besoin, en
  // réduit), à relire et compléter ; sans relecture, elle part aussitôt.
  const agent = selectedAgent(cfg);
  if (agent && cfg.agentReview !== false) {
    openConversation(agent.id);
    conversationInput(text);
    return { ok: true, text, agent: agent.name, panel: true };
  }
  if (agent) {
    const res = sendToAgent(agent, { text }, cfg);
    if (!res.ok) clipboard.writeText(text);
    return res.ok ? { ok: true, text, agent: agent.name }
      : { ok: false, error: `${res.error} Le message est dans le presse-papiers.` };
  }
  if (cfg.showText !== false) showBubble(text);
  const autoPaste = cfg.autoPaste !== false;
  return { ok: true, text, pasted: await pasteText(text, autoPaste), autoPaste };
});

/* ---- IPC : lecture à voix haute ------------------------------------------ */

// Aucun évènement ne signale un changement de sélection ou de presse-papiers :
// on les relit régulièrement, et le renderer n'est prévenu que d'un changement
// (bouton actif, grisé, masqué).
const SPEAK_POLL_MS = 500;
let speakKey = '';
let speakPolling = false;

async function pollSpeak() {
  if (!win || speakPolling) return;
  speakPolling = true;
  try { await updateSpeakState(); } finally { speakPolling = false; }
}

async function updateSpeakState() {
  const cfg = loadConfig();
  const mode = speakMode(cfg);
  // Réglage changé (menu ou config.json retouché) : bouton montré ou masqué.
  if ((mode !== 'off') !== speakShown) {
    speakShown = mode !== 'off';
    applyWidth();
  }
  let state = { mode };
  if (mode !== 'off') {
    // Pocket TTS absent : prêt s'il peut s'installer au premier clic.
    const ready = tts.isInstalled() || tts.canInstall();
    state = { mode, volume: speakVolume(cfg), ready, hasText: await selection.hasText(mode) };
  }
  const key = JSON.stringify(state);
  if (key === speakKey || !win) return;
  speakKey = key;
  win.webContents.send('tts:state', state);
}

const speakOptions = (cfg) => ({ lang: cfg.speakLang, voices: cfg.speakVoices });

// Installe Pocket TTS (premier usage) en le signalant dans la bulle.
async function installPocket() {
  showBubble('Installation de la lecture à voix haute (~400 Mo à télécharger, une seule fois)… La lecture suivra.', 'status');
  const ok = await tts.install();
  showBubble(ok ? 'Lecture à voix haute installée.'
    : 'Installation de la lecture à voix haute impossible (réseau ?) : elle sera retentée au prochain clic.', 'status');
  pollSpeak();
  return ok;
}

const SPEAK_MESSAGES = {
  notInstalled: 'Pocket TTS introuvable et impossible à installer (uv absent) : voir le README.',
  empty: 'Rien à lire.',
  failed: 'La synthèse vocale a échoué.',
};

// Comme pour le collage, le texte ne vient jamais du renderer : on relit ici
// la sélection (ou le presse-papiers) au moment du clic. L'audio suit par
// morceaux (`tts:chunk`), puis `tts:end` ; le renderer les joue bout à bout.
// `source` : rien, ou { agent: id } pour le résumé audio de sa dernière réponse
// ({ agent: id, index } : celui de la réponse choisie par ▶ dans la fenêtre de
// conversation, retenu ici à ce moment-là, cf. conv:speak).
ipcMain.handle('tts:speak', async (_e, source) => {
  const cfg = loadConfig();
  const mode = speakMode(cfg);
  const agentId = source && typeof source.agent === 'string' ? source.agent : null;
  if (!agentId && mode === 'off') return { ok: false, error: SPEAK_MESSAGES.empty };
  const send = (...args) => { if (win) win.webContents.send(...args); };
  if (!tts.isInstalled() && tts.canInstall() && !(await installPocket())) {
    return { ok: false, error: SPEAK_MESSAGES.failed };
  }
  try {
    const fromThread = agentId && Number.isInteger(source.index) && convSpeech ? { audio: convSpeech } : null;
    const reply = agentId && (fromThread || agents.lastReply(agentId));
    const text = agentId ? (reply && reply.audio) || '' : await selection.readText(mode);
    const id = tts.speak(text, speakOptions(cfg),
      (pcm, rate) => send('tts:chunk', id, pcm, rate),
      (code) => send('tts:end', id, code ? SPEAK_MESSAGES[code] || SPEAK_MESSAGES.failed : null));
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: SPEAK_MESSAGES[err && err.message] || SPEAK_MESSAGES.failed };
  }
});
ipcMain.on('tts:cancel', (_e, id) => tts.cancel(id));
// Survol du bouton : le clic va suivre, on charge le modèle d'avance.
ipcMain.on('tts:warmUp', async () => {
  const cfg = loadConfig();
  const mode = speakMode(cfg);
  if (mode !== 'off' && tts.isInstalled()) {
    tts.warmUp(await selection.peekText(mode), speakOptions(cfg));
  }
});

/* ---- Agents Claude Code --------------------------------------------------- */

// Couleur d'un DOSSIER : tirée au sort quand on le choisit pour la première
// fois, modifiable au clic droit sur son agent. Elle aide à s'y retrouver :
// un dossier garde sa couleur, même si son agent est retiré puis recréé.
// [valeur, nom, pastille pour les menus].
const AGENT_COLORS = [
  ['#8b5cf6', 'Violet', '🟣'], ['#3b82f6', 'Bleu', '🔵'], ['#06b6d4', 'Cyan', '🩵'], ['#22c55e', 'Vert', '🟢'],
  ['#eab308', 'Jaune', '🟡'], ['#f97316', 'Orange', '🟠'], ['#ef4444', 'Rouge', '🔴'], ['#ec4899', 'Rose', '🩷'],
];
const isColor = (c) => AGENT_COLORS.some(([v]) => v === c);
const colorDot = (c) => (AGENT_COLORS.find(([v]) => v === c) || AGENT_COLORS[0])[2];
// De préférence une couleur qu'aucun dossier ne porte.
function randomColor(folders) {
  const used = new Set(folders.map((f) => f.color));
  const free = AGENT_COLORS.map(([c]) => c).filter((c) => !used.has(c));
  const pool = free.length ? free : AGENT_COLORS.map(([c]) => c);
  return pool[Math.floor(Math.random() * pool.length)];
}

const agentList = (cfg) => (Array.isArray(cfg.agents) ? cfg.agents.filter((a) => a && a.id && a.dir) : []);
// Un petit bouton par agent, plus le « + ».
const agentSlotCount = (cfg) => (cfg.agentsEnabled === true ? agentList(cfg).length + 1 : 0);

// Dossiers favoris [{ dir, color }] : ceux déjà choisis, qu'ils aient encore un
// agent ou non. Tolère les anciens formats (chemins seuls, couleur sur l'agent).
function favoriteFolders(cfg) {
  const out = [];
  const add = (dir, color) => {
    if (typeof dir !== 'string' || !dir || out.some((f) => f.dir === dir)) return;
    out.push({ dir, color: isColor(color) ? color : null });
  };
  for (const f of Array.isArray(cfg.agentFolders) ? cfg.agentFolders : []) {
    if (typeof f === 'string') add(f); else if (f) add(f.dir, f.color);
  }
  for (const a of agentList(cfg)) add(a.dir, a.color);
  return out;
}
// Donne une couleur aux dossiers qui n'en ont pas, et l'enregistre : elle ne
// doit pas changer d'un lancement à l'autre.
function ensureFolderColors() {
  const cfg = loadConfig();
  const folders = favoriteFolders(cfg);
  if (folders.every((f) => f.color) && folders.length === (cfg.agentFolders || []).length) return folders;
  for (const f of folders) if (!f.color) f.color = randomColor(folders.filter((o) => o.color));
  saveConfig({ agentFolders: folders });
  return folders;
}
// Un agent porte la couleur de son dossier.
const agentColor = (agent, cfg = loadConfig()) => (
  (favoriteFolders(cfg).find((f) => f.dir === agent.dir) || {}).color || AGENT_COLORS[0][0]);
function selectedAgent(cfg) {
  if (cfg.agentsEnabled !== true || !cfg.agentSelected) return null;
  return agentList(cfg).find((a) => a.id === cfg.agentSelected) || null;
}
function updateAgent(id, patch) {
  saveConfig({ agents: agentList(loadConfig()).map((a) => (a.id === id ? { ...a, ...patch } : a)) });
}

// Mode « conversation » : le panneau des conversations est montré. L'agent
// affiché (sur sa session en cours) y reçoit ses demandes d'autorisation, dans
// le fil, et sa réponse y est lue d'office ; celle d'un autre agent met la
// pastille sur son robot. Panneau masqué ou réduit : retour à la bulle.
const conversationShown = () => !!conv && !conv.isDestroyed() && conv.isVisible();
const inConversation = (id) => conversationShown() && !!convView && convView.agentId === id && !convView.sessionId;
const onScreen = inConversation;

// État des robots pour le renderer, et largeur de la fenêtre.

function pushAgents() {
  if (!win) return;
  const cfg = loadConfig();
  const slots = agentSlotCount(cfg);
  if (slots !== agentSlots) { agentSlots = slots; applyWidth(); }
  const enabled = cfg.agentsEnabled === true;
  for (const a of agentList(cfg)) if (agents.state(a.id).unread && onScreen(a.id)) agents.markRead(a.id); // déjà sous les yeux
  win.webContents.send('agents:state', {
    enabled,
    agents: enabled ? agentList(cfg).map((a) => {
      const st = agents.state(a.id);
      // La pastille du robot, panneau ouvert ou non : celle de l'onglet affiché
      // n'apparaît pas (lue d'office, ci-dessus).
      return { id: a.id, name: a.name, color: agentColor(a, cfg), selected: a.id === cfg.agentSelected, ...st };
    }) : [],
  });
  refreshConversation(); // le panneau des conversations suit (réponse arrivée, agent au travail…)
}

const TOOL_LABELS = {
  Write: 'Écrire le fichier', Edit: 'Modifier le fichier', MultiEdit: 'Modifier le fichier', NotebookEdit: 'Modifier le notebook',
  Read: 'Lire le fichier', Bash: 'Exécuter la commande', WebFetch: 'Consulter la page', WebSearch: 'Chercher sur le web',
};
// Ce sur quoi porte un outil : sa commande, son fichier, son adresse…
const toolTarget = (input) => {
  const i = input || {};
  return i.command ?? i.file_path ?? i.notebook_path ?? i.path ?? i.url ?? i.query ?? i.pattern;
};

// Pour le fil de conversation, après coup : « Écrire le fichier : src/note.txt »
// (une ligne, chemin relatif au dossier de l'agent).
function toolSummary(agent, tool, input) {
  const target = toolTarget(input);
  const detail = target === undefined ? '' : String(target).replace(`${agent.dir}${path.sep}`, '').split('\n')[0].slice(0, 300);
  return `${TOOL_LABELS[tool] || tool}${detail ? ` : ${detail}` : ''}`;
}

// Pour une demande d'autorisation : ce qui va s'exécuter, EN ENTIER et TEL QUEL
// (ni chemin raccourci ni coupure silencieuse : c'est sur ce texte qu'on
// autorise). Outil inconnu : ses paramètres bruts.
const PERMISSION_MAX = 20000;
function permissionText(tool, input) {
  const target = toolTarget(input);
  const detail = target === undefined ? JSON.stringify(input || {}, null, 2) : String(target);
  const cut = detail.length > PERMISSION_MAX
    ? `\n\n… ${detail.length - PERMISSION_MAX} caractères de plus ne sont pas affichés : dans le doute, refusez.` : '';
  return `${TOOL_LABELS[tool] || tool} :\n${detail.slice(0, PERMISSION_MAX)}${cut}`;
}

// La consigne ajoutée au prompt système des agents (le résumé <audio>…</audio>,
// cf. agents.js) : un fichier à retoucher dans son éditeur, relu à chaque
// message. Absent, il est recréé avec la consigne par défaut ; vide, aucune
// consigne (plus de résumé : ▶ lit alors la réponse entière, sans formatage).
const instructionsFile = () => path.join(app.getPath('userData'), 'consigne-agents.md');
function agentInstructions() {
  const file = instructionsFile();
  try { return fs.readFileSync(file, 'utf8').trim(); } catch { /* pas encore créé */ }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${agents.AUDIO_RULES}\n`);
  return agents.AUDIO_RULES;
}

// Journal des agents (cf. agents.js) : pour comprendre après coup un agent
// resté bloqué ou une action qui n'a pas pu être autorisée.
const journalFile = () => path.join(app.getPath('userData'), 'agents.log');

const CLAUDE_MISSING = 'Claude Code introuvable : installez-le, ou réglez la commande de lancement (clic droit → Agents Claude Code).';

const isBusy = (id) => ['working', 'asking'].includes(agents.state(id).status);

// `message` ({ text, images }) part à l'agent ; la réponse arrivera par sa
// pastille. { ok } ou { ok: false, error }.
function sendToAgent(agent, message, cfg) {
  if (isBusy(agent.id)) return { ok: false, error: `${agent.name} travaille encore : message non envoyé.` };
  if (!agents.isAvailable(cfg.agentCommand)) return { ok: false, error: CLAUDE_MISSING };
  agents.send(agent, message, {
    command: cfg.agentCommand,
    instructions: agentInstructions(),
    onChange: pushAgents,
    onSession: (sessionId) => updateAgent(agent.id, { sessionId }),
    onProgress: conversationProgress,
    // La demande s'affiche dans le panneau de l'agent : déjà ouvert sur lui,
    // dans son fil ; rien d'ouvert, le panneau réduit s'ouvre, sans prendre le
    // focus. Sinon (on lit autre chose), le « ? » du robot attend qu'on clique.
    onPermission: () => {
      if (inConversation(agent.id)) { refreshConversation(); return; }
      if (!conversationShown() && !(bubble && bubble.isVisible())) openConversation(agent.id, { focus: false });
    },
  }).catch((err) => console.error(`agent ${agent.name} : ${err && err.message}`));
  return { ok: true };
}

// Un message IPC n'est écouté que s'il vient de la fenêtre qui a le droit de
// l'envoyer : autoriser une action d'un agent est réservé au panneau.
const sentBy = (e, w) => !!w && !w.isDestroyed() && e.sender === w.webContents;

// Clic sur un robot : ce qui l'attend (demande d'autorisation, réponse non
// lue) s'ouvre dans son panneau ; sinon, basculer la sélection.
ipcMain.on('agent:click', (e, id) => {
  if (!sentBy(e, win)) return;
  const cfg = loadConfig();
  const agent = agentList(cfg).find((a) => a.id === id);
  if (!agent) return;
  const st = agents.state(id);
  if (conversationShown()) {
    // Panneau des conversations montré : les robots en sont les onglets —
    // cliquer un robot y affiche sa conversation. Second clic sur le robot
    // affiché et sélectionné : la dictée retourne au curseur, le panneau reste.
    if (cfg.agentSelected === id && convView && convView.agentId === id) { selectAgent(null); pushAgents(); } else openConversation(id);
    return;
  }
  if (st.status === 'asking' || st.unread) { openConversation(id); return; }
  selectAgent(cfg.agentSelected === id ? null : id);
  pushAgents();
});

// L'agent sélectionné : celui qui reçoit la dictée, celui du panneau.
function selectAgent(id) {
  saveConfig({ agentSelected: id });
}

// Lancé par l'appli, Claude Code ne pose pas sa question « Faire confiance à ce
// dossier ? » : on la pose ici, une fois, quand un dossier devient favori. Les
// réglages d'un projet (.claude/) peuvent lancer des commandes (hooks, MCP).
async function trustFolder(dir) {
  if (favoriteFolders(loadConfig()).some((f) => f.dir === dir)) return true;
  const { response } = await dialog.showMessageBox({
    type: 'warning', buttons: ['Annuler', 'Faire confiance et ajouter'], defaultId: 0, cancelId: 0,
    title: 'Nouveau dossier pour un agent',
    message: 'Faire confiance à ce dossier ?',
    detail: `${dir}\n\nClaude Code y sera lancé avec les réglages du projet (dossier .claude : hooks, serveurs MCP, `
      + 'autorisations), qui peuvent exécuter des commandes sur cette machine. N\'ajoutez que des dossiers dont vous connaissez le contenu.',
  });
  return response === 1;
}

function newAgent(dir) {
  const cfg = loadConfig();
  const list = agentList(cfg);
  let agent = list.find((a) => a.dir === dir); // un seul agent par dossier
  if (!agent) {
    agent = { id: `a${Date.now().toString(36)}`, dir, name: path.basename(dir) || dir, model: '', effort: '', mode: 'default', sessionId: null };
    saveConfig({ agents: [...list, agent] });
  }
  saveConfig({ agentSelected: agent.id });
  ensureFolderColors(); // nouveau dossier : il reçoit sa couleur et devient favori
  pushAgents();
}

// Bouton « + » : un nouvel agent, dans un dossier favori (déjà choisi, sans
// agent pour l'instant) ou dans un dossier à choisir, qui devient favori.
ipcMain.on('agent:add', (e) => {
  if (!sentBy(e, win)) return;
  const cfg = loadConfig();
  const available = agents.isAvailable(cfg.agentCommand);
  const inUse = new Set(agentList(cfg).map((a) => a.dir));
  const free = ensureFolderColors().filter((f) => !inUse.has(f.dir));
  const home = app.getPath('home');
  const short = (d) => (d.startsWith(`${home}${path.sep}`) ? `~${d.slice(home.length)}` : d);
  Menu.buildFromTemplate([
    { label: free.length ? 'Nouvel agent dans un dossier favori' : 'Aucun dossier favori disponible', enabled: false },
    ...free.map((f) => ({
      label: `${colorDot(f.color)} ${path.basename(f.dir)}  —  ${short(f.dir)}`, enabled: available, click: () => newAgent(f.dir),
    })),
    { type: 'separator' },
    { label: 'Choisir un autre dossier…', enabled: available,
      click: async () => {
        const res = await dialog.showOpenDialog({ title: 'Dossier de travail de l\'agent', properties: ['openDirectory'] });
        if (!res.canceled && res.filePaths[0] && await trustFolder(res.filePaths[0])) newAgent(res.filePaths[0]);
      } },
    ...(free.length ? [{
      label: 'Oublier un dossier favori',
      submenu: free.map((f) => ({
        label: `${colorDot(f.color)} ${short(f.dir)}`,
        click: () => saveConfig({ agentFolders: favoriteFolders(loadConfig()).filter((o) => o.dir !== f.dir) }),
      })),
    }] : []),
    ...(available ? [] : [{ type: 'separator' }, { label: CLAUDE_MISSING, enabled: false }]),
  ]).popup({ window: win });
});

/* ---- Panneau des conversations -------------------------------------------- */

// La conversation d'un agent, dans un panneau ATTACHÉ À L'ICÔNE, à la place
// de la bulle — sans cadre, au-dessus des autres fenêtres (réglage `onTop`), il
// suit l'icône quand on la déplace. Deux tailles :
//   - réduit (⤡) : le dernier échange (votre message, sa réponse), à la taille
//     de son contenu — ce qu'était la bulle d'un agent ;
//   - agrandi (⤢) : tout le fil, l'historique ; redimensionnable par ses bords,
//     taille retenue (`convSize`).
// Dans les deux, en bas, le champ de saisie : la dictée vers l'agent y arrive
// (plus de fenêtre de relecture à part), pièces jointes comprises.
//
// Il prend le focus (on y écrit) : le gestionnaire de fenêtres le gère, et le
// range sur un bureau virtuel (sous KDE, Alt+F3 → Sur tous les bureaux). Sa
// croix le RÉDUIT (au sens du système) au lieu de le masquer : une fenêtre
// masquée revient sur le bureau courant en oubliant ce réglage, une fenêtre
// réduite le garde.
//
// Une conversation à la fois : celle du robot sélectionné — les robots servent
// d'onglets. Depuis l'historique de son dossier, une ancienne conversation s'y
// lit, et peut se reprendre. Ouvert, il remplace la bulle : notifications,
// demandes d'autorisation, dictée de cet agent, et même le texte dicté pour
// ailleurs (cf. showBubble), passent par lui.
const CONV_SIZE = { width: 720, height: 700 };    // agrandi, par défaut
const CONV_MIN = { width: 380, height: 300 };
const COMPACT = { width: 560, minHeight: 160, maxHeight: 560 };
let conv = null;
let convReady = false;  // la page a reçu sa première conversation
let convMode = 'compact';
let convCompactH = 260; // hauteur du réduit, mesurée par la page
let convPlaced = null;  // dernières dimensions posées par placeConversation
let convResizeTimer = null;
let convView = null;    // { agentId, sessionId } ; sessionId null : la session en cours de l'agent
let convThread = [];    // fil affiché
let convSpeech = '';    // résumé audio de la réponse choisie par ▶ (cf. tts:speak)
let convSeq = 0;        // rafraîchissements qui se chevauchent : seul le dernier s'affiche
let convInput = '';     // dictée arrivée avant que la page soit prête
let convFocusInput = false;
let convNotice = null;  // { kind, text } : message montré en tête du panneau (cf. showBubble)

const viewAgent = (cfg = loadConfig()) => convView && agentList(cfg).find((a) => a.id === convView.agentId);

// Ouvre la conversation de l'agent : sa session en cours (ou une ancienne, en
// agrandi). `mode` : la taille ; par défaut, celle du panneau s'il est déjà
// ouvert, sinon le réduit. `focus` : false pour une ouverture que l'utilisateur
// n'a pas demandée (une demande d'autorisation) — elle ne lui vole pas le
// clavier.
function openConversation(agentId, { sessionId = null, mode = null, focus = true } = {}) {
  const agent = agentList(loadConfig()).find((a) => a.id === agentId);
  if (!agent) return;
  selectAgent(agentId); // le robot affiché et le robot sélectionné vont ensemble
  const old = sessionId && sessionId !== agent.sessionId ? sessionId : null;
  convView = { agentId, sessionId: old };
  convMode = old ? 'full' : mode || (conversationShown() ? convMode : 'compact');
  hideBubble(); // le panneau prend sa place
  if (!conv) { createConversation(focus); return; }
  conv.setResizable(convMode === 'full');
  placeConversation();
  if (conv.isMinimized()) conv.restore();
  if (!conv.isVisible()) { if (focus) conv.show(); else conv.showInactive(); }
  if (focus) conv.focus();
  pushAgents(); // lu d'office, panneau à jour
}

function createConversation(focus) {
  convReady = false;
  conv = new BrowserWindow({
    width: COMPACT.width, height: convCompactH, minWidth: CONV_MIN.width, minHeight: COMPACT.minHeight, show: false,
    frame: false, resizable: convMode === 'full', maximizable: false, fullscreenable: false, skipTaskbar: true,
    alwaysOnTop: onTop(), backgroundColor: '#171b24', title: 'Whisper — conversation',
    webPreferences: { preload: path.join(__dirname, 'conversation-preload.js'), contextIsolation: true, sandbox: true },
  });
  conv.setAlwaysOnTop(onTop(), 'floating');
  conv.setVisibleOnAllWorkspaces(true);
  // Les liens passent par conv:openLink : la fenêtre ne navigue jamais ailleurs.
  conv.webContents.on('will-navigate', (e) => e.preventDefault());
  conv.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  conv.loadFile(path.join(__dirname, 'conversation.html'));
  conv.once('ready-to-show', () => {
    if (!conv) return;
    placeConversation();
    if (focus) { conv.show(); conv.focus(); } else conv.showInactive();
  });
  conv.on('closed', () => { conv = null; convView = null; convThread = []; convReady = false; });
  conv.on('focus', pushAgents); // la conversation affichée est lue
  // Agrandi et redimensionné à la main (pas par placeConversation) : la taille
  // est retenue, puis le panneau se recale contre l'icône.
  conv.on('resize', () => {
    clearTimeout(convResizeTimer);
    convResizeTimer = setTimeout(() => {
      if (!conv || !conv.isVisible() || !convPlaced || convMode !== 'full') return;
      const { width, height } = conv.getBounds();
      if (Math.abs(width - convPlaced.width) < 3 && Math.abs(height - convPlaced.height) < 3) return;
      saveConfig({ convSize: { width, height } });
      placeConversation();
    }, 400);
  });
}

// Contre l'icône, centré sur le micro : au-dessus, ou en dessous s'il y a plus
// de place ; la hauteur se plie à la place disponible, tout reste à l'écran.
// Rappelé à chaque pas du glisser de l'icône : le panneau la suit.
function placeConversation() {
  if (!conv || !win) return;
  const icon = win.getBounds();
  const a = screen.getDisplayMatching(icon).workArea;
  const saved = loadConfig().convSize;
  const full = saved && Number.isFinite(saved.width) && Number.isFinite(saved.height) ? saved : CONV_SIZE;
  const size = convMode === 'full' ? full : { width: COMPACT.width, height: convCompactH };
  const above = icon.y - BUBBLE_GAP - a.y;
  const below = a.y + a.height - (icon.y + icon.height + BUBBLE_GAP);
  const width = Math.max(CONV_MIN.width, Math.min(size.width, a.width));
  const height = Math.max(COMPACT.minHeight, Math.min(size.height, Math.max(above, below)));
  const x = Math.max(a.x, Math.min(a.x + a.width - width, icon.x + Math.round(winSize / 2 - width / 2)));
  const y = above >= below ? icon.y - BUBBLE_GAP - height : icon.y + icon.height + BUBBLE_GAP;
  convPlaced = { x, y: Math.max(a.y, Math.min(a.y + a.height - height, y)), width, height };
  conv.setBounds(convPlaced);
}

// La croix du panneau : réduit au sens du système (cf. plus haut), ses
// notifications repassent par les robots.
function hideConversation() {
  if (!conversationShown()) return;
  conv.minimize();
  pushAgents();
}
ipcMain.on('conv:hide', (e) => { if (sentBy(e, conv)) hideConversation(); });

// ⤢ / ⤡ : agrandi (tout le fil) ou réduit (le dernier échange). Réduire une
// ancienne conversation ramène à celle en cours.
ipcMain.on('conv:mode', (e, mode) => {
  if (!sentBy(e, conv) || !convView || !['compact', 'full'].includes(mode)) return;
  openConversation(convView.agentId, { sessionId: mode === 'full' ? convView.sessionId : null, mode });
});

// Réduit : la page dit la hauteur de son contenu, le panneau s'y ajuste.
ipcMain.on('conv:height', (e, height) => {
  const h = Math.round(Number(height));
  if (!sentBy(e, conv) || !Number.isFinite(h)) return;
  convCompactH = Math.max(COMPACT.minHeight, Math.min(COMPACT.maxHeight, h));
  if (convMode === 'compact' && conversationShown()) placeConversation();
});

// La dictée vers l'agent du panneau : dans son champ de saisie (gardée si la
// page n'est pas encore prête).
function conversationInput(text) {
  if (conv && convReady) conv.webContents.send('conv:dictation', text);
  else convInput += `${convInput ? ' ' : ''}${text}`;
}
function conversationFocusInput() {
  if (conv && convReady) conv.webContents.send('conv:focusInput'); else convFocusInput = true;
}

// Message montré en tête du panneau, à la place de la bulle : le texte dicté
// pour ailleurs (à copier), un message de l'appli ; null l'efface.
function conversationNotice(text, kind = 'text') {
  convNotice = text === null ? null : { kind, text: kind === 'text' ? text : String(text) };
  if (conv && convReady) conv.webContents.send('conv:notice', convNotice);
}
ipcMain.handle('conv:copyNotice', (e) => {
  if (!sentBy(e, conv) || !convNotice || convNotice.kind !== 'text') return false;
  clipboard.writeText(convNotice.text);
  return true;
});

// Relit la conversation affichée et l'envoie au panneau (à son ouverture, puis
// à chaque changement d'état d'un agent).
async function refreshConversation() {
  if (!conv) return;
  const seq = ++convSeq;
  const cfg = loadConfig();
  const agent = viewAgent(cfg);
  if (!agent) { hideConversation(); return; } // agent retiré
  const view = { ...convView };
  const sid = view.sessionId || agent.sessionId;
  const st = agents.state(agent.id);
  const [title, thread] = await Promise.all([sid ? agents.sessionTitle(agent, sid) : '', agents.thread(agent, sid)]);
  if (!conv || seq !== convSeq) return;
  convThread = thread;
  conv.webContents.send('conv:thread', {
    mode: convMode, key: view.sessionId ? `${agent.id}:${view.sessionId}` : agent.id, live: !view.sessionId,
    name: agent.name, color: agentColor(agent, cfg), dir: agent.dir, title, status: st.status, since: st.since,
    // La demande d'autorisation de l'agent, à valider dans le fil.
    permission: !view.sessionId && inConversation(agent.id) ? conversationPermission(agent) : null,
    messages: thread.map((m) => {
      const { text, selection: context, files } = m.role === 'user' ? splitComposed(m.text) : { text: m.text, selection: '', files: [] };
      return {
        role: m.role, text, context, files, time: m.time || null, audio: !!m.audio,
        images: (m.images || []).map(thumbnail).filter(Boolean),
        tools: (m.tools || []).map((t) => toolSummary(agent, t.tool, t.input)),
      };
    }),
  });
}

// Pendant un tour, le fil suit l'agent (texte, outils) : au plus un
// rafraîchissement par CONV_PROGRESS_MS, la transcription étant relue en entier.
const CONV_PROGRESS_MS = 800;
let convProgressTimer = null;
function conversationProgress() {
  if (!conv || convProgressTimer) return;
  convProgressTimer = setTimeout(() => { convProgressTimer = null; refreshConversation(); }, CONV_PROGRESS_MS);
}

// Aperçu d'une image d'un message (envoyée en base64 dans la transcription) :
// une data URL réduite à THUMB_SIDE, gardée en cache — le fil est renvoyé à
// chaque changement. null si illisible.
const THUMB_SIDE = 800;
const thumbs = new Map();
function thumbnail(src) {
  if (!src || typeof src.data !== 'string') return null;
  const key = crypto.createHash('sha1').update(src.data).digest('hex');
  if (!thumbs.has(key)) {
    if (thumbs.size > 200) thumbs.clear();
    const buf = Buffer.from(src.data, 'base64');
    const image = nativeImage.createFromBuffer(buf);
    let url = null;
    if (!image.isEmpty()) {
      const { width, height } = image.getSize();
      const scale = Math.min(1, THUMB_SIDE / Math.max(width, height));
      const out = scale < 1 ? image.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'good' }) : image;
      const png = out.toPNG(); // une capture d'écran : en PNG, net ; trop lourde, en JPEG
      url = png.length < 300 * 1024 ? `data:image/png;base64,${png.toString('base64')}`
        : `data:image/jpeg;base64,${out.toJPEG(85).toString('base64')}`;
    } else if (buf.length < 2 * 1024 * 1024 && /^image\/(gif|webp)$/.test(src.media_type)) {
      url = `data:${src.media_type};base64,${src.data}`; // GIF, WebP : tels quels, s'ils sont légers
    }
    thumbs.set(key, url);
  }
  return thumbs.get(key);
}

// Un lien d'un message s'ouvre dans le navigateur — et seulement une adresse web.
function openLink(url) {
  try {
    const u = new URL(String(url));
    if (u.protocol === 'https:' || u.protocol === 'http:') shell.openExternal(u.href);
  } catch { /* pas une adresse */ }
}

// La page est prête : sa conversation, puis ce qui l'attendait (dictée, focus
// du champ, message).
ipcMain.on('conv:ready', async (e) => {
  if (!sentBy(e, conv)) return;
  await refreshConversation();
  convReady = true;
  if (convInput) { conv.webContents.send('conv:dictation', convInput); convInput = ''; }
  if (convFocusInput) { conv.webContents.send('conv:focusInput'); convFocusInput = false; }
  if (convNotice) conv.webContents.send('conv:notice', convNotice);
});
ipcMain.on('conv:openLink', (e, url) => { if (sentBy(e, conv)) openLink(url); });
// Fichier joint à un message : montré dans le gestionnaire de fichiers, jamais
// ouvert (un script se lancerait).
ipcMain.on('conv:showFile', (e, file) => {
  if (sentBy(e, conv) && typeof file === 'string' && path.isAbsolute(file) && fs.existsSync(file)) shell.showItemInFolder(file);
});

// La session en cours de l'agent affiché : l'agent, s'il est dans le panneau sur
// elle (pas sur une ancienne conversation), sinon null.
const liveViewAgent = (cfg) => (convView && !convView.sessionId ? viewAgent(cfg) : null);

// Champ de saisie : un message à l'agent affiché (sa session en cours).
// `draft` : { text, images: [{ name, type, data }], files: [chemin], selection }
// — les pièces jointes du champ (glissées, collées, ou choisies par 📎).
ipcMain.handle('conv:send', (e, draft) => {
  const cfg = loadConfig();
  const agent = sentBy(e, conv) && liveViewAgent(cfg);
  if (!agent) return { ok: false, error: 'Ancienne conversation : reprenez-la pour lui écrire.' };
  const d = draft && typeof draft === 'object' ? draft : {};
  const ready = prepareDraft({ ...d, selection: typeof d.selection === 'string' ? d.selection.slice(0, SELECTION_MAX) : '' });
  return ready.error ? { ok: false, error: ready.error } : sendToAgent(agent, ready.message, cfg);
});

// 📎 du champ : choisir des images ou fichiers, ou joindre le texte sélectionné
// (relu à ce moment, montré dans le menu). Le choix revient par conv:attached.
ipcMain.on('conv:attach', async (e) => {
  if (!sentBy(e, conv)) return;
  const sel = canAttachSelection ? await readSelection() : null;
  const preview = sel && sel.text ? sel.text.replace(/\s+/g, ' ').slice(0, 60) : '';
  Menu.buildFromTemplate([
    { label: 'Images ou fichiers…', click: async () => {
      const res = await dialog.showOpenDialog(conv, { title: 'Joindre au message', properties: ['openFile', 'multiSelections'] });
      if (!res.canceled && conv) conv.webContents.send('conv:attached', { files: res.filePaths });
    } },
    ...(sel ? [{
      label: sel.text ? `Texte sélectionné (${sel.text.length.toLocaleString('fr-FR')} car.) : « ${preview}${sel.text.length > 60 ? '…' : ''} »`
        : 'Aucun texte sélectionné', enabled: !!sel.text,
      click: () => { if (conv) conv.webContents.send('conv:attached', { selection: sel }); },
    }] : []),
  ]).popup({ window: conv });
});

// La demande en tête de file, comme dans la bulle : { key, title, text, always }.
function conversationPermission(agent) {
  const p = agents.pendingPermission(agent.id);
  if (!p) return null;
  return {
    key: p.key, text: permissionText(p.tool, p.input), always: p.always,
    title: `${agent.name} demande l'autorisation${p.waiting ? ` (${p.waiting} autre${p.waiting > 1 ? 's' : ''} en attente)` : ''}`,
  };
}

// Réponse à une demande affichée dans le fil : seulement pour l'agent affiché,
// et seulement à la demande que l'utilisateur a sous les yeux (`key`).
ipcMain.on('conv:answer', (e, decision, key) => {
  const agent = sentBy(e, conv) && liveViewAgent();
  if (!agent || !['allow', 'always', 'deny'].includes(decision) || !Number.isInteger(key)) return;
  agents.answer(agent.id, decision, key);
  pushAgents();
});

// ▶ d'une réponse : son résumé audio, par le lecteur de l'icône.
ipcMain.on('conv:speak', (e, index) => {
  const agent = sentBy(e, conv) && viewAgent();
  if (!agent || !win || !convThread[index] || !convThread[index].audio) return;
  convSpeech = convThread[index].audio;
  win.webContents.send('tts:speakAgent', agent.id, index);
});

// Historique du dossier de l'agent affiché : [{ sessionId, title,
// lastModified, current (la session en cours de l'agent) }].
ipcMain.handle('conv:history', async (e) => {
  const agent = sentBy(e, conv) && viewAgent();
  if (!agent) return [];
  return (await agents.sessions(agent)).map((s) => ({ ...s, current: s.sessionId === agent.sessionId }));
});

// Ouvrir une session de l'historique : seulement une session de CE dossier.
ipcMain.on('conv:open', async (e, sessionId) => {
  const agent = sentBy(e, conv) && viewAgent();
  if (!agent || !(await agents.sessions(agent)).some((s) => s.sessionId === sessionId)) return;
  openConversation(agent.id, { sessionId, mode: 'full' });
});

// Ancienne conversation affichée : revenir à la conversation en cours…
ipcMain.on('conv:current', (e) => {
  const agent = sentBy(e, conv) && viewAgent();
  if (agent) openConversation(agent.id, { mode: 'full' });
});

// … ou la reprendre : elle redevient la session en cours de l'agent (la
// précédente reste dans l'historique).
ipcMain.on('conv:resume', (e) => {
  const agent = sentBy(e, conv) && viewAgent();
  if (!agent || !convView.sessionId || isBusy(agent.id)) return;
  updateAgent(agent.id, { sessionId: convView.sessionId });
  agents.forgetReply(agent.id); // sa « dernière réponse » était celle de l'autre session
  openConversation(agent.id, { mode: 'full' });
});

/* ---- Pièces jointes (champ du panneau) ------------------------------------ */

// Le contexte joint à un message : images (envoyées à Claude, réduites si
// besoin), autres fichiers (par leur chemin : l'agent les lit lui-même), texte
// sélectionné. Pas de sélection sous Windows : la lire y demande un Ctrl+C
// simulé dans l'application au premier plan — dans un terminal, il
// interromprait le programme. Le presse-papiers, lui, se colle dans le champ.
const canAttachSelection = process.platform === 'linux';
const SELECTION_MAX = 100000;          // caractères ; au-delà, coupée
const FILES_MAX = 50;
const IMAGES_MAX = 20;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']; // acceptés par Claude
const IMAGE_SIDE = 1568;               // au-delà, Claude la réduirait lui-même : autant envoyer moins
const IMAGE_BYTES = 3.75 * 1024 * 1024; // ~5 Mo une fois en base64 : la limite par image

async function readSelection() {
  if (!canAttachSelection) return { text: '', cut: false };
  const text = (await selection.readText('selection')).trim();
  return { text: text.slice(0, SELECTION_MAX), cut: text.length > SELECTION_MAX };
}

// Image collée ou déposée → { mediaType, data (base64) } pour Claude, ou null.
// Trop grande (côté ou poids) ou d'un format refusé : réduite et réencodée.
function prepareImage(img) {
  const raw = img && img.data;
  const buf = Buffer.isBuffer(raw) ? raw : raw instanceof ArrayBuffer ? Buffer.from(raw)
    : ArrayBuffer.isView(raw) ? Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength) : null;
  if (!buf || !buf.length || buf.length > 50 * 1024 * 1024) return null;
  const type = String(img.type || '');
  const keep = IMAGE_TYPES.includes(type) && buf.length <= IMAGE_BYTES;
  const image = nativeImage.createFromBuffer(buf);
  // Illisible ici : GIF et WebP (qu'Electron ne décode pas) passent tels quels ; un PNG ou un JPEG est abîmé.
  if (image.isEmpty()) return keep && ['image/gif', 'image/webp'].includes(type) ? { mediaType: type, data: buf.toString('base64') } : null;
  const { width, height } = image.getSize();
  const scale = Math.min(1, IMAGE_SIDE / Math.max(width, height));
  if (scale === 1 && keep) return { mediaType: type, data: buf.toString('base64') };
  const out = scale < 1 ? image.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'best' }) : image;
  const png = out.toPNG(); // net pour une capture d'écran ; en JPEG si trop lourd
  return png.length <= IMAGE_BYTES ? { mediaType: 'image/png', data: png.toString('base64') }
    : { mediaType: 'image/jpeg', data: out.toJPEG(85).toString('base64') };
}

// Le texte écrit, suivi du contexte : la sélection (balisée, pour que l'agent
// la distingue de la demande), les chemins des fichiers joints.
const SELECTION_HEAD = 'Texte sélectionné, joint comme contexte :\n<selection>\n';
const SELECTION_END = '\n</selection>';
const FILES_HEAD = 'Fichiers joints (chemins sur cette machine) :\n';
const composeMessage = (text, selected, files) => [
  text,
  selected && `${SELECTION_HEAD}${selected}${SELECTION_END}`,
  files.length && `${FILES_HEAD}${files.map((f) => `- ${f}`).join('\n')}`,
].filter(Boolean).join('\n\n');

// L'inverse, pour le panneau des conversations : { text, selection, files }. Un
// bloc n'est reconnu qu'à sa place (à la fin, après une ligne vide).
function splitComposed(message) {
  let text = String(message || '');
  const at = (i) => i >= 0 && (i === 0 || text.slice(i - 2, i) === '\n\n');
  let files = [];
  const fi = text.lastIndexOf(FILES_HEAD);
  const lines = fi >= 0 ? text.slice(fi + FILES_HEAD.length).split('\n') : [];
  if (at(fi) && lines.every((l) => l.startsWith('- '))) {
    files = lines.map((l) => l.slice(2));
    text = text.slice(0, fi).trimEnd();
  }
  let selection = '';
  const si = text.indexOf(SELECTION_HEAD);
  if (at(si) && text.endsWith(SELECTION_END)) {
    selection = text.slice(si + SELECTION_HEAD.length, -SELECTION_END.length);
    text = text.slice(0, si).trimEnd();
  }
  return { text, selection, files };
}

// Un brouillon (le champ du panneau) → { message: { text, images } } ou
// { error }. Une image désignée par son chemin (📎 du panneau) part en image ;
// les autres fichiers, par leur chemin.
const IMAGE_FILE = /\.(png|jpe?g|gif|webp)$/i;
const IMAGE_MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
function prepareDraft({ text = '', images = [], files = [], selection = '' }) {
  const paths = (Array.isArray(files) ? files : []).filter((f) => typeof f === 'string' && path.isAbsolute(f));
  const list = Array.isArray(images) ? [...images] : [];
  const others = [];
  for (const f of paths) {
    if (!IMAGE_FILE.test(f)) { others.push(f); continue; }
    try {
      if (fs.statSync(f).size > 50 * 1024 * 1024) return { error: `Image trop lourde : ${path.basename(f)}.` };
      list.push({ name: path.basename(f), type: IMAGE_MIME[path.extname(f).slice(1).toLowerCase()], data: fs.readFileSync(f) });
    } catch { return { error: `Image introuvable : ${path.basename(f)}.` }; }
  }
  if (others.length > FILES_MAX || list.length > IMAGES_MAX) {
    return { error: `Trop de pièces jointes (${IMAGES_MAX} images et ${FILES_MAX} fichiers au plus).` };
  }
  const ready = [];
  for (const img of list) {
    const one = prepareImage(img);
    if (!one) return { error: `Image illisible ou trop lourde : ${String((img && img.name) || 'image')}.` };
    ready.push(one);
  }
  const message = composeMessage(typeof text === 'string' ? text.trim() : '', selection || '', others);
  if (!message && !ready.length) return { error: 'Message vide.' };
  return { message: { text: message, images: ready } };
}

// Clic droit sur un robot : ses réglages, comme dans les autres intégrations.
ipcMain.on('agent:menu', (e, id) => {
  if (!sentBy(e, win)) return;
  const agent = agentList(loadConfig()).find((a) => a.id === id);
  if (!agent) return;
  const st = agents.state(id);
  const busy = isBusy(id);
  const radio = (key, options) => options.map(([value, label]) => ({
    label, type: 'radio', checked: (agent[key] || options[0][0]) === value,
    click: () => {
      updateAgent(id, { [key]: value });
      // Agent au travail : le tour en cours suit le nouveau réglage.
      if (key === 'mode') agents.setMode(id, value);
      if (key === 'model') agents.setModel(id, value);
    },
  }));
  Menu.buildFromTemplate([
    { label: agent.name, enabled: false },
    { label: agent.dir, enabled: false },
    { type: 'separator' },
    // Sans parler (micro indisponible, lieu calme) : le champ de son panneau.
    { label: '✎ Écrire un message…', click: () => { openConversation(agent.id); conversationFocusInput(); } },
    { type: 'separator' },
    { label: 'Couleur du dossier', submenu: AGENT_COLORS.map(([value, label, dot]) => ({
      label: `${dot} ${label}`, type: 'radio', checked: agentColor(agent) === value,
      click: () => {
        saveConfig({ agentFolders: ensureFolderColors().map((f) => (f.dir === agent.dir ? { ...f, color: value } : f)) });
        pushAgents();
      },
    })) },
    { label: 'Modèle', submenu: radio('model', agents.MODELS) },
    { label: 'Effort', submenu: radio('effort', agents.EFFORTS) },
    { label: 'Mode', submenu: radio('mode', agents.MODES) },
    { type: 'separator' },
    { label: 'Dernier échange', enabled: st.hasReply || !!agent.sessionId, click: () => openConversation(id, { mode: 'compact' }) },
    { label: '⤢ Conversation complète (et historique)', click: () => openConversation(id, { mode: 'full' }) },
    { label: 'Interrompre', enabled: busy, click: () => { agents.interrupt(id); pushAgents(); } },
    { label: 'Nouvelle session (effacer le contexte)', click: () => {
      agents.forget(id);
      updateAgent(id, { sessionId: null });
      pushAgents(); // le panneau des conversations, s'il est ouvert, se vide
    } },
    { type: 'separator' },
    { label: 'Retirer cet agent', click: () => {
      agents.forget(id);
      const cfg = loadConfig();
      saveConfig({
        agents: agentList(cfg).filter((a) => a.id !== id),
        agentSelected: cfg.agentSelected === id ? null : cfg.agentSelected,
        agentFolders: ensureFolderColors(), // son dossier reste proposé par « + », avec sa couleur
      });
      pushAgents(); // son panneau, s'il est ouvert, se ferme (cf. refreshConversation)
    } },
  ]).popup({ window: win });
});

/* ---- Menu du clic droit -------------------------------------------------- */

// Langues de lecture (cf. tts.LANGS), dans l'ordre du menu.
const SPEAK_LANGS = {
  fr: { lang: 'Français', voice: 'Voix française' },
  en: { lang: 'Anglais', voice: 'Voix anglaise' },
};
const GENDER = { f: 'femme', m: 'homme' };

const RELEASES_URL = 'https://github.com/GearProductions/whisper/releases';

// `devices` = micros énumérés par le renderer (seul à y avoir accès).
ipcMain.on('menu:open', async (_e, devices) => {
  if (!win) return;
  const cfg = loadConfig();
  const mics = Array.isArray(devices) ? devices.filter((d) => d && typeof d.deviceId === 'string') : [];
  const { cli, model } = whisper.locateWhisper(whisperDirs());
  const speak = speakMode(cfg);
  const setSpeak = (value) => { saveConfig({ speak: value }); pollSpeak(); };
  const template = [
    { label: modelDownload ? `Modèle : téléchargement ${modelDownload.percent} %`
      : cli && model ? `Modèle : ${path.basename(model)}` : 'whisper.cpp non installé', enabled: false },
    { type: 'separator' },
    {
      label: 'Langue',
      submenu: Object.entries(LANGS).map(([code, label]) => ({
        label, type: 'radio', checked: cfg.lang === code, click: () => saveConfig({ lang: code }),
      })),
    },
    {
      label: 'Micro',
      submenu: [
        { label: 'Micro par défaut du système', type: 'radio', checked: !cfg.deviceId,
          click: () => saveConfig({ deviceId: '', deviceLabel: '' }) },
        ...mics.map((d) => ({
          label: String(d.label || 'Micro sans nom').slice(0, 100), type: 'radio', checked: cfg.deviceId === d.deviceId,
          click: () => saveConfig({ deviceId: d.deviceId, deviceLabel: String(d.label || '') }),
        })),
      ],
    },
    { label: 'Bip de début / fin', type: 'checkbox', checked: cfg.sound !== false, click: (i) => saveConfig({ sound: i.checked }) },
    ...(process.platform === 'linux' || process.platform === 'win32' ? [
      { label: 'Couper le son des autres applications pendant la dictée', type: 'checkbox', checked: cfg.muteOthers === true,
        click: (i) => saveConfig({ muteOthers: i.checked }) },
    ] : []),
    { label: 'Coller automatiquement là où est le curseur', type: 'checkbox', checked: cfg.autoPaste !== false,
      click: (i) => saveConfig({ autoPaste: i.checked }) },
    { label: 'Toujours au premier plan (icône, bulles, conversations)', type: 'checkbox', checked: cfg.onTop !== false,
      click: (i) => { saveConfig({ onTop: i.checked }); applyOnTop(); } },
    { label: 'Afficher le texte transcrit', type: 'checkbox', checked: cfg.showText !== false,
      click: (i) => { saveConfig({ showText: i.checked }); if (!i.checked) hideBubble(); } },
    ...(process.platform === 'linux' || process.platform === 'win32' ? [
      { label: 'Autoriser la coupure du micro Discord', type: 'checkbox', checked: cfg.discordMute === true,
        click: (i) => saveConfig({ discordMute: i.checked }) },
    ] : []),
    {
      label: 'Lecture à voix haute',
      submenu: [
        ...(!tts.isInstalled() ? [
          tts.canInstall()
            ? { label: 'Installer Pocket TTS (~400 Mo)', click: () => { installPocket(); } }
            : { label: 'Pocket TTS non installé', enabled: false },
          { type: 'separator' },
        ] : []),
        ...(canReadSelection ? [
          { label: 'Texte sélectionné', type: 'radio', checked: speak === 'selection', click: () => setSpeak('selection') },
        ] : []),
        { label: 'Presse-papiers', type: 'radio', checked: speak === 'clipboard', click: () => setSpeak('clipboard') },
        { label: 'Désactivée', type: 'radio', checked: speak === 'off', click: () => setSpeak('off') },
        { type: 'separator' },
        {
          label: 'Langue du texte',
          submenu: ['auto', ...Object.keys(SPEAK_LANGS)].map((l) => ({
            label: l === 'auto' ? 'Détection automatique' : SPEAK_LANGS[l].lang, type: 'radio',
            checked: (SPEAK_LANGS[cfg.speakLang] ? cfg.speakLang : 'auto') === l, click: () => saveConfig({ speakLang: l }),
          })),
        },
        // « Estelle · femme »
        ...Object.keys(SPEAK_LANGS).map((l) => ({
          label: SPEAK_LANGS[l].voice,
          submenu: tts.LANGS[l].voices.map((v) => ({
            label: `${v.label} · ${GENDER[v.gender]}`, type: 'radio', checked: tts.pickVoice(l, cfg.speakVoices) === v,
            click: () => saveConfig({ speakVoices: { ...loadConfig().speakVoices, [l]: v.id } }),
          })),
        })),
        { type: 'separator' },
        { label: `Volume : ${Math.round(speakVolume(cfg) * 100)} %…`, click: () => showBubble(speakVolume(cfg), 'volume') },
      ],
    },
    {
      label: 'Agents Claude Code',
      submenu: [
        { label: 'Afficher les agents', type: 'checkbox', checked: cfg.agentsEnabled === true,
          click: (i) => { saveConfig({ agentsEnabled: i.checked }); pushAgents(); } },
        { label: 'Relire avant d\'envoyer (la dictée va dans le champ du panneau)', type: 'checkbox', checked: cfg.agentReview !== false,
          click: (i) => saveConfig({ agentReview: i.checked }) },
        { label: agents.isAvailable(cfg.agentCommand) ? `Commande : ${cfg.agentCommand || 'claude'}` : 'Claude Code introuvable', enabled: false },
        { label: 'Changer la commande de lancement… (agentCommand)', click: () => { saveConfig({}); shell.openPath(configFile()); } },
        { label: 'Modifier la consigne des agents (résumé audio)…', click: () => { agentInstructions(); shell.openPath(instructionsFile()); } },
        { label: 'Ouvrir le journal des agents (tours, autorisations)', click: () => {
          if (!fs.existsSync(journalFile())) fs.writeFileSync(journalFile(), '');
          shell.openPath(journalFile());
        } },
      ],
    },
    { type: 'separator' },
    { label: 'Ouvrir le dossier whisper', click: () => { fs.mkdirSync(ownWhisperDir(), { recursive: true }); shell.openPath(ownWhisperDir()); } },
    { label: 'Modifier la configuration (vocabulaire…)', click: () => { saveConfig({}); shell.openPath(configFile()); } },
    { type: 'separator' },
    { label: `À propos : version ${app.getVersion()}${app.isPackaged ? '' : ' (développement)'}`,
      click: () => shell.openExternal(`${RELEASES_URL}/tag/v${app.getVersion()}`) },
    { label: 'Quitter', click: () => app.quit() },
  ];
  Menu.buildFromTemplate(template).popup({ window: win });
});

/* ---- Cycle de vie -------------------------------------------------------- */

app.whenReady().then(() => {
  setupPermissions(require('electron').session.defaultSession);
  createWindow();
  createBubble();
  ensureFolderColors();
  // Au lancement, la dictée va au curseur : un agent sélectionné la veille ne
  // doit pas recevoir (et envoyer à Claude) ce qu'on croit dicter pour soi.
  if (loadConfig().agentSelected) saveConfig({ agentSelected: null });
  setInterval(pollSpeak, SPEAK_POLL_MS);
  // Windows : l'assistant PowerShell sert au premier collage comme à la
  // coupure du micro Discord en début de dictée ; il met ~1 s à démarrer.
  paste.warmUp();
  tts.setDirs({ data: app.getPath('userData'), bin: bundledBinDir() });
  agents.setJournal(journalFile());
  // Après le chargement de la bulle, qui affiche la progression.
  bubble.webContents.once('did-finish-load', ensureModel);
});
app.on('window-all-closed', () => app.quit());
// Quittée en pleine dictée : on rend d'abord le son et le micro Discord. Un
// agent au travail : on lui demande d'arrêter son tour et on attend qu'il l'ait
// fait (quelques secondes au plus) — tué net, il pourrait survivre dans son
// conteneur et continuer seul (cf. agents.interrupt).
let quitting = false;
app.on('before-quit', (e) => {
  const agentsBusy = agentList(loadConfig()).some((a) => isBusy(a.id));
  if (quitting || (!recording && !agentsBusy)) return;
  e.preventDefault();
  quitting = true;
  Promise.all([mute.restore('others'), mute.restore('discord'), agents.stop()]).finally(() => app.quit());
});
app.on('will-quit', () => { windows.stop(); tts.stop(); agents.stop(); });
