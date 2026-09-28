/* =========================================================================
   Whisper — Ctrl+V simulé dans l'application au premier plan

   Le texte est déjà dans le presse-papiers : un collage passe tel quel, là où
   simuler chaque frappe massacrerait accents et caractères spéciaux.

   - Windows : un PowerShell PERMANENT (paste-windows.ps1), préchauffé pendant
     qu'on parle pour que le premier collage n'attende pas son démarrage.
   - Linux : xdotool (X11), sinon wtype puis ydotool (Wayland).
   ========================================================================= */

const path = require('path');
const fs = require('fs');
const { spawn, execFile } = require('child_process');

/* ---- Windows ------------------------------------------------------------ */

function scriptPath(name) {
  const inside = path.join(__dirname, name);
  const unpacked = inside.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
  if (unpacked !== inside && fs.existsSync(unpacked)) return unpacked;
  return inside;
}

let helper = null;
let pending = [];

function startHelper() {
  if (helper) return helper;
  const child = spawn('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath('paste-windows.ps1')],
    { windowsHide: true, stdio: ['pipe', 'pipe', 'ignore'] });
  let buf = '';
  child.stdout.on('data', (d) => {
    buf += d;
    let i;
    while ((i = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (line && pending.length) pending.shift()(line);
    }
  });
  const dead = () => {
    if (helper === child) helper = null;
    for (const p of pending) p(null);
    pending = [];
  };
  child.on('error', dead);
  child.on('close', dead);
  child.stdin.on('error', () => {});
  helper = child;
  return child;
}

// Résout true si le helper a répondu, false (mort, 5 s sans réponse) sinon.
function pasteWindows() {
  return new Promise((resolve) => {
    const child = startHelper();
    const timer = setTimeout(() => {
      const idx = pending.indexOf(done);
      if (idx >= 0) pending.splice(idx, 1);
      resolve(false);
    }, 5000);
    function done(line) { clearTimeout(timer); resolve(line === 'ok'); }
    pending.push(done);
    child.stdin.write('paste\n');
  });
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

function warmUp() { if (isWin) startHelper(); }
function sendPaste() { return isWin ? pasteWindows() : pasteLinux(); }
function stop() {
  if (helper) { try { helper.kill(); } catch { /* déjà mort */ } helper = null; }
}

module.exports = { warmUp, sendPaste, stop };
