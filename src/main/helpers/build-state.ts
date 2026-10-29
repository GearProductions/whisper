/** build-state — en développement, ce que demande ce qui a été reconstruit : le principal (et ses ponts) a
 *  changé depuis son lancement → redémarrer ; sinon les pages ont changé depuis leur dernier chargement →
 *  recharger l'interface ; sinon rien. Par empreintes (null : pas de fichier construit, rien à dire).
 *  Ne connaît pas : le disque, Electron. Utilisé par : app/dev. */

export type Builds = { main: string | null; pages: string | null };
export type BuildState = 'restart' | 'reload' | null;

// `loaded` : ce que l'appli a chargé ; `built` : ce qu'il y a maintenant dans out/.
export function buildState(loaded: Builds, built: Builds): BuildState {
  const changed = (k: keyof Builds) => loaded[k] !== null && built[k] !== null && loaded[k] !== built[k];
  return changed('main') ? 'restart' : changed('pages') ? 'reload' : null;
}
