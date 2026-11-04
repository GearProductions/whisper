/** ide-files — les lignes de la vue IDE des étapes Forme et Modules, sans le DOM : un fichier ou un module
 *  par ligne, son rang dans view.modules, l'état de son module (commité : done, touché : wip, sinon todo), la
 *  couleur de son nom comme VS Code (mark : nouveau, modifié, supprimé, pas commités ; todo : à générer ;
 *  null : commité) et ce que ModuleCode en montre (un module, réduit à un fichier pour Modules ; null : rien à montrer).
 *  Sans module (la Forme n'est pas écrite), les lignes sont les fichiers de la branche, chacun un module
 *  d'un seul fichier (rank et state null). Les tests d'invariants (invariantFiles) : une ligne par test, son rang
 *  dans view.invariants, son état (cas validés : tous done, aucun todo, sinon wip), son état git (lu dans view.files) ; rien à montrer (code null).
 *  Ne connaît pas : le DOM, React, le pont. Utilisé par : app/panel/vibecoder (forme-view, modules-view, ide-view,
 *  invariants-view). */
import type { VibeGit, VibeModule, VibeTestFile, VibeView } from 'technicals/bridge';

export type ModuleState = 'done' | 'wip' | 'todo';
export type FileMark = VibeGit | 'deleted' | 'todo';

// La couleur d'un fichier de la branche : supprimé, sinon son état git (rien : commité).
const markOf = (f: { deleted?: boolean; git?: VibeGit }): FileMark | null => (f.deleted ? 'deleted' : f.git ?? null);

export const moduleState = (m: VibeModule): ModuleState => (m.commits.length ? 'done' : m.touched ? 'wip' : 'todo');

export type IdeFile = {
  path: string;
  rank: number | null;          // le rang dans view.modules ; null : un fichier de la branche
  state: ModuleState | null;
  mark: FileMark | null;        // la couleur de son nom (FileMark) ; null : commité, comme le reste
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
      mark: markOf({ deleted, git: file.git }),
      code: { path: file.path, contract: '', file, touched: true, commits: [], files: [{ ...file, ...(deleted && { deleted }) }], locked },
    }));
  }
  const seen = new Set<string>();
  return view.modules.flatMap((m, rank): IdeFile[] => {
    const state = moduleState(m);
    // Un module ligne à ligne (Forme, ou pas encore de fichier) : à générer s'il n'est pas touché ; la couleur de
    // son fichier s'il n'en a qu'un ; un dossier de plusieurs fichiers : modifié si l'un n'est pas commité.
    const path = by === 'module' ? m.path : m.file?.path ?? m.path;
    const own = m.files?.length === 1 ? m.files[0] : undefined;
    if (by === 'module' || !m.touched || !m.files?.length) return [{ path, rank, state, mark: !m.touched ? 'todo' : own ? markOf(own) : m.files?.some((f) => markOf(f)) ? 'modified' : null, code: m.touched ? m : null }];
    return m.files.map((f) => ({ path: f.path, rank, state, mark: markOf(f), code: { ...m, files: [f] } }));
  }).filter((r) => !seen.has(r.path) && seen.add(r.path));
}

// Une ligne par test d'invariant : done si tous ses cas sont validés (ok), todo si aucun n'a de verdict, sinon wip.
// mark : son état git, lu dans les fichiers de la branche (view.files ; absent : commité).
export const invariantFiles = (tests: VibeTestFile[], files: VibeView['files'] = []): IdeFile[] => tests.map((t, rank) => {
  const marks = t.cases.map((c) => t.marks[c]);
  return {
    path: t.path,
    rank,
    state: marks.length && marks.every((m) => m === 'ok') ? 'done' : marks.some(Boolean) ? 'wip' : 'todo',
    mark: markOf({ git: files.find((f) => f.path === t.path)?.git }),
    code: null,
  };
});
