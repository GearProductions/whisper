/** agents — les agents Claude Code côté appli : un robot par dossier (réglage
 *  `agentsEnabled`). Un robot sélectionné reçoit la dictée au lieu du curseur ;
 *  sa conversation s'affiche dans le panneau. Le robot sélectionné et le robot
 *  affiché vont ensemble. Chaque lancement de Claude Code (tour, sonde) reçoit
 *  le plugin de VibeCoder et le dossier de sorties de l'agent. À chaque
 *  changement des agents, les courses suivent (controllers/runs : les avis de
 *  fin en attente, envoyés dès que la conversation est libre). Les robots
 *  s'envoient par famille (core/family) : chacun ses enfants, et sa pastille
 *  (la branche de son dossier, lue sur le disque, ou « PR #n »). Retirer un
 *  agent oublie son processus et ses courses ; ses enfants gardent leur parent.
 *  Ne connaît pas : le contenu du panneau (controllers/conversation), git
 *  (la branche se lit dans .git).
 *  Utilisé par : app (fenêtres, menus, gestionnaires). */
import fs from 'node:fs';
import path from 'node:path';
import { dialog } from 'electron';
import type { AgentView } from 'shared/bridge';
import { createAgentRuntime, createSessions, type AgentConfig, type OutgoingMessage, type Sdk } from 'core/agents';
import { agentColor, agentList, agentSlotCount, childRow, folderColors, needsTrust, type Config } from 'core/config';
import { agentParent, branchOf, familyGroups } from 'core/family';
import { launcher, loadSdk } from 'technicals/claude';
import { createJournal } from 'technicals/journal';
import { agentInstructions, journalFile, loadConfig, saveConfig, updateAgent, vibeOutDir, vibePluginDir } from 'app/settings';
import { state } from 'app/state';
import { applySize, bubbleShown, conversationShown, inConversation, openConversation, sendToIcon } from 'app/windows';
import { conversationProgress, refreshConversation } from './conversation';
import { closeRuns, runsFollow } from './runs';

const sdk = loadSdk as unknown as () => Promise<Sdk>;
export const agents = createAgentRuntime({ loadSdk: sdk, launcher, journal: createJournal(() => journalFile()) });
export const sessions = createSessions({ loadSdk: sdk, realpath: fs.realpathSync });

export const CLAUDE_MISSING = 'Claude Code introuvable : installez-le, ou réglez la commande de lancement (clic droit → Agents Claude Code).';

export const isBusy = (id: string) => ['working', 'asking'].includes(agents.state(id).status);
export const newId = () => `a${Date.now().toString(36)}`;
// Un chemin résolu (liens symboliques : /home → /var/home) ; null s'il n'existe pas.
export const real = (dir: string) => { try { return fs.realpathSync.native(dir); } catch { return null; } };

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

// Un fichier ordinaire (pas un lien) d'au plus 1 Mo, en texte ; null sinon.
export function readFile(file: string) {
  try {
    const st = fs.lstatSync(file);
    return st.isFile() && st.size <= 1024 * 1024 ? fs.readFileSync(file, 'utf8') : null;
  } catch { return null; }
}

// État des robots pour la page de l'icône (par famille), et taille de la fenêtre.
export function pushAgents() {
  if (!state.icon) return;
  const cfg = loadConfig();
  const slots = agentSlotCount(cfg);
  const row = childRow(cfg);
  if (slots !== state.agentSlots || row !== state.childRow) { state.agentSlots = slots; state.childRow = row; applySize(); }
  const enabled = cfg.agentsEnabled === true;
  for (const a of agentList(cfg)) if (agents.state(a.id).unread && inConversation(a.id)) agents.markRead(a.id); // déjà sous les yeux
  // La pastille de non-lu du robot, panneau ouvert ou non : celle de l'agent
  // affiché n'apparaît pas (lue d'office, ci-dessus). Le badge : « PR #n » pour
  // le robot d'une PR, sinon la branche de son dossier.
  const view = (a: AgentConfig, children: AgentConfig[]): AgentView => {
    const pr = agentParent(a)?.pr;
    return {
      id: a.id, name: a.name, color: agentColor(a, cfg), selected: a.id === cfg.agentSelected, ...agents.state(a.id),
      badge: pr ? `PR #${pr}` : branchOf(a.dir, readFile), children: children.map((c) => ({ ...view(c, []), color: agentColor(a, cfg) })), // de la couleur du parent
    };
  };
  sendToIcon('agents:state', { enabled, agents: enabled ? familyGroups(agentList(cfg)).map((g) => view(g.agent, g.children)) : [] });
  runsFollow(agentList(cfg), cfg); // les avis de fin des courses, conversation libre ; ses demandes, tour fini
  refreshConversation(); // le panneau suit (réponse arrivée, agent au travail…)
}

// Retirer cet agent (son menu) : son processus et ses courses partent, la
// sélection aussi. Son dossier reste proposé par « + », avec sa couleur ; pas
// celui du robot d'une PR (le worktree de la PR, F-110). Ses enfants gardent
// leur parent : des robots ordinaires.
export function removeAgent(id: string) {
  const agent = agentList(loadConfig()).find((a) => a.id === id);
  if (!agent) return;
  agents.forget(id);
  closeRuns(agent);
  const cfg = loadConfig();
  const pr = agentParent(agent)?.pr;
  saveConfig({
    agents: agentList(cfg).filter((a) => a.id !== id),
    agentSelected: cfg.agentSelected === id ? null : cfg.agentSelected,
    agentFolders: ensureFolderColors().filter((f) => !(pr && f.dir === agent.dir)),
  });
  pushAgents(); // son panneau, s'il est ouvert, se ferme (cf. refreshConversation)
}

// Interrompre le tour de l'agent (menu du robot, ⏹ Arrêter de VibeCoder).
export function interruptAgent(id: string) {
  agents.interrupt(id);
  pushAgents();
}

// Ce que reçoit Claude Code pour cet agent, à chaque tour comme à la sonde : la
// commande, la consigne, le plugin de VibeCoder (seulement s'il est là :
// ensureVibeFiles a pu échouer) et le dossier de sorties de l'agent.
export function launchOptions(agent: AgentConfig, cfg: Config) {
  const plugin = vibePluginDir();
  return {
    command: cfg.agentCommand, instructions: agentInstructions(),
    plugins: fs.existsSync(plugin) ? [plugin] : [], dirs: [vibeOutDir(agent.id)],
  };
}

// Modèle, effort ou mode d'un agent (son menu, la barre d'état de VibeCoder) :
// enregistré ; le processus vivant suit aussitôt le mode et le modèle (F-57),
// l'effort à son prochain lancement.
export function setAgentSetting(id: string, key: 'model' | 'effort' | 'mode', value: string) {
  updateAgent(id, { [key]: value });
  if (key === 'mode') agents.setMode(id, value);
  if (key === 'model') agents.setModel(id, value);
}

// `message` part à l'agent ; la réponse arrivera par sa pastille.
export function sendToAgent(agent: AgentConfig, message: OutgoingMessage, cfg: Config): { ok: true } | { ok: false; error: string } {
  if (isBusy(agent.id)) return { ok: false, error: `${agent.name} travaille encore : message non envoyé.` };
  if (!agents.isAvailable(cfg.agentCommand)) return { ok: false, error: CLAUDE_MISSING };
  agents.send(agent, message, {
    ...launchOptions(agent, cfg),
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
// `pr` : le worktree d'une PR (F-110) — la question est toujours posée : ses
// réglages sont ceux de la PR, écrits par son auteur, et changent à chaque push.
export async function trustFolder(dir: string, pr?: number) {
  if (!pr && !needsTrust(loadConfig(), dir)) return true;
  const { response } = await dialog.showMessageBox({
    type: 'warning', buttons: ['Annuler', 'Faire confiance et ajouter'], defaultId: 0, cancelId: 0,
    title: pr ? `PR #${pr} dans un worktree` : 'Nouveau dossier pour un agent',
    message: 'Faire confiance à ce dossier ?',
    detail: `${dir}\n\nClaude Code y sera lancé avec les réglages du projet (dossier .claude : hooks, serveurs MCP, `
      + 'autorisations), qui peuvent exécuter des commandes sur cette machine. '
      + (pr ? `Ce sont ceux de la PR #${pr}, tels que son auteur les a écrits : ils se chargeront. Relisez son dossier .claude avant d'accepter.`
        : 'N\'ajoutez que des dossiers dont vous connaissez le contenu.'),
  });
  return response === 1;
}

export function newAgent(dir: string) {
  const cfg = loadConfig();
  const list = agentList(cfg);
  const here = real(dir) ?? dir;
  let agent = list.find((a) => (real(a.dir) ?? a.dir) === here); // un seul agent par dossier (résolu)
  if (!agent) {
    agent = { id: newId(), dir, name: path.basename(dir) || dir, model: '', effort: '', mode: 'default', sessionId: null };
    saveConfig({ agents: [...list, agent] });
  }
  ensureFolderColors(); // nouveau dossier : il reçoit sa couleur et devient favori
  // Sélectionné ; panneau montré, il y affiche sa conversation (le robot
  // sélectionné et le robot affiché vont ensemble).
  if (conversationShown()) { openConversation(agent.id); return; }
  selectAgent(agent.id);
  pushAgents();
}
