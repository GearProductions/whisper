/** ide-files — les lignes de la vue IDE des étapes Forme, Modules et Invariants, sans le DOM : un fichier ou un module
 *  par ligne, son rang dans view.modules, l'état de son module (commité : done, touché : wip, sinon todo), la
 *  couleur de son nom comme VS Code (mark : nouveau, modifié, supprimé, pas commités ; todo : à générer ;
 *  null : commité) et ce que ModuleCode en montre (un module, réduit à un fichier pour Modules ; null : rien à montrer).
 *  Sans module (la Forme n'est pas écrite), les lignes sont les fichiers de la branche, chacun un module
 *  d'un seul fichier (rank et state null). Avec des modules, l'étape Modules (by 'file') montre aussi les
 *  variants que change la branche (view.variants, lus dans view.files), après eux, comme ces fichiers-là :
 *  on voit où ils sont écrits (note 0.15.0-variants-tdd).
 *  Le menu de diff de la vue IDE (note 0.15.0-ecran-statuts) : ses références (diffRefs : la base de la branche, le
 *  dernier commit, la validation si l'étape en a une) et l'arborescence filtrée (diffTree : base, tous les fichiers ;
 *  head ou validated, ceux de view.diffs, un supprimé absent des fichiers ajouté en « supprimé », son id gone).
 *  Retirés : reviewRows, fileGesture
 *  (les accordéons, le Valider d'un fichier).
 *  L'écran de l'essentiel (note 0.16.0-ecran-essentiel) : la ligne d'état de l'étape Modules, en nombres.
 *  moduleCounts(modules: VibeModule[]): ModuleCounts — total : les modules de la Forme ; written : ceux qui ne sont
 *  plus à générer (moduleState 'wip' ou 'done') ; committed : ceux qui ont un commit et rien de pas commité
 *  (uncommitted). modules-view en fait une seule phrase (« 16 modules écrits · commités »).
 *  Le menu de diff n'a plus que deux références à l'écran du créateur, la base de la branche et la validation
 *  (useCreatorDiff, d'ide-diff ; useIdeDiff, sans appelant, offre toujours le dernier commit) ; diffRefs et diffTree
 *  ne changent pas. Retiré : invariantTree (l'arbre des tests du relecteur, sans appelant depuis son retrait).
 *  Ne connaît pas : le DOM, React, le pont. Utilisé par : app/panel/vibecoder (forme-view, modules-view, ide-view,
 *  ide-diff). */
import type { VibeDiffStep, VibeGit, VibeLang, VibeModule, VibeView, VibeStep } from 'technicals/bridge';
import { t } from './i18n';

export type ModuleState = 'done' | 'wip' | 'todo';
export type FileMark = VibeGit | 'deleted' | 'todo';

// La couleur d'un fichier de la branche : supprimé, sinon son état git (rien : commité).
const markOf = (f: { deleted?: boolean; git?: VibeGit }): FileMark | null => (f.deleted ? 'deleted' : f.git ?? null);

// Un module dont tous les fichiers sont encore le squelette de la Forme (skeleton) : à générer, comme un module pas touché.
export const moduleState = (m: VibeModule): ModuleState => (m.commits.length ? 'done' : m.touched && !m.skeleton ? 'wip' : 'todo');

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

// La section Forme d'une note (parseNote du principal : « Forme », « Shape » ou « Form », casse et accents ignorés, jusqu'au
// titre de niveau 2 suivant, ceux des blocs de code exceptés) ; '' sans elle.
export function formeText(note: string): string {
  const sections: { name: string; text: string }[] = [];
  let fence = false;
  for (const line of note.split(/\r?\n/)) {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const h = fence ? null : /^##\s+(.*?)\s*$/.exec(line);
    if (h) sections.push({ name: h[1], text: '' });
    else if (sections.length) sections[sections.length - 1].text += `${line}\n`;
  }
  return sections.find((s) => /^(forme|shape|form)\b/.test(s.name.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '')))?.text ?? '';
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
// skeletonHint : l'infobulle d'un fichier encore squelette (by 'file' : en retrait, marqué à générer).
export function ideFiles(view: Pick<VibeView, 'modules' | 'files'> & { variants?: VibeView['variants'] }, by: 'module' | 'file', skeletonHint = 'À générer : encore le squelette de la Forme'): IdeFile[] {
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
    return m.files.map((f) => ({ path: f.path, rank, state, mark: f.skeleton ? 'todo' as const : markOf(f), code: { ...m, files: [f] },
      ...(f.skeleton && { dim: true, hint: skeletonHint }) }));
  }), ...variants.map(branchRow)].filter((r) => !seen.has(r.path) && seen.add(r.path));
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
// validated, ce qui diffère de la version validée de l'étape (view.diffs.validated[step]) ; dans les trois, une ligne de
// dossier (un module de la Forme) couvre ses fichiers et reste dès qu'un d'eux diffère. Un chemin de la liste qu'aucune
// ligne de files ne couvre : sa ligne de fichier de la branche (branchRow), sinon, supprimé, une ligne « supprimé » (gone : son id r<i>) ;
// un ajouté que la Forme ne nomme nulle part est en retrait (dim), son infobulle hint le dit (un oubli possible de la
// Forme) ; un ajouté qu'elle nomme (un variant, un fichier supprimé…) reste en clair. L'ordre de files, les ajoutés à la fin par chemin.
export function diffTree(files: IdeFile[], view: Pick<VibeView, 'diffs' | 'files'> & { note?: { text: string; path?: string } | null; lang?: VibeLang }, step: VibeDiffStep, ref: DiffRef): IdeFile[] {
  // Un chemin que couvre une ligne de files : le sien, ou, d'un dossier (module de la Forme), un chemin dessous.
  const under = (p: string, dir: string) => p === dir || p.startsWith(dir.endsWith('/') ? dir : `${dir}/`);
  const covered = (p: string) => files.some((f) => under(p, f.path));
  // Un ajouté que la Forme nomme quelque part : en clair ; sinon, en retrait, avec son infobulle (un oubli possible).
  // La note n'est jamais un oubli de la Forme : la validation de la Forme la retient (son diff : Depuis la validation).
  const forme = formeText(view.note?.text ?? '');
  const hint = t(view.lang ?? 'fr').notInForme;
  const outside = (f: IdeFile): IdeFile => (f.path === view.note?.path || inForme(forme, f.path) ? f : { ...f, dim: true, hint });
  const branch = new Map((view.files ?? []).map((f) => [f.path, f]));
  const byPath = (a: { path: string }, b: { path: string }) => (a.path < b.path ? -1 : 1);
  if (ref === 'base') {
    const extra = [...branch.values()].filter((f) => !covered(f.path)).sort(byPath).map((f) => outside(branchRow(f)));
    return extra.length ? [...files, ...extra] : files;
  }
  const entries = (ref === 'head' ? view.diffs?.head : view.diffs?.validated[step]) ?? [];
  const extra = entries.filter((e) => !covered(e.path)).sort(byPath).flatMap((e): IdeFile[] => {
    const known = branch.get(e.path);
    if (known) return [outside(branchRow(known))];
    return e.deleted ? [outside({ path: e.path, rank: null, state: null, mark: 'deleted', code: null, gone: e.id ?? '' })] : [];
  });
  return [...files.filter((f) => entries.some((e) => under(e.path, f.path))), ...extra];
}

// La couleur d'une étape du fil d'Ariane d'après sa validation (step.check ; les étapes qui se valident) : ok, validée et
// rien de changé depuis (vert) ; warn, du contenu déjà validé, modifié depuis ou à revoir en cascade (jaune) ; none,
// jamais validée (gris, même faite) ; null : une étape sans validation (Revue, PR), la couleur de son état.
export const crumbCheck = (s: Pick<VibeStep, 'check'>): 'ok' | 'warn' | 'none' | null =>
  (!s.check ? null : s.check.state === 'ok' ? 'ok' : s.check.state ? 'warn' : 'none');

// L'étape d'avant qui n'est pas validée (Note → Forme → Invariants → Modules) : celle qu'attend la validation de step ;
// null, rien à attendre (la note, une étape sans validation, ou celle d'avant validée).
const CHAIN = ['note', 'forme', 'invariants', 'modules'] as const;
export function waitingFor(steps: Pick<VibeStep, 'id' | 'check'>[], step: VibeStep['id']): VibeStep['id'] | null {
  const i = CHAIN.indexOf(step as typeof CHAIN[number]);
  if (i <= 0) return null;
  const prev = steps.find((s) => s.id === CHAIN[i - 1]);
  return prev?.check && prev.check.state !== 'ok' ? prev.id : null;
}

// Un fichier supprimé depuis la référence du menu de diff (gone), comme un module d'un seul fichier : ModuleCode le suit par
// son id r<i>, tout en retraits.
export const goneModule = (f: Pick<IdeFile, 'path' | 'gone'>): VibeModule => ({
  path: f.path, paths: [f.path], contract: '', file: null, touched: true, commits: [], files: [{ id: f.gone!, path: f.path, deleted: true }],
});

// La ligne d'état de l'étape Modules, en nombres (voir l'en-tête).
export type ModuleCounts = { total: number; written: number; committed: number };

export const moduleCounts = (modules: VibeModule[]): ModuleCounts => ({
  total: modules.length,
  written: modules.filter((m) => moduleState(m) !== 'todo').length,
  committed: modules.filter((m) => m.commits.length > 0 && !m.uncommitted).length,
});
