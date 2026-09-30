/* =========================================================================
   Whisper — lire le texte sélectionné (ou le presse-papiers)

   Sous Wayland, Electron tourne en X11 (XWayland), et le compositeur ne
   transmet sélection et presse-papiers à une fenêtre X11 que lorsqu'elle a le
   focus — or l'icône ne le prend jamais. On passe donc par `wl-paste`
   (wl-clipboard), qui les lit sans focus. Dans une distrobox, celui de l'hôte
   (/run/host) fait l'affaire.

   Sous KDE, Klipper remplit aussitôt une sélection vidée avec sa dernière
   entrée, marquée du type KLIPPER_REFILL : on la tient pour vide, sinon le
   bouton ne serait jamais grisé. Pas pour le presse-papiers : ce qu'on a
   copié doit rester lisible une fois l'application source fermée.

   Windows n'a pas de sélection « primaire » : au clic, on envoie Ctrl+C à
   l'application au premier plan (qui garde le focus, l'icône ne le prenant
   jamais), on lit le presse-papiers, puis on le rend tel qu'il était. On ne
   peut donc pas savoir d'avance s'il y a une sélection : hasText dit oui.

   Ailleurs (X11, pas de wl-paste) : le presse-papiers d'Electron, dont la
   sélection primaire sous X11.
   ========================================================================= */

const { execFile } = require('child_process');
const { clipboard } = require('electron');
const windows = require('./windows');
const { which } = require('./paths');

const MAX_BYTES = 1024 * 1024;
const KLIPPER_REFILL = 'application/x-kde-onlyReplaceEmpty';

let wlPaste; // chemin, null si absent ; cherché une fois

function findWlPaste() {
  if (wlPaste !== undefined) return wlPaste;
  // /run/host : dans une distrobox, le wl-paste de l'hôte.
  wlPaste = process.platform === 'linux' && process.env.WAYLAND_DISPLAY ? which('wl-paste', ['/run/host/usr/bin']) : null;
  return wlPaste;
}

const TEXT_TYPE = /^(text\/plain|UTF8_STRING|STRING|TEXT)\b/;
const HAS_TEXT_MAX = 4096;

const isWin = process.platform === 'win32';
const COPY_WAIT_MS = 600; // le temps que l'application réponde au Ctrl+C
const delay = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- Presse-papiers : photographier, rendre ------------------------------ */

// Ce que l'utilisateur avait copié, pour le lui rendre après un collage ou un
// Ctrl+C simulé.
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
  } catch { /* tant pis */ }
}

/* ---- Windows : Ctrl+C simulé -------------------------------------------- */

// Vidé avant : s'il reste vide, rien n'était sélectionné (ou l'application
// n'a pas répondu à temps).
async function copySelection() {
  const snap = snapshotClipboard();
  try { clipboard.clear(); } catch { /* occupé */ }
  let text = '';
  if (await windows.request('copy') === 'ok') {
    for (let waited = 0; !text && waited < COPY_WAIT_MS; waited += 25) {
      await delay(25);
      try { text = clipboard.readText(); } catch { /* occupé */ }
    }
  }
  restoreClipboard(snap);
  return text;
}

/* ---- wl-paste (Wayland) -------------------------------------------------- */

const textArgs = (mode) => ['--no-newline', '--type', 'text', ...(mode === 'selection' ? ['--primary'] : [])];

// stdout ; '' si wl-paste échoue ; `null` si le texte dépasse `max` octets.
function wlPasteRun(cli, args, max = MAX_BYTES) {
  return new Promise((resolve) => {
    execFile(cli, args, { timeout: 1500, maxBuffer: max }, (err, stdout) => {
      if (err && err.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') resolve(null);
      else resolve(err ? '' : stdout);
    });
  });
}

// Types proposés, sans les contenus : KLIPPER_REFILL et pas de texte → rien.
async function textOffered(cli, mode) {
  const primary = mode === 'selection';
  const types = (await wlPasteRun(cli, ['--list-types', ...(primary ? ['--primary'] : [])])).split('\n');
  if (primary && types.includes(KLIPPER_REFILL)) return false;
  return types.some((t) => TEXT_TYPE.test(t));
}

// `mode` : 'selection' (primaire, Linux) ou 'clipboard'. Résout '' si rien
// (vide, image seule, sélection trop grosse…).
async function readText(mode) {
  if (isWin && mode === 'selection') return copySelection();
  const cli = findWlPaste();
  if (!cli) {
    try { return clipboard.readText(mode); } catch { return ''; }
  }
  if (!(await textOffered(cli, mode))) return '';
  return (await wlPasteRun(cli, textArgs(mode))) || '';
}

// Y a-t-il du texte à lire ? Relevé toutes les 500 ms pour le bouton : on
// n'en lit que HAS_TEXT_MAX octets (une sélection peut peser 1 Mo). Les types
// ne suffisent pas : un éditeur (Zed…) peut annoncer du texte vide.
async function hasText(mode) {
  if (isWin && mode === 'selection') return true; // inconnaissable sans Ctrl+C
  const cli = findWlPaste();
  if (!cli) {
    try { return !!clipboard.readText(mode).trim(); } catch { return false; }
  }
  if (!(await textOffered(cli, mode))) return false;
  const head = await wlPasteRun(cli, textArgs(mode), HAS_TEXT_MAX);
  return head === null || !!head.trim(); // null : plus long que HAS_TEXT_MAX
}

// Pour un simple aperçu (préchargement au survol) : jamais de Ctrl+C simulé.
function peekText(mode) {
  return isWin && mode === 'selection' ? Promise.resolve('') : readText(mode);
}

module.exports = { readText, hasText, peekText, snapshotClipboard, restoreClipboard };
