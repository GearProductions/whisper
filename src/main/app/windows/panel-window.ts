/** panel-window — le panneau des conversations, ATTACHÉ À L'ICÔNE, à la place
 *  de la bulle : sans cadre, au-dessus des autres fenêtres (réglage `onTop`),
 *  il suit l'icône quand on la déplace. Deux tailles :
 *    - réduit : le dernier échange, à la taille de son contenu ;
 *    - agrandi : tout le fil, l'historique ; redimensionnable par ses bords,
 *      taille retenue (`convSize`).
 *  Il prend le focus (on y écrit) : le gestionnaire de fenêtres le gère, et le
 *  range sur un bureau virtuel (sous KDE, Alt+F3 → Sur tous les bureaux). Sa
 *  croix le RÉDUIT (au sens du système) au lieu de le masquer : une fenêtre
 *  masquée revient sur le bureau courant en oubliant ce réglage, une fenêtre
 *  réduite le garde. Une ouverture que l'utilisateur n'a pas demandée ne lui
 *  prend pas le clavier (I-18).
 *  Une conversation à la fois : celle du robot sélectionné, ou, aucun ne l'étant,
 *  le contexte « Dictée ». Ouvert, il remplace la bulle.
 *  Ne connaît pas : le contenu des conversations (controllers/conversation).
 *  Utilisé par : app. */
import { BrowserWindow, screen } from 'electron';
import type { BubbleKind, ConvMode } from 'shared/bridge';
import { agentList } from 'core/config';
import { pushAgents, selectAgent } from 'app/controllers';
import { loadConfig, page, preload, saveConfig } from 'app/settings';
import { state } from 'app/state';
import { BUBBLE_GAP, hideBubble } from './bubble-window';
import { onTop } from './icon-window';

const CONV_SIZE = { width: 720, height: 700 };    // agrandi, par défaut
const CONV_MIN_WIDTH = 380;
const COMPACT = { width: 560, minHeight: 160, maxHeight: 560 };

// Mode « conversation » : le panneau est montré. L'agent affiché (sur sa
// session en cours) y reçoit ses demandes d'autorisation, dans le fil, et sa
// réponse y est lue d'office ; celle d'un autre agent met la pastille sur son
// robot. Panneau masqué ou réduit : retour à la bulle.
export const conversationShown = () => !!state.panel && !state.panel.isDestroyed() && state.panel.isVisible();
export const inConversation = (id: string) => conversationShown() && !!state.convView && state.convView.agentId === id && !state.convView.sessionId;

// Ouvre la conversation de l'agent : sa session en cours (ou une ancienne, en
// agrandi) ; `agentId` null : le contexte « Dictée », toujours réduit. `mode` :
// la taille ; par défaut, celle du panneau s'il est déjà ouvert, sinon le
// réduit. `focus` : false pour une ouverture que l'utilisateur n'a pas
// demandée (dictée, demande d'autorisation) — elle ne lui vole pas le
// clavier : restore() le prendrait, une fenêtre masquée puis montrée
// « inactive » non (mais elle oublie « sur tous les bureaux »).
export function openConversation(agentId: string | null, { sessionId = null, mode = null, focus = true }: { sessionId?: string | null; mode?: ConvMode | null; focus?: boolean } = {}) {
  const agent = agentId ? agentList(loadConfig()).find((a) => a.id === agentId) : null;
  if (agentId && !agent) return;
  selectAgent(agent ? agentId : null); // le robot affiché et le robot sélectionné vont ensemble
  const old = agent && sessionId && sessionId !== agent.sessionId ? sessionId : null;
  state.convView = { agentId: agent ? agentId : null, sessionId: old };
  state.convMode = old ? 'full' : !agent ? 'compact' : mode || (conversationShown() ? state.convMode : 'compact');
  hideBubble(); // le panneau prend sa place
  const conv = state.panel;
  if (!conv) { createConversation(focus); return; }
  conv.setResizable(state.convMode === 'full');
  placeConversation();
  if (focus) {
    if (conv.isMinimized()) conv.restore();
    conv.show();
    conv.focus();
  } else if (!conversationShown()) {
    conv.hide();
    conv.showInactive();
  }
  pushAgents(); // lu d'office, panneau à jour
}

// Le texte dicté pour ailleurs (aucun robot sélectionné) : dans le panneau,
// contexte « Dictée », sans prendre le clavier.
export function openDictation(text: string) {
  state.dictation = { text, time: Date.now() };
  openConversation(null, { focus: false });
}

function createConversation(focus: boolean) {
  state.convReady = false;
  const conv = new BrowserWindow({
    width: COMPACT.width, height: state.convCompactH, minWidth: CONV_MIN_WIDTH, minHeight: COMPACT.minHeight, show: false,
    frame: false, resizable: state.convMode === 'full', maximizable: false, fullscreenable: false, skipTaskbar: true,
    alwaysOnTop: onTop(), backgroundColor: '#171b24', title: 'Whisper — conversation',
    webPreferences: { preload: preload('panel'), contextIsolation: true, sandbox: true },
  });
  state.panel = conv;
  conv.setAlwaysOnTop(onTop(), 'floating');
  conv.setVisibleOnAllWorkspaces(true);
  // Les liens passent par conv:openLink : la fenêtre ne navigue jamais ailleurs.
  conv.webContents.on('will-navigate', (e) => e.preventDefault());
  conv.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  conv.loadFile(page('app/panel/conversation.html'));
  conv.once('ready-to-show', () => {
    if (!state.panel) return;
    placeConversation();
    if (focus) { conv.show(); conv.focus(); } else conv.showInactive();
  });
  conv.on('closed', () => { state.panel = null; state.convView = null; state.convThread = []; state.convReady = false; });
  conv.on('focus', pushAgents); // la conversation affichée est lue
  // Agrandi et redimensionné à la main (pas par placeConversation) : la taille
  // est retenue, puis le panneau se recale contre l'icône.
  conv.on('resize', () => {
    clearTimeout(state.convResizeTimer);
    state.convResizeTimer = setTimeout(() => {
      if (!state.panel || !state.panel.isVisible() || !state.convPlaced || state.convMode !== 'full') return;
      const { width, height } = state.panel.getBounds();
      if (Math.abs(width - state.convPlaced.width) < 3 && Math.abs(height - state.convPlaced.height) < 3) return;
      saveConfig({ convSize: { width, height } });
      placeConversation();
    }, 400);
  });
}

// Contre l'icône, centré sur le micro : au-dessus, ou en dessous s'il y a plus
// de place ; la hauteur se plie à la place disponible, tout reste à l'écran.
// Rappelé à chaque pas du glisser de l'icône : le panneau la suit.
export function placeConversation() {
  if (!state.panel || !state.icon) return;
  const icon = state.icon.getBounds();
  const a = screen.getDisplayMatching(icon).workArea;
  const saved = loadConfig().convSize;
  const full = saved && Number.isFinite(saved.width) && Number.isFinite(saved.height) ? saved : CONV_SIZE;
  const size = state.convMode === 'full' ? full : { width: COMPACT.width, height: state.convCompactH };
  const above = icon.y - BUBBLE_GAP - a.y;
  const below = a.y + a.height - (icon.y + icon.height + BUBBLE_GAP);
  const width = Math.max(CONV_MIN_WIDTH, Math.min(size.width, a.width));
  const height = Math.max(COMPACT.minHeight, Math.min(size.height, Math.max(above, below)));
  const x = Math.max(a.x, Math.min(a.x + a.width - width, icon.x + Math.round(state.winSize / 2 - width / 2)));
  const y = above >= below ? icon.y - BUBBLE_GAP - height : icon.y + icon.height + BUBBLE_GAP;
  state.convPlaced = { x, y: Math.max(a.y, Math.min(a.y + a.height - height, y)), width, height };
  state.panel.setBounds(state.convPlaced);
}

// La croix du panneau : réduit au sens du système (cf. plus haut), ses
// notifications repassent par les robots.
export function hideConversation() {
  if (!conversationShown()) return;
  state.panel!.minimize();
  pushAgents();
}

// Réduit : la page dit la hauteur de son contenu, le panneau s'y ajuste.
export function setCompactHeight(height: unknown) {
  const h = Math.round(Number(height));
  if (!Number.isFinite(h)) return;
  state.convCompactH = Math.max(COMPACT.minHeight, Math.min(COMPACT.maxHeight, h));
  if (state.convMode === 'compact' && conversationShown()) placeConversation();
}

// La dictée vers l'agent du panneau, dans son champ de saisie, et le focus du
// champ : remis à la page APRÈS le fil de cet agent (cf. refreshConversation) —
// envoyés tout de suite, ils iraient au brouillon de l'agent encore affiché.
export function conversationInput(text: string) {
  state.convInput += `${state.convInput ? ' ' : ''}${text}`;
}
export function conversationFocusInput() {
  state.convFocusInput = true;
}
export function deliverPending() {
  const conv = state.panel;
  if (!conv || !state.convReady) return;
  if (state.convInput) { conv.webContents.send('conv:dictation', state.convInput); state.convInput = ''; }
  if (state.convFocusInput) { conv.webContents.send('conv:focusInput'); state.convFocusInput = false; }
}

// Message de l'appli montré en tête du panneau, à la place de la bulle ; null l'efface.
export function conversationNotice(text: string | null, kind?: BubbleKind) {
  state.convNotice = text === null ? null : { kind: kind!, text: String(text) };
  if (state.panel && state.convReady) state.panel.webContents.send('conv:notice', state.convNotice);
}
