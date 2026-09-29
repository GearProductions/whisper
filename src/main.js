/* =========================================================================
   Whisper — process principal

   Une seule fenêtre : une icône ronde, flottante, toujours au premier plan, qui
   ne prend JAMAIS le focus — le texte dicté doit arriver dans l'application où
   est le curseur, pas ici. Maintenir le clic dicte, glisser déplace, clic droit
   ouvre le menu (langue, micro, son, bulle, micro Discord, dossier whisper,
   quitter).

   À la fin d'une dictée, une BULLE montre le texte à côté de l'icône (réglage
   `showText`) ; un clic dessus le copie.

   Linux : pendant l'enregistrement, le micro Discord peut être coupé puis
   rétabli (réglage `discordMute`, cf. discord.js).

   Ce qui est collé est TOUJOURS ce que whisper vient de rendre, jamais un texte
   fourni par le renderer.
   ========================================================================= */

const path = require('path');
const fs = require('fs');
const { app, BrowserWindow, ipcMain, clipboard, shell, screen, Menu } = require('electron');
const whisper = require('./whisper');
const paste = require('./paste');
const discord = require('./discord');

// Fenêtre transparente sous Linux (X11) : sans ce drapeau, fond noir.
if (process.platform === 'linux') app.commandLine.appendSwitch('enable-transparent-visuals');

if (!app.requestSingleInstanceLock()) app.quit();

/* ---- Configuration (userData/config.json) -------------------------------- */

const DEFAULTS = { lang: 'fr', vocabulary: '', sound: true, showText: true, discordMute: false, deviceId: '', deviceLabel: '', size: 64, pos: null };
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

// Le nôtre d'abord ; puis celui de Cockpit, pour réutiliser son installation.
const ownWhisperDir = () => path.join(app.getPath('userData'), 'whisper');
const whisperDirs = () => [ownWhisperDir(), path.join(app.getPath('appData'), 'cockpit', 'whisper')];

/* ---- Fenêtre ------------------------------------------------------------- */

let win = null;
let winSize = 0; // taille voulue de l'icône, en px logiques

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
  const wa = screen.getPrimaryDisplay().workArea;
  const pos = isVisible(cfg.pos, size) ? cfg.pos : { x: wa.x + wa.width - size - 24, y: wa.y + wa.height - size - 24 };

  win = new BrowserWindow({
    x: Math.round(pos.x), y: Math.round(pos.y), width: size, height: size,
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
  win.loadFile(path.join(__dirname, 'index.html'));
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

const BUBBLE_W = 340;
const BUBBLE_MAX_H = 240;
const BUBBLE_GAP = 6;
const BUBBLE_MS = 10000;         // affichage avant masquage automatique
const BUBBLE_COPIED_MS = 1200;   // le temps de lire « Copié »

let bubble = null;
let bubbleText = '';
let bubbleKind = 'text';         // 'text' : transcription, cliquable ; 'notice' : simple message
let bubbleH = 80;                // hauteur mesurée par le renderer de la bulle
let bubbleTimer = null;
let recording = false;

// Créée une fois, cachée : la montrer ensuite est instantané.
function createBubble() {
  bubble = new BrowserWindow({
    width: BUBBLE_W, height: 80, show: false,
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
// n'a rien à copier.
function showBubble(text, kind = 'text') {
  if (!bubble || !win) return;
  bubbleKind = kind;
  bubbleText = kind === 'text' ? text : '';
  bubble.webContents.send('bubble:show', text, kind);
}

// Au-dessus de l'icône, centrée sur elle ; en dessous si le haut de l'écran
// manque de place ; toujours dans la zone de travail de l'écran de l'icône.
// Rappelée à chaque pas du glisser : la bulle suit l'icône.
function placeBubble() {
  const icon = win.getBounds();
  const a = screen.getDisplayMatching(icon).workArea;
  let x = icon.x + Math.round(icon.width / 2 - BUBBLE_W / 2);
  x = Math.max(a.x, Math.min(a.x + a.width - BUBBLE_W, x));
  let y = icon.y - bubbleH - BUBBLE_GAP;
  if (y < a.y) y = Math.min(icon.y + icon.height + BUBBLE_GAP, a.y + a.height - bubbleH);
  bubble.setBounds({ x, y, width: BUBBLE_W, height: bubbleH });
}

ipcMain.on('bubble:ready', (_e, height) => {
  if (!bubble || !win) return;
  // Notice arrivée après la fin de l'enregistrement : elle n'a plus lieu d'être.
  if (bubbleKind === 'notice' && !recording) return;
  bubbleH = Math.max(40, Math.min(BUBBLE_MAX_H, Math.round(Number(height)) || 80));
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
  win.setBounds({ x: Math.round(x), y: Math.round(y), width: winSize, height: winSize });
  if (bubble && bubble.isVisible()) placeBubble();
});
ipcMain.on('win:savePosition', (_e, x, y) => saveConfig({ pos: { x: Math.round(x), y: Math.round(y) } }));

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

// Début (dès le seuil de maintien, avant l'ouverture du micro) et fin de
// l'enregistrement. Au début, la bulle de la dictée précédente s'efface, et
// « Micro Discord coupé » s'affiche si la coupure est confirmée. La fin
// rétablit toujours : réglage décoché en cours de route ou non, rien ne doit
// rester coupé.
ipcMain.on('dictation:recording', (_e, on) => {
  recording = !!on;
  if (on) {
    hideBubble();
    if (loadConfig().discordMute !== true) return;
    discord.mute().then((n) => { if (n > 0 && recording) showBubble('Micro Discord coupé', 'notice'); });
  } else {
    if (bubbleKind === 'notice') hideBubble();
    discord.restore();
  }
});

// Photographie de ce que l'utilisateur avait copié, pour le lui rendre après
// le collage.
function snapshotClipboard() {
  const snap = {};
  try {
    const formats = clipboard.availableFormats();
    if (formats.some((f) => f.startsWith('text/plain'))) snap.text = clipboard.readText();
    if (formats.includes('text/html')) snap.html = clipboard.readHTML();
    if (formats.includes('text/rtf')) snap.rtf = clipboard.readRTF();
    if (formats.some((f) => f.startsWith('image/'))) {
      const img = clipboard.readImage();
      if (!img.isEmpty()) snap.image = img;
    }
  } catch { /* presse-papiers occupé : on ne restaurera rien */ }
  return snap;
}

function restoreClipboard(snap) {
  try {
    if (Object.keys(snap).length) clipboard.write(snap); else clipboard.clear();
  } catch { /* tant pis : le texte dicté reste dans le presse-papiers */ }
}

const delay = (ms) => new Promise((r) => setTimeout(r, ms));

async function pasteText(text) {
  const snap = snapshotClipboard();
  clipboard.writeText(text);
  const ok = await paste.sendPaste();
  // Collage raté (outil absent sous Linux…) : le texte RESTE dans le
  // presse-papiers, l'utilisateur le colle à la main.
  if (!ok) return false;
  // L'application cible lit le presse-papiers APRÈS avoir reçu Ctrl+V, et à
  // son rythme : restaurer tout de suite lui ferait coller l'ancien contenu.
  await delay(400);
  restoreClipboard(snap);
  return true;
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
    return { ok: false, code, error: MESSAGES[code] };
  }
  if (!text) return { ok: true, text: '', pasted: false };
  if (cfg.showText !== false) showBubble(text);
  return { ok: true, text, pasted: await pasteText(text) };
});

/* ---- Menu du clic droit -------------------------------------------------- */

// `devices` = micros énumérés par le renderer (seul à y avoir accès).
ipcMain.on('menu:open', (_e, devices) => {
  if (!win) return;
  const cfg = loadConfig();
  const mics = Array.isArray(devices) ? devices.filter((d) => d && typeof d.deviceId === 'string') : [];
  const { cli, model } = whisper.locateWhisper(whisperDirs());
  const template = [
    { label: cli && model ? `Modèle : ${path.basename(model)}` : 'whisper.cpp non installé', enabled: false },
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
    { label: 'Afficher le texte transcrit', type: 'checkbox', checked: cfg.showText !== false,
      click: (i) => { saveConfig({ showText: i.checked }); if (!i.checked) hideBubble(); } },
    ...(process.platform === 'linux' ? [
      { label: 'Autoriser la coupure du micro Discord', type: 'checkbox', checked: cfg.discordMute === true,
        click: (i) => saveConfig({ discordMute: i.checked }) },
    ] : []),
    { type: 'separator' },
    { label: 'Ouvrir le dossier whisper', click: () => { fs.mkdirSync(ownWhisperDir(), { recursive: true }); shell.openPath(ownWhisperDir()); } },
    { label: 'Modifier la configuration (vocabulaire…)', click: () => { saveConfig({}); shell.openPath(configFile()); } },
    { type: 'separator' },
    { label: 'Quitter', click: () => app.quit() },
  ];
  Menu.buildFromTemplate(template).popup({ window: win });
});

/* ---- Cycle de vie -------------------------------------------------------- */

app.whenReady().then(() => {
  setupPermissions(require('electron').session.defaultSession);
  createWindow();
  createBubble();
});
app.on('window-all-closed', () => app.quit());
app.on('will-quit', () => paste.stop());
