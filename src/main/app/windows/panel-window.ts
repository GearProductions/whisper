/** panel-window — la fenêtre de l'appli : une fenêtre classique (cadre du
 *  système, barre des tâches, redimensionnable), ni au premier plan ni sur tous
 *  les bureaux. Créée au lancement (createWindow) ; la fermer quitte l'appli.
 *  Sa taille est retenue (`vibeSize`) ; elle n'est plus placée contre l'icône,
 *  ni réduite à son contenu : placeConversation et setCompactHeight ne font
 *  plus rien, hideConversation la réduit (au sens du système) ; les trois
 *  partent avec la conversation seule. Une ouverture que l'utilisateur n'a pas
 *  demandée ne lui prend pas le clavier (I-18).
 *  Une conversation à la fois : celle du robot sélectionné, ou, aucun ne l'étant,
 *  le contexte « Dictée ». Ouverte, elle masque la bulle.
 *  Ne connaît pas : le contenu (controllers).
 *  Utilisé par : app. */
import { BrowserWindow, app } from 'electron';
import type { BubbleKind, ConvMode } from 'shared/bridge';
import { agentList } from 'core/config';
import { pushAgents, runsTab, selectAgent } from 'app/controllers';
import { loadConfig, page, preload, saveConfig } from 'app/settings';
import { state } from 'app/state';
import { hideBubble } from './bubble-window';

const VIBE_SIZE = { width: 1280, height: 820 };   // par défaut
const VIBE_MIN = { width: 960, height: 600 };

// Mode « conversation » : le panneau est montré. L'agent affiché (sur sa
// session en cours) y reçoit ses demandes d'autorisation, dans le fil, et sa
// réponse y est lue d'office ; celle d'un autre agent met la pastille sur son
// robot. Panneau masqué ou réduit : retour à la bulle.
export const conversationShown = () => !!state.panel && !state.panel.isDestroyed() && state.panel.isVisible();
export const inConversation = (id: string) => conversationShown() && !!state.convView && state.convView.agentId === id && !state.convView.sessionId;

// Ouvre la conversation de l'agent : sa session en cours (ou une ancienne, en
// agrandi) ; `agentId` null : le contexte « Dictée », toujours réduit. `mode` :
// la taille ; par défaut, celle du panneau s'il est déjà ouvert, sinon le
// réduit ; un agent en VibeCoder, toujours agrandi. `focus` : false pour une
// ouverture que l'utilisateur n'a pas demandée (dictée, demande
// d'autorisation) — elle ne lui vole pas le clavier : restore() le prendrait,
// une fenêtre masquée puis montrée « inactive » non.
export function openConversation(agentId: string | null, { sessionId = null, mode = null, focus = true }: { sessionId?: string | null; mode?: ConvMode | null; focus?: boolean } = {}) {
  const agent = agentId ? agentList(loadConfig()).find((a) => a.id === agentId) : null;
  if (agentId && !agent) return;
  selectAgent(agent ? agentId : null); // le robot affiché et le robot sélectionné vont ensemble
  const old = agent && sessionId && sessionId !== agent.sessionId ? sessionId : null;
  state.convView = { agentId: agent ? agentId : null, sessionId: old };
  state.convMode = old || agent?.view === 'vibecoder' ? 'full' : !agent ? 'compact' : mode || (conversationShown() ? state.convMode : 'compact');
  hideBubble(); // le panneau prend sa place
  const conv = state.panel;
  if (!conv) { createWindow(focus); return; }
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

// Au lancement (focus : l'appli vient d'être lancée pour qu'on s'en serve).
export function createWindow(focus = true) {
  state.convReady = false;
  const saved = loadConfig().vibeSize;
  const size = saved && Number.isFinite(saved.width) && Number.isFinite(saved.height) ? saved : VIBE_SIZE;
  const conv = new BrowserWindow({
    width: Math.max(VIBE_MIN.width, size.width), height: Math.max(VIBE_MIN.height, size.height),
    minWidth: VIBE_MIN.width, minHeight: VIBE_MIN.height, show: false,
    backgroundColor: '#171b24', title: 'Whisper',
    webPreferences: { preload: preload('panel'), contextIsolation: true, sandbox: true, plugins: true },   // plugins : le visionneur PDF d'un artefact
  });
  state.panel = conv;
  // Les liens passent par conv:openLink : la fenêtre ne navigue jamais ailleurs.
  conv.webContents.on('will-navigate', (e) => e.preventDefault());
  conv.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  conv.loadFile(page('app/panel/conversation.html'));
  conv.once('ready-to-show', () => {
    if (!state.panel) return;
    if (focus) { conv.show(); conv.focus(); } else conv.showInactive();
  });
  // Fermée : l'onglet Actions aussi (la page ne le dit pas en partant), et l'appli quitte.
  conv.on('closed', () => { state.panel = null; state.convView = null; state.convThread = []; state.convReady = false; runsTab(null); app.quit(); });
  conv.on('focus', pushAgents); // la conversation affichée est lue
  // Redimensionnée à la main : la taille est retenue.
  conv.on('resize', () => {
    clearTimeout(state.convResizeTimer);
    state.convResizeTimer = setTimeout(() => {
      if (!state.panel || !state.panel.isVisible() || state.panel.isMinimized()) return;
      const { width, height } = state.panel.getBounds();
      saveConfig({ vibeSize: { width, height } });
    }, 400);
  });
}

// Vides : la fenêtre n'est plus placée contre l'icône (le glisser de l'icône
// l'appelle) ni ajustée à la hauteur de son contenu. Retirés avec la conversation seule.
export function placeConversation() {}
export function setCompactHeight(_height: unknown) {}

// La croix de la page : réduit au sens du système, ses notifications repassent
// par les robots.
export function hideConversation() {
  if (!conversationShown()) return;
  state.panel!.minimize();
  pushAgents();
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
