/** agents — les agents Claude Code côté appli : un robot par dossier (réglage
 *  `agentsEnabled`). Un robot sélectionné reçoit la dictée au lieu du curseur ;
 *  sa conversation s'affiche dans le panneau. Le robot sélectionné et le robot
 *  affiché vont ensemble.
 *  Ne connaît pas : le contenu du panneau (controllers/conversation).
 *  Utilisé par : app (fenêtres, menus, gestionnaires). */
import fs from 'node:fs';
import path from 'node:path';
import { dialog } from 'electron';
import { createAgentRuntime, createSessions, type AgentConfig, type OutgoingMessage, type Sdk } from 'core/agents';
import { agentColor, agentList, agentSlotCount, folderColors, needsTrust, type Config } from 'core/config';
import { launcher, loadSdk } from 'technicals/claude';
import { createJournal } from 'technicals/journal';
import { agentInstructions, journalFile, loadConfig, saveConfig, updateAgent } from 'app/settings';
import { state } from 'app/state';
import { applyWidth, bubbleShown, conversationShown, inConversation, openConversation, sendToIcon } from 'app/windows';
import { conversationProgress, refreshConversation } from './conversation';

const sdk = loadSdk as unknown as () => Promise<Sdk>;
export const agents = createAgentRuntime({ loadSdk: sdk, launcher, journal: createJournal(() => journalFile()) });
export const sessions = createSessions({ loadSdk: sdk, realpath: fs.realpathSync });

export const CLAUDE_MISSING = 'Claude Code introuvable : installez-le, ou réglez la commande de lancement (clic droit → Agents Claude Code).';

export const isBusy = (id: string) => ['working', 'asking'].includes(agents.state(id).status);

// L'agent affiché dans le panneau ; `liveViewAgent` : seulement sur sa session en cours.
export const viewAgent = (cfg: Config = loadConfig()) => (state.convView && agentList(cfg).find((a) => a.id === state.convView!.agentId)) || null;
export const liveViewAgent = (cfg?: Config) => (state.convView && !state.convView.sessionId ? viewAgent(cfg) : null);

// Donne une couleur aux dossiers qui n'en ont pas, et l'enregistre : elle ne
// doit pas changer d'un lancement à l'autre.
export function ensureFolderColors() {
  const { folders, changed } = folderColors(loadConfig());
  if (changed) saveConfig({ agentFolders: folders });
  return folders;
}

// L'agent sélectionné : celui qui reçoit la dictée, celui du panneau.
export function selectAgent(id: string | null) {
  saveConfig({ agentSelected: id });
}

// État des robots pour la page de l'icône, et largeur de la fenêtre.
export function pushAgents() {
  if (!state.icon) return;
  const cfg = loadConfig();
  const slots = agentSlotCount(cfg);
  if (slots !== state.agentSlots) { state.agentSlots = slots; applyWidth(); }
  const enabled = cfg.agentsEnabled === true;
  for (const a of agentList(cfg)) if (agents.state(a.id).unread && inConversation(a.id)) agents.markRead(a.id); // déjà sous les yeux
  sendToIcon('agents:state', {
    enabled,
    // La pastille du robot, panneau ouvert ou non : celle de l'agent affiché
    // n'apparaît pas (lue d'office, ci-dessus).
    agents: enabled ? agentList(cfg).map((a) => ({ id: a.id, name: a.name, color: agentColor(a, cfg), selected: a.id === cfg.agentSelected, ...agents.state(a.id) })) : [],
  });
  refreshConversation(); // le panneau suit (réponse arrivée, agent au travail…)
}

// `message` part à l'agent ; la réponse arrivera par sa pastille.
export function sendToAgent(agent: AgentConfig, message: OutgoingMessage, cfg: Config): { ok: true } | { ok: false; error: string } {
  if (isBusy(agent.id)) return { ok: false, error: `${agent.name} travaille encore : message non envoyé.` };
  if (!agents.isAvailable(cfg.agentCommand)) return { ok: false, error: CLAUDE_MISSING };
  agents.send(agent, message, {
    command: cfg.agentCommand,
    instructions: agentInstructions(),
    onChange: pushAgents,
    onSession: (sessionId) => updateAgent(agent.id, { sessionId }),
    onProgress: conversationProgress,
    // La demande s'affiche dans le panneau de l'agent : déjà ouvert sur lui,
    // dans son fil ; rien d'ouvert, le panneau réduit s'ouvre, sans prendre le
    // focus. Sinon (on lit autre chose), le « ? » du robot attend qu'on clique.
    onPermission: () => {
      if (inConversation(agent.id)) { refreshConversation(); return; }
      if (!conversationShown() && !bubbleShown()) openConversation(agent.id, { focus: false });
    },
  }).catch((err) => console.error(`agent ${agent.name} : ${err && err.message}`));
  return { ok: true };
}

// Clic sur un robot : ce qui l'attend (demande d'autorisation, réponse non
// lue) s'ouvre dans son panneau ; sinon, basculer la sélection.
export function clickAgent(id: unknown) {
  const cfg = loadConfig();
  const agent = agentList(cfg).find((a) => a.id === id);
  if (!agent) return;
  const st = agents.state(agent.id);
  if (conversationShown()) {
    // Panneau montré : les robots servent d'onglets — cliquer un robot y
    // affiche sa conversation. Second clic sur le robot affiché et
    // sélectionné : la dictée retourne au curseur, le panneau passe à la dictée.
    openConversation(cfg.agentSelected === agent.id && state.convView && state.convView.agentId === agent.id ? null : agent.id);
    return;
  }
  if (st.status === 'asking' || st.unread) { openConversation(agent.id); return; }
  selectAgent(cfg.agentSelected === agent.id ? null : agent.id);
  pushAgents();
}

// Lancé par l'appli, Claude Code ne pose pas sa question « Faire confiance à ce
// dossier ? » : on la pose ici, une fois, quand un dossier devient favori. Les
// réglages d'un projet (.claude/) peuvent lancer des commandes (hooks, MCP).
export async function trustFolder(dir: string) {
  if (!needsTrust(loadConfig(), dir)) return true;
  const { response } = await dialog.showMessageBox({
    type: 'warning', buttons: ['Annuler', 'Faire confiance et ajouter'], defaultId: 0, cancelId: 0,
    title: 'Nouveau dossier pour un agent',
    message: 'Faire confiance à ce dossier ?',
    detail: `${dir}\n\nClaude Code y sera lancé avec les réglages du projet (dossier .claude : hooks, serveurs MCP, `
      + 'autorisations), qui peuvent exécuter des commandes sur cette machine. N\'ajoutez que des dossiers dont vous connaissez le contenu.',
  });
  return response === 1;
}

export function newAgent(dir: string) {
  const cfg = loadConfig();
  const list = agentList(cfg);
  let agent = list.find((a) => a.dir === dir); // un seul agent par dossier
  if (!agent) {
    agent = { id: `a${Date.now().toString(36)}`, dir, name: path.basename(dir) || dir, model: '', effort: '', mode: 'default', sessionId: null };
    saveConfig({ agents: [...list, agent] });
  }
  saveConfig({ agentSelected: agent.id });
  ensureFolderColors(); // nouveau dossier : il reçoit sa couleur et devient favori
  pushAgents();
}
