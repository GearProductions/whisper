/** worktrees — les robots enfants des worktrees d'un dépôt (core/family) et
 *  leur `parent` enregistré. Trois naissances, toujours sur la racine d'un
 *  worktree du même dépôt (même `git rev-parse --git-common-dir`), autre que
 *  la copie du parent, sans agent, après la question de confiance (I-23,
 *  I-41) :
 *  - le robot « PR #n » (F-110, un enfant avec `pr`), né du fichier que le
 *    skill worktree-pr écrit dans les sorties de l'agent du dépôt
 *    (`pr-<n>-worktree.json`), après une demande de l'écran (Ouvrir dans un
 *    worktree, ou le proposer à nouveau) ; la question toujours posée. Il
 *    part quand ce fichier n'est plus là (Décharger : le skill
 *    retirer-worktree le supprime après `git worktree remove`), avec son
 *    dossier des favoris ; son brouillon de revue revient à l'agent du dépôt ;
 *  - *Ouvrir un agent ici* (openHere, clic droit du parent → Worktrees, parmi
 *    freeWorktrees : `git worktree list`, 1 s au plus) ; la question pour un dossier jamais
 *    choisi ; nommé par sa branche, de la couleur du parent ;
 *  - le rattachement par git (syncFamilies) : le `parent` de chaque agent
 *    d'après son dépôt (familyLinks), l'ancien `temp` réécrit en `parent`.
 *  Un enfant sans `pr` ne part qu'à Retirer (controllers/agents). Les dossiers
 *  des agents sont résolus (liens symboliques) avant d'être comparés à ceux
 *  de git. Aucune page ne donne de chemin.
 *  Ne connaît pas : la page (seulement ce que demandent controllers/vibecoder
 *  et app/menus).
 *  Utilisé par : controllers/vibecoder, controllers/runs, app/menus,
 *  app/lifecycle. */
import fs from 'node:fs';
import path from 'node:path';
import type { VibeWorktree } from 'shared/bridge';
import type { AgentConfig } from 'core/agents';
import { agentColor, agentList, agentVibe, favoriteFolders } from 'core/config';
import { agentParent, childAgent, childOf, familyLinks, isMain, parseWorktrees, repoOf as gitRepoOf } from 'core/family';
import { worktreeCard } from 'core/vibecoder';
import { gitRun } from 'technicals/git';
import { loadConfig, saveConfig, saveVibeStore, vibeOutDir, vibeStore } from 'app/settings';
import { state } from 'app/state';
import { openConversation } from 'app/windows';
import { newId, real } from './agents';
import { agents, ensureFolderColors, isBusy, pushAgents, trustFolder } from './agents';
import { closeRuns } from './runs';

const wanted = new Set<string>();   // `<agent>:<n>` : l'écran a demandé le worktree de cette PR (en mémoire)
let syncing = false;
let pass: Promise<void> = Promise.resolve();   // les passages de syncFamilies, à la suite

const key = (agentId: string, pr: number) => `${agentId}:${pr}`;
const cardFile = (agentId: string, pr: number) => path.join(vibeOutDir(agentId), `pr-${pr}-worktree.json`);
const robotOf = (list: AgentConfig[], agentId: string, pr: number) =>
  list.find((a) => agentParent(a)?.id === agentId && agentParent(a)?.pr === pr) ?? null;
const repoOf = (dir: string, timeout?: number) => gitRepoOf(gitRun(dir, timeout), fs.realpathSync.native);
const hasAgent = (dir: string) => agentList(loadConfig()).some((a) => real(a.dir) === dir);
// Les favoris, avec `dir` de la couleur `color` (celle du parent).
const withFolder = (dir: string, color: string) => [...ensureFolderColors().filter((f) => f.dir !== dir), { dir, color }];

// La fiche du worktree (un fichier ordinaire, pas un lien), lue ; null sinon.
function readCard(agentId: string, pr: number) {
  const file = cardFile(agentId, pr);
  try { return fs.lstatSync(file).isFile() ? worktreeCard(fs.readFileSync(file, 'utf8')) : null; } catch { return null; }
}

// L'agent parent présent d'un enfant ; null pour un autre agent.
export function worktreeParent(agent: AgentConfig) {
  const p = agentParent(agent);
  return (p && agentList(loadConfig()).find((a) => a.id === p.id)) || null;
}

// L'écran a envoyé « Ouvrir dans un worktree » pour la PR `pr` de cet agent.
export function wantWorktree(agentId: string, pr: number) {
  wanted.add(key(agentId, pr));
}

// La PR suivie dans un worktree, pour le relevé : ce robot-ci (un enfant avec
// pr), ou, pour l'agent du dépôt, son robot là, le worktree ouvert sans robot,
// ou en création (demandé, l'agent au travail).
export function worktreeState(agent: AgentConfig, pr: number | null, busy: boolean): VibeWorktree | null {
  if (agentParent(agent)?.pr) return { state: 'robot', temp: true, dir: agent.dir };
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

// Le robot de la PR `pr`, d'après la fiche du worktree de l'agent du dépôt :
// vérifiée (dossier, même dépôt, pas encore d'agent), puis la question de
// confiance ; refusée : rien.
async function adopt(parent: AgentConfig, pr: number) {
  const card = readCard(parent.id, pr);
  const dir = card && real(card.dir);
  if (!dir || !fs.statSync(dir).isDirectory()) return;
  const [own, wt] = await Promise.all([repoOf(parent.dir), repoOf(dir)]);
  if (!own || !wt || !childOf(dir, own, wt) || hasAgent(dir)) return;
  if (!await trustFolder(dir, pr)) return;
  // La question a pu durer : l'agent du dépôt a pu partir, un agent arriver dans ce dossier.
  const cfg = loadConfig();
  const owner = agentList(cfg).find((a) => a.id === parent.id);
  if (!owner || hasAgent(dir)) return;
  const robot = childAgent(owner, dir, newId(), { pr });
  saveConfig({ agents: [...agentList(cfg), robot], agentFolders: withFolder(dir, agentColor(owner, cfg)) });
  // Ses sorties : la fiche de la PR ; son brouillon de revue : celui de l'agent du dépôt.
  try { fs.copyFileSync(path.join(vibeOutDir(owner.id), `pr-${pr}.json`), path.join(vibeOutDir(robot.id), `pr-${pr}.json`)); } catch { /* il la rechargera */ }
  const store = vibeStore();
  const draft = store.drafts[owner.id]?.[pr];
  if (draft?.length) { store.drafts[robot.id] = { [pr]: draft }; saveVibeStore(store); }
  pushAgents();
}

// Retire le robot d'une PR : son processus et ses courses, ses sorties, ses validations, son
// dossier des favoris ; son brouillon revient à l'agent du dépôt. Affiché : le
// panneau passe à l'agent du dépôt.
function removeRobot(robot: AgentConfig, parent: AgentConfig | null, pr: number) {
  agents.forget(robot.id);
  closeRuns(robot);
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

// À chaque relevé : retire les robots de PR (enfants avec pr) dont la fiche
// du worktree a disparu (ou l'agent du dépôt), sauf au travail ; un enfant
// sans pr reste. Adopte les worktrees demandés dont la fiche est arrivée. Un
// passage à la fois (la question de confiance peut durer).
export async function syncWorktrees() {
  if (syncing) return;
  syncing = true;
  try {
    const list = agentList(loadConfig());
    for (const a of list) {
      const p = agentParent(a);
      const parent = p && list.find((o) => o.id === p.id);
      if (p?.pr && !isBusy(a.id) && (!parent || !fs.existsSync(cardFile(parent.id, p.pr)))) removeRobot(a, parent || null, p.pr);
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

// Les worktrees du dépôt de `parent` qui n'ont pas d'agent (`free`, dossiers
// résolus, `git worktree list`), sans la copie principale, et son dépôt
// (`own`). null si `parent` n'est pas à la racine de la copie principale (il ne
// serait pas reconnu comme parent), ou si git n'a pas répondu en 1 s (le clic
// droit l'attend : les deux appels en même temps).
export async function freeWorktrees(parent: AgentConfig) {
  const [own, out] = await Promise.all([repoOf(parent.dir, 1000), gitRun(parent.dir, 1000)(['worktree', 'list', '--porcelain', '-z'])]);
  if (!own || !isMain(own) || own.top !== real(parent.dir) || out === null) return null;
  const taken = new Set(agentList(loadConfig()).map((a) => real(a.dir)));
  const free = parseWorktrees(out).flatMap((w) => {
    const dir = real(w.dir);
    return dir && dir !== own.top && !taken.has(dir) ? [{ dir, branch: w.branch }] : [];
  });
  return { own, free };
}

// `dir` parmi les worktrees libres de `parent` (relu dans la config), racine
// d'un worktree de son dépôt (childOf) ; null sinon.
async function freeChild(parentId: string, dir: string) {
  const owner = agentList(loadConfig()).find((a) => a.id === parentId);
  const wts = owner ? await freeWorktrees(owner) : null;
  const free = wts?.free.find((w) => w.dir === dir);
  const wt = free ? await repoOf(dir) : null;
  return owner && wts && free && wt && childOf(dir, wts.own, wt) ? { owner, branch: free.branch } : null;
}

// Ouvrir un agent ici (clic droit du parent → Worktrees) : l'enfant du
// worktree `dir` de `parent`, après la question de confiance (dossier jamais
// choisi, I-23, I-41), le tout revérifié après elle (elle a pu durer). Un
// dossier déjà favori garde son chemin (/home… ou /var/home…).
export async function openHere(parent: AgentConfig, dir: string): Promise<void> {
  const here = favoriteFolders(loadConfig()).find((f) => real(f.dir) === dir)?.dir ?? dir;
  if (!await freeChild(parent.id, dir) || !await trustFolder(here)) return;
  const ok = await freeChild(parent.id, dir);
  if (!ok) return;
  const cfg = loadConfig();
  if (hasAgent(dir)) return;   // deux clics : le premier l'a déjà enregistré
  const child = childAgent(ok.owner, here, newId(), { name: ok.branch ?? path.basename(dir) });
  saveConfig({ agents: [...agentList(cfg), child], agentFolders: withFolder(here, agentColor(ok.owner, cfg)) });
  pushAgents();
}

// Le rattachement par git (au lancement, après « + ») : le `parent` de chaque
// agent d'après son dépôt (familyLinks, dossiers résolus ; introuvable : dépôt
// inconnu), l'ancien `temp` effacé. Les passages à la suite, un par appel ;
// un échec n'arrête pas les suivants.
async function linkOnce() {
  const list = agentList(loadConfig()).map((a) => ({ ...a, dir: real(a.dir) ?? '' }));
  const repos = Object.fromEntries(await Promise.all(list.map(async (a) => [a.id, a.dir ? await repoOf(a.dir) : null] as const)));
  const changes = new Map(familyLinks(list, repos).map((c) => [c.id, c.parent]));
  if (!changes.size) return;
  saveConfig({
    agents: agentList(loadConfig()).map((a) => {
      if (!changes.has(a.id)) return a;
      const { temp: _temp, parent: _parent, ...rest } = a;
      const parent = changes.get(a.id);
      return parent ? { ...rest, parent } : rest;
    }),
  });
  pushAgents();
}
export const syncFamilies = (): Promise<void> =>
  (pass = pass.then(linkOnce).catch((err) => console.error(`agents : familles (${err instanceof Error ? err.message : err})`)));
