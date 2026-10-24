import { describe, expect, it } from 'vitest';
import {
  addComment, blobSha, editComment, markState, parseNote, removeComment, setMark, vibeMarks, vibeView,
  type Drafts, type JourneyInput, type Marks,
} from 'core/vibecoder';

describe('markState : une validation vaut pour le contenu validé', () => {
  const marks: Marks = { note: { hash: 'h1', verdict: 'ok' }, forme: { hash: 'h2', verdict: 'ko' } };

  it('même contenu : le verdict', () => {
    expect(markState(marks, 'note', 'h1')).toBe('ok');
  });

  it('un refus garde son verdict aussi', () => {
    expect(markState(marks, 'forme', 'h2')).toBe('ko');
  });

  it('contenu changé depuis : changed', () => {
    expect(markState(marks, 'note', 'h9')).toBe('changed');
  });

  it('sans validation : null', () => {
    expect(markState(marks, 'case:a.test.ts:x', 'h1')).toBeNull();
  });

  it('une cible qui porte le nom d\'une propriété d\'objet (constructor) : null', () => {
    expect(markState(marks, 'constructor', 'h1')).toBeNull();
  });
});

describe('setMark', () => {
  it('valide pour l\'empreinte donnée', () => {
    expect(setMark({}, 'note', 'h1', 'ok')).toEqual({ note: { hash: 'h1', verdict: 'ok' } });
  });

  it('null oublie la validation', () => {
    expect(setMark({ note: { hash: 'h1', verdict: 'ok' } }, 'note', 'h1', null)).toEqual({});
  });

  it('rend un nouvel état, sans toucher à l\'ancien', () => {
    const before: Marks = { note: { hash: 'h1', verdict: 'ok' } };
    setMark(before, 'note', 'h2', 'ko');
    expect(before).toEqual({ note: { hash: 'h1', verdict: 'ok' } });
  });
});

describe('le brouillon de revue, par PR', () => {
  it('addComment numérote les remarques à partir de 1', () => {
    const drafts = addComment(addComment({}, 12, 'note', 'a'), 12, 'commit abc', 'b');
    expect(drafts[12]).toEqual([{ id: 1, target: 'note', text: 'a' }, { id: 2, target: 'commit abc', text: 'b' }]);
  });

  it('chaque PR a son brouillon', () => {
    expect(addComment({ 12: [{ id: 1, target: 'note', text: 'a' }] }, 13, 'note', 'b')[13]).toEqual([{ id: 1, target: 'note', text: 'b' }]);
  });

  it('un numéro retiré n\'est pas repris', () => {
    const drafts = addComment(removeComment(addComment(addComment({}, 12, 'x', 'a'), 12, 'x', 'b'), 12, 1), 12, 'x', 'c');
    expect(drafts[12].map((c) => c.id)).toEqual([2, 3]);
  });

  it('removeComment ne retire que la remarque désignée, de cette PR', () => {
    const drafts: Drafts = { 12: [{ id: 1, target: 'x', text: 'a' }], 13: [{ id: 1, target: 'y', text: 'b' }] };
    expect(removeComment(drafts, 12, 1)).toEqual({ 12: [], 13: [{ id: 1, target: 'y', text: 'b' }] });
  });
});

describe('editComment : changer le texte d\'une remarque', () => {
  it('seulement celle désignée, de cette PR : même id, même cible', () => {
    const drafts: Drafts = { 12: [{ id: 1, target: 'x', text: 'a' }, { id: 2, target: 'y', text: 'b' }], 13: [{ id: 1, target: 'z', text: 'c' }] };
    expect(editComment(drafts, 12, 1, 'a2')).toEqual({
      12: [{ id: 1, target: 'x', text: 'a2' }, { id: 2, target: 'y', text: 'b' }], 13: [{ id: 1, target: 'z', text: 'c' }],
    });
  });

  it('un id inconnu : rien ne change', () => {
    const drafts: Drafts = { 12: [{ id: 1, target: 'x', text: 'a' }] };
    expect(editComment(drafts, 12, 9, 'b')).toEqual(drafts);
  });
});

describe('vibeMarks : Vibe → Guide, le ✓ des étapes que Vibe a passées', () => {
  const NOTE = ['# G2-1 — Un bouton', '', '## Ce que ça fait', 'Un bouton.', '', '## Ce que ça ne doit pas faire',
    '- Lire un autre fichier. → invariant', '', '## Forme', '```', 'src/core/hello.ts    hello()', '```', ''].join('\n');
  const NOTE_PATH = 'docs/tickets/feat/G2-1-bouton.md';
  const TEST_PATH = 'src/core/tests/invariants/hello.test.ts';
  const TEST = 'it("dit bonjour", () => {});\nit("ne lit rien", () => {});\n';
  const BLOB = blobSha(TEST);
  const input = (over: Partial<JourneyInput> = {}): JourneyInput => ({
    agentId: 'a1', lang: 'fr', flow: 'create', pr: null, autonomy: 'vibe', agent: { model: 'opus', effort: 'high', mode: 'default' },
    busy: false, running: [], runs: [], error: null, readings: [], outputs: {}, marks: {}, draft: [], actions: [],
    who: {}, model: {}, skills: [], exists: () => false, now: 1700000000000,
    note: { path: NOTE_PATH, text: NOTE, before: null }, tests: [{ path: TEST_PATH, blob: BLOB, text: TEST }],
    repo: { branch: 'feat/G2-1-bouton', base: 'origin/main', changed: [NOTE_PATH, TEST_PATH],
      commits: [{ hash: 'a'.repeat(40), subject: 'Note, forme, invariants', files: [NOTE_PATH, TEST_PATH] }] },
    ...over,
  });
  const status = (marks: Marks) => Object.fromEntries(vibeView(input({ autonomy: 'guide', marks })).steps.map((s) => [s.id, s.status]));

  it('les cibles et empreintes d\'un clic sur ✓ : note, forme, chaque cas', () => {
    expect(vibeMarks({}, vibeView(input()))).toEqual({
      note: { hash: blobSha(NOTE), verdict: 'ok' },
      forme: { hash: blobSha(parseNote(NOTE).forme), verdict: 'ok' },
      [`case:${TEST_PATH}:dit bonjour`]: { hash: BLOB, verdict: 'ok' },
      [`case:${TEST_PATH}:ne lit rien`]: { hash: BLOB, verdict: 'ok' },
    });
  });

  it('en Guide, ces étapes restent faites sans recliquer', () => {
    expect(status({})).toMatchObject({ note: 'current' });
    expect(status(vibeMarks({}, vibeView(input())))).toMatchObject({ note: 'done', forme: 'done', invariants: 'done' });
  });

  it('un ✗ déjà donné pour ce contenu reste ; une validation d\'un autre contenu est remplacée', () => {
    const marks: Marks = { note: { hash: blobSha(NOTE), verdict: 'ko' }, forme: { hash: 'vieux', verdict: 'ko' } };
    const next = vibeMarks(marks, vibeView(input({ marks })));
    expect(next.note).toEqual({ hash: blobSha(NOTE), verdict: 'ko' });
    expect(next.forme).toEqual({ hash: blobSha(parseNote(NOTE).forme), verdict: 'ok' });
  });

  it('une étape pas faite ne reçoit rien', () => {
    // Les invariants écrits mais pas commités : l'étape Invariants n'est pas faite.
    const v = vibeView(input({ repo: { branch: 'b', base: 'origin/main', changed: [NOTE_PATH, TEST_PATH], dirty: [NOTE_PATH, TEST_PATH], commits: [] } }));
    expect(Object.keys(vibeMarks({}, v))).toEqual(['note', 'forme']);
  });

  it('Relire : rien', () => {
    expect(vibeMarks({}, vibeView(input({ flow: 'review' })))).toEqual({});
  });
});
