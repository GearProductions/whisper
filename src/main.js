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
   le presse-papiers), en local : Pocket TTS sur le processeur, ou Chatterbox
   sur GPU par son service (réglages `speak`, `speakEngine`, cf. tts.js).

   Des agents Claude Code (un par dossier de projet, réglage `agentsEnabled`,
   cf. agents.js) : un robot sélectionné reçoit la dictée au lieu du curseur ;
   sa réponse se lit dans la bulle et s'écoute par le lecteur. Avant l'envoi,
   une fenêtre de relecture (réglage `agentReview`) montre le texte dicté, à
   corriger, et reçoit le contexte : images et fichiers (glissés ou collés),
   texte sélectionné (joint seulement si on le coche).

   Ce qui est collé est TOUJOURS ce que whisper vient de rendre, jamais un texte
   fourni par le renderer. Le collage automatique peut être désactivé (réglage
   `autoPaste`) : le texte reste alors dans le presse-papiers. Seule exception
   pour un agent : le texte relu, qui vient de la fenêtre de relecture et
   d'elle seule.
   ========================================================================= */

const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { app, BrowserWindow, ipcMain, clipboard, shell, screen, Menu, dialog, nativeImage } = require('electron');
const whisper = require('./whisper');
const paste = require('./paste');
const mute = require('./mute');
const tts = require('./tts');
const chatterbox = require('./chatterbox');
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
  agentReview: true,                 // relire (et joindre du contexte) avant d'envoyer à un agent
  muteOthers: false,                 // couper le son des autres applications pendant la dictée
  autoPaste: true,                   // coller là où est le curseur ; sinon le texte reste dans le presse-papiers
  speak: 'selection', speakVolume: 1,
  speakEngine: 'pocket',             // 'pocket' (processeur) ou 'chatterbox' (GPU, service local)
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
    alwaysOnTop: true,
    // Clé du dispositif : cliquer l'icône laisse le focus à l'application cible.
    focusable: false,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: true },
  });
  win.setAlwaysOnTop(true, 'floating');
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

// Largeur et hauteur maximale selon le genre : la réponse d'un agent, souvent
// longue, et sa demande d'autorisation, à lire en entier, ont droit à une
// grande bulle.
const BUBBLE_SIZES = { large: { width: 560, maxHeight: 520 }, default: { width: 340, maxHeight: 240 } };
const bubbleSize = () => (BUBBLE_STAYS.has(bubbleKind) ? BUBBLE_SIZES.large : BUBBLE_SIZES.default);
const BUBBLE_GAP = 6;
const BUBBLE_MS = 10000;         // affichage avant masquage automatique
const BUBBLE_COPIED_MS = 1200;   // le temps de lire « Copié »

let bubble = null;
let bubbleText = '';
let bubbleKind = 'text';         // 'text' : transcription, cliquable ; 'notice' : simple message…
let bubbleAgent = null;          // agent dont la bulle montre la réponse ou la demande
let bubbleH = 80;                // hauteur mesurée par le renderer de la bulle
let bubbleTimer = null;
let recording = false;

// Créée une fois, cachée : la montrer ensuite est instantané.
function createBubble() {
  bubble = new BrowserWindow({
    width: BUBBLE_SIZES.default.width, height: 80, show: false,
    frame: false, transparent: true, resizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, hasShadow: false, alwaysOnTop: true,
    // Comme l'icône : la cliquer ne vole pas le focus à l'application cible.
    focusable: false,
    webPreferences: { preload: path.join(__dirname, 'bubble-preload.js'), contextIsolation: true, sandbox: true },
  });
  bubble.setAlwaysOnTop(true, 'floating');
  bubble.setVisibleOnAllWorkspaces(true);
  // Les liens passent par bubble:openLink : la bulle ne navigue jamais ailleurs.
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
// à copier ; `volume` montre le curseur du volume de lecture (`text`
// est alors le volume, 0 à 1). `agent` (réponse d'un agent, à copier ou à
// écouter) et `permission` (sa demande d'autorisation) reçoivent { title,
// text } et restent affichées jusqu'à leur croix.
const BUBBLE_STAYS = new Set(['agent', 'permission']);
function showBubble(text, kind = 'text', agentId = null) {
  if (!bubble || !win) return;
  bubbleKind = kind;
  bubbleAgent = agentId;
  bubbleText = kind === 'text' ? text : kind === 'agent' ? text.text : '';
  bubble.webContents.send('bubble:show', text, kind, bubbleSize());
}

// Au-dessus de l'icône, centrée sur elle ; en dessous si le haut de l'écran
// manque de place ; toujours dans la zone de travail de l'écran de l'icône.
// Rappelée à chaque pas du glisser : la bulle suit l'icône.
function placeBubble() {
  const icon = win.getBounds();
  const a = screen.getDisplayMatching(icon).workArea;
  const { width } = bubbleSize();
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
  // 'status' : message de l'appli (téléchargement…), sans lien avec la dictée.
  bubbleH = Math.max(40, Math.min(bubbleSize().maxHeight, Math.round(Number(height)) || 80));
  placeBubble();
  bubble.showInactive();
  if (BUBBLE_STAYS.has(bubbleKind)) clearTimeout(bubbleTimer); else scheduleHide(BUBBLE_MS);
});

// Survolée : on la laisse lire ; quittée : le délai repart.
ipcMain.on('bubble:hover', (_e, inside) => {
  if (!bubble || !bubble.isVisible()) return;
  if (inside || BUBBLE_STAYS.has(bubbleKind)) clearTimeout(bubbleTimer); else scheduleHide(BUBBLE_MS);
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
  if (!BUBBLE_STAYS.has(bubbleKind)) scheduleHide(BUBBLE_COPIED_MS);
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
    hideBubble();
    const cfg = loadConfig();
    if (cfg.muteOthers === true) mute.mute('others', ownPids());
    if (cfg.discordMute === true) {
      mute.mute('discord').then((n) => { if (n > 0 && recording) showBubble('Micro Discord coupé', 'notice'); });
    }
  } else {
    if (bubbleKind === 'notice') hideBubble();
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
  // Elle passe par la fenêtre de relecture (et s'ajoute au brouillon si elle
  // est déjà ouverte) ; sans relecture, elle part aussitôt.
  const agent = selectedAgent(cfg);
  if (agent && (compose || cfg.agentReview !== false)) {
    await openCompose(agent, text);
    return { ok: true, text, agent: agent.name, review: true };
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
    // Chatterbox : prêt d'office ; service arrêté, la lecture passe par Pocket
    // TTS. Pocket TTS absent : prêt s'il peut s'installer au premier clic.
    const ready = cfg.speakEngine === 'chatterbox' || tts.isInstalled() || tts.canInstall();
    state = { mode, volume: speakVolume(cfg), ready, hasText: await selection.hasText(mode) };
  }
  const key = JSON.stringify(state);
  if (key === speakKey || !win) return;
  speakKey = key;
  win.webContents.send('tts:state', state);
}

const speakOptions = (cfg) => ({ lang: cfg.speakLang, voices: cfg.speakVoices, engine: cfg.speakEngine });

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
  if (cfg.speakEngine !== 'chatterbox' && !tts.isInstalled() && tts.canInstall() && !(await installPocket())) {
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
  if (mode !== 'off' && (cfg.speakEngine === 'chatterbox' || tts.isInstalled())) {
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

// État des robots pour le renderer, et largeur de la fenêtre.
function pushAgents() {
  if (!win) return;
  const cfg = loadConfig();
  const slots = agentSlotCount(cfg);
  if (slots !== agentSlots) { agentSlots = slots; applyWidth(); }
  const enabled = cfg.agentsEnabled === true;
  win.webContents.send('agents:state', {
    enabled,
    agents: enabled ? agentList(cfg).map((a) => ({
      id: a.id, name: a.name, color: agentColor(a, cfg), selected: a.id === cfg.agentSelected, ...agents.state(a.id),
    })) : [],
  });
  refreshConversation(); // la fenêtre de conversation suit (réponse arrivée, agent au travail…)
  refreshCompose();      // la relecture aussi (destinataire, agent occupé)
  syncPermissionBubble(); // une demande affichée a pu être annulée
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

function showAgentReply(agent) {
  const reply = agents.lastReply(agent.id);
  if (!reply) return;
  agents.markRead(agent.id);
  showBubble({ title: agent.name, text: reply.text, color: agentColor(agent) }, 'agent', agent.id);
  pushAgents();
  // Le bouton ▶ de la bulle va sans doute servir : on charge le lecteur d'avance.
  const cfg = loadConfig();
  if (cfg.speakEngine === 'chatterbox' || tts.isInstalled()) tts.warmUp(reply.audio, speakOptions(cfg));
}

// La demande en tête de file de l'agent. Les autres attendent derrière (outils
// lancés en parallèle) : la bulle le dit, et passe à la suivante après chaque
// réponse. `bubblePermission` : le numéro de la demande affichée — un clic ne
// répond qu'à elle (cf. agents.answer).
let bubblePermission = null;
let bubbleWaiting = 0;  // demandes derrière celle affichée (le titre le dit)
function showAgentPermission(agent) {
  const p = agents.pendingPermission(agent.id);
  if (!p) return;
  bubblePermission = p.key;
  bubbleWaiting = p.waiting;
  showBubble({
    title: `${agent.name} demande l'autorisation${p.waiting ? ` (${p.waiting} autre${p.waiting > 1 ? 's' : ''} en attente)` : ''}`,
    text: permissionText(p.tool, p.input), color: agentColor(agent),
    always: p.always, // ce que « Toujours autoriser » accorderait, pour cette session
  }, 'permission', agent.id);
}

// Bulle d'autorisation affichée : elle suit la file de son agent. Demande
// annulée par Claude Code entre-temps : la suivante prend sa place, ou la
// bulle se ferme s'il n'y en a plus ; une autre arrivée derrière : le titre
// le dit.
function syncPermissionBubble() {
  if (!bubble || !bubble.isVisible() || bubbleKind !== 'permission' || !bubbleAgent) return;
  const head = agents.pendingPermission(bubbleAgent);
  const agent = agentList(loadConfig()).find((a) => a.id === bubbleAgent);
  if (!head || !agent) hideBubble();
  else if (head.key !== bubblePermission || head.waiting !== bubbleWaiting) showAgentPermission(agent);
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
    // Une bulle est déjà ouverte (la réponse d'un autre agent qu'on lit…) : on
    // ne la remplace pas, le « ? » du robot attend qu'on clique dessus.
    onPermission: () => {
      const free = !bubble || !bubble.isVisible() || (bubbleKind === 'permission' && bubbleAgent === agent.id);
      if (free) showAgentPermission(agent);
    },
  }).catch((err) => console.error(`agent ${agent.name} : ${err && err.message}`));
  return { ok: true };
}

// Un message IPC n'est écouté que s'il vient de la fenêtre qui a le droit de
// l'envoyer : autoriser une action d'un agent est réservé à la bulle.
const sentBy = (e, w) => !!w && !w.isDestroyed() && e.sender === w.webContents;

// Clic sur un robot : lire ce qui attend (demande d'autorisation, réponse non
// lue) et le sélectionner ; sinon basculer la sélection.
ipcMain.on('agent:click', (e, id) => {
  if (!sentBy(e, win)) return;
  const cfg = loadConfig();
  const agent = agentList(cfg).find((a) => a.id === id);
  if (!agent) return;
  const st = agents.state(id);
  if (st.status === 'asking' || st.unread) {
    saveConfig({ agentSelected: id });
    if (st.status === 'asking') showAgentPermission(agent); else showAgentReply(agent);
  } else {
    saveConfig({ agentSelected: cfg.agentSelected === id ? null : id });
    if (bubbleAgent) hideBubble();
  }
  // Brouillon ouvert : il part au robot qu'on vient de sélectionner.
  const selected = loadConfig().agentSelected;
  if (compose && selected) composeAgent = selected;
  pushAgents();
});

// Boutons de la bulle d'un agent.
ipcMain.on('bubble:action', (e, action) => {
  const id = bubbleAgent;
  if (!id || !sentBy(e, bubble)) return;
  if (action === 'speak' && bubbleKind === 'agent') { if (win) win.webContents.send('tts:speakAgent', id); return; }
  if (action === 'expand' && bubbleKind === 'agent') { hideBubble(); openConversation(id); return; }
  if (bubbleKind === 'permission' && ['allow', 'always', 'deny'].includes(action)) {
    agents.answer(id, action, bubblePermission);
    // La suivante de la file, s'il y en a : sinon Claude Code l'attendrait sans fin.
    const agent = agentList(loadConfig()).find((a) => a.id === id);
    if (agent && agents.pendingPermission(id)) showAgentPermission(agent); else hideBubble();
    pushAgents();
  }
});

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

/* ---- Fenêtre de conversation ---------------------------------------------- */

// Une fenêtre classique (barre de titre, redimensionnable, elle prend le
// focus), à ONGLETS : une seule fenêtre, une conversation par onglet. L'onglet
// « vivant » d'un agent suit sa session en cours ; l'historique de son dossier
// (les sessions Claude Code passées, retrouvées par leur intitulé) s'ouvre en
// onglets de lecture, que l'on peut reprendre. Sa taille est retenue.
let conv = null;
let convTabs = [];     // [{ key, agentId, sessionId }] ; sessionId null : la session en cours de l'agent
let convActive = null; // clé de l'onglet affiché
let convThread = [];   // fil affiché
let convSpeech = '';   // résumé audio de la réponse choisie par ▶ (cf. tts:speak)
let convSeq = 0;       // rafraîchissements qui se chevauchent : seul le dernier s'affiche

const tabAgent = (tab, cfg = loadConfig()) => tab && agentList(cfg).find((a) => a.id === tab.agentId);
const tabSession = (tab, agent) => tab.sessionId || agent.sessionId;
const activeTab = () => convTabs.find((t) => t.key === convActive);

// Ouvre (ou montre) l'onglet de la session en cours de l'agent, ou celui d'une
// de ses anciennes sessions.
function openConversation(agentId, sessionId = null) {
  const agent = agentList(loadConfig()).find((a) => a.id === agentId);
  if (!agent) return;
  const old = sessionId && sessionId !== agent.sessionId ? sessionId : null;
  const key = old ? `${agentId}:${old}` : agentId;
  if (!convTabs.some((t) => t.key === key)) convTabs.push({ key, agentId, sessionId: old });
  convActive = key;
  if (conv) { refreshConversation(); conv.show(); conv.focus(); return; }
  const saved = loadConfig().convBounds;
  conv = new BrowserWindow({
    width: 720, height: 780, minWidth: 380, minHeight: 300,
    ...(saved && Number.isFinite(saved.width) ? saved : {}),
    backgroundColor: '#171b24', autoHideMenuBar: true, title: 'Whisper — conversations',
    webPreferences: { preload: path.join(__dirname, 'conversation-preload.js'), contextIsolation: true, sandbox: true },
  });
  conv.removeMenu();
  // Les liens passent par conv:openLink : la fenêtre ne navigue jamais ailleurs.
  conv.webContents.on('will-navigate', (e) => e.preventDefault());
  conv.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  conv.loadFile(path.join(__dirname, 'conversation.html'));
  conv.on('close', () => saveConfig({ convBounds: conv.getBounds() }));
  conv.on('closed', () => { conv = null; convTabs = []; convActive = null; convThread = []; });
}

// Relit les onglets (intitulés, état des agents) et le fil de l'onglet
// affiché, et les envoie à la fenêtre (à son ouverture, puis à chaque
// changement d'état d'un agent).
async function refreshConversation() {
  if (!conv) return;
  const seq = ++convSeq;
  const cfg = loadConfig();
  convTabs = convTabs.filter((t) => tabAgent(t, cfg)); // agent retiré : ses onglets partent
  if (!convTabs.length) { conv.close(); return; }
  if (!activeTab()) convActive = convTabs[convTabs.length - 1].key;
  const tabs = await Promise.all(convTabs.map(async (t) => {
    const agent = tabAgent(t, cfg);
    const sid = tabSession(t, agent);
    const st = agents.state(agent.id);
    return {
      key: t.key, live: !t.sessionId, name: agent.name, color: agentColor(agent, cfg),
      status: st.status, since: st.since, title: sid ? await agents.sessionTitle(agent, sid) : '',
    };
  }));
  const tab = activeTab();
  const agent = tabAgent(tab, cfg);
  const thread = await agents.thread(agent, tabSession(tab, agent));
  if (!conv || seq !== convSeq) return;
  convThread = thread;
  conv.webContents.send('conv:thread', {
    tabs, active: tab.key, dir: agent.dir,
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

ipcMain.on('conv:ready', (e) => { if (sentBy(e, conv)) refreshConversation(); });
ipcMain.on('conv:openLink', (e, url) => { if (sentBy(e, conv)) openLink(url); });
// Fichier joint à un message : montré dans le gestionnaire de fichiers, jamais
// ouvert (un script se lancerait).
ipcMain.on('conv:showFile', (e, file) => {
  if (sentBy(e, conv) && typeof file === 'string' && path.isAbsolute(file) && fs.existsSync(file)) shell.showItemInFolder(file);
});
ipcMain.on('bubble:openLink', (e, url) => { if (sentBy(e, bubble)) openLink(url); });
ipcMain.on('conv:select', (e, key) => {
  if (!sentBy(e, conv) || !convTabs.some((t) => t.key === key)) return;
  convActive = key;
  refreshConversation();
});
ipcMain.on('conv:closeTab', (e, key) => {
  if (!sentBy(e, conv)) return;
  convTabs = convTabs.filter((t) => t.key !== key);
  refreshConversation(); // dernier onglet fermé : la fenêtre aussi
});

// ▶ d'une réponse : son résumé audio, par le lecteur de l'icône.
ipcMain.on('conv:speak', (e, index) => {
  const tab = sentBy(e, conv) && activeTab();
  if (!tab || !win || !convThread[index] || !convThread[index].audio) return;
  convSpeech = convThread[index].audio;
  win.webContents.send('tts:speakAgent', tab.agentId, index);
});

// Historique du dossier de l'onglet affiché : [{ sessionId, title,
// lastModified, current (la session en cours de l'agent) }].
ipcMain.handle('conv:history', async (e) => {
  const agent = sentBy(e, conv) && tabAgent(activeTab());
  if (!agent) return [];
  return (await agents.sessions(agent)).map((s) => ({ ...s, current: s.sessionId === agent.sessionId }));
});

// Ouvrir une session de l'historique : seulement une session de CE dossier.
ipcMain.on('conv:open', async (e, sessionId) => {
  const agent = sentBy(e, conv) && tabAgent(activeTab());
  if (!agent || !(await agents.sessions(agent)).some((s) => s.sessionId === sessionId)) return;
  openConversation(agent.id, sessionId);
});

// Reprendre l'ancienne session de l'onglet affiché : elle redevient la session
// en cours de l'agent (la précédente reste dans l'historique).
ipcMain.on('conv:resume', (e) => {
  const tab = sentBy(e, conv) && activeTab();
  const agent = tab && tab.sessionId && tabAgent(tab);
  if (!agent || isBusy(agent.id)) return;
  updateAgent(agent.id, { sessionId: tab.sessionId });
  convTabs = convTabs.filter((t) => t.key !== tab.key && t.key !== agent.id);
  if (bubbleAgent === agent.id) hideBubble(); // sa « dernière réponse » était celle de l'autre session
  openConversation(agent.id);
  pushAgents();
});

/* ---- Fenêtre de relecture (avant l'envoi à un agent) ---------------------- */

// Au relâché, la dictée destinée à un agent s'ouvre ici, au-dessus de l'icône :
// une fenêtre qui PREND le focus (on y corrige, on y colle, on y dépose). Une
// seule ; tant qu'elle est ouverte, chaque dictée s'ajoute au brouillon, et
// cliquer un autre robot change le destinataire. Envoyer la ferme ; annuler
// abandonne le brouillon.
//
// Le contexte joint : images (envoyées à Claude, réduites si besoin), autres
// fichiers (par leur chemin : l'agent les lit lui-même), texte sélectionné. La
// sélection est relevée au moment de la dictée (puis à la demande) et RESTE
// ici : la fenêtre n'en reçoit qu'une copie à montrer et ne renvoie qu'un
// booléen « la joindre ». Pas sous Windows : la lire y demande un Ctrl+C simulé
// dans l'application au premier plan — dans un terminal, il interromprait le
// programme. Le presse-papiers, lui, se colle à la main dans le texte.
const COMPOSE_SIZE = { width: 560, height: 500 };
const canAttachSelection = process.platform === 'linux';
const SELECTION_MAX = 100000;          // caractères ; au-delà, coupée
const FILES_MAX = 50;
const IMAGES_MAX = 20;
const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']; // acceptés par Claude
const IMAGE_SIDE = 1568;               // au-delà, Claude la réduirait lui-même : autant envoyer moins
const IMAGE_BYTES = 3.75 * 1024 * 1024; // ~5 Mo une fois en base64 : la limite par image

let compose = null;
let composeAgent = null;
let composeReady = false;              // la page a reçu le brouillon (cf. compose:init)
let composeQueue = '';                 // dictée arrivée avant
let composeSelection = Promise.resolve({ text: '', cut: false });

async function readComposeSelection() {
  if (!canAttachSelection) return { text: '', cut: false };
  const text = (await selection.readText('selection')).trim();
  return { text: text.slice(0, SELECTION_MAX), cut: text.length > SELECTION_MAX };
}

const composeInfo = () => {
  const agent = agentList(loadConfig()).find((a) => a.id === composeAgent);
  return agent ? { name: agent.name, dir: agent.dir, color: agentColor(agent), busy: isBusy(agent.id) } : null;
};

function refreshCompose() {
  const info = compose && composeReady && composeInfo();
  if (info) compose.webContents.send('compose:agent', info);
}

// Au-dessus de l'icône, centrée sur le micro ; en dessous si la place manque.
function composeBounds() {
  const icon = win.getBounds();
  const a = screen.getDisplayMatching(icon).workArea;
  const { width, height } = COMPOSE_SIZE;
  const x = Math.max(a.x, Math.min(a.x + a.width - width, icon.x + Math.round(winSize / 2 - width / 2)));
  let y = icon.y - height - BUBBLE_GAP;
  if (y < a.y) y = Math.min(icon.y + icon.height + BUBBLE_GAP, a.y + a.height - height);
  return { x, y: Math.max(a.y, y), width, height };
}

function openCompose(agent, text) {
  composeAgent = agent.id;
  if (compose) {
    if (composeReady) compose.webContents.send('compose:append', text);
    else composeQueue += `${composeQueue ? ' ' : ''}${text}`;
    refreshCompose();
    compose.show();
    compose.focus();
    return;
  }
  composeQueue = text;
  composeReady = false;
  composeSelection = readComposeSelection(); // tout de suite : c'est ce qui était sélectionné en dictant
  compose = new BrowserWindow({
    ...composeBounds(), minWidth: 380, minHeight: 320, show: false, alwaysOnTop: true,
    backgroundColor: '#171b24', autoHideMenuBar: true, title: 'Whisper — message',
    webPreferences: { preload: path.join(__dirname, 'compose-preload.js'), contextIsolation: true, sandbox: true },
  });
  compose.removeMenu();
  // Au-dessus des autres : on va chercher une sélection ailleurs sans la perdre de vue.
  compose.setAlwaysOnTop(true, 'floating');
  // Un fichier lâché hors de la zone prévue ne doit pas remplacer la page.
  compose.webContents.on('will-navigate', (e) => e.preventDefault());
  compose.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  compose.loadFile(path.join(__dirname, 'compose.html'));
  compose.once('ready-to-show', () => { if (compose) { compose.show(); compose.focus(); } });
  compose.on('closed', () => { compose = null; composeAgent = null; composeReady = false; composeQueue = ''; });
}

// Image collée ou déposée → { mediaType, data (base64) } pour Claude, ou null.
// Trop grande (côté ou poids) ou d'un format refusé : réduite et réencodée.
function prepareImage(img) {
  const raw = img && img.data;
  const buf = raw instanceof ArrayBuffer || ArrayBuffer.isView(raw) ? Buffer.from(raw.buffer || raw) : null;
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

// Le texte relu, suivi du contexte : la sélection (balisée, pour que l'agent
// la distingue de la demande), les chemins des fichiers joints.
const SELECTION_HEAD = 'Texte sélectionné, joint comme contexte :\n<selection>\n';
const SELECTION_END = '\n</selection>';
const FILES_HEAD = 'Fichiers joints (chemins sur cette machine) :\n';
const composeMessage = (text, selected, files) => [
  text,
  selected && `${SELECTION_HEAD}${selected}${SELECTION_END}`,
  files.length && `${FILES_HEAD}${files.map((f) => `- ${f}`).join('\n')}`,
].filter(Boolean).join('\n\n');

// L'inverse, pour la fenêtre de conversation : { text, selection, files }. Un
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

// La page demande le brouillon une fois prête : { agent, text, selection }
// (`selection` : null si elle ne peut pas être jointe, cf. plus haut).
ipcMain.handle('compose:init', async (e) => {
  if (!sentBy(e, compose)) return null;
  const selected = canAttachSelection ? await composeSelection : null;
  if (!compose) return null;
  composeReady = true;
  const text = composeQueue;
  composeQueue = '';
  return { agent: composeInfo(), text, selection: selected };
});

ipcMain.handle('compose:selection', (e) => {
  if (!sentBy(e, compose) || !canAttachSelection) return null;
  composeSelection = readComposeSelection();
  return composeSelection;
});

ipcMain.on('compose:cancel', (e) => { if (sentBy(e, compose)) compose.close(); });

// `draft` : { text, withSelection, images: [{ name, type, data }], files: [chemin] }.
ipcMain.handle('compose:send', async (e, draft) => {
  if (!sentBy(e, compose)) return { ok: false };
  const cfg = loadConfig();
  const agent = agentList(cfg).find((a) => a.id === composeAgent);
  if (!agent) return { ok: false, error: 'Cet agent n\'existe plus.' };
  const d = draft || {};
  const files = (Array.isArray(d.files) ? d.files : []).filter((f) => typeof f === 'string' && path.isAbsolute(f));
  const list = Array.isArray(d.images) ? d.images : [];
  if (files.length > FILES_MAX || list.length > IMAGES_MAX) {
    return { ok: false, error: `Trop de pièces jointes (${IMAGES_MAX} images et ${FILES_MAX} fichiers au plus).` };
  }
  const images = [];
  for (const img of list) {
    const ready = prepareImage(img);
    if (!ready) return { ok: false, error: `Image illisible ou trop lourde : ${String((img && img.name) || 'image')}.` };
    images.push(ready);
  }
  const selected = d.withSelection === true ? (await composeSelection).text : '';
  const text = composeMessage(typeof d.text === 'string' ? d.text.trim() : '', selected, files);
  if (!text && !images.length) return { ok: false, error: 'Message vide.' };
  const res = sendToAgent(agent, { text, images }, cfg);
  if (res.ok && compose) compose.close();
  return res;
});

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
    { label: 'Voir la dernière réponse', enabled: st.hasReply, click: () => showAgentReply(agent) },
    { label: 'Conversations (en cours et historique)', click: () => openConversation(id) },
    { label: 'Interrompre', enabled: busy, click: () => { agents.interrupt(id); pushAgents(); } },
    { label: 'Nouvelle session (effacer le contexte)', click: () => {
      agents.forget(id);
      updateAgent(id, { sessionId: null });
      if (bubbleAgent === id) hideBubble();
      pushAgents(); // la fenêtre de conversation, si elle est ouverte, se vide
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
      if (bubbleAgent === id) hideBubble();
      if (composeAgent === id && compose) compose.close();
      pushAgents();
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
  const chatterboxUp = await chatterbox.isUp();
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
          label: 'Moteur',
          submenu: [
            { label: tts.isInstalled() ? 'Pocket TTS (processeur)' : 'Pocket TTS (non installé)', type: 'radio',
              checked: cfg.speakEngine !== 'chatterbox', click: () => { saveConfig({ speakEngine: 'pocket' }); pollSpeak(); } },
            { label: chatterboxUp ? 'Chatterbox (GPU)' : 'Chatterbox (GPU, service arrêté)', type: 'radio',
              checked: cfg.speakEngine === 'chatterbox', click: () => { saveConfig({ speakEngine: 'chatterbox' }); pollSpeak(); } },
          ],
        },
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
        { label: 'Relire avant d\'envoyer (texte, images, sélection)', type: 'checkbox', checked: cfg.agentReview !== false,
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
