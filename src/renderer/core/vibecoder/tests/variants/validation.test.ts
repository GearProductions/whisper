import { describe, expect, it } from 'vitest';
import { awaiting } from 'core/vibecoder';
import type { VibeNote, VibeStepId, VibeTestFile, VibeView } from 'technicals/bridge';

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
  note: note(), questions: [], modules: [{ path: 'a.ts', contract: '', file: null, touched: false, commits: [] }], invariants: [], variants: [],
  commits: [], outputs: {}, checklist: [], actions: [], skills: [], pr: null, prs: null, draft: [], time: 0, ...over,
});

describe('awaiting', () => {
  it('Créer, Guide : la note rédigée, sans question, pas validée → la valider', () => {
    expect(awaiting(view('note'))).toEqual({ kind: 'note' });
    expect(awaiting(view('note', { note: note({ mark: 'changed' }) }))).toEqual({ kind: 'note' });
  });

  it('note à rédiger, questions ouvertes, ou déjà validée : rien à valider', () => {
    expect(awaiting(view('note', { note: note({ filled: false }) }))).toBeNull();
    expect(awaiting(view('note', { questions: [{ n: 1, text: '?', options: [] }] }))).toBeNull();
    expect(awaiting(view('note', { note: note({ mark: 'ok' }) }))).toBeNull();
    expect(awaiting(view('note', { note: null }))).toBeNull();
  });

  it('la forme posée, pas validée → la valider ; sans module, rien', () => {
    expect(awaiting(view('forme'))).toEqual({ kind: 'forme' });
    expect(awaiting(view('forme', { modules: [] }))).toBeNull();
    expect(awaiting(view('forme', { note: note({ formeMark: 'ok' }) }))).toBeNull();
  });

  it('invariants tous lus : le nombre de cas sans validation ; un fichier pas lu : rien (Lire d\'abord)', () => {
    expect(awaiting(view('invariants', { invariants: tests({ a: 'ok', b: 'ko' }) }))).toEqual({ kind: 'cases', count: 1 });
    expect(awaiting(view('invariants', { invariants: tests({ a: 'ok', b: 'ok' }) }))).toBeNull();
    expect(awaiting(view('invariants', { invariants: tests({}, false) }))).toBeNull();
    expect(awaiting(view('invariants'))).toBeNull();
  });

  it('Vibe : rien à valider', () => {
    expect(awaiting(view('note', { autonomy: 'vibe' }))).toBeNull();
  });

  it('Relire : un verdict, ✓ ou ✗, sur la note (même pas rédigée) et sur chaque cas lu', () => {
    expect(awaiting(view('note', { flow: 'review', note: note({ filled: false }) }))).toEqual({ kind: 'note' });
    expect(awaiting(view('note', { flow: 'review', note: note({ mark: 'ko' }) }))).toBeNull();
    expect(awaiting(view('invariants', { flow: 'review', invariants: tests({ a: 'ko', b: 'changed' }) }))).toEqual({ kind: 'cases', count: 1 });
  });
});

// 0.9.0-rc.4 : valider ne demande plus d'avoir lu (docs/tickets/fix/0.9.0-vibecoder-etape-invariants.md).
describe('awaiting, un fichier pas lu', () => {
  it('l\'étape Invariants en cours, un fichier pas lu sans verdict : ses cas attendent leur validation', () => {
    const invariants = tests({}, false);

    const waiting = awaiting(view('invariants', { invariants }));

    // Chaque cas du fichier attend son ✓, lu ou pas.
    expect(waiting).toEqual({ kind: 'cases', count: invariants[0].cases.length });
  });
});
