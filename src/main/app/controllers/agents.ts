/** agents — les agents Claude Code côté appli : un agent par dossier, et la liste
 *  du sélecteur du panneau (core/switcher : par dépôt, avec l'étape, la branche,
 *  la question). L'agent sélectionné est l'agent affiché dans le panneau, retrouvé
 *  au lancement ; la dictée y va, dans son champ. Fenêtre sans le focus,
 *  les questions et les erreurs des autres agents deviennent une notification du
 *  système ; son clic montre l'agent (showAgent). Chaque lancement de Claude Code (tour, sonde) reçoit
 *  le plugin de VibeCoder, le dossier de sorties de l'agent et le dossier d'artefacts de son projet. À chaque
 *  changement des agents, les courses suivent (controllers/runs : les avis de
 *  fin en attente, envoyés dès que la conversation est libre). L'état d'un agent
 *  est celui de sa conversation, et par-dessus un état au repos le signal de
 *  ses courses (core/vibecoder robotState, F-55). Les agents se rangent par
 *  famille (core/family) : chacun ses enfants, et sa branche (celle de son
 *  dossier, lue sur le disque, ou « PR #n »). Retirer un
 *  agent oublie son processus, ses courses et ses commandes ; ses enfants gardent leur parent ;
 *  le dossier d'artefacts du projet n'est pas touché (controllers/artifacts).
 *  Ne connaît pas : le contenu du panneau (controllers/conversation), git
 *  (la branche se lit dans .git).
 *  Utilisé par : app (fenêtres, menus, gestionnaires). */
import fs from 'node:fs';
import path from 'node:path';
import { dialog, Notification } from 'electron';
import type { AgentView } from 'shared/bridge';
import { createAgentRuntime, createSessions, type AgentConfig, type OutgoingMessage, type Sdk } from 'core/agents';
import { agentList, folderColors, needsTrust, type Config } from 'core/config';
import { agentParent, branchOf } from 'core/family';
import { agentEvents, switcherAgents } from 'core/switcher';
import { questionsRule, robotState } from 'core/vibecoder';
import { launcher, loadSdk } from 'technicals/claude';
import { createJournal } from 'technicals/journal';
import { agentInstructions, journalFile, loadConfig, saveConfig, updateAgent, vibeOutDir, vibePluginDir } from 'app/settings';
import { state } from 'app/state';
import { conversationShown, inConversation, openConversation } from 'app/windows';
import { conversationProgress, refreshConversation } from './conversation';
import { readFile, stopAgentProcesses } from './processes';
import { projectArtifactsDir } from './artifacts';
import { closeRuns, runSignalOf, runsFollow } from './runs';
import { lastView } from './vibecoder';

const sdk = loadSdk as unknown as () => Promise<Sdk>;
export const agents = createAgentRuntime({ loadSdk: sdk, launcher, journal: createJournal(() => journalFile()) });
export const sessions = createSessions({ loadSdk: sdk, realpath: fs.realpathSync });

export const CLAUDE_MISSING = 'Claude Code introuvable : installez-le, ou réglez la commande de lancement (⚙ Réglages → Agents → Commande de lancement).';

export const isBusy = (id: string) => ['working', 'asking'].includes(agents.state(id).status);
// L'état d'un robot : sa conversation, et le signal de ses courses par-dessus un état au repos.
const robotOf = (id: string) => {
  const conv = agents.state(id);
  const signal = runSignalOf(id);
  return { ...conv, ...robotState(conv, signal), signal };
};
export const newId = () => `a${Date.now().toString(36)}`;
// Un chemin résolu (liens symboliques : /home → /var/home) ; null s'il n'existe pas.
export const real = (dir: string) => { try { return fs.realpathSync.native(dir); } catch { return null; } };

// L'agent affiché dans le panneau, sur sa session en cours ou sur une ancienne (lue dans le
// fil, l'écran reste ; ses envois vont à la session en cours) ; `liveViewAgent` : seulement sur
// sa session en cours.
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

// Ce que l'agent demande : l'autorisation en attente, sinon la première question ouverte de son relevé.
const questionOf = (id: string) => {
  const perm = agents.pendingPermission(id);
  return perm ? `Autorisation : ${perm.tool}` : lastView(id)?.questions[0]?.text ?? null;
};

// La liste du sélecteur au dernier envoi : les événements sont ses différences
// (null : rien d'envoyé encore — au lancement, ce qui est déjà là n'est pas un événement).
let previous: AgentView[] | null = null;

// Notification du système (fenêtre sans le focus) ; un clic montre l'agent.
function notify(events: ReturnType<typeof agentEvents>, cfg: Config) {
  if (!events.length || !Notification.isSupported() || state.panel?.isFocused()) return;
  for (const e of events) {
    const name = agentList(cfg).find((a) => a.id === e.agentId)?.name ?? '';
    const n = new Notification({ title: name, body: e.kind === 'asking' ? e.detail ?? 'te pose une question' : 'a échoué' });
    n.on('click', () => showAgent(e.agentId));
    n.show();
  }
}

// État des agents : la liste du panneau (sélecteur, notifications).
export function pushAgents() {
  const cfg = loadConfig();
  for (const a of agentList(cfg)) if (agents.state(a.id).unread && inConversation(a.id)) agents.markRead(a.id); // déjà sous les yeux
  const shown = state.convView?.agentId ?? null;
  const list = switcherAgents(cfg, {
    state: (id) => { const { status, unread, signal } = robotOf(id); return { status, unread, signal }; },
    step: (id) => lastView(id)?.steps.find((s) => s.status === 'current')?.id ?? null,
    branch: (dir) => branchOf(dir, readFile),
    question: questionOf,
  });
  const events = previous ? agentEvents(previous, list, shown) : [];
  previous = list;
  if (state.panel && !state.panel.isDestroyed()) {
    state.panel.webContents.send('agents:state', { agents: list, shown });
    notify(events, cfg);
  }
  runsFollow(agentList(cfg), cfg); // les avis de fin des courses, conversation libre ; ses demandes, tour fini
  refreshConversation(); // le panneau suit (réponse arrivée, agent au travail…)
}

// Retirer cet agent (son menu) : son processus, ses courses et ses commandes
// (I-47) partent, la sélection aussi. Son dossier reste proposé par « Nouvel
// agent… », avec sa couleur ; pas celui d'un agent de PR (le worktree de la PR, F-110).
// Ses enfants gardent leur parent : des agents ordinaires. Les artefacts sont
// ceux du projet : rien à déplacer.
export function removeAgent(id: string): void {
  const agent = agentList(loadConfig()).find((a) => a.id === id);
  if (!agent) return;
  agents.forget(id);
  closeRuns(agent);
  stopAgentProcesses(id);
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
// commande, la consigne (la consigne audio, puis la ligne du questionnaire,
// questionsRule : fixe pour un agent, elle ne relance pas son processus), le
// plugin de VibeCoder (seulement s'il est là : ensureVibeFiles a pu échouer), le
// dossier de sorties de l'agent et le dossier d'artefacts de son projet.
export function launchOptions(agent: AgentConfig, cfg: Config) {
  const plugin = vibePluginDir();
  const audio = agentInstructions();
  const rule = questionsRule(vibeOutDir(agent.id));
  return {
    command: cfg.agentCommand, instructions: audio ? `${audio}\n\n${rule}` : rule,
    plugins: fs.existsSync(plugin) ? [plugin] : [], dirs: [vibeOutDir(agent.id), projectArtifactsDir(agent.dir)],
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
    // dans son fil ; rien d'ouvert, le panneau s'ouvre sur lui, sans prendre le
    // focus. Sinon (on lit autre chose), le « ? » du robot attend qu'on clique.
    onPermission: () => {
      if (inConversation(agent.id)) { refreshConversation(); return; }
      if (!conversationShown()) openConversation(agent.id, { focus: false });
    },
  }).catch((err) => console.error(`agent ${agent.name} : ${err && err.message}`));
  return { ok: true };
}

// Montrer cet agent dans le panneau (son id, vérifié dans la config : un message de page n'est jamais cru).
export function showAgent(id: unknown) {
  const agent = agentList(loadConfig()).find((a) => a.id === id);
  if (agent) openConversation(agent.id);
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
