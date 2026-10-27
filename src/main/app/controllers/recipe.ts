/** recipe — la recette du fichier du projet du parent (core/runner : setup,
 *  worktree.create, worktree.remove, sinon git worktree add / remove), lancée
 *  par l'appli sans IA (technicals/process runOnce : une étape après l'autre,
 *  l'entrée fermée, 15 min au plus chacune, arrêt au premier échec, dont la
 *  dernière ligne utile est rendue), une à la fois par famille (le dossier du
 *  parent, controllers/processes homeOf), son journal dans
 *  <sorties de l'agent concerné>/recipe.log. La branche et la base passent par
 *  l'environnement (recipeEnv : VIBECODER_BRANCH, VIBECODER_BASE).
 *  - prepare : le setup au dossier de l'agent ;
 *  - createWorktree : refusé si une branche n'est pas un ref sûr ou si le
 *    dossier est déjà là ; réussi seulement si le dossier est ensuite la
 *    racine d'un worktree du dépôt (repoOf, childOf) ; après le git de repli, le setup
 *    y tourne alors (worktree.create prépare lui-même son worktree) ;
 *  - removeWorktree : parent présent ; `git status --porcelain` dans le
 *    worktree (technicals/git, en lecture) : une ligne, ou pas de réponse →
 *    refusé, quelle que soit la commande ; réussi si le dossier n'existe plus.
 *  Pas de dossier du parent (un enfant dont le parent est parti) : rien ne tourne.
 *  Ne connaît pas : la page, les fenêtres, la naissance et le départ des
 *  robots (controllers/worktrees).
 *  Utilisé par : controllers (processes, vibecoder, worktrees). */
import fs from 'node:fs';
import path from 'node:path';
import type { VibeRecipe } from 'shared/bridge';
import type { AgentConfig } from 'core/agents';
import { agentList, type Config } from 'core/config';
import { branchOf, childOf, familyOwner, repoOf } from 'core/family';
import { createSteps, DEFAULT_SHELL, recipeEnv, removeSteps, setupSteps, worktreeDir, type Project, type Step } from 'core/runner';
import { okRef } from 'helpers';
import { gitRun } from 'technicals/git';
import { runOnce } from 'technicals/process';
import { loadConfig, vibeOutDir } from 'app/settings';
import { real } from './agents';
import { homeOf, projectAt, readFile } from './processes';

export type RecipeResult = { ok: boolean; line: string };

const STEP_MS = 15 * 60 * 1000;
const STATUS_MS = 30 * 1000;

// La recette de chaque famille, par dossier du parent : en cours, ou la dernière.
const families = new Map<string, VibeRecipe>();

const projectOf = (home: string): Project => projectAt(home) ?? { commands: [], shell: DEFAULT_SHELL };
const logOf = (agent: AgentConfig) => path.join(vibeOutDir(agent.id), 'recipe.log');
const gitRepo = (dir: string) => repoOf(gitRun(dir), fs.realpathSync.native);

// La recette de la famille de `agent` : en cours, ou la dernière ; null sans
// dossier du parent ou sans recette lancée dans la session.
export const recipeView = (agent: AgentConfig, cfg: Config = loadConfig()): VibeRecipe | null => {
  const home = homeOf(agent, cfg);
  return (home && families.get(home)) || null;
};

// `body` pour la famille `home`, si aucune recette n'y tourne ; son résultat
// retenu (recipeView).
async function inFamily<R extends RecipeResult>(home: string, op: VibeRecipe['op'], body: () => Promise<R>): Promise<R | RecipeResult> {
  const now = families.get(home);
  if (now?.running) return { ok: false, line: 'une recette tourne déjà dans cette famille : attendre sa fin' };
  families.set(home, { op, running: true, last: now?.last ?? null });
  let r: R | RecipeResult;
  try { r = await body(); } catch (err) { r = { ok: false, line: err instanceof Error ? err.message : String(err) }; }
  families.set(home, { op, running: false, last: { ok: r.ok, line: r.line, time: Date.now() } });
  return r;
}

// Les étapes, une après l'autre ; la première qui échoue arrête tout, sa dernière ligne rendue.
async function runSteps(steps: Step[], env: Record<string, string> | undefined, log: string): Promise<RecipeResult> {
  for (const s of steps) {
    const { exit, tail } = await runOnce({ ...s, env, log, timeoutMs: STEP_MS });
    if (exit !== 0) return { ok: false, line: tail || `échec (${exit === null ? 'arrêtée' : `code ${exit}`})` };
  }
  return { ok: true, line: '' };
}

const noHome: RecipeResult = { ok: false, line: 'pas de fichier du projet : le parent n’est plus là' };

// Préparer le projet : le setup du fichier du parent, au dossier de l'agent.
export async function prepare(agent: AgentConfig, cfg: Config = loadConfig()): Promise<RecipeResult> {
  const home = homeOf(agent, cfg);
  if (!home) return noHome;
  const project = projectOf(home);
  const steps = setupSteps(project, agent.dir, cfg.agentCommand, cfg.vibeCommandPrefix);
  if (!steps.length) return { ok: false, line: 'pas de setup dans le fichier du projet' };
  return inFamily(home, 'setup', async () => {
    const r = await runSteps(steps, undefined, logOf(agent));
    return r.ok ? { ok: true, line: 'projet préparé' } : r;
  });
}

// Créer le worktree de `w.branch` depuis `w.start` (base : `w.base`), puis,
// après le git de repli, le setup dans ce worktree ; `dir` : sa racine, une fois réussi.
export async function createWorktree(
  home: AgentConfig, w: { branch: string; base: string; start: string }, cfg: Config = loadConfig(),
): Promise<RecipeResult & { dir?: string }> {
  const h = homeOf(home, cfg);
  if (!h) return noHome;
  const env = recipeEnv(w.branch, w.base);
  if (!env || !okRef(w.start)) return { ok: false, line: 'branche refusée : pas un nom de branche sûr' };
  return inFamily(h, 'create', async (): Promise<RecipeResult & { dir?: string }> => {
    const project = projectOf(h);
    const dir = worktreeDir(project, h, w.branch);
    if (fs.existsSync(dir)) return { ok: false, line: `${dir} existe déjà` };
    const [create, ...setup] = createSteps(project, { home: h, branch: w.branch, start: w.start }, cfg.agentCommand, cfg.vibeCommandPrefix);
    const log = logOf(home);
    const made = await runSteps([create], env, log);
    if (!made.ok) return made;
    const top = real(dir);
    const [own, wt] = await Promise.all([gitRepo(h), top ? gitRepo(top) : null]);
    if (!top || !own || !wt || !childOf(top, own, wt)) return { ok: false, line: `${dir} n’est pas un worktree du dépôt` };
    const prepared = await runSteps(setup, env, log);
    return prepared.ok ? { ok: true, line: 'worktree créé', dir: top } : prepared;
  });
}

// Retirer le worktree de l'enfant `child` : jamais avec des modifications, ni
// sans réponse de git status.
export async function removeWorktree(child: AgentConfig, cfg: Config = loadConfig()): Promise<RecipeResult> {
  const owner = familyOwner(child, agentList(cfg));
  if (!owner) return noHome;
  if (owner.id === child.id) return { ok: false, line: 'pas un worktree : cet agent n’a pas de parent' };
  return inFamily(owner.dir, 'remove', async () => {
    const status = await gitRun(child.dir, STATUS_MS)(['status', '--porcelain']);
    if (status === null) return { ok: false, line: 'git status ne répond pas : worktree gardé' };
    if (status.trim()) return { ok: false, line: 'des modifications en cours : worktree gardé' };
    const branch = branchOf(child.dir, readFile);
    const env = branch ? recipeEnv(branch) : null;
    if (!env) return { ok: false, line: 'branche du worktree inconnue : worktree gardé' };
    const r = await runSteps(removeSteps(projectOf(owner.dir), { home: owner.dir, dir: child.dir }, cfg.agentCommand, cfg.vibeCommandPrefix), env, logOf(child));
    if (!fs.existsSync(child.dir)) return { ok: true, line: 'worktree retiré' };
    return { ok: false, line: r.line || 'le dossier du worktree est toujours là' };
  });
}
