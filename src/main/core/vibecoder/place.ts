/** place — où relire une PR et où commencer une demande (note 0.12.0-creer-relire-meme-dossier) : quels
 *  choix de lieu montrer d'après l'état du dossier (changer de branche, un nouveau worktree, propre ou pas,
 *  décharger la PR, mettre de côté), et pourquoi l'un est grisé (des modifications : pas de git switch ; une recette en cours).
 *  Masqué n'est pas refusé : le principal revérifie au clic.
 *  Ne connaît pas : Electron, git, le disque, les libellés.
 *  Utilisé par : core/vibecoder (journey). */

export const PLACE_ACTIONS: readonly string[] = ['pr-here', 'pr-worktree', 'unload-pr', 'new-here', 'new-worktree', 'stash'];

export type PlaceState = {
  head: string | null;      // la tête de la PR chargée (sa fiche) ; null : pas de PR chargée
  branch: string | null;    // la branche du dossier
  dirty: boolean;           // des modifications non commitées dans le dossier
  child: boolean;           // l'agent est l'enfant d'un worktree
  robot: boolean;           // le robot d'une PR
  prWorktree: boolean;      // la PR a déjà son worktree
  request: string | null;   // la branche d'une nouvelle demande en attente de son choix
  recipe: boolean;          // une recette de la famille en cours
};

// Le dossier est sur la PR : sur sa tête, ou c'est son robot.
export function onPr(s: PlaceState): boolean {
  return s.robot || (s.head !== null && s.branch === s.head);
}

export function placeShown(s: PlaceState): Record<string, boolean> {
  const prHere = s.head !== null && !onPr(s);
  const unloadPr = s.head !== null && !s.robot;
  const newHere = s.request !== null;
  return {
    'pr-here': prHere,
    'pr-worktree': prHere && !s.child && !s.prWorktree,
    'unload-pr': unloadPr,
    'new-here': newHere,
    'new-worktree': newHere && !s.child,
    stash: s.dirty && (prHere || unloadPr || newHere),
  };
}

const SWITCHES = ['pr-here', 'unload-pr', 'new-here'];   // git switch : jamais sur des modifications

export function placeReason(id: string, s: PlaceState): 'dirty' | 'preparing' | null {
  if (!PLACE_ACTIONS.includes(id)) return null;
  if (s.recipe) return 'preparing';
  if (SWITCHES.includes(id) && s.dirty) return 'dirty';
  return null;
}
