/** place — où relire une PR, sur quelle branche aller, où créer une branche (notes 0.12.0-creer-relire-meme-dossier,
 *  0.12.0-gestion-des-branches) : quels choix de lieu montrer d'après l'état du dossier (charger la PR ici ou
 *  dans un nouveau worktree, aller sur une branche, créer une branche ici ou dans un worktree, revenir sur la
 *  base, mettre de côté), et pourquoi l'un est grisé (des modifications : pas de git switch ; une recette en cours).
 *  Masqué n'est pas refusé : le principal revérifie au clic.
 *  Ne connaît pas : Electron, git, le disque, les libellés.
 *  Utilisé par : core/vibecoder (journey), app/controllers/vibecoder (onBase). */

export const PLACE_ACTIONS: readonly string[] = ['pr-here', 'pr-worktree', 'unload-pr', 'switch-branch', 'new-here', 'new-worktree', 'stash'];

export type PlaceState = {
  head: string | null;      // la tête de la PR chargée (sa fiche) ; null : pas de PR chargée
  branch: string | null;    // la branche du dossier
  onBase: boolean;          // le dossier est sur la branche principale (onBase)
  dirty: boolean;           // des modifications non commitées dans le dossier
  child: boolean;           // l'agent est l'enfant d'un worktree
  robot: boolean;           // le robot d'une PR
  prWorktree: boolean;      // la PR a déjà son worktree
  recipe: boolean;          // une recette de la famille en cours
};

// La branche est la base, l'une ou l'autre écrite avec ou sans « origin/ ».
export function onBase(branch: string | null, base: string | null): boolean {
  const name = (b: string | null) => b?.replace(/^origin\//, '') || null;
  return name(branch) !== null && name(branch) === name(base);
}

// Le dossier est sur la PR : sur sa tête, ou c'est son robot.
export function onPr(s: PlaceState): boolean {
  return s.robot || (s.head !== null && s.branch === s.head);
}

export function placeShown(s: PlaceState): Record<string, boolean> {
  const prHere = s.head !== null && !onPr(s);
  return {
    'pr-here': prHere,
    'pr-worktree': prHere && !s.child && !s.prWorktree,
    'unload-pr': (s.head !== null || !s.onBase) && !s.robot,
    'switch-branch': true,
    'new-here': true,
    'new-worktree': !s.child,
    stash: s.dirty,
  };
}

const SWITCHES = ['pr-here', 'unload-pr', 'switch-branch', 'new-here'];   // git switch : jamais sur des modifications

export function placeReason(id: string, s: PlaceState): 'dirty' | 'preparing' | null {
  if (!PLACE_ACTIONS.includes(id)) return null;
  if (s.recipe) return 'preparing';
  if (SWITCHES.includes(id) && s.dirty) return 'dirty';
  return null;
}
