/** worktrees — Relire dans un worktree (F-110) : le robot temporaire « PR #n »
 *  d'une PR que l'agent du dépôt a ouverte dans un worktree (skill
 *  worktree-pr). Il ne naît que du fichier que ce skill écrit dans les sorties
 *  de l'agent du dépôt (`pr-<n>-worktree.json`), après une demande de l'écran
 *  (Ouvrir dans un worktree, ou le proposer à nouveau) — aucune page ne donne
 *  de chemin —, si ce dossier existe et est la racine d'un worktree du même
 *  dépôt (même `git rev-parse --git-common-dir`), autre que celui de l'agent du
 *  dépôt, et seulement après la question de confiance, toujours posée (I-23,
 *  I-41). Il part quand ce fichier n'est plus là (Décharger : le skill
 *  retirer-worktree, chez l'agent du dépôt, le supprime après `git worktree
 *  remove`), avec son dossier des favoris ; son brouillon de revue revient à
 *  l'agent du dépôt.
 *  Ne connaît pas : la page (seulement ce que demande controllers/vibecoder).
 *  Utilisé par : controllers/vibecoder. */
import fs from 'node:fs';
import path from 'node:path';
import type { VibeWorktree } from 'shared/bridge';
import type { AgentConfig } from 'core/agents';
import { agentColor, agentList, agentTemp, agentVibe, favoriteFolders, tempAgent } from 'core/config';
import { worktreeCard } from 'core/vibecoder';
import { gitRun } from 'technicals/git';
import { loadConfig, saveConfig, saveVibeStore, vibeOutDir, vibeStore } from 'app/settings';
import { state } from 'app/state';
import { openConversation } from 'app/windows';
import { agents, ensureFolderColors, isBusy, pushAgents, trustFolder } from './agents';

const wanted = new Set<string>();   // `<agent>:<n>` : l'écran a demandé le worktree de cette PR (en mémoire)
let syncing = false;

const key = (agentId: string, pr: number) => `${agentId}:${pr}`;
const cardFile = (agentId: string, pr: number) => path.join(vibeOutDir(agentId), `pr-${pr}-worktree.json`);
const robotOf = (list: AgentConfig[], agentId: string, pr: number) =>
  list.find((a) => agentTemp(a)?.parent === agentId && agentTemp(a)?.pr === pr) ?? null;

// La fiche du worktree (un fichier ordinaire, pas un lien), lue ; null sinon.
function readCard(agentId: string, pr: number) {
  const file = cardFile(agentId, pr);
  try { return fs.lstatSync(file).isFile() ? worktreeCard(fs.readFileSync(file, 'utf8')) : null; } catch { return null; }
}

// Le dépôt de `dir` : son dossier git commun et la racine de sa copie, résolus ; null si ce n'en est pas un.
async function repoOf(dir: string) {
  const [common, top] = ((await gitRun(dir)(['rev-parse', '--path-format=absolute', '--git-common-dir', '--show-toplevel'])) ?? '').split('\n');
  try { return common && top ? { common: fs.realpathSync(common), top: fs.realpathSync(top) } : null; } catch { return null; }
}

// L'agent du dépôt d'un robot temporaire ; null pour un autre agent.
export function worktreeParent(agent: AgentConfig) {
  const t = agentTemp(agent);
  return (t && agentList(loadConfig()).find((a) => a.id === t.parent)) || null;
}

// L'écran a envoyé « Ouvrir dans un worktree » pour la PR `pr` de cet agent.
export function wantWorktree(agentId: string, pr: number) {
  wanted.add(key(agentId, pr));
}

// La PR suivie dans un worktree, pour le relevé : ce robot-ci (temporaire), ou,
// pour l'agent du dépôt, son robot là, le worktree ouvert sans robot, ou en
// création (demandé, l'agent au travail).
export function worktreeState(agent: AgentConfig, pr: number | null, busy: boolean): VibeWorktree | null {
  if (agentTemp(agent)) return { state: 'robot', temp: true, dir: agent.dir };
  if (!pr) return null;
  const robot = robotOf(agentList(loadConfig()), agent.id, pr);
  if (robot) return { state: 'robot', temp: false, dir: robot.dir };
  const card = readCard(agent.id, pr);
  if (card) return { state: 'open', temp: false, dir: card.dir };
  return busy && wanted.has(key(agent.id, pr)) ? { state: 'creating', temp: false, dir: '' } : null;
}

// « Aller au robot PR #n » : l'afficher ; le worktree ouvert sans robot (question refusée…) : le proposer à nouveau.
export function showWorktree(agent: AgentConfig) {
  const { pr } = agentVibe(agent);
  if (!pr) return;
  const robot = robotOf(agentList(loadConfig()), agent.id, pr);
  if (robot) { openConversation(robot.id, { mode: 'full' }); return; }
  if (readCard(agent.id, pr)) { wantWorktree(agent.id, pr); syncWorktrees(); }
}

// Le robot temporaire de la PR `pr`, d'après la fiche du worktree de l'agent du
// dépôt : vérifiée (dossier, même dépôt, pas encore d'agent), puis la question
// de confiance ; refusée : rien.
async function adopt(parent: AgentConfig, pr: number) {
  const card = readCard(parent.id, pr);
  let dir: string;
  try { dir = card ? fs.realpathSync(card.dir) : ''; } catch { return; }
  if (!dir || !fs.statSync(dir).isDirectory()) return;
  const [own, wt] = await Promise.all([repoOf(parent.dir), repoOf(dir)]);
  if (!own || !wt || wt.common !== own.common || wt.top !== dir || wt.top === own.top) return;
  if (agentList(loadConfig()).some((a) => a.dir === dir)) return;
  if (!await trustFolder(dir, pr)) return;
  // La question a pu durer : l'agent du dépôt a pu partir, un agent arriver dans ce dossier.
  const cfg = loadConfig();
  const owner = agentList(cfg).find((a) => a.id === parent.id);
  if (!owner || agentList(cfg).some((a) => a.dir === dir)) return;
  const robot = tempAgent(owner, pr, dir, `a${Date.now().toString(36)}`);
  saveConfig({ agents: [...agentList(cfg), robot], agentFolders: [...ensureFolderColors(), { dir, color: agentColor(owner, cfg) }] });
  // Ses sorties : la fiche de la PR ; son brouillon de revue : celui de l'agent du dépôt.
  try { fs.copyFileSync(path.join(vibeOutDir(owner.id), `pr-${pr}.json`), path.join(vibeOutDir(robot.id), `pr-${pr}.json`)); } catch { /* il la rechargera */ }
  const store = vibeStore();
  const draft = store.drafts[owner.id]?.[pr];
  if (draft?.length) { store.drafts[robot.id] = { [pr]: draft }; saveVibeStore(store); }
  pushAgents();
}

// Retire le robot temporaire : son processus, ses sorties, ses validations, son
// dossier des favoris ; son brouillon revient à l'agent du dépôt. Affiché : le
// panneau passe à l'agent du dépôt.
function removeRobot(robot: AgentConfig, parent: AgentConfig | null, pr: number) {
  agents.forget(robot.id);
  const store = vibeStore();
  const draft = store.drafts[robot.id]?.[pr];
  if (parent && draft) store.drafts[parent.id] = { ...store.drafts[parent.id], [pr]: draft };
  delete store.drafts[robot.id];
  delete store.marks[robot.id];
  saveVibeStore(store);
  fs.rmSync(vibeOutDir(robot.id), { recursive: true, force: true });
  const cfg = loadConfig();
  saveConfig({
    agents: agentList(cfg).filter((a) => a.id !== robot.id),
    agentSelected: cfg.agentSelected === robot.id ? null : cfg.agentSelected,
    agentFolders: favoriteFolders(cfg).filter((f) => f.dir !== robot.dir),
  });
  if (parent && state.convView?.agentId === robot.id) openConversation(parent.id, { mode: 'full' });
  else pushAgents();
}

// À chaque relevé : retire les robots temporaires dont la fiche du worktree a
// disparu (ou l'agent du dépôt), sauf au travail ; adopte les worktrees
// demandés dont la fiche est arrivée. Un passage à la fois (la question de
// confiance peut durer).
export async function syncWorktrees() {
  if (syncing) return;
  syncing = true;
  try {
    const list = agentList(loadConfig());
    for (const a of list) {
      const t = agentTemp(a);
      const parent = t && list.find((p) => p.id === t.parent);
      if (t && !isBusy(a.id) && (!parent || !fs.existsSync(cardFile(parent.id, t.pr)))) removeRobot(a, parent || null, t.pr);
    }
    for (const k of [...wanted]) {
      const [id, n] = [k.slice(0, k.lastIndexOf(':')), Number(k.slice(k.lastIndexOf(':') + 1))];
      const parent = list.find((a) => a.id === id);
      if (parent && !fs.existsSync(cardFile(id, n))) continue;
      wanted.delete(k);
      if (parent) await adopt(parent, n);
    }
  } catch (err) {
    console.error(`VibeCoder : worktree (${err instanceof Error ? err.message : err})`);
  } finally {
    syncing = false;
  }
}
