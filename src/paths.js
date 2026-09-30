/* =========================================================================
   Whisper — où trouver un programme, un script du paquet
   ========================================================================= */

const path = require('path');
const fs = require('fs');
const os = require('os');

// Chemin d'un programme : dans PATH, dans ~/.local/bin (uv, pipx, l'installeur
// de Claude Code : absent du PATH d'une appli lancée hors d'un terminal), puis
// dans `extraDirs`. null s'il est introuvable.
function which(name, extraDirs = []) {
  const names = process.platform === 'win32' && !path.extname(name) ? [`${name}.exe`, `${name}.cmd`, name] : [name];
  const dirs = [...String(process.env.PATH || '').split(path.delimiter), path.join(os.homedir(), '.local', 'bin'), ...extraDirs];
  for (const dir of dirs.filter(Boolean)) {
    for (const n of names) {
      const file = path.join(dir, n);
      try { if (fs.statSync(file).isFile()) return file; } catch { /* pas là */ }
    }
  }
  return null;
}

// Un script de src/ lancé par un autre programme (PowerShell, Python), qui ne
// sait pas lire l'archive du paquet (asar) : il en est sorti (asarUnpack, cf.
// package.json).
function unpacked(name) {
  const inside = path.join(__dirname, name);
  const outside = inside.replace(/app\.asar([\\/])/, 'app.asar.unpacked$1');
  return outside !== inside && fs.existsSync(outside) ? outside : inside;
}

module.exports = { which, unpacked };
