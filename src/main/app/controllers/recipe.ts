/** recipe — la recette du fichier du projet du parent (core/runner), lancée
 *  par l'appli (technicals/process runOnce), une à la fois par famille, son
 *  journal dans <sorties>/recipe.log : préparer le projet (setup au dossier de
 *  l'agent), créer un worktree (refusé si recipeEnv est null ou si le dossier
 *  est déjà là ; réussi seulement si le dossier est ensuite un worktree du
 *  dépôt), le retirer (parent présent ; `git status --porcelain` dans le
 *  worktree, non vide ou sans réponse : refusé, quelle que soit la commande).
 *  Ne connaît pas : la page, les fenêtres, la naissance et le départ des
 *  robots (controllers/worktrees).
 *  Utilisé par : controllers (processes, vibecoder, worktrees). */
import type { AgentConfig } from 'core/agents';

export type RecipeResult = { ok: boolean; line: string };

export async function prepare(_agent: AgentConfig): Promise<RecipeResult> {
  throw new Error('not implemented');
}

export async function createWorktree(
  _home: AgentConfig, _w: { branch: string; base: string; start: string },
): Promise<RecipeResult & { dir?: string }> {
  throw new Error('not implemented');
}

export async function removeWorktree(_child: AgentConfig): Promise<RecipeResult> {
  throw new Error('not implemented');
}
