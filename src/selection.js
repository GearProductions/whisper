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

const TEXT_TYPE = /^(text\/plain|UTF8_STRING|STRING|TEXT)\b/;
const HAS_TEXT_MAX = 4096;

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
  const cli = findWlPaste();
  if (!cli) {
    try { return !!clipboard.readText(mode).trim(); } catch { return false; }
  }
  if (!(await textOffered(cli, mode))) return false;
  const head = await wlPasteRun(cli, textArgs(mode), HAS_TEXT_MAX);
  return head === null || !!head.trim(); // null : plus long que HAS_TEXT_MAX
}

module.exports = { readText, hasText };
