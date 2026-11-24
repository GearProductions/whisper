/** journey — le parcours de l'écran VibeCoder, calculé sans modèle à partir du
 *  relevé (dépôt, note, tests, sorties des skills, validations) : un seul parcours
 *  (Note, Forme, Invariants, Modules, Revue, PR) pour les deux rôles (view.flow : créateur
 *  'create', relecteur 'review', décidé par l'appli, passé en entrée). Les étapes (faite,
 *  en cours — la première pas faite — , à venir ; toutes s'ouvrent, la page ne reçoit plus
 *  d'`open`), leurs faits en une ligne (facts : tous, l'infobulle du fil d'Ariane ; head : ceux que
 *  l'étape ne montre pas en dessous, son en-tête, sans doublon ; note 0.15.0-ecran-epure), la prochaine action (celle de l'étape en cours), les
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
 *  Le mode Vibe en cours ou pas (vibe : le moteur est en route, aucune validation tenue pour donnée
 *  depuis la 0.16.0 ; note 0.12.0-mode-vibe), les choix de lieu (charger la PR suivie, aller sur une branche, en créer
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
 *  ligne « → invariant » (Écrire les invariants masquée sans griser), sinon chaque cas jugé
 *  (relecteur), lu ou pas ; en créateur : le contrôle en trois points, plus bas ; sans test d'invariant de la branche
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
 *  recopié) ; la lecture d'un test (caseReading), celle d'une version
 *  précédente périmée pour les seuls cas dont le bloc a changé depuis (staleCases ; stale : un au moins), un cas
 *  périmé jamais compté comme lu ; les validations des cas par leur clé (caseKeys), d'après leur bloc et le code
 *  commun (caseMarkState de case-marks ; 'common' rendu 'changed', sa clé dans commonChanged ; hashes : caseBlocks)
 *  (note 0.15.0-invariants-par-cas) ; le texte d'un test à la base
 *  (base, passé ; au-delà de SOURCE_MAX : null) ; les actions en file d'attente (queued, recopiées : la page
 *  montre « en attente » à côté de leur bouton, design-check comprise).
 *  Un module de la Forme a un chemin ou plusieurs (parseNote : paths) : ses fichiers sont ceux sous l'un d'eux,
 *  il est touché si l'un l'est (note 0.15.0-stabilisation, T-15) ; commencé (started) seulement si un fichier a
 *  changé depuis son squelette : un commit sans la note le touche, ou, la note commitée, un fichier sous ses chemins
 *  n'est pas commité (le commit de la note : le plus ancien de la branche qui la porte, il porte les squelettes ;
 *  ses commits sont ceux hors de lui ; la note ignorée par git, note.ignored : le plus ancien de la branche, et la
 *  note n'est jamais attendue dans un commit — ni noteChanged, ni la case « note commitée » d'après elle, qui suit
 *  ce premier commit ; note 0.16.0-notes-hors-projet) : begun, Générer les modules, stillOk en dépendent, pas touched (note
 *  0.15.0-skills-humain-ia) ; la note vérifiée (verified :
 *  ce qu'a rendu sa dernière vérification, designState de marks, créateur seul), Vérifier la
 *  conception proposée dès que la note est rédigée (le contrôle en trois points, plus bas) ; un commit porte sa marque « commit:<hash> »
 *  (mark, absente : aucune ; T-23). Une action directe faite et dont rien n'a changé depuis ne ferait rien de
 *  plus : grisée avec sa raison (T-24 ; la passe sur F-114 : seul Revenir sur la base, une fois dessus, se
 *  décide d'après le relevé ; les autres sont déjà grisées ou masquées (Commiter, Pull, Pousser, S'assigner,
 *  Me retirer…) ou visent un argument que le relevé ne connaît pas) ; Mettre de côté, Actualiser, Pull et
 *  Rebase restent relançables.
 *  Les validations d'étape (note 0.15.0-ecran-statuts) : step.check de la note, la Forme, les invariants et les
 *  modules (stepContents et stepChecks de step-checks, d'après marks et blobs ; le créateur seul) ; leur en-tête et
 *  leurs faits : « modifiée depuis la validation » (changed), « à revoir : la note a changé » (cascade, la première
 *  étape décochée) ; done et next n'en dépendent pas ; la marque de la note est celle de sa conception (noteDesign :
 *  la Forme seule changée ne la change pas) ; Commiter les modules grisé (« modules pas validés ») tant que les
 *  modules ne sont pas cochés, aussi pendant Vibe. Le menu de diff de la vue IDE : diffs (diffFiles de validated ;
 *  créateur seul, avec les blobs) — head, les fichiers relevés qui diffèrent du dernier commit ; validated, par étape
 *  dont la liste retenue est lue (validated), ceux de sa vue (les tests, ou les fichiers des modules) qui diffèrent
 *  d'elle ; un supprimé sans autre id dans la vue (m, b, t) : r<i>, d'un bout à l'autre de diffs.
 *  Retirés : validation (fileReview), step.stale, since et « périmée ».
 *  Les mêmes règles pour les deux historiques d'un projet (note 0.16.0-flow-allege) : un commit par module et ses
 *  fixups repliés, ou un seul commit pour le code de tous les modules et des corrections en commits ordinaires —
 *  l'étape Modules, l'étape Revue et la case « Chaque module commité, aucun fixup à replier » de l'étape PR.
 *  Le contrôle en trois points (note 0.16.0-controle-en-trois-points), en créateur :
 *  - la note n'est faite que par le ✓ de l'utilisateur, jamais tenue pour validée (Vibe en cours compris) ; la Forme, les
 *    invariants et les modules ne l'attendent plus pour être faits : la Forme, dès qu'elle a des modules ; les
 *    invariants, alignés (align.md sans rubrique [toi], toiCount) ou chaque cas validé à la main, et le premier commit
 *    fait ; sans ligne « → invariant » : comme avant ;
 *  - la preuve (proof : proofOf de outputs, preuve.md et les lignes « → invariant » de la note) : l'étape Modules n'est
 *    pas faite tant qu'elle n'est ni 'ok' ni 'none', quel que soit le rythme ; Prouver les invariants (prove) est sa
 *    prochaine action une fois chaque module commencé, avant Commiter les modules ; masquée sans ligne
 *    « → invariant » (ses faits le disent : « rien à prouver ») ; une preuve passée le reste quand le code change
 *    ensuite (un module corrigé, un commit de plus) : Prouver les invariants n'est pas reproposée ;
 *  - check.by de chaque étape validée : 'system' d'après sa marque ;
 *  - la pause (pause) : 'note', un commit porte la note (ou, ignorée par git, la branche a un commit) et elle n'a pas
 *    son ✓ ; sinon 'withdrawn:<étape>', la première étape (la Forme, les invariants, les modules, dans cet ordre) dont
 *    le ✓ a été retiré à la main et dont le retrait tient (withdrawn de marks : l'empreinte retenue est celle du
 *    contenu d'aujourd'hui de l'étape, stepContents) — le contenu changé, ou l'étape revalidée à la main (le retrait
 *    oublié) : plus cette pause ; sinon 'invariants', l'étape Invariants faite, le premier commit fait, aucun module
 *    commencé ; 'modules', l'étape Modules faite, la Revue pas commencée (ni vérifications ni ponytail review) ; sinon
 *    null ; le relecteur : toujours null ; express (recopié de l'entrée) n'y change rien, c'est holdsPause de vibe-mode
 *    qui tranche ; done et next ne dépendent pas du retrait (l'étape reste faite, ses actions à la main restent) ;
 *  - Vibe (le moteur, repris à une pause) : la prochaine action d'une pause 'invariants' ou 'modules' ; masquée à une
 *    pause 'withdrawn:<étape>' (refused : « étape refusée », comme unvalidated pour la note sans son ✓), elle revient
 *    quand la pause est levée : Reprendre n'est proposé ni à l'écran ni par la CLI tant que le retrait tient ; Vérifier la
 *    conception (design-check : Vérifier, un geste à part de Valider la note) proposée en créateur dès que la note est
 *    rédigée, vérifiée ou non, validée ou non, et relançable à volonté ; masquée sans note rédigée ; note.verified dit à
 *    l'écran si Valider la note se montre ('clean', 'edited') ; Relire le diff, Lire en pseudo-code : jamais prochaine
 *    action ;
 *  - la liste « Avant la PR » : « Chaque diff a été relu » cochée par le relevé (les modules validés et la ponytail
 *    review faite), plus à la main ; « AGENTS.md à jour… » reste à la main.
 *  Le relecteur : rien ne change (ses étapes, ses actions, ses faits).
 *  L'écran de l'essentiel (note 0.16.0-ecran-essentiel), en créateur :
 *  - Lire en pseudo-code (read-invariants) devient une action du moteur : la prochaine action de l'étape Invariants
 *    tant qu'un cas d'un test d'invariant de la branche n'est pas lu ou que sa lecture est périmée (après Écrire les
 *    invariants, avant le premier commit ; sans ligne « → invariant » : rien à lire) ; la pause 'invariants' attend cette
 *    lecture, le premier commit fait aussi (l'utilisateur y regarde ses règles en pseudo-code) ; done n'en dépend pas ;
 *  - check.withdrawn de chaque étape (la Forme, les invariants, les modules) dont le ✓ retiré à la main tient (withdrawn
 *    de marks, pour son contenu d'aujourd'hui) : toutes, pas seulement la première, que nomme la pause ;
 *  - l'état de la preuve quitte les faits de l'étape Modules pour ceux de l'étape Invariants (il ne se dit qu'à un
 *    endroit) ; « modifiée depuis la validation » et « à revoir » restent seuls dans leur en-tête ;
 *  - rien n'est retiré du relevé : les actions, checklist et modulesView (recopié, plus lu par la page) restent.
 *  Ne connaît pas : Electron, le disque, git, gh, si la pause est tenue (holdsPause de vibe-mode : journey dit où le
 *  parcours se tient, le contrôleur décide) (tout est passé ; `exists` dit si
 *  un chemin du dossier de l'agent existe ; les textes des tests, à la tête et à la base, sont lus par
 *  l'appelant) ; l'historique que choisit le projet (AGENTS.md : lu par les skills de commit, jamais ici).
 *  Utilisé par : app/controllers/vibecoder (refreshVibe). */
import type {
  VibeAction, VibeCheck, VibeComment, VibeFlow, VibeGit, VibeLang, VibeMarkState, VibeModule, VibeNote, VibePause, VibePr,
  VibeDiffFile, VibeDiffs, VibeDiffStep, VibePrItem, VibeRecipe, VibeRun, VibeStepCheck, VibeStepId, VibeTestFile, VibeView, VibeWorktree,
} from 'shared/bridge';
import { DIRECT_ACTIONS, DIRECT_ONLY, EFFORT_LEVELS, prNumber, SKILL_MODELS, templateVars, type ActionDef } from './actions';
import { caseMarkState, caseTarget } from './case-marks';
import { designState, markState, withdrawn, type Marks } from './marks';
import { hasInvariantLines, noteDesign, parseNote } from './note';
import { json, parseChecklist, parseQuestions, parseReading, proofOf, toiCount } from './outputs';
import { ELSEWHERE, onBase, onPr, placeReason, placeShown, type PlaceState } from './place';
import { canAssign, unassignable, type PrPeople } from './role';
import { blockedBy, codeLock, ownRun } from './runs';
import { stepChecks, stepContents, type CheckedStep } from './step-checks';
import { syncReason } from './sync';
import { blobSha, caseBlocks, caseLines, caseReading, caseTitles, isInvariantTest, type ReadingRecord } from './test-files';
import { diffFiles, type FileBlobs, type StepFiles } from './validated';

export type JourneyInput = {
  agentId: string;
  lang: VibeLang;
  flow: VibeFlow;
  pr: number | null;            // la PR suivie (vibeSet({ pr }), load-pr), les deux rôles
  autonomy?: 'guide' | 'vibe';  // d'avant la 0.12.0, ignorée (plus rendue) : vibe la remplace
  vibe?: boolean;               // le mode Vibe en cours (F-103) ; absent : non
  express?: boolean;            // le rythme express (aucune pause) ; absent : le rythme par défaut
  agent: { model: string; effort: string; mode: string };
  busy: boolean;                                    // la conversation de l'agent travaille
  // Les courses qui retiennent (runs : LOCKING), par id d'action, avec le module qu'elles génèrent (Run.module).
  running: { id: string; reads: boolean; module?: string | null }[];
  runs: VibeRun[];                                  // les courses à l'écran (runViews)
  queued?: string[];                                // les actions en file d'attente (queuedOf de controllers/runs), dans l'ordre ; absent : aucune
  repo: { branch: string; base: string; changed: string[]; dirty?: string[]; added?: string[]; commits: { hash: string; subject: string; files: string[] }[] } | null;
  error: string | null;                             // pourquoi le dépôt manque
  // ignored : la note est ignorée par git (hors du projet, jamais commitée) ; absent : non.
  note: { path: string; text: string; before: string | null; ignored?: boolean } | null;
  // Les tests de la branche ; base : leur texte à la base de la branche (null : absent à la base, ajouté ; absent :
  // inconnu, pas de base, ou au-delà de 200 Ko, aussi les fixtures des invariants protégés d'avant la 0.13.0).
  tests: { path: string; blob: string; text: string; base?: string | null }[];
  // Toutes les lectures (<sorties>/invariants/<blob>.md) ; par blob : d'avant la 0.11.0 (fixtures protégées), heure 0.
  readings: ReadingRecord[] | Record<string, string>;
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
  // Les fichiers des étapes (ceux des modules, les tests, et ceux des listes retenues) : l'empreinte de leur texte sur
  // le disque et au dernier commit ; absent : aucun.
  blobs?: FileBlobs[];
  // La liste des fichiers retenue par la validation de chaque étape (validated/<files> de sa marque, lu par le
  // contrôleur) ; null : illisible ; absent : pas de validation.
  validated?: Partial<Record<CheckedStep, StepFiles | null>>;
  now: number;                                     // l'heure du relevé
};

// Le texte d'un test d'invariant, montré à l'écran à côté de sa lecture ; au-delà : '' (la vue ne le montre pas) ;
// son texte à la base, au-delà : null.
const SOURCE_MAX = 200_000;

const ORDER: VibeStepId[] = ['note', 'forme', 'invariants', 'modules', 'revue', 'pr'];

const TEXT = {
  fr: {
    plural: (n: number) => n > 1,
    mark: { ok: 'validée', ko: 'refusée', changed: 'modifiée depuis' },
    noNote: 'pas de note', filled: 'rédigée', unfilled: 'à rédiger', question: ['question', 'questions'], changedSince: 'modifiée depuis la validation',
    toReview: { note: 'à revoir : la note a changé', forme: 'à revoir : la Forme a changé', invariants: 'à revoir : les invariants ont changé', modules: 'à revoir : les modules ont changé' },
    module: ['module', 'modules'], file: ['fichier', 'fichiers'], kase: ['cas', 'cas'], read: ['lu', 'lus'],
    checksOk: 'vérifications ok', checksKo: 'vérifications en échec', warning: ['avertissement', 'avertissements'], unchecked: 'pas vérifiée', ponytail: 'ponytail faite',
    fixup: ['fixup', 'fixups'], noPr: 'pas de PR', commit: ['commit', 'commits'], reviewed: 'relus',
    box: ['case', 'cases'], noPlan: 'pas de plan', remark: ['remarque', 'remarques'], published: 'publiée',
    busy: 'L\'agent travaille', directRunning: 'Une commande directe est en cours', noRepo: 'Pas de dépôt git', noNoteYet: 'Pas encore de note', nothingToRead: 'Aucun test d\'invariant à lire',
    noModule: 'Aucun module à générer', noPrChosen: 'Aucune PR choisie', loadFirst: 'Charger d\'abord la PR',
    emptyDraft: 'Le brouillon de revue est vide', noCommitMd: 'Préparer d\'abord le commit', noQuestion: 'Aucune question ouverte',
    openQuestions: 'Répondre d\'abord aux questions de la note', unvalidated: 'Valider d\'abord la note', refused: 'étape refusée', started: 'Déjà en cours', modulesUnvalidated: 'modules pas validés',
    proof: { none: 'rien à prouver', ok: 'invariants prouvés', missing: 'invariants pas prouvés', blocked: 'preuve bloquée : à toi' },
    noFixup: 'Aucun commit fixup!', dirty: 'Des modifications en cours', preparing: 'Une recette du projet est en cours',
    elsewhere: 'Passer d\'abord sur la branche de la PR', noUpstream: 'Pas de branche distante suivie', upToDate: 'Déjà à jour', alreadyOnBase: 'Déjà sur la base',
    checklist: ['La note est à jour', 'Les invariants passent', 'Chaque diff a été relu', 'Chaque module commité, aucun fixup à replier',
      'AGENTS.md à jour si une convention a changé'],
  },
  en: {
    plural: (n: number) => n !== 1,
    mark: { ok: 'approved', ko: 'rejected', changed: 'changed since' },
    noNote: 'no note', filled: 'written', unfilled: 'to write', question: ['question', 'questions'], changedSince: 'changed since approval',
    toReview: { note: 'to review: the note changed', forme: 'to review: the shape changed', invariants: 'to review: the invariants changed', modules: 'to review: the modules changed' },
    module: ['module', 'modules'], file: ['file', 'files'], kase: ['case', 'cases'], read: ['read', 'read'],
    checksOk: 'checks pass', checksKo: 'checks fail', warning: ['warning', 'warnings'], unchecked: 'not checked', ponytail: 'ponytail done',
    fixup: ['fixup', 'fixups'], noPr: 'no PR', commit: ['commit', 'commits'], reviewed: 'reviewed',
    box: ['box', 'boxes'], noPlan: 'no plan', remark: ['remark', 'remarks'], published: 'published',
    busy: 'The agent is working', directRunning: 'A direct command is running', noRepo: 'No git repository', noNoteYet: 'No note yet', nothingToRead: 'No invariant test to read',
    noModule: 'No module to generate', noPrChosen: 'No PR chosen', loadFirst: 'Load the PR first',
    emptyDraft: 'The review draft is empty', noCommitMd: 'Prepare the commit first', noQuestion: 'No open question',
    openQuestions: 'Answer the note\'s questions first', unvalidated: 'Approve the note first', refused: 'step rejected', started: 'Already running', modulesUnvalidated: 'modules not approved',
    proof: { none: 'nothing to prove', ok: 'invariants proved', missing: 'invariants not proved', blocked: 'proof blocked: yours to decide' },
    noFixup: 'No fixup! commit', dirty: 'Uncommitted changes', preparing: 'A project recipe is running',
    elsewhere: 'Switch to the PR branch first', noUpstream: 'No upstream branch', upToDate: 'Already up to date', alreadyOnBase: 'Already on the base',
    checklist: ['The note is up to date', 'The invariants pass', 'Every diff has been reviewed', 'Every module committed, no fixup to fold',
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

// Les fichiers relevés qui diffèrent du dernier commit (head) et de la liste retenue de chaque étape lue (validated),
// chaque étape ne comparant que sa vue (views : les tests, ou les fichiers des modules) et les chemins de sa liste ; un
// supprimé qui n'a pas d'autre id dans le relevé (known) reçoit r<i>, le même chemin le même numéro, de head aux modules.
function diffsOf(
  blobs: FileBlobs[], validated: JourneyInput['validated'], views: Record<VibeDiffStep, Set<string>>, known: Set<string>,
): VibeDiffs {
  const numbers = new Map<string, string>();
  const numbered = (list: VibeDiffFile[]): VibeDiffFile[] => list.map((f) => {
    if (!f.deleted || known.has(f.path)) return f;
    if (!numbers.has(f.path)) numbers.set(f.path, `r${numbers.size}`);
    return { ...f, id: numbers.get(f.path)! };
  });
  const head = numbered(diffFiles(blobs, 'head'));
  const done: VibeDiffs['validated'] = {};
  for (const step of ['forme', 'invariants', 'modules'] as const) {
    const list = validated?.[step];
    if (list) done[step] = numbered(diffFiles(blobs.filter((b) => views[step].has(b.path) || Object.hasOwn(list, b.path)), list));
  }
  return { head, validated: done };
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

  // Un fichier encore identique au squelette que la Forme a laissé (marque skel:<chemin>, empreinte du disque).
  const diskBlob = new Map((input.blobs ?? []).map((b) => [b.path, b.disk]));
  const isSkeleton = (path: string): boolean => { const k = marks[`skel:${path}`]?.hash; return !!k && diskBlob.get(path) === k; };

  // La note, ses validations, les modules de sa Forme.
  const facts = input.note && parseNote(input.note.text);
  const note: VibeNote | null = input.note && facts && {
    id: 'n', path: input.note.path, text: input.note.text, before: input.note.before, filled: facts.filled, mustNot: facts.mustNot,
    mark: markState(marks, 'note', blobSha(noteDesign(input.note.text))), formeMark: markState(marks, 'forme', blobSha(facts.forme)),
    nothingMark: markState(marks, 'nothing', blobSha(input.note.text)), locked: codeLock(null, input.busy, input.running, lang),
    ...(flow === 'create' && { verified: designState(marks, input.note.path, blobSha(noteDesign(input.note.text))) }),
  };
  // Le commit de la note : le plus ancien de la branche qui la porte (les commits vont du plus ancien au plus récent) ;
  // il porte aussi les squelettes des modules, qui ne sont pas un module fait. Note ignorée par git (jamais commitée) :
  // le plus ancien de la branche, tout simplement ; noteIn dit si un commit est le sien, et noteDirty si elle est à commiter.
  const noteIn = (c: { files: string[] }) => !!note && (input.note?.ignored ? c === commits[0] : c.files.includes(note.path));
  const noteCommit = note && commits.find(noteIn);
  const noteDirty = !!note && dirty.includes(note.path);
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
    // skeleton : un fichier dont l'empreinte du disque est celle que la Forme a laissée (marque skel:<chemin>) : à générer.
    const files = !touched ? [] : changed.filter((f) => bares.some((b, k) => (roots[k] ? within(f, b) === roots[k] : within(f, b) !== null))).sort()
      .map((path, j) => (input.exists(path)
        ? { id: `m${i}/${j}`, path, ...gitOf(path), ...(isSkeleton(path) && { skeleton: true as const }) }
        : { id: `m${i}/${j}`, path, deleted: true }));
    const skeleton = files.length > 0 && files.every((f) => 'skeleton' in f && f.skeleton);
    return {
      path: m.path, paths: m.paths, contract: m.contract, file: real ? { id: `m${i}`, path: real } : null,
      touched, started, commits: by.map((c) => c.hash), files, locked: codeLock(m.path, input.busy, input.running, lang), uncommitted,
      ...(skeleton && { skeleton }),
    };
  });
  const unstarted = modules.some((m) => !m.started);
  const invLines = !!input.note && hasInvariantLines(input.note.text);
  // La preuve des invariants : preuve.md et les lignes « → invariant » de la note ; passée si elle est 'ok' (ou 'none' : rien à
  // prouver). Elle ne dépend que d'eux : le code corrigé ensuite ne la périme pas.
  const proof = proofOf(out('preuve.md'), (facts?.mustNot ?? []).filter((m) => m.mark === 'invariant').map((m) => m.text));
  const proved = proof.state === 'ok' || proof.state === 'none';

  // Les tests de la branche (ceux qui ont des cas) : invariants et variants.
  const tests = input.tests.map((t) => ({ ...t, cases: caseTitles(t.text), lines: caseLines(t.text) })).filter((t) => t.cases.length);
  const readings = Array.isArray(input.readings) ? input.readings : Object.entries(input.readings).map(([blob, text]) => ({ blob, text, time: 0 }));
  const invariants: VibeTestFile[] = tests.filter((t) => isInvariantTest(t.path)).map((t, i) => {
    const r = caseReading(t, readings);
    const { keys, blocks, common } = caseBlocks(t.text);
    const states = keys.map((k, j) => caseMarkState(marks, caseTarget(t.path, k), { hash: blocks[j], common }));
    const commonChanged = keys.filter((_, j) => states[j] === 'common');   // 'common' : rendu 'changed'
    return {
      id: `t${i}`, path: t.path, blob: t.blob, cases: t.cases, lines: t.lines, source: t.text.length > SOURCE_MAX ? '' : t.text,
      base: t.base != null && t.base.length > SOURCE_MAX ? undefined : t.base,
      reading: r && parseReading(r.text), stale: !!r?.stale.length, locked: codeLock(null, input.busy, input.running, lang),
      ...(r?.stale.length && { staleCases: r.stale }),
      marks: Object.fromEntries(keys.map((k, j) => [k, states[j] === 'common' ? 'changed' : states[j]])),
      ...(commonChanged.length && { commonChanged }), hashes: { blocks, common },
    };
  });
  const variants = tests.filter((t) => !isInvariantTest(t.path)).map((t, i) => ({ id: `v${i}`, path: t.path, cases: t.cases.length }));
  // Les validations d'étape (le créateur seul valide) : ce que chaque étape valide aujourd'hui et son état (step-checks).
  const blobs = input.blobs ?? [];
  const contents = flow === 'create' && note ? stepContents({ note, invariants, modules, changed }, marks, blobs) : null;
  const stepCheck = contents && stepChecks(marks, contents);
  // Un ✓ d'étape retiré à la main qui tient : sa marque retient l'empreinte du contenu d'aujourd'hui de l'étape.
  const heldBack = (s: 'forme' | 'invariants' | 'modules'): boolean => withdrawn(marks, s) !== null && withdrawn(marks, s) === contents?.[s]?.hash;
  // La validation d'une étape et qui l'a posée : 'system' d'après sa marque (by), absent : à la main ; withdrawn : son retrait tient.
  const checkOf = (id: CheckedStep): VibeStepCheck => {
    const c = stepCheck![id];
    return { ...(c.state && marks[id]?.by === 'system' ? { ...c, by: 'system' as const } : c), ...(id !== 'note' && heldBack(id) && { withdrawn: true as const }) };
  };
  // Ce que dit l'en-tête d'une étape décochée : modifiée depuis la validation, ou à revoir (la première décochée a changé).
  const mood = (id: VibeStepId): string | null => {
    const c = stepCheck?.[id as CheckedStep];
    return c?.state === 'changed' ? T.changedSince : c?.state === 'cascade' ? T.toReview[c.cause as CheckedStep] : null;
  };
  // Le menu de diff : sans blobs (aucun relevé des fichiers), rien ne diffère, aucune liste n'est comparée.
  const modulePaths = modules.flatMap((m) => (m.files ?? []).map((f) => f.path));
  const invariantPaths = invariants.map((f) => f.path);
  // Les modules valident tout ce que la branche change, hors la note et les tests d'invariants (stepContent) : le menu de diff aussi.
  const own = new Set([note?.path, ...invariantPaths]);
  const diffs = flow === 'create'
    ? diffsOf(blobs, input.blobs ? input.validated : undefined, {
      forme: new Set(modulePaths), modules: new Set([...modulePaths, ...changed.filter((p) => !own.has(p))]), invariants: new Set(invariantPaths),
    }, new Set([...modulePaths, ...changed, ...invariantPaths]))
    : undefined;
  // Une fois un module commencé, le parcours ne recule plus (note 0.15.0-stabilisation) : une validation faite puis
  // dépassée par une retouche (« changed », la note, sa Forme, un cas) compte encore ; l'écran la dit changée.
  const begun = modules.some((m) => m.started);
  const stillOk = (s: VibeMarkState) => s === 'ok' || (begun && s === 'changed');
  const casesOk = invariants.every((f) => Object.values(f.marks).every(stillOk));
  // Les tests de l'étape Invariants : ceux qu'un commit porte avec la note (le premier, ses fixups repliés).
  const stepTests = invariants.filter((f) => !!note && commits.some((c) => noteIn(c) && c.files.includes(f.path)));
  const caseCount = invariants.reduce((s, f) => s + f.cases.length, 0);
  // un cas périmé n'est pas lu
  const readCount = invariants.reduce((s, f) => s + (f.reading ? f.cases.length - (f.staleCases?.length ?? 0) : 0), 0);

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
    commits.some(noteIn),   // note ignorée : le premier commit
    // Tous les invariants passent, quel que soit le nom que leur donne le projet (« invariants (backend) »…).
    !!checks?.some((c) => /invariant/i.test(String(c?.name))) && checks!.filter((c) => /invariant/i.test(String(c?.name))).every(passes),
    // Chaque diff relu : cochée par le relevé, les modules validés et la ponytail review faite.
    stepCheck?.modules.state === 'ok' && ponytail,
    // Aucun fixup! à replier, et chaque module de la Forme a son commit (un commit peut en porter plusieurs).
    !fixups && modules.length > 0 && modules.every((m) => m.commits.length > 0),
    null,
  ];
  const checklist: VibeCheck[] = flow === 'review' ? []
    : T.checklist.map((text, i) => (a3[i] !== null ? { text, done: a3[i] }
      : { text, done: (!!head && markState(marks, `a3:${i}`, head) === 'ok') || null, manual: true }));

  // Les étapes : faite, et l'action qui la fait avancer quand elle est en cours.
  const judged = (s: VibeMarkState) => s === 'ok' || s === 'ko';
  // Le fait que la Note seule dit ; les questions sont dans le questionnaire, la validation à côté du chemin.
  const noteHead = note ? (note.filled ? T.filled : T.unfilled) : T.noNote;
  const noteFacts = note ? line(noteHead, questions.length > 0 && count(questions.length, T.question), note.mark && !mood('note') && T.mark[note.mark], mood('note')) : noteHead;
  const invFacts = (proofFact?: string | false) =>
    line(count(invariants.length, T.file), count(caseCount, T.kase), count(readCount, T.read), proofFact, mood('invariants'));
  let done: Partial<Record<VibeStepId, boolean>>;
  let next: Partial<Record<VibeStepId, string | null>>;
  let stepFacts: Partial<Record<VibeStepId, string>>;
  // head : de facts, ce que l'étape ne montre pas en dessous (une carte, un questionnaire, une validation) ; absent : rien.
  let stepHead: Partial<Record<VibeStepId, string>>;
  // Où le parcours se tient (créateur) ; le contrôleur dit, d'après le rythme, si elle est tenue (holdsPause).
  let pause: VibePause | null = null;
  if (flow === 'create') {
    // La note n'est faite que par le ✓ de l'utilisateur, Vibe et l'express compris ; la Forme, dès qu'elle a des modules.
    const noteDone = !!note?.filled && !questions.length && stillOk(note.mark);
    const formeDone = !!note && modules.length > 0;
    // La note (sa Forme comprise) commitée puis modifiée : la Forme n'est faite qu'une fois ce changement commité
    // (Préparer le commit : un fixup de son commit, un nouveau commit une fois la PR ouverte), note et Forme revalidées.
    // Une fois un module commencé, le parcours ne recule plus : une retouche de la note ou d'un test d'invariant fait
    // partie du travail en cours, que Commiter les modules range (note 0.15.0-stabilisation) ; les faits le disent.
    const noteChanged = noteDirty && commits.some(noteIn);
    const reopens = noteChanged && !begun;
    // la retouche : la note ou un test d'invariant de la branche, modifiés ; en attente une fois les modules commencés
    const retouched = noteDirty || dirty.some((f) => invariants.some((t) => t.path === f));
    const pending = begun && retouched;
    // Les tests alignés : align.md, sans rubrique [toi] ; ou chaque cas validé à la main.
    const alignMd = out('align.md');
    const aligned = alignMd !== null && toiCount(alignMd) === 0;
    done = {
      note: noteDone,
      forme: formeDone && !reopens,
      // Seulement si la Note et la Forme le sont (note 0.12.0-vibe-sans-rc-diff-en-fond), puis : sans ligne « → invariant »,
      // rien à écrire ni à commiter. Avec, sans test de la branche (déjà observée par un test existant) : la
      // dernière course Écrire les invariants ou Vérifier l'alignement finie, ou ✓ Rien à écrire. Avec des
      // tests : alignés (align.md sans [toi]) ou chaque cas validé à la main, lu ou pas, et le premier commit
      // (note, forme, invariants) fait.
      // Une fois un module commencé, seuls comptent les tests écrits pour l'étape (portés par le commit de la note) :
      // un test protégé retouché ensuite par un module (un harnais) est du travail des modules, pas à revalider.
      invariants: noteDone && formeDone && (!invLines || (begun
        ? aligned || stepTests.every((f) => Object.values(f.marks).every(stillOk))
        : !invariants.length
          ? input.runs.find((r) => r.id === 'invariants' || r.id === 'align')?.state === 'done' || note.nothingMark === 'ok'
          : (aligned || casesOk) && !retouched)),
      // Pas faite sans preuve qui passe, quel que soit le rythme.
      modules: modules.length > 0 && modules.every((m) => m.commits.length > 0) && !modules.some((m) => m.uncommitted) && !pending && proved,
      revue: checksOk && ponytail && !fixups && boxes === screen.length,   // le plan à l'écran, s'il y en a un
      pr: !!pr,
    };
    // La pause : la note commitée qui a perdu son ✓ ; un ✓ d'étape retiré à la main qui tient ; le premier commit fait, aucun module commencé ; les modules faits, la
    // revue pas commencée (ni vérifications ni ponytail review, ni PR).
    const first = commits.some(noteIn);
    // Un ✓ d'étape retiré à la main qui tient : sa marque retient l'empreinte du contenu d'aujourd'hui de l'étape.
    const refused = (['forme', 'invariants', 'modules'] as const).find(heldBack);
    // Un test de la branche pas lu, ou sa lecture périmée : Lire en pseudo-code attend, avant le premier commit ; la pause aussi.
    const unread = invLines && readCount < caseCount;
    pause = !note ? null
      : first && !stillOk(note.mark) ? 'note'
        : refused ? `withdrawn:${refused}`
          : done.invariants && first && !begun && !unread ? 'invariants'
            : done.modules && !checks && !ponytail && !pr ? 'modules'
              : null;
    next = {
      note: !note?.filled ? 'note' : questions.length ? 'answers' : null,
      forme: !modules.length ? 'forme' : reopens && noteDone && formeDone ? (commitMd ? 'commit' : 'commit-prepare') : null,
      // Aucun ✓ à attendre : Écrire les invariants vérifie l'alignement, puis Lire en pseudo-code (avant le premier commit),
      // et la pause après eux dit où l'on en est.
      invariants: !invariants.length ? 'invariants' : unread && !first ? 'read-invariants' : commitMd ? 'commit' : dirty.length ? 'commit-prepare' : null,
      // À la pause après les invariants : Vibe. Sinon Générer les modules tant qu'il en reste un pas commencé (un à un sur sa
      // ligne, au choix), puis Prouver les invariants (avant Commiter les modules), puis Commiter les modules.
      modules: pause === 'invariants' ? 'vibe' : commitMd ? 'commit' : unstarted ? 'modules' : !proved ? 'prove'
        : modules.some((m) => m.uncommitted) ? 'commit-modules' : pending ? 'commit-prepare' : null,
      // Lancer les vérifications demande aussi la ponytail review (F-115) : elle n'a plus son bouton. À la pause après les modules : Vibe.
      revue: pause === 'modules' ? 'vibe' : !checksOk || !ponytail ? 'checks' : fixups ? 'fixups' : null,
      pr: 'pr',
    };
    stepFacts = {
      note: noteFacts,
      forme: note ? line(count(modules.length, T.module), note.formeMark && !mood('forme') && T.mark[note.formeMark], mood('forme')) : T.noNote,
      // La preuve, dite ici et nulle part ailleurs, quand chaque module est commencé (avant, il n'y a rien à en dire, sauf rien à prouver).
      invariants: invFacts(!!note && (!unstarted || proof.state !== 'missing') && T.proof[proof.state]),
      modules: line(`${modules.filter((m) => m.commits.length).length} / ${count(modules.length, T.module)}`, mood('modules')),
      revue: line(!checks ? T.unchecked : checksOk ? T.checksOk : T.checksKo, warnings > 0 && count(warnings, T.warning),
        ponytail && T.ponytail, fixups > 0 && count(fixups, T.fixup), screen.length > 0 && `${boxes} / ${count(screen.length, T.box)}`),
      pr: pr ? `PR #${pr.number}` : T.noPr,
    };
    stepHead = {
      note: line(noteHead, mood('note')),
      forme: note ? mood('forme') ?? '' : T.noNote,
      invariants: mood('invariants') ?? '',
      modules: mood('modules') ?? '',
      // Sans vérification, les fixups restent dits ici : aucune carte ne les compte (le § A.3 ne dit que « repliés »).
      revue: line(!checks && T.unchecked, fixups > 0 && count(fixups, T.fixup)),
      pr: pr ? '' : T.noPr,
    };
  } else {
    const noteDone = here && (!note || judged(note.mark));
    done = {
      note: noteDone,
      forme: noteDone,   // rien à juger : avec la Note
      invariants: here && invariants.every((f) => Object.values(f.marks).every(judged)),
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
      invariants: invFacts(),
      modules: line(count(commits.length, T.commit), done.modules && T.reviewed),
      revue: plan === null ? T.noPlan : `${boxes} / ${count(screen.length, T.box)}`,
      pr: line(count(input.draft.length, T.remark), done.pr && T.published),
    };
    // Modules : sa vue ne compte pas les commits de la PR, inchangé.
    stepHead = { note: noteHead, modules: stepFacts.modules, revue: plan === null ? T.noPlan : '' };
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
      if (pause?.startsWith('withdrawn:')) return 'refused';
      if (vibe || input.busy || input.running.length) return 'started';
    }
    // Commiter les modules attend leur validation, Vibe compris (l'orchestrateur les valide par step.validate).
    if (d.id === 'commit-modules' && stepCheck && stepCheck.modules.state !== 'ok') return 'modulesUnvalidated';
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
    'openQuestions', 'unvalidated', 'refused', 'started']);
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
    'design-check': !!note?.filled,   // un geste à part de Valider la note : dès que la note est rédigée, à volonté
    prove: proof.state !== 'none',   // sans ligne « → invariant », rien à prouver
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
    agentId: input.agentId, lang, flow, vibe: input.vibe, express: input.express, agent: input.agent,
    repo: repo && { branch: repo.branch, base: repo.base, changed: changed.length },
    error: input.error,
    steps: ORDER.map((id) => ({
      id, status: done[id] ? 'done' : id === current ? 'current' : 'todo', facts: stepFacts[id] ?? '', head: stepHead[id] ?? '',
      ...(stepCheck && Object.hasOwn(stepCheck, id) && { check: checkOf(id as CheckedStep) }),
    })),
    ...(flow === 'create' && { pause, proof }),
    files: [...changed].sort().map((path, i) => ({
      id: `b${i}`, path, ...(input.exists(path) ? gitOf(path) : { deleted: true }), locked: codeLock(null, input.busy, input.running, lang),
    })),
    modulesView: input.modulesView, diffs,
    note, questions, modules, invariants, variants, commits: viewCommits, outputs, checklist, screen, actions,
    skills: input.skills, pr, prs, loaded, child, branches: input.branches ?? null,
    sync: input.sync ?? null, draft: input.draft, worktree: input.worktree ?? null, runs: input.runs,
    queued: input.queued ?? [], request: input.request ? { branch: input.request } : null, time: input.now,
  };
}
