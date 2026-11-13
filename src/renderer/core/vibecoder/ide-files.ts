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
 *  (base absente : nouveau ; différente : modifié ; la même ou inconnue : aucune), code null. Sans Forme : les tests seuls.
 *  Le menu de diff de la vue IDE (note 0.15.0-ecran-statuts) : ses références (diffRefs : la base de la branche, le
 *  dernier commit, la validation si l'étape en a une) et l'arborescence filtrée (diffTree : base, tous les fichiers ;
 *  head ou validated, ceux de view.diffs, un supprimé absent des fichiers ajouté en « supprimé », son id gone).
 *  Retirés : reviewRows, fileGesture
 *  (les accordéons, le Valider d'un fichier).
 *  Ne connaît pas : le DOM, React, le pont. Utilisé par : app/panel/vibecoder (forme-view, modules-view, ide-view,
 *  invariants-view, ide-diff). */
import type { VibeDiffStep, VibeGit, VibeMarkState, VibeModule, VibeStepCheck, VibeTestFile, VibeView } from 'technicals/bridge';

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
  gone?: string;                // menu de diff : un fichier supprimé depuis la référence, son id r<i> (view.diffs) ; absent : aucun
  hint?: string;                // l'infobulle de sa ligne, après son chemin (un fichier hors de la Forme) ; absent : le chemin seul
};

// La section Forme d'une note (de « ## Forme » au titre de niveau 2 suivant) ; '' sans elle.
export function formeText(note: string): string {
  const m = /^## Forme[ \t]*$/m.exec(note);
  if (!m) return '';
  const rest = note.slice(m.index + m[0].length);
  const end = rest.search(/^## /m);
  return end < 0 ? rest : rest.slice(0, end);
}

// Un chemin que la Forme nomme quelque part (en tête d'un module, dans ses variants, un « supprime … ») : déclaré, pas un
// oubli ; aussi sans son src/ de tête (la Forme l'omet souvent).
export const inForme = (forme: string, path: string): boolean => forme.includes(path) || forme.includes(path.replace(/^src\//, ''));

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

// L'état d'un test : done si tous ses cas sont validés (ok), todo si aucun n'a de verdict, sinon wip.
const testState = (t: VibeTestFile): ModuleState => {
  const marks = t.cases.map((c) => t.marks[c]);
  return marks.length && marks.every((m) => m === 'ok') ? 'done' : marks.some(Boolean) ? 'wip' : 'todo';
};

// L'étape Invariants : les fichiers de la Forme (ideFiles by 'module', dim) et les tests (test, rank null,
// couleur d'après base), une ligne par chemin, celle du test s'il est aussi un chemin de la Forme ; sans
// module, les tests seuls (jamais les autres fichiers de la branche).
export function invariantTree(view: Pick<VibeView, 'modules' | 'invariants' | 'files'>): IdeFile[] {
  const tests = view.invariants.map((t, test): IdeFile => ({
    path: t.path,
    rank: null,
    state: testState(t),
    // base null : absente à la base, ajouté par la branche ; absente (undefined) : inconnue, aucune couleur
    mark: t.base === undefined ? null : t.base === null ? 'new' : t.base === t.source ? null : 'modified',
    code: null,
    test,
  }));
  const paths = new Set(tests.map((t) => t.path));
  const forme = view.modules.length ? ideFiles(view, 'module').filter((r) => !paths.has(r.path)).map((r) => ({ ...r, dim: true })) : [];
  return [...forme, ...tests];
}

// La référence du menu de diff de la vue IDE.
export type DiffRef = 'base' | 'head' | 'validated';

// Les références offertes à l'étape : base et head toujours ; validated si l'étape a une validation (step.check.state
// non null).
export function diffRefs(view: Pick<VibeView, 'steps'>, step: VibeDiffStep): DiffRef[] {
  const check = view.steps.find((s) => s.id === step)?.check;
  return check?.state ? ['base', 'head', 'validated'] : ['base', 'head'];
}

// L'arborescence de la vue IDE pour une référence, d'après git, sans autre règle : base, files plus tout ce que la branche
// change depuis sa base (view.files : git diff et git status, supprimés compris) qu'aucune ligne de files ne couvre (son
// chemin, ou sous un dossier de files) ; head, ce qui diffère du dernier commit (view.diffs.head, le git status) ;
// validated, ce qui diffère de la version validée de l'étape (view.diffs.validated[step]). Un chemin de la liste absent
// de files : sa ligne de fichier de la branche (branchRow), sinon, supprimé, une ligne « supprimé » (gone : son id r<i>) ;
// un ajouté que la Forme ne nomme nulle part est en retrait (dim), son infobulle hint le dit (un oubli possible de la
// Forme) ; un ajouté qu'elle nomme (un variant, un fichier supprimé…) reste en clair. L'ordre de files, les ajoutés à la fin par chemin.
export function diffTree(files: IdeFile[], view: Pick<VibeView, 'diffs' | 'files'> & { note?: { text: string } | null }, step: VibeDiffStep, ref: DiffRef, hint = 'Changé par la branche, hors de la Forme'): IdeFile[] {
  const have = new Set(files.map((f) => f.path));
  // Un ajouté que la Forme nomme quelque part : en clair ; sinon, en retrait, avec son infobulle (un oubli possible).
  const forme = formeText(view.note?.text ?? '');
  const outside = (f: IdeFile): IdeFile => (inForme(forme, f.path) ? f : { ...f, dim: true, hint });
  const branch = new Map((view.files ?? []).map((f) => [f.path, f]));
  const byPath = (a: { path: string }, b: { path: string }) => (a.path < b.path ? -1 : 1);
  if (ref === 'base') {
    const covered = (p: string) => have.has(p) || files.some((f) => p.startsWith(f.path.endsWith('/') ? f.path : `${f.path}/`));
    const extra = [...branch.values()].filter((f) => !covered(f.path)).sort(byPath).map((f) => outside(branchRow(f)));
    return extra.length ? [...files, ...extra] : files;
  }
  const entries = (ref === 'head' ? view.diffs?.head : view.diffs?.validated[step]) ?? [];
  const by = new Set(entries.map((e) => e.path));
  const extra = entries.filter((e) => !have.has(e.path)).sort(byPath).flatMap((e): IdeFile[] => {
    const known = branch.get(e.path);
    if (known) return [outside(branchRow(known))];
    return e.deleted ? [outside({ path: e.path, rank: null, state: null, mark: 'deleted', code: null, gone: e.id ?? '' })] : [];
  });
  return [...files.filter((f) => by.has(f.path)), ...extra];
}

// La validation d'une étape d'après step.check, pour MarkControl : cochée → ok, décochée (changée, ou en cascade) → changed.
export const checkMark = (c?: VibeStepCheck): VibeMarkState => (c?.state === 'ok' ? 'ok' : c?.state ? 'changed' : null);

// Un fichier supprimé depuis la référence du menu de diff (gone), comme un module d'un seul fichier : ModuleCode le suit par
// son id r<i>, tout en retraits.
export const goneModule = (f: Pick<IdeFile, 'path' | 'gone'>): VibeModule => ({
  path: f.path, paths: [f.path], contract: '', file: null, touched: true, commits: [], files: [{ id: f.gone!, path: f.path, deleted: true }],
});
