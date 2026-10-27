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
import type { Project } from './runner';

export type Step = { argv: string[]; cwd: string };

// VIBECODER_BRANCH et VIBECODER_BASE ; null si l'un n'est pas un ref sûr (okRef).
export function recipeEnv(_branch: string, _base?: string): Record<string, string> | null {
  throw new Error('not implemented');
}

// Le dossier du worktree de `branch` : worktree.dir (par défaut
// ../<nom du dossier>-worktrees/{branch}), {branch} remplacé, résolu depuis home.
export function worktreeDir(_project: Project, _home: string, _branch: string): string {
  throw new Error('not implemented');
}

// Les commandes `setup` du fichier, au dossier `dir`.
export function setupSteps(_project: Project, _dir: string, _agentCommand: unknown, _setting: unknown): Step[] {
  throw new Error('not implemented');
}

// Créer le worktree de `branch` depuis `start` : worktree.create (au dossier
// home), sinon git worktree add puis setupSteps au worktree.
export function createSteps(
  _project: Project, _w: { home: string; branch: string; start: string }, _agentCommand: unknown, _setting: unknown,
): Step[] {
  throw new Error('not implemented');
}

// Retirer le worktree `dir` : worktree.remove, sinon git worktree remove <dir>.
export function removeSteps(_project: Project, _w: { home: string; dir: string }, _agentCommand: unknown, _setting: unknown): Step[] {
  throw new Error('not implemented');
}
