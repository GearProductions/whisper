/** journey — le parcours de l'écran VibeCoder, calculé sans modèle à partir du
 *  relevé (dépôt, note, tests, sorties des skills, validations) : un seul parcours
 *  (Note, Forme, Invariants, Modules, Revue, PR) pour les deux rôles (view.flow : créateur
 *  'create', relecteur 'review', décidé par l'appli, passé en entrée). Les étapes (faite,
 *  en cours — la première pas faite — , à venir ; toutes s'ouvrent, la page ne reçoit plus
 *  d'`open`), leurs faits en une ligne, la prochaine action (celle de l'étape en cours), les
 *  actions possibles, pourquoi une autre est grisée (noNoteYet : grisée, sa raison au survol) et
 *  celles qui n'ont pas encore de sens (hidden : masquées, leur raison d'être grisée gardée).
 *  Faite, en relecteur : la Note jugée ; la Forme avec elle (rien à juger) ; les Invariants,
 *  chaque cas jugé ; les Modules, les commits relus ; la Revue, le plan à l'écran écrit et toutes
 *  ses cases cochées ; la PR, la revue publiée. En créateur, la Revue attend en plus chaque case
 *  du plan à l'écran, s'il y en a un (screen : ecran.md, une sortie de branche, marques
 *  check:<rang>). Le relecteur ne voit aucune action qui édite, génère ou commite (les actions
 *  create ne sont pas au relevé ; rebase, push, copy-artifact masquées) ; S'assigner la PR lui
 *  est montrée si canAssign, Me retirer de la PR au créateur si unassignable (people, login :
 *  lus par gh, absents : null).
 *  Le mode Vibe en cours ou pas (vibe : les validations tenues pour données ; note
 *  0.12.0-mode-vibe), les choix de lieu (charger la PR suivie, aller sur une branche, en créer
 *  une, revenir sur la base, mettre de côté), montrés et grisés par core/vibecoder place
 *  d'après le dossier (checkout, onBase), Pull grisé par core/vibecoder sync, Pousser montré
 *  après un rebase réussi pas encore poussé (d'après direct), Nouvelle demande masquée hors de
 *  la base, et le retrait du worktree d'un enfant (sur un enfant seulement, grisé pendant une
 *  recette) ; la PR suivie et sa fiche (loaded), les PR ouvertes du dépôt (prs : les miennes, à
 *  relire, toutes ; false : gh en échec), les branches locales et l'état distant (sync) ; le
 *  dossier hors de la tête de la PR suivie (ou de son robot ; elsewhere ; notes
 *  0.12.0-creer-relire-meme-dossier, 0.12.0-gestion-des-branches) grise les étapes du
 *  relecteur ; ce que l'appli fait aussi elle-même (F-114 : en cours, dernier résultat ; les
 *  règles : la note du ticket 0.8.0), les courses (une action d'étape court à part : grisée par
 *  blockedBy de runs, pas par la conversation qui travaille ; note 0.9.0 des actions
 *  indépendantes) ; une action de ELSEWHERE (place : elle travaille dans un autre dossier)
 *  n'est pas grisée par la conversation qui travaille, et sa directe porte elsewhere (la page ne
 *  grise que son « via »), une commande directe en cours la grise toujours ; efforts : ceux de
 *  EFFORT_LEVELS pour une action dont le skill fixe son modèle (note 0.13.0-fix-and-improvements) ;
 *  un checks.json antérieur au départ de la dernière course checks ignoré partout, sorties
 *  comprises (I-46 ; note 0.9.0-vibecoder-pr-verifications-courses) ; l'étape Invariants faite
 *  seulement si la Note et la Forme le sont (note 0.12.0-vibe-sans-rc-diff-en-fond), puis sans
 *  ligne « → invariant » (Écrire les invariants masquée sans griser), sinon chaque cas validé
 *  (créateur) ou jugé (relecteur), lu ou pas ; en créateur, sans test d'invariant de la branche
 *  (la ligne déjà observée par un test existant) : la dernière course invariants ou align
 *  finie, ou ✓ Rien à écrire validé à la main, Vibe compris (nothingMark ; note
 *  0.11.0-vibecoder-invariants-existants-et-courses) ; Lire en pseudo-code jamais mise en
 *  avant, Vibe compris (note 0.11.0-stabiliser-vibecoder). Vibe grisée tant que la note n'est
 *  pas rédigée (noNoteYet), masquée si elle a des questions ouvertes ou n'a pas son ✓
 *  (unvalidated), pendant Vibe, un tour de la conversation ou une course qui retient (started) ; un module aux fichiers changés pas
 *  commités (uncommitted) : Commiter les modules, s'il n'en reste pas à faire, l'étape Modules
 *  pas faite tant qu'il en reste un ; les fichiers d'un module touché (files : ceux que la
 *  branche change sous son chemin, la copie de travail comprise, ids `m<rang>/<i>`, triés,
 *  deleted : absents du disque ; note 0.13.0-ameliorations-interface) et pourquoi son code, la
 *  note ou un test ne s'édite pas (locked : codeLock de runs ; notes 0.11.0-code-des-modules et
 *  0.11.0-editer-invariants-et-note) ; les fichiers que change la branche (files : repo.changed,
 *  la copie de travail comprise, triés, ids `b<i>`, deleted : absents du disque, locked : codeLock
 *  sans module ; note 0.13.0-forme-modules-ide) et le réglage de la vue Modules (modulesView,
 *  recopié) ; la lecture d'un test (readingOf), celle d'une version
 *  précédente montrée périmée (stale), jamais comptée comme lue ; le texte d'un test à la base
 *  (base, passé ; au-delà de SOURCE_MAX : null) ; les actions en file d'attente (queued, recopiées : la page
 *  montre « en attente » à côté de leur bouton, design-check comprise).
 *  Un module de la Forme a un chemin ou plusieurs (parseNote : paths) : ses fichiers sont ceux sous l'un d'eux,
 *  il est touché si l'un l'est (note 0.15.0-stabilisation, T-15) ; commencé (started) seulement si un fichier a
 *  changé depuis son squelette : un commit sans la note le touche, ou, la note commitée, un fichier sous ses chemins
 *  n'est pas commité (le commit de la note : le plus ancien de la branche qui la porte, il porte les squelettes ;
 *  ses commits sont ceux hors de lui) : begun, Générer les modules, stillOk en dépendent, pas touched (note
 *  0.15.0-skills-humain-ia) ; la note vérifiée (checked : la marque design de sa note, designChecked), Vérifier la
 *  conception masquée tant qu'elle ne l'est pas (la première part de Valider la note) ; un commit porte sa marque « commit:<hash> »
 *  (mark, absente : aucune ; T-23). Une action directe faite et dont rien n'a changé depuis ne ferait rien de
 *  plus : grisée avec sa raison (T-24 ; la passe sur F-114 : seul Revenir sur la base, une fois dessus, se
 *  décide d'après le relevé ; les autres sont déjà grisées ou masquées (Commiter, Pull, Pousser, S'assigner,
 *  Me retirer…) ou visent un argument que le relevé ne connaît pas) ; Mettre de côté, Actualiser, Pull et
 *  Rebase restent relançables.
 *  Ne connaît pas : Electron, le disque, git, gh (tout est passé ; `exists` dit si
 *  un chemin du dossier de l'agent existe ; les textes des tests, à la tête et à la base, sont lus par
 *  l'appelant).
 *  Utilisé par : app/controllers/vibecoder (refreshVibe). */
import type {
  VibeAction, VibeCheck, VibeComment, VibeFlow, VibeGit, VibeLang, VibeMarkState, VibeModule, VibeNote, VibePr,
  VibePrItem, VibeRecipe, VibeRun, VibeStepId, VibeTestFile, VibeView, VibeWorktree,
} from 'shared/bridge';
import { DIRECT_ACTIONS, DIRECT_ONLY, EFFORT_LEVELS, prNumber, SKILL_MODELS, templateVars, type ActionDef } from './actions';
import { designChecked, markState, type Marks } from './marks';
import { parseNote } from './note';
import { json, parseChecklist, parseQuestions, parseReading } from './outputs';
import { ELSEWHERE, onBase, onPr, placeReason, placeShown, type PlaceState } from './place';
import { canAssign, unassignable, type PrPeople } from './role';
import { blockedBy, codeLock, ownRun } from './runs';
import { syncReason } from './sync';
import { blobSha, caseLines, caseTitles, isInvariantTest, readingOf } from './test-files';

export type JourneyInput = {
  agentId: string;
  lang: VibeLang;
  flow: VibeFlow;
  pr: number | null;            // la PR suivie (vibeSet({ pr }), load-pr), les deux rôles
  autonomy?: 'guide' | 'vibe';  // d'avant la 0.12.0, ignorée (plus rendue) : vibe la remplace
  vibe?: boolean;               // le mode Vibe en cours (F-103) ; absent : non
  agent: { model: string; effort: string; mode: string };
  busy: boolean;                                    // la conversation de l'agent travaille
  // Les courses qui retiennent (runs : LOCKING), par id d'action, avec le module qu'elles génèrent (Run.module).
  running: { id: string; reads: boolean; module?: string | null }[];
  runs: VibeRun[];                                  // les courses à l'écran (runViews)
  queued?: string[];                                // les actions en file d'attente (queuedOf de controllers/runs), dans l'ordre ; absent : aucune
  repo: { branch: string; base: string; changed: string[]; dirty?: string[]; added?: string[]; commits: { hash: string; subject: string; files: string[] }[] } | null;
  error: string | null;                             // pourquoi le dépôt manque
  note: { path: string; text: string; before: string | null } | null;
  // Les tests de la branche ; base : leur texte à la base de la branche (null : absent à la base, ajouté ; absent :
  // inconnu, pas de base, ou au-delà de 200 Ko, aussi les fixtures des invariants protégés d'avant la 0.13.0).
  tests: { path: string; blob: string; text: string; base?: string | null }[];
  // Toutes les lectures (<sorties>/invariants/<blob>.md) ; par blob : d'avant la 0.11.0 (fixtures protégées), heure 0.
  readings: { blob: string; text: string; time: number }[] | Record<string, string>;
  outputs: Record<string, { text: string; time: number }>; // par nom connu (OUTPUTS)
  marks: Marks;
  draft: VibeComment[];
  worktree?: VibeWorktree | null;                   // Relecteur : la PR suivie dans un worktree (F-110)
  child?: boolean;                                  // l'agent est l'enfant d'un worktree (agent.parent)
  recipe?: VibeRecipe | null;                       // la recette de la famille ; en cours : les actions de worktree grisées
  // Le dossier (les deux parcours) : sa branche et s'il a des modifications (git status), pour les choix de lieu.
  checkout?: { branch: string; dirty: boolean } | null;
  request?: string | null;                          // la branche de la nouvelle demande retenue, qui attend son choix
  // Lu par gh, sans agent (technicals/github) : créateur, la PR de la branche ; l'état de la PR suivie ; les PR
  // ouvertes du dépôt (les deux rôles). Absent ou null : les sorties des skills (pr.json, pr-<n>.json).
  // Lus par gh, en fond : les personnes de la PR et l'identifiant de l'utilisateur (S'assigner la PR, Me retirer) ;
  // absents : null (les fixtures des invariants protégés d'avant la 0.13.0).
  people?: PrPeople | null;
  login?: string | null;
  github?: { pr?: Record<string, unknown> | null; prs?: { mine: unknown[]; review: unknown[]; all: unknown[] } | false | null; state?: string | null };
  // Lus par git (les deux parcours) : les branches locales ; les commits de @{u} et de origin/<base> absents de
  // HEAD. Absents : null (les fixtures des invariants protégés d'avant la 0.12.0).
  branches?: string[] | null;
  sync?: { behind: number | null; baseAhead: number | null } | null;
  actions: ActionDef[];
  direct?: Record<string, NonNullable<VibeAction['direct']>>;   // par id de DIRECT_ACTIONS : en cours, dernier résultat (F-114)
  who: Record<string, string>;                      // par id d'action : qui travaille
  model: Record<string, string | null>;             // par id d'action : le modèle que fixe son skill (skillModel)
  skills: string[];
  exists: (rel: string) => boolean;                 // un chemin, relatif au dépôt, existe sur le disque
  modulesView?: 'ide' | 'list';                     // le réglage de la vue Modules (config) ; absent : non rempli
  now: number;                                      // l'heure du relevé
};

// Le texte d'un test d'invariant, montré à l'écran à côté de sa lecture ; au-delà : '' (la vue ne le montre pas) ;
// son texte à la base, au-delà : null.
const SOURCE_MAX = 200_000;

const ORDER: VibeStepId[] = ['note', 'forme', 'invariants', 'modules', 'revue', 'pr'];

const TEXT = {
  fr: {
    plural: (n: number) => n > 1,
    mark: { ok: 'validée', ko: 'refusée', changed: 'modifiée depuis' },
    noNote: 'pas de note', filled: 'rédigée', unfilled: 'à rédiger', question: ['question', 'questions'], noteChanged: 'note modifiée depuis son commit',
    module: ['module', 'modules'], file: ['fichier', 'fichiers'], kase: ['cas', 'cas'], read: ['lu', 'lus'],
    checksOk: 'vérifications ok', checksKo: 'vérifications en échec', warning: ['avertissement', 'avertissements'], unchecked: 'pas vérifiée', ponytail: 'ponytail faite',
    fixup: ['fixup', 'fixups'], noPr: 'pas de PR', commit: ['commit', 'commits'], reviewed: 'relus',
    box: ['case', 'cases'], noPlan: 'pas de plan', remark: ['remarque', 'remarques'], published: 'publiée',
    busy: 'L\'agent travaille', directRunning: 'Une commande directe est en cours', noRepo: 'Pas de dépôt git', noNoteYet: 'Pas encore de note', nothingToRead: 'Aucun test d\'invariant à lire',
    noModule: 'Aucun module à générer', noPrChosen: 'Aucune PR choisie', loadFirst: 'Charger d\'abord la PR',
    emptyDraft: 'Le brouillon de revue est vide', noCommitMd: 'Préparer d\'abord le commit', noQuestion: 'Aucune question ouverte',
    openQuestions: 'Répondre d\'abord aux questions de la note', unvalidated: 'Valider d\'abord la note', started: 'Déjà en cours',
    noFixup: 'Aucun commit fixup!', dirty: 'Des modifications en cours', preparing: 'Une recette du projet est en cours',
    elsewhere: 'Passer d\'abord sur la branche de la PR', noUpstream: 'Pas de branche distante suivie', upToDate: 'Déjà à jour', alreadyOnBase: 'Déjà sur la base',
    checklist: ['La note est à jour', 'Les invariants passent', 'Chaque diff a été relu', 'Un commit par module, fixups repliés',
      'AGENTS.md à jour si une convention a changé'],
  },
  en: {
    plural: (n: number) => n !== 1,
    mark: { ok: 'approved', ko: 'rejected', changed: 'changed since' },
    noNote: 'no note', filled: 'written', unfilled: 'to write', question: ['question', 'questions'], noteChanged: 'note changed since its commit',
    module: ['module', 'modules'], file: ['file', 'files'], kase: ['case', 'cases'], read: ['read', 'read'],
    checksOk: 'checks pass', checksKo: 'checks fail', warning: ['warning', 'warnings'], unchecked: 'not checked', ponytail: 'ponytail done',
    fixup: ['fixup', 'fixups'], noPr: 'no PR', commit: ['commit', 'commits'], reviewed: 'reviewed',
    box: ['box', 'boxes'], noPlan: 'no plan', remark: ['remark', 'remarks'], published: 'published',
    busy: 'The agent is working', directRunning: 'A direct command is running', noRepo: 'No git repository', noNoteYet: 'No note yet', nothingToRead: 'No invariant test to read',
    noModule: 'No module to generate', noPrChosen: 'No PR chosen', loadFirst: 'Load the PR first',
    emptyDraft: 'The review draft is empty', noCommitMd: 'Prepare the commit first', noQuestion: 'No open question',
    openQuestions: 'Answer the note\'s questions first', unvalidated: 'Approve the note first', started: 'Already running',
    noFixup: 'No fixup! commit', dirty: 'Uncommitted changes', preparing: 'A project recipe is running',
    elsewhere: 'Switch to the PR branch first', noUpstream: 'No upstream branch', upToDate: 'Already up to date', alreadyOnBase: 'Already on the base',
    checklist: ['The note is up to date', 'The invariants pass', 'Every diff has been reviewed', 'One commit per module, fixups folded',
      'AGENTS.md updated if a convention changed'],
  },
};

// Pourquoi une action est grisée (sense) : la clé de son texte.
type Reason = { [K in keyof typeof TEXT.fr]: typeof TEXT.fr[K] extends string ? K : never }[keyof typeof TEXT.fr];

const FIXUP = /^(fixup|squash|amend)! /;

// Le chemin, dans le dépôt, du module `bare` de la Forme (souvent sans src/ ni
// le dossier du paquet) d'après un fichier qui est lui ou qu'il contient ;
// null si le fichier n'est pas de lui.
function within(file: string, bare: string): string | null {
  const i = `/${file}/`.indexOf(`/${bare}/`);
  return i < 0 ? null : file.slice(0, i + bare.length);
}

// Un texte d'une fiche de PR ; un auteur de gh ({ login }) donne son login.
const str = (v: unknown): string =>
  typeof v === 'string' ? v : typeof (v as { login?: unknown } | null)?.login === 'string' ? (v as { login: string }).login : '';

const toPr = (number: number, c: Record<string, unknown> | null): VibePr => ({
  number, title: str(c?.title), url: str(c?.url), author: str(c?.author), base: str(c?.base), head: str(c?.head),
  body: str(c?.body), state: ['OPEN', 'CLOSED', 'MERGED'].includes(c?.state as string) ? c!.state as VibePr['state'] : null,
});

// Une liste de gh → ses PR, celles sans numéro écartées.
const toItems = (list: unknown[]): VibePrItem[] => (list as (Record<string, unknown> | null)[]).flatMap((p) => {
  const number = prNumber(p?.number);
  return number ? [{ number, title: str(p!.title), author: str(p!.author), url: str(p!.url) }] : [];
});

// Le départ de la dernière course checks ; un checks.json dont le time (le champ du résultat, pas l'heure
// du fichier) le précède, ou sans time, est retiré des sorties : ignoré partout (I-46). Aucune course
// checks connue (appli relancée) : il compte.
function freshOutputs(outputs: JourneyInput['outputs'], runs: VibeRun[]): JourneyInput['outputs'] {
  const start = Math.max(...runs.filter((r) => r.id === 'checks').map((r) => r.since));
  const checks = outputs['checks.json'];
  if (!checks || start === -Infinity || (json(checks.text)?.time as number) >= start) return outputs;
  return Object.fromEntries(Object.entries(outputs).filter(([name]) => name !== 'checks.json'));
}

export function vibeView(input: JourneyInput): VibeView {
  const { lang, flow, repo, marks } = input;
  const outputs = freshOutputs(input.outputs, input.runs);
  const T = TEXT[lang];
  const count = (n: number, [one, many]: string[]) => `${n} ${T.plural(n) ? many : one}`;
  const line = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' · ');
  const vibe = !!input.vibe;
  const n = input.pr;
  const out = (name: string) => outputs[name]?.text ?? null;
  const commits = repo?.commits ?? [];
  const changed = repo?.changed ?? [];
  const dirty = repo?.dirty ?? [];   // pas commités : hors de tout commit, ou retouchés depuis
  // L'état git d'un fichier, comme VS Code : nouveau (pas suivi, ajouté) ou modifié, pas commité ; rien : commité.
  const gitOf = (path: string): { git?: VibeGit } => (!dirty.includes(path) ? {} : { git: repo?.added?.includes(path) ? 'new' : 'modified' });

  // La note, ses validations, les modules de sa Forme.
  const facts = input.note && parseNote(input.note.text);
  const note: VibeNote | null = input.note && facts && {
    id: 'n', path: input.note.path, text: input.note.text, before: input.note.before, filled: facts.filled, mustNot: facts.mustNot,
    mark: markState(marks, 'note', blobSha(input.note.text)), formeMark: markState(marks, 'forme', blobSha(facts.forme)),
    nothingMark: markState(marks, 'nothing', blobSha(input.note.text)), checked: designChecked(marks, input.note.path), locked: codeLock(null, input.busy, input.running, lang),
  };
  // Le commit de la note : le plus ancien de la branche qui la porte (les commits vont du plus ancien au plus récent) ;
  // il porte aussi les squelettes des modules, qui ne sont pas un module fait.
  const noteCommit = note && commits.find((c) => c.files.includes(note.path));
  const modules: VibeModule[] = (facts?.modules ?? []).map((m, i) => {
    const bares = m.paths.map((p) => p.replace(/\/+$/, ''));   // un module a un chemin ou plusieurs (T-15)
    const per = bares.map((b) => changed.flatMap((f) => within(f, b) ?? []));   // les fichiers changés sous chaque chemin
    const hits = per.flat();
    const on = commits.filter((c) => c.files.some((f) => bares.some((b) => within(f, b) !== null)));
    const by = on.filter((c) => c !== noteCommit);   // ceux du module : hors du commit de la note
    // ponytail: un chemin jamais touché n'est cherché qu'à la racine et sous src/ (la Forme omet souvent src/).
    const roots = bares.map((b, k) => [...new Set([...per[k], b, `src/${b}`])].find((p) => input.exists(p)));
    const real = roots.find(Boolean);
    const uncommitted = hits.some((f) => dirty.includes(f));
    // Touché : la branche change un fichier sous ses chemins (le squelette compris) ; commencé : un commit sans la note
    // en touche un, ou, la note commitée, un fichier n'est pas commité (un squelette commité n'est pas un module fait).
    const touched = hits.length > 0 || on.length > 0;
    const started = by.length > 0 || (!!noteCommit && uncommitted);
    // Les fichiers que la branche change sous l'un de ses chemins (changed : la copie de travail comprise), dans son dossier
    // seulement (roots) ; sans dossier (supprimé), sous tout chemin qui le contient ; absent : supprimé.
    const files = !touched ? [] : changed.filter((f) => bares.some((b, k) => (roots[k] ? within(f, b) === roots[k] : within(f, b) !== null))).sort()
      .map((path, j) => (input.exists(path) ? { id: `m${i}/${j}`, path, ...gitOf(path) } : { id: `m${i}/${j}`, path, deleted: true }));
    return {
      path: m.path, paths: m.paths, contract: m.contract, file: real ? { id: `m${i}`, path: real } : null,
      touched, started, commits: by.map((c) => c.hash), files, locked: codeLock(m.path, input.busy, input.running, lang), uncommitted,
    };
  });
  const unstarted = modules.some((m) => !m.started);
  const invLines = !!facts?.mustNot.some((l) => l.mark === 'invariant');

  // Les tests de la branche (ceux qui ont des cas) : invariants et variants.
  const tests = input.tests.map((t) => ({ ...t, cases: caseTitles(t.text), lines: caseLines(t.text) })).filter((t) => t.cases.length);
  const readings = Array.isArray(input.readings) ? input.readings : Object.entries(input.readings).map(([blob, text]) => ({ blob, text, time: 0 }));
  const invariants: VibeTestFile[] = tests.filter((t) => isInvariantTest(t.path)).map((t, i) => {
    const r = readingOf(t, readings);
    return {
      id: `t${i}`, path: t.path, blob: t.blob, cases: t.cases, lines: t.lines, source: t.text.length > SOURCE_MAX ? '' : t.text,
      base: t.base != null && t.base.length > SOURCE_MAX ? undefined : t.base,
      reading: r && parseReading(r.text), stale: !!r?.stale, locked: codeLock(null, input.busy, input.running, lang),
      marks: Object.fromEntries(t.cases.map((c) => [c, markState(marks, `case:${t.path}:${c}`, t.blob)])),
    };
  });
  const variants = tests.filter((t) => !isInvariantTest(t.path)).map((t, i) => ({ id: `v${i}`, path: t.path, cases: t.cases.length }));
  const isRead = (f: VibeTestFile) => f.reading !== null && !f.stale;   // une lecture périmée n'est pas lue
  // Une fois un module commencé, le parcours ne recule plus (note 0.15.0-stabilisation) : une validation faite puis
  // dépassée par une retouche (« changed », la note, sa Forme, un cas) compte encore ; l'écran la dit changée.
  const begun = modules.some((m) => m.started);
  const stillOk = (s: VibeMarkState) => s === 'ok' || (begun && s === 'changed');
  const casesOk = invariants.every((f) => f.cases.every((c) => stillOk(f.marks[c])));
  // Les tests de l'étape Invariants : ceux qu'un commit porte avec la note (le premier, ses fixups repliés).
  const stepTests = invariants.filter((f) => !!note && commits.some((c) => c.files.includes(note.path) && c.files.includes(f.path)));
  const caseCount = invariants.reduce((s, f) => s + f.cases.length, 0);
  const readCount = invariants.reduce((s, f) => s + (isRead(f) ? f.cases.length : 0), 0);

  // Les sorties des skills.
  const questions = parseQuestions(out('questions.md') ?? '');
  // mark : la marque « commit:<hash> » (T-23), absente quand il n'y en a pas.
  const viewCommits = commits.map((c) => {
    const mark = markState(marks, `commit:${c.hash}`, c.hash);
    return { hash: c.hash, subject: c.subject, fixup: FIXUP.test(c.subject), files: c.files, ...(mark && { mark }) };
  });
  const fixups = viewCommits.filter((c) => c.fixup).length;
  const checkItems = json(out('checks.json'))?.items;
  const checks = Array.isArray(checkItems) ? checkItems as { name?: unknown; ok?: unknown; level?: unknown }[] : null;
  // Un contrôle passe s'il est « ok » ou n'a que des avertissements (level) ; sans level (ancien format) : ok === true.
  const passes = (c: { ok?: unknown; level?: unknown } | null) =>
    c?.level === 'ok' || c?.level === 'warning' ? true : c?.level === 'error' ? false : c?.ok === true;
  const checksOk = !!checks?.length && checks.every(passes);
  const warnings = checks?.filter((c) => c?.level === 'warning').length ?? 0;
  const ponytail = out('ponytail.md') !== null;
  const commitMd = out('commit.md') !== null;
  // La PR suivie (les deux rôles) et sa fiche, chargée : son état d'après gh s'il a répondu ; elle ouvre
  // ses choix de lieu. Créateur : la PR de la branche (gh, sinon pr.json) ; relecteur : la PR suivie.
  const gh = input.github ?? {};
  const fiche = json(n ? out(`pr-${n}.json`) : null);
  const followed = fiche && gh.state ? { ...fiche, state: gh.state } : fiche;
  const card = flow === 'create' ? gh.pr ?? json(out('pr.json')) : followed;
  const number = flow === 'review' ? n : prNumber(card?.number);
  const pr = number ? toPr(number, card) : null;
  const loaded = n && followed ? toPr(n, followed) : null;
  const branch = input.checkout?.branch ?? null;
  const place: PlaceState = {
    head: loaded?.head ?? null, branch, onBase: onBase(branch, repo?.base ?? null), dirty: !!input.checkout?.dirty,
    child: !!input.child, robot: !!input.worktree?.temp, prWorktree: !!input.worktree, recipe: !!input.recipe?.running,
  };
  const here = !!loaded && onPr(place);   // relecteur : le dossier sur la tête de la PR suivie (ou son robot)
  const prs = gh.prs ? { mine: toItems(gh.prs.mine), review: toItems(gh.prs.review), all: toItems(gh.prs.all) } : gh.prs === false ? false : null;
  // Pull, Rebase, Pousser : Pousser après un rebase réussi, tant qu'aucun push n'a réussi depuis.
  const rebased = input.direct?.rebase?.last, pushed = input.direct?.push?.last;
  const sync = { behind: input.sync?.behind ?? null, rebased: !!rebased?.ok && !(pushed?.ok && pushed.time >= rebased.time) };
  // Le plan à l'écran (ecran.md, les deux rôles) : chaque case validée (pour ce plan-là), ou cochée dans le
  // fichier et pas refusée. Créateur : la liste du § A.3, cochée d'après le dépôt quand c'est possible ; sinon à la
  // main (manual) : cochée si la case `a3:<rang>` est validée pour le commit de tête de la branche (un commit de
  // plus la décoche). Relecteur : pas de liste A.3.
  const plan = out('ecran.md');
  const screen: VibeCheck[] = parseChecklist(plan ?? '').map((c, i) => {
    const m = markState(marks, `check:${i}`, blobSha(plan!));
    return { text: c.text, done: m === 'ok' || (!!c.done && m !== 'ko') };
  });
  const boxes = screen.filter((c) => c.done).length;
  const head = commits.at(-1)?.hash;
  const a3 = [
    !!note && commits.some((c) => c.files.includes(note.path)),
    // Tous les invariants passent, quel que soit le nom que leur donne le projet (« invariants (backend) »…).
    !!checks?.some((c) => /invariant/i.test(String(c?.name))) && checks!.filter((c) => /invariant/i.test(String(c?.name))).every(passes),
    null,
    // Aucun fixup! à replier, et chaque module de la Forme a son commit (un commit peut en porter plusieurs).
    !fixups && modules.length > 0 && modules.every((m) => m.commits.length > 0),
    null,
  ];
  const checklist: VibeCheck[] = flow === 'review' ? []
    : T.checklist.map((text, i) => (a3[i] !== null ? { text, done: a3[i] }
      : { text, done: (!!head && markState(marks, `a3:${i}`, head) === 'ok') || null, manual: true }));

  // Les étapes : faite, et l'action qui la fait avancer quand elle est en cours.
  const validated = (s: VibeMarkState) => vibe || stillOk(s);
  const judged = (s: VibeMarkState) => s === 'ok' || s === 'ko';
  const noteFacts = note ? line(note.filled ? T.filled : T.unfilled, questions.length > 0 && count(questions.length, T.question),
    note.mark && T.mark[note.mark]) : T.noNote;
  const invFacts = line(count(invariants.length, T.file), count(caseCount, T.kase), count(readCount, T.read));
  let done: Partial<Record<VibeStepId, boolean>>;
  let next: Partial<Record<VibeStepId, string | null>>;
  let stepFacts: Partial<Record<VibeStepId, string>>;
  if (flow === 'create') {
    const noteDone = !!note?.filled && !questions.length && validated(note.mark);
    const formeDone = !!note && modules.length > 0 && validated(note.formeMark);
    // La note (sa Forme comprise) commitée puis modifiée : la Forme n'est faite qu'une fois ce changement commité
    // (Préparer le commit : un fixup de son commit, un nouveau commit une fois la PR ouverte), note et Forme revalidées.
    // Une fois un module commencé, le parcours ne recule plus : une retouche de la note ou d'un test d'invariant fait
    // partie du travail en cours, que Commiter les modules range (note 0.15.0-stabilisation) ; les faits le disent.
    const noteChanged = !!note && dirty.includes(note.path) && commits.some((c) => c.files.includes(note.path));
    const reopens = noteChanged && !begun;
    // la retouche : la note ou un test d'invariant de la branche, modifiés ; en attente une fois les modules commencés
    const retouched = !!note && dirty.some((f) => f === note.path || invariants.some((t) => t.path === f));
    const pending = begun && retouched;
    done = {
      note: noteDone,
      forme: formeDone && !reopens,
      // Seulement si la Note et la Forme le sont (note 0.12.0-vibe-sans-rc-diff-en-fond), puis : sans ligne « → invariant »,
      // rien à écrire ni à commiter. Avec, sans test de la branche (déjà observée par un test existant) : la
      // dernière course Écrire les invariants ou Vérifier l'alignement finie, ou ✓ Rien à écrire. Avec des
      // tests : chaque cas validé, lu ou pas, et le premier commit (note, forme, invariants) fait.
      // Une fois un module commencé, seuls comptent les tests écrits pour l'étape (portés par le commit de la note) :
      // un test protégé retouché ensuite par un module (un harnais) est du travail des modules, pas à revalider.
      invariants: noteDone && formeDone && (!invLines || (begun
        ? vibe || stepTests.every((f) => f.cases.every((c) => stillOk(f.marks[c])))
        : !invariants.length
          ? input.runs.find((r) => r.id === 'invariants' || r.id === 'align')?.state === 'done' || note.nothingMark === 'ok'
          : (vibe || casesOk) && !retouched)),
      modules: modules.length > 0 && modules.every((m) => m.commits.length > 0) && !modules.some((m) => m.uncommitted) && !pending,
      revue: checksOk && ponytail && !fixups && boxes === screen.length,   // le plan à l'écran, s'il y en a un
      pr: !!pr,
    };
    next = {
      note: !note?.filled ? 'note' : questions.length ? 'answers' : null,
      forme: !modules.length ? 'forme' : reopens && noteDone && formeDone ? (commitMd ? 'commit' : 'commit-prepare') : null,
      // Hors Vibe : les cas attendent leurs ✓, lus ou pas ; Vibe : sans lecture (Écrire les invariants vérifie l'alignement).
      invariants: !invariants.length ? 'invariants' : !vibe && !casesOk ? null
        : commitMd ? 'commit' : dirty.length ? 'commit-prepare' : null,
      // Générer les modules tant qu'il en reste un pas commencé (un à un sur sa ligne, au choix), puis Commiter les modules.
      modules: commitMd ? 'commit' : unstarted ? 'modules' : modules.some((m) => m.uncommitted) ? 'commit-modules' : pending ? 'commit-prepare' : null,
      // Lancer les vérifications demande aussi la ponytail review (F-115) : elle n'a plus son bouton.
      revue: !checksOk || !ponytail ? 'checks' : fixups ? 'fixups' : null,
      pr: 'pr',
    };
    stepFacts = {
      note: noteFacts,
      forme: note ? line(count(modules.length, T.module), note.formeMark && T.mark[note.formeMark], noteChanged && T.noteChanged) : T.noNote,
      invariants: invFacts,
      modules: `${modules.filter((m) => m.commits.length).length} / ${count(modules.length, T.module)}`,
      revue: line(!checks ? T.unchecked : checksOk ? T.checksOk : T.checksKo, warnings > 0 && count(warnings, T.warning),
        ponytail && T.ponytail, fixups > 0 && count(fixups, T.fixup), screen.length > 0 && `${boxes} / ${count(screen.length, T.box)}`),
      pr: pr ? `PR #${pr.number}` : T.noPr,
    };
  } else {
    const noteDone = here && (!note || judged(note.mark));
    done = {
      note: noteDone,
      forme: noteDone,   // rien à juger : avec la Note
      invariants: here && invariants.every((f) => f.cases.every((c) => judged(f.marks[c]))),
      modules: !!n && out(`pr-${n}-commits.md`) !== null,
      revue: screen.length > 0 && boxes === screen.length,
      pr: !!n && out(`pr-${n}-review.json`) !== null,
    };
    next = {
      note: note && n && out(`pr-${n}-note.md`) === null ? 'review-note' : null,
      forme: null,
      invariants: null,   // les cas attendent leur verdict, lus ou pas
      modules: 'review-commits',
      revue: n && plan === null ? 'screen' : null,
      pr: 'publish',
    };
    stepFacts = {
      note: noteFacts,
      forme: note ? count(modules.length, T.module) : T.noNote,
      invariants: invFacts,
      modules: line(count(commits.length, T.commit), done.modules && T.reviewed),
      revue: plan === null ? T.noPlan : `${boxes} / ${count(screen.length, T.box)}`,
      pr: line(count(input.draft.length, T.remark), done.pr && T.published),
    };
  }
  const current = ORDER.find((s) => !done[s]) ?? null;
  const primary = current && next[current];

  // Une action directe en cours (F-114) : les autres attendent, comme quand l'agent travaille ; et elle
  // retient les courses comme l'une d'elles (elle lit, publish, load-pr, ou modifie, commit, base) ; pas un
  // nouveau worktree (ELSEWHERE), qui travaille dans un autre dossier.
  const running = Object.values(input.direct ?? {}).some((x) => x.running);
  const locks = [...input.running, ...Object.entries(input.direct ?? {}).filter(([id, x]) => x.running && !ELSEWHERE.includes(id))
    .map(([id]) => ({ id, reads: !!input.actions.find((a) => a.id === id)?.reads }))];
  // Pourquoi une action est grisée : une course la retient (celle d'une étape) ou la conversation travaille
  // (les autres), une commande directe est en cours (held) ; une variable de son gabarit manque, elle ne
  // sert pas ici (sense).
  const held = (d: ActionDef): string | null =>
    (ownRun(d) ? blockedBy(d, locks, lang) : input.busy && !ELSEWHERE.includes(d.id) ? T.busy : null)
    ?? (DIRECT_ACTIONS.includes(d.id) && running ? T.directRunning : null);
  const sense = (d: ActionDef): Reason | null => {
    const v = new Set(templateVars(d.text));
    if ((v.has('branch') || v.has('base')) && !repo) return 'noRepo';
    // La Forme et les invariants s'écrivent d'après la note.
    if (!note && (v.has('note') || (flow === 'create' && (d.step === 'forme' || d.step === 'invariants')))) return 'noNoteYet';
    // Vibe : la note rédigée, ses questions répondues et validée par l'utilisateur (Vibe ne la valide pas) ;
    // rien pendant Vibe, un tour ou une course qui retient.
    if (flow === 'create' && d.id === 'vibe') {
      if (!note?.filled) return 'noNoteYet';
      if (questions.length) return 'openQuestions';
      if (!stillOk(note.mark)) return 'unvalidated';
      if (vibe || input.busy || input.running.length) return 'started';
    }
    if (v.has('files') && !invariants.length) return 'nothingToRead';   // tout lu : on peut relire (args.file)
    // Relecteur : les étapes qui lisent la PR attendent qu'elle soit chargée (charger la PR, ses choix de lieu : la
    // vue des branches, sans étape, prennent son numéro de la page).
    if (flow === 'review' && !loaded && d.step !== null && (v.has('pr') || v.has('ref'))) return pr ? 'loadFirst' : 'noPrChosen';
    // Chargée, le dossier ailleurs que sur sa tête : les étapes lisent la copie de travail.
    if (flow === 'review' && loaded && !here && d.step !== null) return 'elsewhere';
    if (v.has('draft') && !input.draft.length) return 'emptyDraft';
    if (d.id === 'commit' && !commitMd) return 'noCommitMd';
    if (d.id === 'answers' && !questions.length) return 'noQuestion';
    if (d.id === 'fixups' && !fixups) return 'noFixup';
    if (d.id === 'remove-worktree' && place.recipe) return 'preparing';
    // Faite et inchangée (T-24) : un second clic ne ferait rien de plus. Revenir sur la base, une fois dessus.
    if (d.id === 'base' && input.direct?.base?.last?.ok && place.onBase) return 'alreadyOnBase';
    return placeReason(d.id, place) ?? syncReason(d.id, sync);
  };
  // Pas encore de sens : masquée (sa raison reste), sauf noNoteYet : grisée, sa raison au survol. L'étape PR (créateur) d'après l'état de la PR, sans griser :
  // une demande juste après pr ne doit pas tomber sur un relevé en retard.
  const notYet = new Set<Reason>(['nothingToRead', 'noCommitMd', 'noQuestion', 'noFixup',
    'openQuestions', 'unvalidated', 'started']);
  // ponytail: une PR sans état connu (pr.json, avant que gh réponde) compte comme ouverte.
  const prState = pr && (pr.state ?? 'OPEN');
  const child = !!input.child;
  const prShown: Record<string, boolean> = {
    pr: !prState, ci: prState === 'OPEN', base: prState === 'MERGED' && !child,
  };
  // Les choix de lieu (core/vibecoder place), Pousser (après un rebase pas encore poussé), sans griser ; Rebase hors
  // de la base ; Nouvelle demande sur la base seulement. Retirer le worktree : sur un enfant, sa PR fusionnée (Créer) ou sur le robot d'une PR (relecteur).
  // Préparer le commit, seulement s'il y a quelque chose à commiter ; Générer les modules, seulement s'il en reste un
  // pas commencé.
  const shown: Record<string, boolean> = {
    ...placeShown(place),
    rebase: !place.onBase && flow === 'create',   // le relecteur n'édite ni ne pousse : rien à rebaser, à pousser, à copier
    'load-pr': !place.child,   // un worktree reste sur sa branche (place : BRANCH_CHANGES)
    push: sync.rebased && flow === 'create',
    'copy-artifact': flow === 'create',
    'assign-pr': flow === 'review' && canAssign(input.people ?? null, input.login ?? null),
    'unassign-pr': flow === 'create' && unassignable(input.people ?? null, input.login ?? null),
    'new-request': place.onBase,
    'remove-worktree': child && (flow === 'create' ? prState === 'MERGED' : place.robot),
    'commit-prepare': dirty.length > 0,
    modules: unstarted,
    'design-check': !!note?.checked,   // la première vérification est la part de Valider la note
  };
  // Écrire les invariants, sans ligne « → invariant » dans la note : masquée sans griser, elle aussi (un clic
  // reste possible si le relevé retarde sur une ligne ajoutée ; runs.test.ts, invariant, le clique ainsi).
  const hidden = (d: ActionDef, reason: Reason | null) =>
    (flow === 'create' && ((Object.hasOwn(prShown, d.id) && !prShown[d.id]) || (d.id === 'invariants' && !!note && !invLines)))
    || (Object.hasOwn(shown, d.id) && !shown[d.id])
    || (reason !== null && notYet.has(reason));
  const actions: VibeAction[] = input.actions
    .filter((d) => (d.flow === 'both' || d.flow === flow) && (d.id !== 'guide' || input.skills.includes('gear-guide')))
    .map((d) => {
      const reason = d.kind === 'prefill' ? null : sense(d);
      return {
        id: d.id, step: d.step, label: d.label, hint: d.hint, who: input.who[d.id] ?? 'agent',
        model: input.model[d.id] ?? null, models: input.model[d.id] ? SKILL_MODELS : [], efforts: input.model[d.id] ? EFFORT_LEVELS : [], kind: d.kind, needs: d.needs,
        usesText: templateVars(d.text).includes('text'),
        ...(d.kind === 'prefill' ? { text: d.text } : {}),
        primary: d.id === primary, disabled: d.kind === 'prefill' ? null : held(d) ?? (reason && T[reason]), hidden: hidden(d, reason),
        ...(DIRECT_ACTIONS.includes(d.id) ? {
          direct: { ...input.direct?.[d.id] ?? { running: false, last: null }, ...(DIRECT_ONLY.includes(d.id) ? { only: true as const } : {}), ...(ELSEWHERE.includes(d.id) ? { elsewhere: true as const } : {}) },
        } : {}),
      };
    });

  return {
    agentId: input.agentId, lang, flow, vibe: input.vibe, agent: input.agent,
    repo: repo && { branch: repo.branch, base: repo.base, changed: changed.length },
    error: input.error,
    steps: ORDER.map((id) => ({ id, status: done[id] ? 'done' : id === current ? 'current' : 'todo', facts: stepFacts[id] ?? '' })),
    files: [...changed].sort().map((path, i) => ({
      id: `b${i}`, path, ...(input.exists(path) ? gitOf(path) : { deleted: true }), locked: codeLock(null, input.busy, input.running, lang),
    })),
    modulesView: input.modulesView,
    note, questions, modules, invariants, variants, commits: viewCommits, outputs, checklist, screen, actions,
    skills: input.skills, pr, prs, loaded, child, branches: input.branches ?? null,
    sync: input.sync ?? null, draft: input.draft, worktree: input.worktree ?? null, runs: input.runs,
    queued: input.queued ?? [], request: input.request ? { branch: input.request } : null, time: input.now,
  };
}
