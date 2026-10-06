/** bubble-window — la petite bulle au-dessus de l'icône : un message de
 *  l'appli, le curseur du volume. Le texte dicté, lui, va au panneau (contexte
 *  « Dictée ») ; quand le panneau est ouvert, il occupe cette place et c'est
 *  lui qui montre ces messages. Elle ne prend jamais le focus (I-1).
 *  Ne connaît pas : la dictée, les agents. Utilisé par : app. */
import { BrowserWindow, screen } from 'electron';
import type { BubbleKind } from 'shared/bridge';
import { page, preload } from 'app/settings';
import { state } from 'app/state';
import { onTop } from './icon-window';
import { conversationNotice, conversationShown } from './panel-window';

const BUBBLE_SIZE = { width: 340, maxHeight: 240 };
export const BUBBLE_GAP = 6;
const BUBBLE_MS = 10000; // affichage avant masquage automatique

// Créée une fois, cachée : la montrer ensuite est instantané.
export function createBubble() {
  const bubble = new BrowserWindow({
    width: BUBBLE_SIZE.width, height: 80, show: false,
    frame: false, transparent: true, resizable: false, maximizable: false, fullscreenable: false,
    skipTaskbar: true, hasShadow: false, alwaysOnTop: onTop(),
    // Comme l'icône : la cliquer ne vole pas le focus à l'application cible.
    focusable: false,
    webPreferences: { preload: preload('bubble'), contextIsolation: true, sandbox: true },
  });
  state.bubble = bubble;
  bubble.setAlwaysOnTop(onTop(), 'floating');
  bubble.setVisibleOnAllWorkspaces(true);
  bubble.webContents.on('will-navigate', (e) => e.preventDefault());
  bubble.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  bubble.loadFile(page('app/bubble/bubble.html'));
}

export const bubbleShown = () => !!state.bubble && state.bubble.isVisible();

export function hideBubble() {
  clearTimeout(state.bubbleTimer);
  if (state.bubble && state.bubble.isVisible()) state.bubble.hide();
}

function scheduleHide(ms: number) {
  clearTimeout(state.bubbleTimer);
  state.bubbleTimer = setTimeout(hideBubble, ms);
}

// Le texte part à la page de la bulle, qui mesure sa hauteur et répond
// `bubble:ready` : c'est là qu'on la place et qu'on la montre. `kind` :
// 'notice' (« Micro Discord coupé », le temps d'un enregistrement), 'status'
// (téléchargement…) ou 'volume' (le curseur du volume de lecture ; `text` est
// alors le volume, 0 à 1). Panneau ouvert : le message s'y affiche, ni
// par-dessus ni à côté (sauf le volume, demandé au menu).
export function showBubble(text: string | number, kind: BubbleKind) {
  if (!state.bubble || !state.icon) return;
  if (conversationShown() && kind !== 'volume') { conversationNotice(String(text), kind); return; }
  state.bubbleKind = kind;
  state.bubble.webContents.send('bubble:show', text, kind, BUBBLE_SIZE);
}

// Au-dessus de l'icône, centrée sur elle ; en dessous si le haut de l'écran
// manque de place ; toujours dans la zone de travail de l'écran de l'icône.
// Rappelée à chaque pas du glisser : la bulle suit l'icône.
export function placeBubble() {
  const icon = state.icon!.getBounds();
  const a = screen.getDisplayMatching(icon).workArea;
  const { width } = BUBBLE_SIZE;
  let x = icon.x + Math.round(state.winSize / 2 - width / 2); // centrée sur le micro, pas sur les petits boutons
  x = Math.max(a.x, Math.min(a.x + a.width - width, x));
  let y = icon.y - state.bubbleH - BUBBLE_GAP;
  if (y < a.y) y = Math.min(icon.y + icon.height + BUBBLE_GAP, a.y + a.height - state.bubbleH);
  state.bubble!.setBounds({ x, y, width, height: state.bubbleH });
}

// La page a mesuré son contenu : on place la bulle et on la montre.
export function bubbleReady(height: unknown) {
  if (!state.bubble || !state.icon) return;
  // Notice arrivée après la fin de l'enregistrement : elle n'a plus lieu d'être.
  if (state.bubbleKind === 'notice' && !state.recording) return;
  state.bubbleH = Math.max(40, Math.min(BUBBLE_SIZE.maxHeight, Math.round(Number(height)) || 80));
  placeBubble();
  state.bubble.showInactive();
  scheduleHide(BUBBLE_MS);
}

// Survolée : on la laisse lire ; quittée : le délai repart.
export function bubbleHover(inside: unknown) {
  if (!state.bubble || !state.bubble.isVisible()) return;
  if (inside) clearTimeout(state.bubbleTimer); else scheduleHide(BUBBLE_MS);
}
