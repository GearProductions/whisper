/** journey — le parcours de l'écran VibeCoder, calculé sans modèle à partir du
 *  relevé (dépôt, note, tests, sorties des skills, validations) : les étapes
 *  (faite, en cours, à venir) et leurs faits en une ligne, la prochaine
 *  action, les actions possibles et pourquoi une autre est grisée — Créer ou
 *  Relire, Guide ou Vibe, la PR dans un worktree, ce que l'appli fait aussi
 *  elle-même (F-114 : en cours, dernier résultat ; les règles : la note du
 *  ticket 0.8.0).
 *  Ne connaît pas : Electron, le disque, git (tout est passé ; `exists` dit si
 *  un chemin du dossier de l'agent existe).
 *  Utilisé par : app/controllers/vibecoder (refreshVibe). */
import type {
  VibeAction, VibeAutonomy, VibeCheck, VibeComment, VibeFlow, VibeLang, VibeMarkState, VibeModule, VibeNote, VibePr,
  VibePrItem, VibeStepId, VibeTestFile, VibeView, VibeWorktree,
} from 'shared/bridge';
import { DIRECT_ACTIONS, prNumber, SKILL_MODELS, templateVars, type ActionDef } from './actions';
import { markState, type Marks } from './marks';
import { parseNote } from './note';
import { json, parseChecklist, parseQuestions, parseReading } from './outputs';
import { blobSha, caseLines, caseTitles, isInvariantTest } from './test-files';

export type JourneyInput = {
  agentId: string;
  lang: VibeLang;
  flow: VibeFlow;
  pr: number | null;            // Relire : la PR suivie (vibeSet({ pr }))
  autonomy: VibeAutonomy;
  agent: { model: string; effort: string; mode: string };
  busy: boolean;                                    // l'agent travaille
  repo: { branch: string; base: string; changed: string[]; commits: { hash: string; subject: string; files: string[] }[] } | null;
  error: string | null;                             // pourquoi le dépôt manque
  note: { path: string; text: string; before: string | null } | null;
  tests: { path: string; blob: string; text: string }[];   // les tests de la branche
  readings: Record<string, string>;                 // par blob : sa lecture (<sorties>/invariants/<blob>.md)
  outputs: Record<string, { text: string; time: number }>; // par nom connu (OUTPUTS)
  marks: Marks;
  draft: VibeComment[];
  worktree?: VibeWorktree | null;                   // Relire : la PR suivie dans un worktree (F-110)
  // Lu par gh, sans agent (technicals/github) : Créer, la PR de la branche ; Relire,
  // les PR à relire et l'état de la PR suivie. Absent ou null : les sorties des skills.
  github?: { pr?: Record<string, unknown> | null; prs?: unknown[] | null; state?: string | null };
  actions: ActionDef[];
  direct?: Record<string, NonNullable<VibeAction['direct']>>;   // par id de DIRECT_ACTIONS : en cours, dernier résultat (F-114)
  who: Record<string, string>;                      // par id d'action : qui travaille
  model: Record<string, string | null>;             // par id d'action : le modèle de son skill en sous-contexte (forkedModel)
  skills: string[];
  exists: (rel: string) => boolean;
  now: number;                                      // l'heure du relevé
};

// Le texte d'un test d'invariant, montré à l'écran à côté de sa lecture ; au-delà : '' (la vue ne le montre pas).
const SOURCE_MAX = 200_000;

const ORDER: Record<VibeFlow, VibeStepId[]> = {
  create: ['note', 'forme', 'invariants', 'modules', 'revue', 'pr'],
  review: ['pr', 'note', 'invariants', 'commits', 'ecran', 'revue'],
};

const TEXT = {
  fr: {
    plural: (n: number) => n > 1,
    mark: { ok: 'validée', ko: 'refusée', changed: 'modifiée depuis' },
    noNote: 'pas de note', filled: 'rédigée', unfilled: 'à rédiger', question: ['question', 'questions'],
    module: ['module', 'modules'], file: ['fichier', 'fichiers'], kase: ['cas', 'cas'], read: ['lu', 'lus'],
    checksOk: 'vérifications ok', checksKo: 'vérifications en échec', warning: ['avertissement', 'avertissements'], unchecked: 'pas vérifiée', ponytail: 'ponytail faite',
    fixup: ['fixup', 'fixups'], noPr: 'pas de PR', toLoad: 'à charger', commit: ['commit', 'commits'], reviewed: 'relus',
    box: ['case', 'cases'], noPlan: 'pas de plan', remark: ['remarque', 'remarques'], published: 'publiée',
    busy: 'L\'agent travaille', directRunning: 'Une commande directe est en cours', noRepo: 'Pas de dépôt git', noNoteYet: 'Pas encore de note', nothingToRead: 'Aucun test d\'invariant à lire',
    noModule: 'Aucun module à générer', noPrChosen: 'Aucune PR choisie', loadFirst: 'Charger d\'abord la PR',
    emptyDraft: 'Le brouillon de revue est vide', noCommitMd: 'Préparer d\'abord le commit', noQuestion: 'Aucune question ouverte',
    noFixup: 'Aucun commit fixup!', worktreeOpen: 'Déjà ouverte dans un worktree', notWorktree: 'Seulement sur le robot d\'un worktree',
    merged: 'PR déjà fusionnée : rien à relire', closed: 'PR fermée : rien à relire',
    checklist: ['La note est à jour', 'Les invariants passent', 'Chaque diff a été relu', 'Un commit par module, fixups repliés',
      'AGENTS.md à jour si une convention a changé'],
  },
  en: {
    plural: (n: number) => n !== 1,
    mark: { ok: 'approved', ko: 'rejected', changed: 'changed since' },
    noNote: 'no note', filled: 'written', unfilled: 'to write', question: ['question', 'questions'],
    module: ['module', 'modules'], file: ['file', 'files'], kase: ['case', 'cases'], read: ['read', 'read'],
    checksOk: 'checks pass', checksKo: 'checks fail', warning: ['warning', 'warnings'], unchecked: 'not checked', ponytail: 'ponytail done',
    fixup: ['fixup', 'fixups'], noPr: 'no PR', toLoad: 'to load', commit: ['commit', 'commits'], reviewed: 'reviewed',
    box: ['box', 'boxes'], noPlan: 'no plan', remark: ['remark', 'remarks'], published: 'published',
    busy: 'The agent is working', directRunning: 'A direct command is running', noRepo: 'No git repository', noNoteYet: 'No note yet', nothingToRead: 'No invariant test to read',
    noModule: 'No module to generate', noPrChosen: 'No PR chosen', loadFirst: 'Load the PR first',
    emptyDraft: 'The review draft is empty', noCommitMd: 'Prepare the commit first', noQuestion: 'No open question',
    noFixup: 'No fixup! commit', worktreeOpen: 'Already open in a worktree', notWorktree: 'Only on a worktree\'s robot',
    merged: 'PR already merged: nothing to review', closed: 'PR closed: nothing to review',
    checklist: ['The note is up to date', 'The invariants pass', 'Every diff has been reviewed', 'One commit per module, fixups folded',
      'AGENTS.md updated if a convention changed'],
  },
};

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

export function vibeView(input: JourneyInput): VibeView {
  const { lang, flow, repo, outputs, marks } = input;
  const T = TEXT[lang];
  const count = (n: number, [one, many]: string[]) => `${n} ${T.plural(n) ? many : one}`;
  const line = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' · ');
  const vibe = input.autonomy === 'vibe';
  const n = input.pr;
  const out = (name: string) => outputs[name]?.text ?? null;
  const commits = repo?.commits ?? [];
  const changed = repo?.changed ?? [];
  const committed = new Set(commits.flatMap((c) => c.files));
  // ponytail: « pas commité » = changé sans être dans un commit de la branche ; un fichier commité puis
  // retouché n'y est pas. Passer la copie de travail seule (status) dans le relevé si ça gêne.
  const uncommitted = changed.filter((f) => !committed.has(f));

  // La note, ses validations, les modules de sa Forme.
  const facts = input.note && parseNote(input.note.text);
  const note: VibeNote | null = input.note && facts && {
    id: 'n', path: input.note.path, text: input.note.text, before: input.note.before, filled: facts.filled, mustNot: facts.mustNot,
    mark: markState(marks, 'note', blobSha(input.note.text)), formeMark: markState(marks, 'forme', blobSha(facts.forme)),
  };
  const bares = (facts?.modules ?? []).map((m) => m.path.replace(/\/+$/, ''));
  const modules: VibeModule[] = (facts?.modules ?? []).map((m, i) => {
    const hits = changed.flatMap((f) => within(f, bares[i]) ?? []);
    const by = commits.filter((c) => c.files.some((f) => within(f, bares[i]) !== null));
    // ponytail: un module jamais touché n'est cherché qu'à la racine et sous src/ (la Forme omet souvent src/).
    const real = [...new Set([...hits, bares[i], `src/${bares[i]}`])].find((p) => input.exists(p));
    return {
      path: m.path, contract: m.contract, file: real ? { id: `m${i}`, path: real } : null,
      touched: hits.length > 0 || by.length > 0, commits: by.map((c) => c.hash),
    };
  });
  const untouched = modules.some((m) => !m.touched);

  // Les tests de la branche (ceux qui ont des cas) : invariants et variants.
  const tests = input.tests.map((t) => ({ ...t, cases: caseTitles(t.text), lines: caseLines(t.text) })).filter((t) => t.cases.length);
  const invariants: VibeTestFile[] = tests.filter((t) => isInvariantTest(t.path)).map((t, i) => ({
    id: `t${i}`, path: t.path, blob: t.blob, cases: t.cases, lines: t.lines, source: t.text.length > SOURCE_MAX ? '' : t.text,
    reading: Object.hasOwn(input.readings, t.blob) ? parseReading(input.readings[t.blob]) : null,
    marks: Object.fromEntries(t.cases.map((c) => [c, markState(marks, `case:${t.path}:${c}`, t.blob)])),
  }));
  const variants = tests.filter((t) => !isInvariantTest(t.path)).map((t, i) => ({ id: `v${i}`, path: t.path, cases: t.cases.length }));
  const allRead = invariants.every((f) => f.reading !== null);
  const caseCount = invariants.reduce((s, f) => s + f.cases.length, 0);
  const readCount = invariants.reduce((s, f) => s + (f.reading ? f.cases.length : 0), 0);

  // Les sorties des skills.
  const questions = parseQuestions(out('questions.md') ?? '');
  const viewCommits = commits.map((c) => ({ hash: c.hash, subject: c.subject, fixup: FIXUP.test(c.subject), files: c.files }));
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
  // Créer : la PR de la branche (gh, sinon pr.json) ; Relire : la PR suivie, avec sa fiche si elle est
  // chargée, et son état d'après gh s'il a répondu.
  const gh = input.github ?? {};
  const read = json(flow === 'review' ? (n ? out(`pr-${n}.json`) : null) : out('pr.json'));
  const card = flow === 'create' ? gh.pr ?? read : read && gh.state ? { ...read, state: gh.state } : read;
  const number = flow === 'review' ? n : prNumber(card?.number);
  const pr: VibePr | null = number ? {
    number, title: str(card?.title), url: str(card?.url), author: str(card?.author), base: str(card?.base), head: str(card?.head),
    body: str(card?.body), state: ['OPEN', 'CLOSED', 'MERGED'].includes(card?.state as string) ? card!.state as VibePr['state'] : null,
  } : null;
  const loaded = flow === 'review' && !!card && repo !== null;
  const list = flow === 'review' ? gh.prs ?? json(out('prs.json')) : null;
  const prs: VibePrItem[] | null = Array.isArray(list)
    ? (list as (Record<string, unknown> | null)[]).flatMap((p) => {
      const number = prNumber(p?.number);
      return number ? [{ number, title: str(p!.title), author: str(p!.author), url: str(p!.url) }] : [];
    })
    : null;
  // Relire : le plan de test, chaque case validée (pour ce plan-là), ou cochée dans le fichier et pas refusée ;
  // Créer : la liste du § A.3, cochée d'après le dépôt quand c'est possible ; sinon à la main (manual) :
  // cochée si la case `a3:<rang>` est validée pour le commit de tête de la branche (un commit de plus la décoche).
  const plan = n ? out(`pr-${n}-ecran.md`) : null;
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
  const checklist: VibeCheck[] = flow === 'review'
    ? parseChecklist(plan ?? '').map((c, i) => {
      const m = markState(marks, `check:${n}:${i}`, blobSha(plan!));
      return { text: c.text, done: m === 'ok' || (!!c.done && m !== 'ko') };
    })
    : T.checklist.map((text, i) => (a3[i] !== null ? { text, done: a3[i] }
      : { text, done: (!!head && markState(marks, `a3:${i}`, head) === 'ok') || null, manual: true }));

  // Les étapes : faite, et l'action qui la fait avancer quand elle est en cours.
  const validated = (s: VibeMarkState) => vibe || s === 'ok';
  const judged = (s: VibeMarkState) => s === 'ok' || s === 'ko';
  const noteFacts = note ? line(note.filled ? T.filled : T.unfilled, questions.length > 0 && count(questions.length, T.question),
    note.mark && T.mark[note.mark]) : T.noNote;
  const invFacts = line(count(invariants.length, T.file), count(caseCount, T.kase), count(readCount, T.read));
  let done: Partial<Record<VibeStepId, boolean>>;
  let next: Partial<Record<VibeStepId, string | null>>;
  let stepFacts: Partial<Record<VibeStepId, string>>;
  if (flow === 'create') {
    const invLines = !!facts?.mustNot.some((l) => l.mark === 'invariant');
    const inProgress = bares.some((b) => uncommitted.some((f) => within(f, b) !== null));
    done = {
      note: !!note?.filled && !questions.length && validated(note.mark),
      forme: !!note && modules.length > 0 && validated(note.formeMark),
      // … et le premier commit (note, forme, invariants) fait : rien de tout ça n'attend d'être commité.
      invariants: !!note && (!invLines || (invariants.length > 0
        && (vibe || (allRead && invariants.every((f) => f.cases.every((c) => f.marks[c] === 'ok'))))))
        && !uncommitted.some((f) => f === note.path || invariants.some((t) => t.path === f)),
      modules: modules.length > 0 && modules.every((m) => m.commits.length > 0),
      revue: checksOk && ponytail && !fixups,
      pr: !!pr,
    };
    next = {
      note: !note?.filled ? 'note' : questions.length ? 'answers' : null,
      forme: modules.length ? null : 'forme',
      // Guide : les cas lus attendent leur validation avant le commit.
      invariants: !invariants.length ? 'invariants' : !allRead ? 'read-invariants'
        : !vibe && !invariants.every((f) => f.cases.every((c) => f.marks[c] === 'ok')) ? null
          : commitMd ? 'commit' : uncommitted.length ? 'commit-prepare' : null,
      modules: commitMd ? 'commit' : inProgress ? (untouched ? 'next' : 'commit-prepare') : 'module',
      revue: !checksOk ? 'checks' : !ponytail ? 'ponytail' : fixups ? 'fixups' : null,
      pr: 'pr',
    };
    stepFacts = {
      note: noteFacts,
      forme: note ? line(count(modules.length, T.module), note.formeMark && T.mark[note.formeMark]) : T.noNote,
      invariants: invFacts,
      modules: `${modules.filter((m) => m.commits.length).length} / ${count(modules.length, T.module)}`,
      revue: line(!checks ? T.unchecked : checksOk ? T.checksOk : T.checksKo, warnings > 0 && count(warnings, T.warning),
        ponytail && T.ponytail, fixups > 0 && count(fixups, T.fixup)),
      pr: pr ? `PR #${pr.number}` : T.noPr,
    };
  } else {
    const boxes = checklist.filter((c) => c.done).length;
    done = {
      pr: loaded,
      note: loaded && (!note || judged(note.mark)),
      invariants: loaded && invariants.every((f) => f.reading !== null && f.cases.every((c) => judged(f.marks[c]))),
      commits: !!n && out(`pr-${n}-commits.md`) !== null,
      ecran: checklist.length > 0 && boxes === checklist.length,
      revue: !!n && out(`pr-${n}-review.json`) !== null,
    };
    next = {
      // prs : l'action d'un actions.json retouché d'avant la 0.8.0-rc.10 ; sinon, le bouton de l'écran (gh).
      pr: !n && !prs ? 'prs' : 'load-pr',
      note: note && n && out(`pr-${n}-note.md`) === null ? 'review-note' : null,
      invariants: allRead ? null : 'read-invariants',
      commits: 'review-commits',
      ecran: n && plan === null ? 'screen' : null,
      revue: 'publish',
    };
    stepFacts = {
      pr: pr ? line(`#${pr.number}`, loaded ? pr.title : T.toLoad) : T.noPr,
      note: noteFacts,
      invariants: invFacts,
      commits: line(count(commits.length, T.commit), done.commits && T.reviewed),
      ecran: plan === null ? T.noPlan : `${boxes} / ${count(checklist.length, T.box)}`,
      revue: line(count(input.draft.length, T.remark), done.revue && T.published),
    };
  }
  const current = ORDER[flow].find((s) => !done[s]) ?? null;
  const primary = flow === 'create' && vibe && !note ? 'vibe' : current && next[current];

  // Une action directe en cours (F-114) : les autres attendent, comme quand l'agent travaille.
  const running = Object.values(input.direct ?? {}).some((x) => x.running);
  // Pourquoi une action est grisée : l'agent travaille, une commande directe est en cours, une variable
  // de son gabarit manque, elle ne sert pas ici.
  const why = (d: ActionDef): string | null => {
    if (d.kind === 'prefill') return null;
    if (input.busy) return T.busy;
    if (DIRECT_ACTIONS.includes(d.id) && running) return T.directRunning;
    // Relire une PR fusionnée ou fermée : elle se charge, mais ne se relit pas.
    if (flow === 'review' && d.step !== null && d.step !== 'pr' && (pr?.state === 'MERGED' || pr?.state === 'CLOSED')) {
      return pr.state === 'MERGED' ? T.merged : T.closed;
    }
    const v = new Set(templateVars(d.text));
    if ((v.has('branch') || v.has('base')) && !repo) return T.noRepo;
    // La Forme et les invariants s'écrivent d'après la note.
    if (!note && (v.has('note') || (flow === 'create' && (d.step === 'forme' || d.step === 'invariants')))) return T.noNoteYet;
    if (v.has('files') && !invariants.length) return T.nothingToRead;   // tout lu : on peut relire (args.file)
    // Relire : ce qui lit la PR attend qu'elle soit chargée (l'étape PR, elle, prend son numéro de la page).
    if (flow === 'review' && !loaded && d.step !== 'pr' && (v.has('pr') || v.has('ref'))) return pr ? T.loadFirst : T.noPrChosen;
    if (v.has('draft') && !input.draft.length) return T.emptyDraft;
    if (d.id === 'commit' && !commitMd) return T.noCommitMd;
    if (d.id === 'answers' && !questions.length) return T.noQuestion;
    if (d.id === 'fixups' && !fixups) return T.noFixup;
    // Relire dans un worktree : ouvrir une PR chargée, une fois ; décharger, sur son robot.
    if (d.id === 'open-worktree') return input.worktree ? T.worktreeOpen : loaded ? null : pr ? T.loadFirst : T.noPrChosen;
    if (d.id === 'unload-worktree' && !input.worktree?.temp) return T.notWorktree;
    return null;
  };
  const actions: VibeAction[] = input.actions
    .filter((d) => (d.flow === 'both' || d.flow === flow) && (d.id !== 'guide' || input.skills.includes('gear-guide')))
    .map((d) => ({
      id: d.id, step: d.step, label: d.label, hint: d.hint, who: input.who[d.id] ?? 'agent',
      model: input.model[d.id] ?? null, models: input.model[d.id] ? SKILL_MODELS : [], kind: d.kind, needs: d.needs,
      usesText: templateVars(d.text).includes('text'),
      ...(d.kind === 'prefill' ? { text: d.text } : {}),
      primary: d.id === primary, disabled: why(d),
      ...(DIRECT_ACTIONS.includes(d.id) ? { direct: input.direct?.[d.id] ?? { running: false, last: null } } : {}),
    }));

  return {
    agentId: input.agentId, lang, flow, autonomy: input.autonomy, agent: input.agent,
    repo: repo && { branch: repo.branch, base: repo.base, changed: changed.length },
    error: input.error,
    steps: ORDER[flow].map((id) => ({ id, status: done[id] ? 'done' : id === current ? 'current' : 'todo', facts: stepFacts[id] ?? '' })),
    note, questions, modules, invariants, variants, commits: viewCommits, outputs, checklist, actions,
    skills: input.skills, pr, prs, draft: input.draft, worktree: input.worktree ?? null, time: input.now,
  };
}
