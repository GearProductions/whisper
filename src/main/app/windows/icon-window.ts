/** icon-window — la fenêtre de l'icône : ronde, flottante, au premier plan
 *  (réglage `onTop`), qui ne prend JAMAIS le focus (I-1) — le texte dicté doit
 *  arriver dans l'application où est le curseur. Elle s'élargit des petits
 *  boutons accolés (lecture, robots, « + »), moitié moins grands.
 *  Ne connaît pas : la dictée, les agents. Utilisé par : app. */
import { BrowserWindow, screen } from 'electron';
import { agentSlotCount, DEFAULTS, speakMode } from 'core/config';
import { loadConfig, page, preload } from 'app/settings';
import { state } from 'app/state';

export const canReadSelection = process.platform === 'linux' || process.platform === 'win32';

// Au-dessus de toutes les fenêtres (réglage `onTop`, par défaut) : l'icône, sa
// bulle, le panneau des conversations. Décoché (une vidéo en plein écran…) :
// des fenêtres comme les autres, que les autres recouvrent.
export const onTop = () => loadConfig().onTop !== false;
export function applyOnTop() {
  for (const w of [state.icon, state.bubble, state.panel]) if (w && !w.isDestroyed()) w.setAlwaysOnTop(onTop(), 'floating');
}

// Les petits boutons (lecture, agents, ajout) s'alignent à droite de l'icône :
// la fenêtre s'élargit d'autant (cf. style.css de la page).
export const winWidth = () => state.winSize + ((state.speakShown ? 1 : 0) + state.agentSlots) * (Math.round(state.winSize / 2) + 4);

// Une position mémorisée peut pointer hors écran (moniteur débranché) : on ne
// la retient que si l'icône reste visible.
function isVisible(pos: { x: number; y: number } | null, size: number): pos is { x: number; y: number } {
  if (!pos || !Number.isFinite(pos.x) || !Number.isFinite(pos.y)) return false;
  return screen.getAllDisplays().some(({ workArea: a }) => (
    pos.x + size > a.x && pos.x < a.x + a.width && pos.y + size > a.y && pos.y < a.y + a.height
  ));
}

// `onLoad` : la page est (re)chargée, elle n'a pas encore son état.
export function createIconWindow(onLoad: () => void) {
  const cfg = loadConfig();
  const size = Math.max(32, Math.min(200, Math.round(cfg.size) || DEFAULTS.size));
  state.winSize = size;
  state.speakShown = speakMode(cfg, canReadSelection) !== 'off';
  state.agentSlots = agentSlotCount(cfg);
  const wa = screen.getPrimaryDisplay().workArea;
  const pos = isVisible(cfg.pos, size) ? cfg.pos : { x: wa.x + wa.width - size - 24, y: wa.y + wa.height - size - 24 };

  const win = new BrowserWindow({
    x: Math.round(pos.x), y: Math.round(pos.y), width: winWidth(), height: size,
    frame: false,
    transparent: true,
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    hasShadow: false,
    alwaysOnTop: onTop(),
    // Clé du dispositif : cliquer l'icône laisse le focus à l'application cible.
    focusable: false,
    webPreferences: { preload: preload('icon'), contextIsolation: true, sandbox: true },
  });
  state.icon = win;
  win.setAlwaysOnTop(onTop(), 'floating');
  win.setVisibleOnAllWorkspaces(true);
  win.loadFile(page('app/icon/index.html'), { query: { size: String(size) } });
  win.webContents.on('did-finish-load', onLoad);
}

// Boutons montrés ou masqués : on élargit ou rétrécit la fenêtre.
export function applyWidth() {
  if (!state.icon) return;
  const { x, y } = state.icon.getBounds();
  state.icon.setBounds({ x, y, width: winWidth(), height: state.winSize });
}

// setBounds et non setPosition : avec une échelle d'affichage fractionnaire
// (1,1 sous KDE…), chaque setPosition arrondit la taille vers le haut et
// l'icône grossit à chaque pas du glisser. On réimpose donc la taille.
export function moveIcon(x: number, y: number) {
  state.icon?.setBounds({ x: Math.round(x), y: Math.round(y), width: winWidth(), height: state.winSize });
}

// Un message à la page de l'icône.
export const sendToIcon = (channel: string, ...args: unknown[]) => { if (state.icon) state.icon.webContents.send(channel, ...args); };
