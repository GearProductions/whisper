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
   sa réponse se lit dans la bulle et s'écoute par le lecteur.

   Ce qui est collé est TOUJOURS ce que whisper vient de rendre, jamais un texte
   fourni par le renderer. Le collage automatique peut être désactivé (réglage
   `autoPaste`) : le texte reste alors dans le presse-papiers.
   ========================================================================= */

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, clipboard, shell, screen, Menu, dialog } = require('electron');
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
  // Agents Claude Code : un par dossier ({ id, dir, name, color, model, effort,
  // mode, sessionId }). `agentFolders` : les dossiers déjà choisis, proposés
  // par le bouton « + ». `agentCommand` : la commande qui lance Claude Code
  // ('' : `claude` ; ex. « distrobox enter dev -- mise exec -- claude »).
  agentsEnabled: false, agentCommand: '', agents: [], agentFolders: [], agentSelected: null,
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
// longue, a droit à une grande bulle.
const BUBBLE_SIZES = { agent: { width: 560, maxHeight: 520 }, default: { width: 340, maxHeight: 240 } };
const bubbleSize = () => BUBBLE_SIZES[bubbleKind] || BUBBLE_SIZES.default;
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
  // Un agent est sélectionné : la dictée lui est envoyée, rien n'est collé.
  const agent = selectedAgent(cfg);
  if (agent) return sendToAgent(agent, text, cfg);
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
// `source` : rien, ou { agent: id } pour le résumé audio de sa dernière réponse.
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
    const reply = agentId && agents.lastReply(agentId);
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

// Couleur d'un agent : tirée au sort à sa création, modifiable au clic droit.
const AGENT_COLORS = [
  ['#8b5cf6', 'Violet'], ['#3b82f6', 'Bleu'], ['#06b6d4', 'Cyan'], ['#22c55e', 'Vert'],
  ['#eab308', 'Jaune'], ['#f97316', 'Orange'], ['#ef4444', 'Rouge'], ['#ec4899', 'Rose'],
];
const agentColor = (a) => (AGENT_COLORS.some(([c]) => c === a.color) ? a.color : AGENT_COLORS[0][0]);
// De préférence une couleur qu'aucun agent ne porte.
function randomColor(list) {
  const used = new Set(list.map(agentColor));
  const free = AGENT_COLORS.map(([c]) => c).filter((c) => !used.has(c));
  const pool = free.length ? free : AGENT_COLORS.map(([c]) => c);
  return pool[Math.floor(Math.random() * pool.length)];
}

const agentList = (cfg) => (Array.isArray(cfg.agents) ? cfg.agents.filter((a) => a && a.id && a.dir) : []);
// Un petit bouton par agent, plus le « + ».
const agentSlotCount = (cfg) => (cfg.agentsEnabled === true ? agentList(cfg).length + 1 : 0);
// Dossiers favoris : ceux déjà choisis, qu'ils aient encore un agent ou non.
function favoriteFolders(cfg) {
  const saved = Array.isArray(cfg.agentFolders) ? cfg.agentFolders.filter((d) => typeof d === 'string' && d) : [];
  return [...new Set([...saved, ...agentList(cfg).map((a) => a.dir)])];
}
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
      id: a.id, name: a.name, color: agentColor(a), selected: a.id === cfg.agentSelected, ...agents.state(a.id),
    })) : [],
  });
}

// « Écrire le fichier : src/note.txt » — l'outil en clair, les chemins relatifs
// au dossier de l'agent.
const TOOL_LABELS = {
  Write: 'Écrire le fichier', Edit: 'Modifier le fichier', MultiEdit: 'Modifier le fichier', NotebookEdit: 'Modifier le notebook',
  Read: 'Lire le fichier', Bash: 'Exécuter la commande', WebFetch: 'Consulter la page', WebSearch: 'Chercher sur le web',
};
function toolSummary(agent, tool, input) {
  const v = input && (input.command || input.file_path || input.notebook_path || input.path || input.url || input.query || input.pattern || input.description);
  const detail = v ? String(v).split(`${agent.dir}${path.sep}`).join('').slice(0, 300) : '';
  return `${TOOL_LABELS[tool] || tool}${detail ? ` : ${detail}` : ''}`;
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

function showAgentPermission(agent) {
  const p = agents.pendingPermission(agent.id);
  if (p) {
    showBubble({ title: `${agent.name} demande l'autorisation`, text: toolSummary(agent, p.tool, p.input), color: agentColor(agent) },
      'permission', agent.id);
  }
}

const AGENT_MESSAGES = {
  busy: (name) => `${name} travaille encore : message non envoyé (il est dans le presse-papiers).`,
  notInstalled: () => 'Claude Code introuvable : installez-le, ou réglez la commande de lancement (clic droit → Agents Claude Code).',
};

// La dictée part à l'agent ; la réponse arrivera par sa pastille.
function sendToAgent(agent, text, cfg) {
  const st = agents.state(agent.id).status;
  if (st === 'working' || st === 'asking') {
    clipboard.writeText(text);
    return { ok: false, error: AGENT_MESSAGES.busy(agent.name) };
  }
  if (!agents.isAvailable(cfg.agentCommand)) return { ok: false, error: AGENT_MESSAGES.notInstalled() };
  agents.send(agent, text, {
    command: cfg.agentCommand,
    onChange: pushAgents,
    onSession: (sessionId) => updateAgent(agent.id, { sessionId }),
    onPermission: () => showAgentPermission(agent),
  }).catch((err) => console.error(`agent ${agent.name} : ${err && err.message}`));
  return { ok: true, text, agent: agent.name };
}

// Clic sur un robot : lire ce qui attend (demande d'autorisation, réponse non
// lue) et le sélectionner ; sinon basculer la sélection.
ipcMain.on('agent:click', (_e, id) => {
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
  pushAgents();
});

// Boutons de la bulle d'un agent.
ipcMain.on('bubble:action', (_e, action) => {
  const id = bubbleAgent;
  if (!id) return;
  if (action === 'speak' && bubbleKind === 'agent') { if (win) win.webContents.send('tts:speakAgent', id); return; }
  if (bubbleKind === 'permission' && ['allow', 'always', 'deny'].includes(action)) {
    agents.answer(id, action);
    hideBubble();
    pushAgents();
  }
});

function newAgent(dir) {
  const cfg = loadConfig();
  const list = agentList(cfg);
  let agent = list.find((a) => a.dir === dir); // un seul agent par dossier
  if (!agent) {
    agent = {
      id: `a${Date.now().toString(36)}`, dir, name: path.basename(dir) || dir, color: randomColor(list),
      model: '', effort: '', mode: 'default', sessionId: null,
    };
    saveConfig({ agents: [...list, agent] });
  }
  saveConfig({ agentSelected: agent.id, agentFolders: [...new Set([...favoriteFolders(loadConfig()), dir])] });
  pushAgents();
}

// Bouton « + » : un nouvel agent, dans un dossier favori (déjà choisi, sans
// agent pour l'instant) ou dans un dossier à choisir, qui devient favori.
ipcMain.on('agent:add', () => {
  if (!win) return;
  const cfg = loadConfig();
  const available = agents.isAvailable(cfg.agentCommand);
  const inUse = new Set(agentList(cfg).map((a) => a.dir));
  const free = favoriteFolders(cfg).filter((d) => !inUse.has(d));
  const home = app.getPath('home');
  const short = (d) => (d.startsWith(`${home}${path.sep}`) ? `~${d.slice(home.length)}` : d);
  Menu.buildFromTemplate([
    { label: free.length ? 'Nouvel agent dans un dossier favori' : 'Aucun dossier favori disponible', enabled: false },
    ...free.map((d) => ({ label: `${path.basename(d)}  —  ${short(d)}`, enabled: available, click: () => newAgent(d) })),
    { type: 'separator' },
    { label: 'Choisir un autre dossier…', enabled: available,
      click: async () => {
        const res = await dialog.showOpenDialog({ title: 'Dossier de travail de l\'agent', properties: ['openDirectory'] });
        if (!res.canceled && res.filePaths[0]) newAgent(res.filePaths[0]);
      } },
    ...(free.length ? [{
      label: 'Oublier un dossier favori',
      submenu: free.map((d) => ({
        label: short(d), click: () => saveConfig({ agentFolders: favoriteFolders(loadConfig()).filter((f) => f !== d) }),
      })),
    }] : []),
    ...(available ? [] : [{ type: 'separator' }, { label: AGENT_MESSAGES.notInstalled(), enabled: false }]),
  ]).popup({ window: win });
});

// Clic droit sur un robot : ses réglages, comme dans les autres intégrations.
ipcMain.on('agent:menu', (_e, id) => {
  if (!win) return;
  const agent = agentList(loadConfig()).find((a) => a.id === id);
  if (!agent) return;
  const st = agents.state(id);
  const busy = st.status === 'working' || st.status === 'asking';
  const radio = (key, options) => options.map(([value, label]) => ({
    label, type: 'radio', checked: (agent[key] || options[0][0]) === value,
    click: () => updateAgent(id, { [key]: value }),
  }));
  Menu.buildFromTemplate([
    { label: agent.name, enabled: false },
    { label: agent.dir, enabled: false },
    { type: 'separator' },
    { label: 'Couleur', submenu: AGENT_COLORS.map(([value, label]) => ({
      label, type: 'radio', checked: agentColor(agent) === value,
      click: () => { updateAgent(id, { color: value }); pushAgents(); },
    })) },
    { label: 'Modèle', submenu: radio('model', agents.MODELS) },
    { label: 'Effort', submenu: radio('effort', agents.EFFORTS) },
    { label: 'Mode', submenu: radio('mode', agents.MODES) },
    { type: 'separator' },
    { label: 'Voir la dernière réponse', enabled: st.hasReply, click: () => showAgentReply(agent) },
    { label: 'Interrompre', enabled: busy, click: () => { agents.interrupt(id); pushAgents(); } },
    { label: 'Nouvelle session (effacer le contexte)', click: () => {
      agents.forget(id);
      updateAgent(id, { sessionId: null });
      if (bubbleAgent === id) hideBubble();
      pushAgents();
    } },
    { label: 'Ouvrir le dossier', click: () => shell.openPath(agent.dir) },
    { type: 'separator' },
    { label: 'Retirer cet agent', click: () => {
      agents.forget(id);
      const cfg = loadConfig();
      saveConfig({
        agents: agentList(cfg).filter((a) => a.id !== id),
        agentSelected: cfg.agentSelected === id ? null : cfg.agentSelected,
        agentFolders: favoriteFolders(cfg), // son dossier reste proposé par « + »
      });
      if (bubbleAgent === id) hideBubble();
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
        { label: agents.isAvailable(cfg.agentCommand) ? `Commande : ${cfg.agentCommand || 'claude'}` : 'Claude Code introuvable', enabled: false },
        { label: 'Changer la commande de lancement… (agentCommand)', click: () => { saveConfig({}); shell.openPath(configFile()); } },
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
  setInterval(pollSpeak, SPEAK_POLL_MS);
  // Windows : l'assistant PowerShell sert au premier collage comme à la
  // coupure du micro Discord en début de dictée ; il met ~1 s à démarrer.
  paste.warmUp();
  tts.setDirs({ data: app.getPath('userData'), bin: bundledBinDir() });
  // Après le chargement de la bulle, qui affiche la progression.
  bubble.webContents.once('did-finish-load', ensureModel);
});
app.on('window-all-closed', () => app.quit());
// Quittée en pleine dictée : on rend d'abord le son et le micro Discord.
let quitting = false;
app.on('before-quit', (e) => {
  if (quitting || !recording) return;
  e.preventDefault();
  quitting = true;
  Promise.all([mute.restore('others'), mute.restore('discord')]).finally(() => app.quit());
});
app.on('will-quit', () => { windows.stop(); tts.stop(); agents.stop(); });
