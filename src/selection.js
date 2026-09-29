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

   Ailleurs (X11, Windows, pas de wl-paste) : le presse-papiers d'Electron.
   ========================================================================= */

const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const { clipboard } = require('electron');

const MAX_BYTES = 1024 * 1024;
const KLIPPER_REFILL = 'application/x-kde-onlyReplaceEmpty';

let wlPaste; // chemin, null si absent ; cherché une fois

function findWlPaste() {
  if (wlPaste !== undefined) return wlPaste;
  wlPaste = null;
  if (process.platform !== 'linux' || !process.env.WAYLAND_DISPLAY) return wlPaste;
  const dirs = [...String(process.env.PATH || '').split(path.delimiter), '/run/host/usr/bin'];
  for (const dir of dirs) {
    if (!dir) continue;
    const file = path.join(dir, 'wl-paste');
    try { if (fs.statSync(file).isFile()) { wlPaste = file; break; } } catch { /* pas là */ }
  }
  return wlPaste;
}

// `mode` : 'selection' (primaire, Linux) ou 'clipboard'. Résout '' si rien
// (vide, image seule, sélection trop grosse…).
function readText(mode) {
  const cli = findWlPaste();
  if (!cli) {
    try { return Promise.resolve(clipboard.readText(mode)); } catch { return Promise.resolve(''); }
  }
  const run = (args) => new Promise((resolve) => {
    execFile(cli, args, { timeout: 1500, maxBuffer: MAX_BYTES }, (err, stdout) => resolve(err ? '' : stdout));
  });
  const text = ['--no-newline', '--type', 'text'];
  if (mode !== 'selection') return run(text);
  return run(['--list-types', '--primary']).then((types) => (
    !types || types.split('\n').includes(KLIPPER_REFILL) ? '' : run([...text, '--primary'])));
}

module.exports = { readText };
