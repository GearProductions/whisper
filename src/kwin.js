/* =========================================================================
   Whisper — fenêtres « sur tous les bureaux » sous KDE Plasma (KWin)

   L'icône et la bulle ne prennent jamais le focus : elles échappent au
   gestionnaire de fenêtres et s'affichent sur tous les bureaux virtuels. Le
   panneau des conversations et la relecture prennent le focus (on y écrit) :
   KWin les gère et les range sur UN bureau — changer de bureau les laissait
   derrière.

   Ni Electron (setVisibleOnAllWorkspaces ne fait rien sous Linux) ni la
   demande X11 standard (_NET_WM_DESKTOP, celle de wmctrl) n'y peuvent : KWin
   sous Wayland ignore cette demande venant d'une appli X11. Seul KWin le peut
   (Alt+F3 → Sur tous les bureaux). On lui confie donc, par D-Bus, un petit
   script TEMPORAIRE : toute fenêtre gérée de notre processus va sur tous les
   bureaux, maintenant et à chaque (ré)affichage. Rien n'est écrit dans la
   configuration de KDE ; le script est retiré à la fermeture de l'appli (et
   disparaît avec la session). Ailleurs qu'en KDE : rien.
   ========================================================================= */

const fs = require('fs');
const path = require('path');
const { execFile, spawnSync } = require('child_process');
const { which } = require('./paths');

const NAME = `whisper-dictation-${process.pid}`;

// KWin 6 (windowList, windowAdded) comme KWin 5 (clientList, clientAdded).
const SCRIPT = `
function stick(w) { if (w && w.pid === ${process.pid}) w.onAllDesktops = true; }
(workspace.windowList ? workspace.windowList() : workspace.clientList()).forEach(stick);
(workspace.windowAdded || workspace.clientAdded).connect(stick);
`;

// dbus-send, ou celui de l'hôte depuis une distrobox. null : pas de D-Bus.
function dbusCommand() {
  const own = which('dbus-send');
  if (own) return [own];
  const host = which('distrobox-host-exec');
  return host ? [host, 'dbus-send'] : null;
}

function kwin(args) {
  const cmd = dbusCommand();
  if (!cmd) return Promise.resolve(null);
  return new Promise((resolve) => {
    execFile(cmd[0], [...cmd.slice(1), '--session', '--print-reply', '--dest=org.kde.KWin', ...args],
      { timeout: 3000 }, (err, stdout) => resolve(err ? null : stdout));
  });
}

let loaded = false;

// À appeler une fois au démarrage. `dir` : où écrire le script (lisible par
// KWin, donc sur l'hôte). Résout true si KWin l'a accepté.
async function stickToAllDesktops(dir) {
  if (process.platform !== 'linux' || !/KDE/i.test(process.env.XDG_CURRENT_DESKTOP || '')) return false;
  const file = path.join(dir, 'kwin-tous-les-bureaux.js');
  try { fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(file, SCRIPT); } catch { return false; }
  const out = await kwin(['/Scripting', 'org.kde.kwin.Scripting.loadScript', `string:${file}`, `string:${NAME}`]);
  const id = out && (out.match(/int32 (-?\d+)/) || [])[1];
  if (id === undefined || Number(id) < 0) return false;
  loaded = true;
  // KWin 6 : /Scripting/Script<id> ; KWin 5 : /<id>.
  return !!(await kwin([`/Scripting/Script${id}`, 'org.kde.kwin.Script.run'])
    || await kwin([`/${id}`, 'org.kde.kwin.Script.run']));
}

// À la fermeture : le script n'a plus d'objet (synchrone : l'appli s'en va).
function release() {
  const cmd = loaded && dbusCommand();
  if (!cmd) return;
  spawnSync(cmd[0], [...cmd.slice(1), '--session', '--print-reply', '--dest=org.kde.KWin', '/Scripting',
    'org.kde.kwin.Scripting.unloadScript', `string:${NAME}`], { timeout: 2000 });
}

module.exports = { stickToAllDesktops, release };
