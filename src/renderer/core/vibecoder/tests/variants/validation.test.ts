import { describe, expect, it } from 'vitest';
import { awaiting, stepBadge } from 'core/vibecoder';
import type { VibeFlow, VibeNote, VibeStepCheck, VibeStepId, VibeTestFile, VibeView } from 'technicals/bridge';

const note = (over: Partial<VibeNote> = {}): VibeNote => ({
  id: 'n', path: 'docs/tickets/feat/x.md', text: '# x', before: null, filled: true, mustNot: [], mark: null, formeMark: null, ...over,
});
const tests = (marks: VibeTestFile['marks'], read = true): VibeTestFile[] => [{
  id: 't0', path: 'tests/invariants/a.test.ts', blob: 'b', cases: ['a', 'b'], lines: [3, 8], source: '', marks,
  reading: read ? [{ title: 'a', pseudo: '', edges: [], guarantees: '', warning: null }] : null,
}];
const view = (current: VibeStepId, over: Partial<VibeView> = {}): VibeView => ({
  agentId: 'a1', lang: 'fr', flow: 'create', autonomy: 'guide', agent: { model: '', effort: '', mode: '' }, repo: null, error: null,
  steps: ['note', 'forme', 'invariants'].map((id) => ({ id: id as VibeStepId, status: id === current ? 'current' : 'todo', facts: '', open: true })),
  note: note(), questions: [], modules: [{ path: 'a.ts', paths: ['a.ts'], contract: '', file: null, touched: false, commits: [] }], invariants: [], variants: [],
  commits: [], outputs: {}, checklist: [], actions: [], skills: [], pr: null, prs: null, draft: [], time: 0, ...over,
});

describe('awaiting', () => {
  it('Créer : la note rédigée, sans question, pas validée → la valider', () => {
    expect(awaiting(view('note'))).toEqual({ kind: 'note' });
    expect(awaiting(view('note', { note: note({ mark: 'changed' }) }))).toEqual({ kind: 'note' });
  });

  it('note à rédiger, questions ouvertes, ou déjà validée : rien à valider', () => {
    expect(awaiting(view('note', { note: note({ filled: false }) }))).toBeNull();
    expect(awaiting(view('note', { questions: [{ n: 1, text: '?', options: [] }] }))).toBeNull();
    expect(awaiting(view('note', { note: note({ mark: 'ok' }) }))).toBeNull();
    expect(awaiting(view('note', { note: null }))).toBeNull();
  });

  it('Créer : la forme posée, les cas pas cochés : rien d\u2019attendu (le système les valide)', () => {
    expect(awaiting(view('forme'))).toBeNull();
    expect(awaiting(view('forme', { note: note({ formeMark: 'changed' }) }))).toBeNull();
    expect(awaiting(view('invariants', { invariants: tests({ a: 'ok', b: 'ko' }) }))).toBeNull();
    expect(awaiting(view('invariants', { invariants: tests({}, false) }))).toBeNull();
  });

  it('Relire : la forme pas validée → la valider ; sans module, validée : rien', () => {
    expect(awaiting(view('forme', { flow: 'review' }))).toEqual({ kind: 'forme' });
    expect(awaiting(view('forme', { flow: 'review', modules: [] }))).toBeNull();
    expect(awaiting(view('forme', { flow: 'review', note: note({ formeMark: 'ok' }) }))).toBeNull();
  });

  it('Relire, invariants : le nombre de cas sans verdict ; tous jugés ou sans test : rien', () => {
    const review = (marks: VibeTestFile['marks']) => view('invariants', { flow: 'review', invariants: tests(marks) });
    expect(awaiting(review({ a: 'ok', b: 'changed' }))).toEqual({ kind: 'cases', count: 1 });
    expect(awaiting(review({ a: 'ok', b: 'ko' }))).toBeNull();
    expect(awaiting(view('invariants', { flow: 'review' }))).toBeNull();
  });

  it('deux cas de même titre, un seul ✓ : l\u2019autre attend sa validation', () => {
    const dup = (marks: VibeTestFile['marks']) => view('invariants', { flow: 'review', invariants: [{ ...tests(marks)[0], cases: ['t', 't'] }] });
    expect(awaiting(dup({ t: 'ok' }))).toEqual({ kind: 'cases', count: 1 });
    expect(awaiting(dup({ t: 'ok', 't n° 2': 'ok' }))).toBeNull();
  });

  it('Créer : la note attendue (à vérifier, puis à valider), le moteur en marche ou pas ; validée, rien', () => {
    expect(awaiting(view('note', { vibe: true }))).toEqual({ kind: 'note' });
    expect(awaiting(view('note', { vibe: false }))).toEqual({ kind: 'note' });
    expect(awaiting(view('note', { vibe: true, note: note({ mark: 'ok' }) }))).toBeNull();
    expect(awaiting(view('note', { vibe: true, note: note({ filled: false }) }))).toBeNull();
  });

  it('Relire : un verdict, ✓ ou ✗, sur la note (même pas rédigée) et sur chaque cas', () => {
    expect(awaiting(view('note', { flow: 'review', note: note({ filled: false }) }))).toEqual({ kind: 'note' });
    expect(awaiting(view('note', { flow: 'review', note: note({ mark: 'ko' }) }))).toBeNull();
    expect(awaiting(view('invariants', { flow: 'review', invariants: tests({ a: 'ko', b: 'changed' }) }))).toEqual({ kind: 'cases', count: 1 });
  });
});

// 0.9.0-rc.4 : valider ne demande plus d'avoir lu (docs/tickets/fix/0.9.0-vibecoder-etape-invariants.md).
describe('awaiting, un fichier pas lu', () => {
  it('Relire, l\'étape Invariants en cours, un fichier pas lu sans verdict : ses cas attendent leur verdict', () => {
    const invariants = tests({}, false);

    const waiting = awaiting(view('invariants', { flow: 'review', invariants }));

    // Chaque cas du fichier attend son verdict, lu ou pas.
    expect(waiting).toEqual({ kind: 'cases', count: invariants[0].cases.length });
  });
});

// 0.16.0 : le ✓ sur le badge d'état d'une étape (note 0.16.0-ecran-essentiel).
describe('stepBadge', () => {
  const CHECKED = ['forme', 'invariants', 'modules'] as const;
  const OTHERS = ['note', 'revue', 'pr'] as const;
  const badge = (flow: VibeFlow, id: VibeStepId, check?: VibeStepCheck, prevOk = true) => stepBadge(flow, { id, ...(check && { check }) }, prevOk);
  const NOTHING = { mark: null, click: null };

  it.each(CHECKED)('créateur, %s validée : le ✓, un clic le retire', (id) => {
    expect(badge('create', id, { state: 'ok', now: 'h' })).toEqual({ mark: 'ok', click: 'withdraw' });
    expect(badge('create', id, { state: 'ok', now: 'h', by: 'system' })).toEqual({ mark: 'ok', click: 'withdraw' });
  });

  it.each(CHECKED)('créateur, %s : le ✓ retiré à la main qui tient : « ✓ retiré », un clic le rend', (id) => {
    expect(badge('create', id, { state: null, now: 'h', withdrawn: true })).toEqual({ mark: 'withdrawn', click: 'restore' });
  });

  // validateStep refuse l'étape dont celle d'avant n'est pas validée : « rendre » ne s'offre pas, le badge reste sans clic.
  it.each(CHECKED)('créateur, %s : ✓ retiré mais l\'étape d\'avant pas validée : « ✓ retiré » sans clic', (id) => {
    expect(badge('create', id, { state: null, now: null, withdrawn: true }, false)).toEqual({ mark: 'withdrawn', click: null });
  });

  it.each(CHECKED)('créateur, %s validée : le clic « retirer » ne dépend pas de l\'étape d\'avant', (id) => {
    expect(badge('create', id, { state: 'ok', now: 'h' }, false)).toEqual({ mark: 'ok', click: 'withdraw' });
  });

  it.each(CHECKED)('créateur, %s jamais validée : ni ✓ ni clic', (id) => {
    expect(badge('create', id)).toEqual(NOTHING);
    expect(badge('create', id, { state: null, now: null })).toEqual(NOTHING);
  });

  it.each(CHECKED)('créateur, %s modifiée depuis la validation, ou à revoir : ni ✓ ni clic', (id) => {
    expect(badge('create', id, { state: 'changed', now: 'h' })).toEqual(NOTHING);
    expect(badge('create', id, { state: 'cascade', cause: 'forme', now: 'h' })).toEqual(NOTHING);
  });

  it.each(OTHERS)('créateur, %s : ni ✓ ni clic, validée ou pas', (id) => {
    expect(badge('create', id)).toEqual(NOTHING);
    expect(badge('create', id, { state: 'ok', now: 'h' })).toEqual(NOTHING);
    expect(badge('create', id, { state: null, now: 'h', withdrawn: true })).toEqual(NOTHING);
  });

  it.each([...CHECKED, ...OTHERS])('relecteur, %s : ni ✓ ni clic, à toute étape', (id) => {
    expect(badge('review', id)).toEqual(NOTHING);
    expect(badge('review', id, { state: 'ok', now: 'h' })).toEqual(NOTHING);
    expect(badge('review', id, { state: null, now: 'h', withdrawn: true })).toEqual(NOTHING);
  });
});
