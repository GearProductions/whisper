/** ide-files — les lignes de la vue IDE des étapes Forme et Modules, sans le DOM : un fichier ou un module
 *  par ligne, son rang dans view.modules, l'état de son module (commité : done, touché : wip, sinon todo) et
 *  ce que ModuleCode en montre (un module, réduit à un fichier pour Modules ; null : rien à montrer).
 *  Sans module (la Forme n'est pas écrite), les lignes sont les fichiers de la branche, chacun un module
 *  d'un seul fichier (rank et state null).
 *  Ne connaît pas : le DOM, React, le pont. Utilisé par : app/panel/vibecoder (forme-view, modules-view, ide-view). */
import type { VibeModule, VibeView } from 'technicals/bridge';

export type ModuleState = 'done' | 'wip' | 'todo';

export const moduleState = (m: VibeModule): ModuleState => (m.commits.length ? 'done' : m.touched ? 'wip' : 'todo');

export type IdeFile = {
  path: string;
  rank: number | null;          // le rang dans view.modules ; null : un fichier de la branche
  state: ModuleState | null;
  code: VibeModule | null;      // ce que ModuleCode montre ; null : rien à montrer
};

// by 'module' (Forme) : un par module, son chemin de la Forme. by 'file' (Modules) : un par fichier changé
// des modules touchés, le chemin de leur fichier des autres (un module touché sans fichier compris). Un chemin
// n'a qu'une ligne : si des modules se chevauchent, le premier de la Forme le garde.
export function ideFiles(view: Pick<VibeView, 'modules' | 'files'>, by: 'module' | 'file'): IdeFile[] {
  if (!view.modules.length) {
    return (view.files ?? []).map(({ deleted, locked, ...file }) => ({
      path: file.path,
      rank: null,
      state: null,
      code: { path: file.path, contract: '', file, touched: true, commits: [], files: [{ ...file, ...(deleted && { deleted }) }], locked },
    }));
  }
  const seen = new Set<string>();
  return view.modules.flatMap((m, rank): IdeFile[] => {
    const state = moduleState(m);
    if (by === 'module' || !m.touched || !m.files?.length) return [{ path: by === 'module' ? m.path : m.file?.path ?? m.path, rank, state, code: m.touched ? m : null }];
    return m.files.map((f) => ({ path: f.path, rank, state, code: { ...m, files: [f] } }));
  }).filter((r) => !seen.has(r.path) && seen.add(r.path));
}
