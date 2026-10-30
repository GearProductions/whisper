/** worktrees — les robots enfants des worktrees d'un dépôt (core/family) et
 *  leur `parent` enregistré. Leurs naissances, toujours sur la racine d'un
 *  worktree du même dépôt (même `git rev-parse --git-common-dir`), autre que
 *  la copie du parent, sans agent, après la question de confiance (I-23,
 *  I-41) :
 *  - le robot « PR #n » (F-110, un enfant avec `pr`), né de la fiche
 *    `pr-<n>-worktree.json` que l'appli écrit dans les sorties de l'agent du
 *    dépôt quand la recette a créé le worktree de la PR (prWorktreeReady,
 *    après *Dans un worktree*), ou à nouveau proposé (showWorktree) ; la
 *    question toujours posée. Il part quand cette fiche n'est plus là (Retirer
 *    le worktree : removeWorktreeChild la supprime une fois le worktree
 *    retiré par la recette), avec son dossier des favoris ; son brouillon de
 *    revue revient à l'agent du dépôt ;
 *  - un enfant sur un worktree libre (openChild) : *Ouvrir un agent ici*
 *    (openHere, clic droit du parent → Worktrees, parmi freeWorktrees :
 *    `git worktree list`, 1 s au plus), nommé par sa branche, ou celui d'une
 *    nouvelle demande (en Créer) ; la question pour un dossier jamais choisi ;
 *    de la couleur du parent ;
 *  - le rattachement par git (syncFamilies) : le `parent` de chaque agent
 *    d'après son dépôt (familyLinks), l'ancien `temp` réécrit en `parent`.
 *  Un enfant sans `pr` ne part qu'à Retirer (controllers/agents) ou avec son
 *  worktree (removeWorktreeChild). Les dossiers des agents sont résolus (liens
 *  symboliques) avant d'être comparés à ceux de git. Aucune page ne donne de
 *  chemin. La création et le retrait des worktrees : controllers/recipe.
 *  Les artefacts : un enfant retiré efface ses sorties (eraseOutputs), sauf un
 *  ancien artifacts/ pas encore parti ; jamais le dossier du projet.
 *  Ne connaît pas : la page (seulement ce que demandent controllers/vibecoder
 *  et app/menus).
 *  Utilisé par : controllers/vibecoder, controllers/runs, app/menus,
 *  app/lifecycle. */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { VibeWorktree } from 'shared/bridge';
import type { AgentConfig } from 'core/agents';
import { agentColor, agentList, agentVibe, favoriteFolders } from 'core/config';
import { agentParent, childAgent, childOf, familyLinks, isMain, parseWorktrees, repoOf as gitRepoOf } from 'core/family';
import { ARTIFACTS, worktreeCard } from 'core/vibecoder';
import { hasFiles } from 'technicals/file-tree';
import { gitRun } from 'technicals/git';
import { loadConfig, saveConfig, saveVibeStore, vibeOutDir, vibeOutPath, vibeStore } from 'app/settings';
import { state } from 'app/state';
import { openConversation } from 'app/windows';
import { ensureFolderColors, isBusy, newId, pushAgents, real, removeAgent, trustFolder } from './agents';
import { legacyArtifactsPath } from './artifacts';
import { removeWorktree, type RecipeResult } from './recipe';

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

// Le worktree `dir` de la PR `pr` créé par la recette (pr-worktree) : la fiche
// pr-<n>-worktree.json écrite par l'appli (jamais à travers un lien laissé là),
// puis le robot, comme à la demande de l'écran (adopt : tout revérifié, la
// question de confiance toujours posée, I-41).
export async function prWorktreeReady(agent: AgentConfig, pr: number, dir: string, branch: string): Promise<void> {
  const file = cardFile(agent.id, pr);
  fs.rmSync(file, { force: true });
  fs.writeFileSync(file, JSON.stringify({ dir, branch }), { flag: 'wx' });
  wantWorktree(agent.id, pr);
  await syncWorktrees();
}

// Le robot de la PR `pr` de cet agent est attendu (sa fiche écrite, ou à nouveau proposé).
export function wantWorktree(agentId: string, pr: number) {
  wanted.add(key(agentId, pr));
}

// La PR suivie dans un worktree, pour le relevé : ce robot-ci (un enfant avec
// pr), ou, pour l'agent du dépôt, son robot là, le worktree ouvert sans robot,
// ou en création (`creating` : pr-worktree en cours, donné par l'appelant).
export function worktreeState(agent: AgentConfig, pr: number | null, creating: boolean): VibeWorktree | null {
  if (agentParent(agent)?.pr) return { state: 'robot', temp: true, dir: agent.dir };
  if (!pr) return null;
  const robot = robotOf(agentList(loadConfig()), agent.id, pr);
  if (robot) return { state: 'robot', temp: false, dir: robot.dir };
  const card = readCard(agent.id, pr);
  if (card) return { state: 'open', temp: false, dir: card.dir };
  return creating ? { state: 'creating', temp: false, dir: '' } : null;
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

// Les sorties d'un agent retiré. Sur le disque, jamais d'après une entrée : un
// ancien artifacts/ pas encore parti reste (rm ne suit pas un lien), le reste part.
async function eraseOutputs(agentId: string): Promise<void> {
  const dir = vibeOutPath(agentId);
  if (!await hasFiles(legacyArtifactsPath(agentId))) { await fsp.rm(dir, { recursive: true, force: true }); return; }
  for (const name of await fsp.readdir(dir).catch(() => [])) {
    if (name !== ARTIFACTS) await fsp.rm(path.join(dir, name), { recursive: true, force: true });
  }
}

// Retire un enfant : le brouillon de sa PR revient au parent, ses validations
// partent ; affiché, le panneau passe au parent ; son dossier quitte les
// favoris ; removeAgent (son processus, ses courses et ses commandes) et ses
// sorties (eraseOutputs : sauf un ancien artifacts/ pas encore parti).
async function removeChild(child: AgentConfig, parent: AgentConfig | null) {
  const pr = agentParent(child)?.pr;
  const store = vibeStore();
  const draft = pr && store.drafts[child.id]?.[pr];
  if (pr && parent && draft) store.drafts[parent.id] = { ...store.drafts[parent.id], [pr]: draft };
  delete store.drafts[child.id];
  delete store.marks[child.id];
  saveVibeStore(store);
  if (parent && state.convView?.agentId === child.id) openConversation(parent.id, { mode: 'full' });
  removeAgent(child.id);   // d'abord : l'agent est parti de la config
  saveConfig({ agentFolders: ensureFolderColors().filter((f) => f.dir !== child.dir) });
  await eraseOutputs(child.id);
}

// Retirer le worktree (remove-worktree) : la recette le retire (refusé s'il a
// des modifications) ; retiré, le robot d'une PR perd sa fiche (syncWorktrees
// le retire, son brouillon revient), un autre enfant part aussitôt.
export async function removeWorktreeChild(child: AgentConfig): Promise<RecipeResult> {
  const result = await removeWorktree(child);
  if (!result.ok) return result;
  const p = agentParent(child);
  if (p?.pr) {
    fs.rmSync(cardFile(p.id, p.pr), { force: true });
    await syncWorktrees();
  } else await removeChild(child, worktreeParent(child));
  return result;
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
      if (p?.pr && !isBusy(a.id) && (!parent || !fs.existsSync(cardFile(parent.id, p.pr)))) await removeChild(a, parent || null);
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

// L'enfant du worktree libre `dir` de `parent`, nommé `name`, sinon par sa
// branche (`create` : celui d'une nouvelle demande, en Créer), après la
// question de confiance (dossier jamais choisi, I-23, I-41), le tout revérifié
// après elle (elle a pu durer) ; null sinon. `dir` absolu, résolu (liens
// symboliques) ; un dossier déjà favori garde son chemin (/home… ou /var/home…).
export async function openChild(parent: AgentConfig, dir: string, o: { name?: string; create?: true }): Promise<AgentConfig | null> {
  const at = path.isAbsolute(dir) ? real(dir) : null;
  if (!at) return null;
  const here = favoriteFolders(loadConfig()).find((f) => real(f.dir) === at)?.dir ?? at;
  if (!await freeChild(parent.id, at) || !await trustFolder(here)) return null;
  const ok = await freeChild(parent.id, at);
  if (!ok) return null;
  const cfg = loadConfig();
  if (hasAgent(at)) return null;   // deux clics : le premier l'a déjà enregistré
  const child = childAgent(ok.owner, here, newId(), { ...o, name: o.name ?? ok.branch ?? path.basename(at) });
  saveConfig({ agents: [...agentList(cfg), child], agentFolders: withFolder(here, agentColor(ok.owner, cfg)) });
  pushAgents();
  return child;
}

// Ouvrir un agent ici (clic droit du parent → Worktrees) : l'enfant du
// worktree `dir`, nommé par sa branche.
export async function openHere(parent: AgentConfig, dir: string): Promise<void> {
  await openChild(parent, dir, {});
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
