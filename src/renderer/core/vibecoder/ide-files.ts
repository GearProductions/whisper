/** ide-files — les lignes de la vue IDE des étapes Forme, Modules et Invariants, sans le DOM : un fichier ou un module
 *  par ligne, son rang dans view.modules, l'état de son module (commité : done, touché : wip, sinon todo), la
 *  couleur de son nom comme VS Code (mark : nouveau, modifié, supprimé, pas commités ; todo : à générer ;
 *  null : commité) et ce que ModuleCode en montre (un module, réduit à un fichier pour Modules ; null : rien à montrer).
 *  Sans module (la Forme n'est pas écrite), les lignes sont les fichiers de la branche, chacun un module
 *  d'un seul fichier (rank et state null). Avec des modules, l'étape Modules (by 'file') montre aussi les
 *  variants que change la branche (view.variants, lus dans view.files), après eux, comme ces fichiers-là :
 *  on voit où ils sont écrits (note 0.15.0-variants-tdd).
 *  L'étape Invariants (invariantTree) : les fichiers de la Forme (comme by 'module', en retrait : dim) et les
 *  tests d'invariants ensemble ; un test : test (son rang dans view.invariants), sans rang (pas de numéro), son
 *  état (cas validés : tous done, aucun todo, sinon wip), sa couleur d'après son texte à la base de la branche
 *  (base absente : nouveau ; différente : modifié ; la même : aucune), code null. Sans Forme : les tests seuls.
 *  invariantFiles : retiré avec son dernier appelant (invariants-view passe à invariantTree).
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
  test?: number;                // Invariants : un test, son rang dans view.invariants ; absent : pas un test
  dim?: boolean;                // Invariants : un fichier de la Forme, en retrait ; absent = false
};

// Un fichier de la branche, un module d'un seul fichier (rank et state null).
const branchRow = ({ deleted, locked, ...file }: NonNullable<VibeView['files']>[number]): IdeFile => ({
  path: file.path,
  rank: null,
  state: null,
  mark: markOf({ deleted, git: file.git }),
  code: { path: file.path, paths: [file.path], contract: '', file, touched: true, commits: [], files: [{ ...file, ...(deleted && { deleted }) }], locked },
});

// by 'module' (Forme) : un par module, son chemin de la Forme. by 'file' (Modules) : un par fichier changé
// des modules touchés, le chemin de leur fichier des autres (un module touché sans fichier compris). Un chemin
// n'a qu'une ligne : si des modules se chevauchent, le premier de la Forme le garde. Puis, by 'file',
// les variants de la branche (view.variants) qu'aucun module ne liste, chacun comme un fichier de la branche.
export function ideFiles(view: Pick<VibeView, 'modules' | 'files'> & { variants?: VibeView['variants'] }, by: 'module' | 'file'): IdeFile[] {
  if (!view.modules.length) return (view.files ?? []).map(branchRow);
  const variants = by === 'file' ? (view.files ?? []).filter((f) => view.variants?.some((v) => v.path === f.path)) : [];
  const seen = new Set<string>();
  return [...view.modules.flatMap((m, rank): IdeFile[] => {
    const state = moduleState(m);
    // Un module ligne à ligne (Forme, ou pas encore de fichier) : à générer s'il n'est pas touché ; la couleur de
    // son fichier s'il n'en a qu'un ; un dossier de plusieurs fichiers : modifié si l'un n'est pas commité.
    const { paths } = m;
    const lines = by === 'module' || paths.length > 1 ? paths : [m.file?.path ?? m.path];
    const own = m.files?.length === 1 ? m.files[0] : undefined;
    // Une entrée de la Forme à plusieurs chemins (« a + b », T-15) : une ligne par chemin, au rang de l'entrée.
    const row = { rank, state, mark: !m.touched ? 'todo' as const : own ? markOf(own) : m.files?.some((f) => markOf(f)) ? 'modified' as const : null, code: m.touched ? m : null };
    if (by === 'module' || !m.touched || !m.files?.length) return lines.map((path) => ({ path, ...row }));
    return m.files.map((f) => ({ path: f.path, rank, state, mark: markOf(f), code: { ...m, files: [f] } }));
  }), ...variants.map(branchRow)].filter((r) => !seen.has(r.path) && seen.add(r.path));
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

// L'étape Invariants : les fichiers de la Forme (ideFiles by 'module', dim) et les tests (test, rank null,
// couleur d'après base), une ligne par chemin, celle du test s'il est aussi un chemin de la Forme ; sans
// module, les tests seuls (jamais les autres fichiers de la branche).
export function invariantTree(view: Pick<VibeView, 'modules' | 'invariants' | 'files'>): IdeFile[] {
  void view;
  throw new Error('not implemented');
}
