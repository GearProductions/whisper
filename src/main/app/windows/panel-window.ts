/** panel-window — la fenêtre de l'appli : une fenêtre classique sans cadre
 *  du système (l'en-tête de VibeCoder sert de barre de titre, les boutons de la
 *  fenêtre dessinés par Electron à sa droite), barre des tâches, redimensionnable, ni au premier plan ni sur tous
 *  les bureaux. Créée au lancement (createWindow) ; la fermer quitte l'appli.
 *  Sa taille est retenue (`vibeSize`). Une ouverture que l'utilisateur n'a pas
 *  demandée ne lui prend pas le clavier (I-18).
 *  Une conversation à la fois : celle de l'agent affiché (openConversation, où
 *  mène showAgent ; c'est aussi l'agent sélectionné).
 *  Ne connaît pas : le contenu (controllers).
 *  Utilisé par : app. */
import { BrowserWindow, app } from 'electron';
import type { NoticeKind } from 'shared/bridge';
import { agentList } from 'core/config';
import { pushAgents, runsTab, selectAgent } from 'app/controllers';
import { loadConfig, page, preload, saveConfig } from 'app/settings';
import { state } from 'app/state';

const VIBE_SIZE = { width: 1280, height: 820 };   // par défaut
const VIBE_MIN = { width: 960, height: 600 };

// Mode « conversation » : le panneau est montré. L'agent affiché (sur sa
// session en cours) y reçoit ses demandes d'autorisation, dans le fil, et sa
// réponse y est lue d'office ; celle d'un autre agent met sa pastille dans le
// sélecteur.
export const conversationShown = () => !!state.panel && !state.panel.isDestroyed() && state.panel.isVisible();
export const inConversation = (id: string) => conversationShown() && !!state.convView && state.convView.agentId === id && !state.convView.sessionId;

// Ouvre la conversation de l'agent : sa session en cours (ou une ancienne).
// `focus` : false pour une ouverture que l'utilisateur n'a pas demandée (demande
// d'autorisation) — elle ne lui vole pas le clavier : restore() le prendrait,
// une fenêtre masquée puis montrée « inactive » non.
export function openConversation(agentId: string, { sessionId = null, focus = true }: { sessionId?: string | null; focus?: boolean } = {}) {
  const agent = agentList(loadConfig()).find((a) => a.id === agentId);
  if (!agent) return;
  selectAgent(agentId); // l'agent affiché et l'agent sélectionné vont ensemble
  const old = sessionId && sessionId !== agent.sessionId ? sessionId : null;
  state.convView = { agentId, sessionId: old };
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

// Au lancement (focus : l'appli vient d'être lancée pour qu'on s'en serve).
export function createWindow(focus = true) {
  state.convReady = false;
  const saved = loadConfig().vibeSize;
  const size = saved && Number.isFinite(saved.width) && Number.isFinite(saved.height) ? saved : VIBE_SIZE;
  const conv = new BrowserWindow({
    width: Math.max(VIBE_MIN.width, size.width), height: Math.max(VIBE_MIN.height, size.height),
    minWidth: VIBE_MIN.width, minHeight: VIBE_MIN.height, show: false,
    backgroundColor: '#1c1f25', title: 'Whisper',   // le fond de la vue C (--vc-bg) : pas d'éclair au chargement
    // Sans cadre du système : l'en-tête de VibeCoder sert de barre de titre (déplacer : -webkit-app-region),
    // les boutons réduire / agrandir / fermer dessinés par Electron à sa droite (Window Controls Overlay).
    titleBarStyle: 'hidden', titleBarOverlay: { color: '#21252c', symbolColor: '#a3a9b5', height: 48 },   // --vc-side, --vc-soft, l'en-tête
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

// Le focus du champ de saisie : remis à la page APRÈS le fil de cet agent (cf.
// refreshConversation) — envoyé tout de suite, il irait au brouillon de l'agent
// encore affiché.
export function conversationFocusInput() {
  state.convFocusInput = true;
}
export function deliverPending() {
  const conv = state.panel;
  if (!conv || !state.convReady) return;
  if (state.convFocusInput) { conv.webContents.send('conv:focusInput'); state.convFocusInput = false; }
}

// Message de l'appli montré en tête du panneau ; null l'efface.
export function conversationNotice(text: string | null, kind?: NoticeKind) {
  state.convNotice = text === null ? null : { kind: kind!, text: String(text) };
  if (state.panel && state.convReady) state.panel.webContents.send('conv:notice', state.convNotice);
}
