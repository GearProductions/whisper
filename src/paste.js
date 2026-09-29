/* =========================================================================
   Whisper — Ctrl+V simulé dans l'application au premier plan

   Le texte est déjà dans le presse-papiers : un collage passe tel quel, là où
   simuler chaque frappe massacrerait accents et caractères spéciaux.

   - Windows : l'assistant PowerShell permanent (cf. windows.js).
   - Linux : xdotool (X11), sinon wtype puis ydotool (Wayland).
   ========================================================================= */

const { execFile } = require('child_process');
const windows = require('./windows');

/* ---- Windows ------------------------------------------------------------ */

// Résout true si l'assistant a répondu, false (mort, sans réponse) sinon.
async function pasteWindows() {
  return (await windows.request('paste')) === 'ok';
}

/* ---- Linux -------------------------------------------------------------- */

function run(cmd, args) {
  return new Promise((resolve) => {
    execFile(cmd, args, { timeout: 3000 }, (err) => resolve(!err));
  });
}

// Premier outil présent qui réussit. Sous Wayland, xdotool n'atteint que les
// applications XWayland : on le garde en dernier recours.
async function pasteLinux() {
  const x11 = [['xdotool', ['key', '--clearmodifiers', 'ctrl+v']]];
  const wayland = [
    ['wtype', ['-M', 'ctrl', '-k', 'v', '-m', 'ctrl']],
    ['ydotool', ['key', '29:1', '47:1', '47:0', '29:0']], // codes evdev : Ctrl gauche, V
  ];
  const tools = process.env.WAYLAND_DISPLAY ? [...wayland, ...x11] : x11;
  for (const [cmd, args] of tools) if (await run(cmd, args)) return true;
  return false;
}

/* ---- API ---------------------------------------------------------------- */

const isWin = process.platform === 'win32';

// Démarre l'assistant Windows d'avance, pour que le premier collage n'attende pas.
function warmUp() { if (isWin) windows.start(); }
function sendPaste() { return isWin ? pasteWindows() : pasteLinux(); }

module.exports = { warmUp, sendPaste };
