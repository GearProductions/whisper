/** recipe — la recette du fichier du projet (`setup`, `worktree.create`,
 *  `worktree.remove`), en étapes à lancer par l'appli, sans IA : chaque argv
 *  est le préfixe (commandPrefix), puis le shell du fichier et le texte de la
 *  commande, jamais une branche dedans ; la branche et la base passent par
 *  l'environnement (recipeEnv : VIBECODER_BRANCH, VIBECODER_BASE). Sans
 *  `worktree.create` : `git -C <home> worktree add -b <branche> <dossier>
 *  <départ>`, puis `setup` au worktree ; sans `worktree.remove` : `git -C
 *  <home> worktree remove <dossier>` (sans --force) — la branche y est un
 *  argument à part.
 *  Ne connaît pas : le disque, git, les processus.
 *  Utilisé par : app/controllers/recipe. */
import path from 'node:path';
import { okRef } from 'helpers';
import { commandPrefix, type Project } from './runner';

export type Step = { argv: string[]; cwd: string };

// VIBECODER_BRANCH et VIBECODER_BASE (sans base : la branche seule) ; null si
// l'une n'est pas un ref sûr (okRef).
export function recipeEnv(branch: string, base?: string): Record<string, string> | null {
  if (!okRef(branch) || (base !== undefined && !okRef(base))) return null;
  return base === undefined ? { VIBECODER_BRANCH: branch } : { VIBECODER_BRANCH: branch, VIBECODER_BASE: base };
}

// Le dossier du worktree de `branch` : worktree.dir (par défaut
// ../<nom du dossier>-worktrees/{branch}), {branch} remplacé, résolu depuis home.
export function worktreeDir(project: Project, home: string, branch: string): string {
  const dir = project.worktree?.dir ?? `../${path.basename(home)}-worktrees/{branch}`;
  return path.resolve(home, dir.replaceAll('{branch}', branch));
}

// Une commande du fichier : le préfixe, le shell du fichier, son texte.
const fileStep = (project: Project, text: string, cwd: string, agentCommand: unknown, setting: unknown): Step =>
  ({ argv: [...commandPrefix(project, setting, agentCommand), ...project.shell, text], cwd });

// Le git de repli : derrière le préfixe, sans shell, chaque mot un argument.
const gitStep = (project: Project, home: string, args: string[], agentCommand: unknown, setting: unknown): Step =>
  ({ argv: [...commandPrefix(project, setting, agentCommand), 'git', '-C', home, ...args], cwd: home });

// Les commandes `setup` du fichier, au dossier `dir`.
export function setupSteps(project: Project, dir: string, agentCommand: unknown, setting: unknown): Step[] {
  return (project.setup ?? []).map((t) => fileStep(project, t, dir, agentCommand, setting));
}

// Créer le worktree de `branch` depuis `start` : worktree.create (au dossier
// home ; le script du projet prépare son worktree), sinon git worktree add puis
// setupSteps au worktree.
export function createSteps(
  project: Project, { home, branch, start }: { home: string; branch: string; start: string }, agentCommand: unknown, setting: unknown,
): Step[] {
  const dir = worktreeDir(project, home, branch);
  const create = project.worktree?.create;
  if (create) return [fileStep(project, create, home, agentCommand, setting)];
  return [gitStep(project, home, ['worktree', 'add', '-b', branch, dir, start], agentCommand, setting), ...setupSteps(project, dir, agentCommand, setting)];
}

// Retirer le worktree `dir` : worktree.remove (au dossier home), sinon git
// worktree remove <dir> (sans --force).
export function removeSteps(project: Project, { home, dir }: { home: string; dir: string }, agentCommand: unknown, setting: unknown): Step[] {
  const remove = project.worktree?.remove;
  return [remove ? fileStep(project, remove, home, agentCommand, setting) : gitStep(project, home, ['worktree', 'remove', dir], agentCommand, setting)];
}
