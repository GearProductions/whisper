/* =========================================================================
   Whisper — assistant Windows (windows-helper.ps1)

   Un PowerShell PERMANENT : le lancer et compiler ses types coûte ~1 s, qu'on
   ne veut payer ni à chaque collage ni au début de chaque dictée (coupure du
   micro Discord). Démarré avec l'appli, relancé s'il meurt.

   Une commande par ligne, une ligne de réponse, dans l'ordre : paste, copy,
   discord-mute, discord-restore, others-mute, others-restore (cf. le script).
   ========================================================================= */

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const TIMEOUT_MS = 5000;

// Dans un paquet (asar), PowerShell ne lit pas l'archive : le script en est
// sorti (asarUnpack, cf. package.json).
function scriptPath() {
  const inside = path.join(__dirname, 'windows-helper.ps1');
  const unpacked = inside.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
  return unpacked !== inside && fs.existsSync(unpacked) ? unpacked : inside;
}

let helper = null;
let pending = [];

function start() {
  if (helper) return helper;
  const child = spawn('powershell.exe',
    ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', scriptPath()],
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

// Réponse du script, ou null (mort, TIMEOUT_MS sans réponse).
function request(command) {
  return new Promise((resolve) => {
    const child = start();
    const timer = setTimeout(() => {
      const idx = pending.indexOf(done);
      if (idx >= 0) pending.splice(idx, 1);
      resolve(null);
    }, TIMEOUT_MS);
    function done(line) { clearTimeout(timer); resolve(line); }
    pending.push(done);
    child.stdin.write(`${command}\n`);
  });
}

function stop() {
  if (helper) { try { helper.kill(); } catch { /* déjà mort */ } helper = null; }
}

module.exports = { start, request, stop };
