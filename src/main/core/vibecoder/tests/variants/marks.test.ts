import { describe, expect, it } from 'vitest';
import {
  addComment, blobSha, CHECKED, designChecked, designEnd, editComment, hasComment, markState, noteClick, noteDesign, parseNote, removeComment, setMark, stepChecks, stepContent,
  targetHash, vibeMarks, vibeView, type Drafts, type FileBlobs, type JourneyInput, type Marks,
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

describe('hasComment : une remarque du brouillon, connue ou non', () => {
  const drafts: Drafts = { 12: [{ id: 1, target: 'x', text: 'a' }, { id: 3, target: 'y', text: 'b' }], 13: [{ id: 7, target: 'z', text: 'c' }], 14: [] };

  it('une remarque du brouillon : true', () => {
    expect(hasComment(drafts, 12, 1)).toBe(true);
    expect(hasComment(drafts, 12, 3)).toBe(true);
  });

  it('un id absent, ou une PR sans brouillon : false', () => {
    expect(hasComment(drafts, 12, 2)).toBe(false);
    expect(hasComment(drafts, 99, 1)).toBe(false);
    expect(hasComment(drafts, 14, 1)).toBe(false);
    expect(hasComment({}, 12, 1)).toBe(false);
  });

  it('la remarque d\'une autre PR : false', () => {
    expect(hasComment(drafts, 12, 7)).toBe(false);
    expect(hasComment(drafts, 13, 1)).toBe(false);
  });

  it('suit les autres opérations : ajoutée true, retirée false', () => {
    const added = addComment({}, 5, 'x', 'a');
    expect(hasComment(added, 5, 1)).toBe(true);
    expect(hasComment(removeComment(added, 5, 1), 5, 1)).toBe(false);
  });
});

describe('vibeMarks : le ✓ des étapes faites pendant Vibe', () => {
  const NOTE = ['# G2-1 — Un bouton', '', '## Ce que ça fait', 'Un bouton.', '', '## Ce que ça ne doit pas faire',
    '- Lire un autre fichier. → invariant', '', '## Forme', '```', 'src/core/hello.ts    hello()', '```', ''].join('\n');
  const NOTE_PATH = 'docs/tickets/feat/G2-1-bouton.md';
  const TEST_PATH = 'src/core/tests/invariants/hello.test.ts';
  const TEST = 'it("dit bonjour", () => {});\nit("ne lit rien", () => {});\n';
  const BLOB = blobSha(TEST);
  const blobs: FileBlobs[] = [{ path: TEST_PATH, disk: BLOB, head: null }, { path: 'src/core/hello.ts', disk: blobSha('code'), head: null }];
  const input = (over: Partial<JourneyInput> = {}): JourneyInput => ({
    agentId: 'a1', lang: 'fr', flow: 'create', pr: null, autonomy: 'guide', vibe: true, agent: { model: 'opus', effort: 'high', mode: 'default' },
    busy: false, running: [], runs: [], error: null, readings: [], outputs: {}, marks: {}, draft: [], actions: [],
    who: {}, model: {}, skills: [], exists: () => false, now: 1700000000000,
    note: { path: NOTE_PATH, text: NOTE, before: null }, tests: [{ path: TEST_PATH, blob: BLOB, text: TEST }],
    repo: { branch: 'feat/G2-1-bouton', base: 'origin/main', changed: [NOTE_PATH, TEST_PATH],
      commits: [{ hash: 'a'.repeat(40), subject: 'Note, forme, invariants', files: [NOTE_PATH, TEST_PATH] }] },
    ...over,
  });
  const CASES = [`case:${TEST_PATH}:dit bonjour`, `case:${TEST_PATH}:ne lit rien`];
  const run = (marks: Marks = {}, over: Partial<JourneyInput> = {}) => {
    const view = vibeView(input({ marks, ...over }));
    return { view, next: vibeMarks(marks, view, blobs) };
  };
  // L'état de chaque étape d'après les marques, comme le contrôleur le calcule.
  const checks = (view: ReturnType<typeof vibeView>, marks: Marks) =>
    stepChecks(marks, Object.fromEntries(CHECKED.map((s) => [s, stepContent(view, marks, s, blobs)])));
  const status = (marks: Marks) => Object.fromEntries(vibeView(input({ vibe: false, marks, blobs })).steps.map((s) => [s.id, s.status]));

  it('note, forme, invariants : chaque étape validée pour son contenu, et chaque cas son ✓ (les empreintes d\'un clic)', () => {
    const { next } = run();
    expect(next.note).toMatchObject({ hash: blobSha(noteDesign(NOTE)), verdict: 'ok' });
    expect(next.forme).toMatchObject({ hash: blobSha(parseNote(NOTE).forme), verdict: 'ok' });
    expect(next.invariants).toMatchObject({ verdict: 'ok' });
    CASES.forEach((c) => expect(next[c]).toEqual({ hash: BLOB, verdict: 'ok' }));
  });

  it('la Forme validée porte after = la marque de la note, les invariants celle de la Forme : l\'état de chaque étape est ok', () => {
    const { view, next } = run();
    expect(next.note.after).toBeUndefined();
    expect(next.forme.after).toBeDefined();
    expect(next.invariants.after).toBeDefined();
    const c = checks(view, next);
    expect([c.note.state, c.forme.state, c.invariants.state, c.modules.state]).toEqual(['ok', 'ok', 'ok', null]);
  });

  it('plus de marque de fichier', () => {
    expect(Object.keys(run().next).filter((k) => k.startsWith('file:'))).toEqual([]);
  });

  it('les validations suivent l\'ordre note → forme → invariants : une note déjà validée change son after, pas son contenu', () => {
    const first = run().next;
    // La note revalidée avec un autre after : la Forme ne suit plus, le geste Vibe la revalide dans l'ordre.
    const marks: Marks = { ...first, note: { ...first.note, after: 'autre' } };
    const { view, next } = run(marks);
    expect(checks(view, next).forme.state).toBe('ok');
  });

  it('Vibe arrêté ou fini, ces étapes restent faites sans recliquer', () => {
    expect(status({})).toMatchObject({ note: 'current' });
    expect(status(run().next)).toMatchObject({ note: 'done', forme: 'done', invariants: 'done' });
  });

  it('rejouée, elle ne change rien : les marques rendues sont les mêmes (le contrôleur ne réécrit rien)', () => {
    const { view, next } = run();
    expect(vibeMarks(next, view, blobs)).toBe(next);
  });

  it('un ✗ déjà donné à la note pour ce contenu reste : la Forme et les invariants ne sont pas validés, les cas oui', () => {
    const marks: Marks = { note: { hash: blobSha(noteDesign(NOTE)), verdict: 'ko' } };
    const { next } = run(marks);
    expect(next.note).toEqual(marks.note);
    expect(next.forme).toBeUndefined();
    expect(next.invariants).toBeUndefined();
    CASES.forEach((c) => expect(next[c].verdict).toBe('ok'));
  });

  it('un ✗ déjà donné à la Forme pour ce contenu reste ; celui d\'un autre contenu est remplacé', () => {
    const ko: Marks = { forme: { hash: blobSha(parseNote(NOTE).forme), verdict: 'ko' } };
    expect(run(ko).next.forme).toEqual(ko.forme);
    expect(run(ko).next.invariants).toBeUndefined();
    const vieux: Marks = { forme: { hash: 'vieux', verdict: 'ko' } };
    expect(run(vieux).next.forme).toMatchObject({ hash: blobSha(parseNote(NOTE).forme), verdict: 'ok' });
  });

  it('un ✗ déjà donné à un cas reste, et les invariants ne sont pas validés', () => {
    const marks: Marks = { [CASES[0]]: { hash: BLOB, verdict: 'ko' } };
    const { next } = run(marks);
    expect(next[CASES[0]].verdict).toBe('ko');
    expect(next.invariants).toBeUndefined();
  });

  it('une étape pas faite ne reçoit rien', () => {
    // Les invariants écrits mais pas commités : l'étape Invariants n'est pas faite.
    const { next } = run({}, { repo: { branch: 'b', base: 'origin/main', changed: [NOTE_PATH, TEST_PATH], dirty: [NOTE_PATH, TEST_PATH], commits: [] } });
    expect(Object.keys(next)).toEqual(['note', 'forme']);
  });

  it('sans les empreintes du disque (blobs omis), la note et la Forme sont validées', () => {
    const next = vibeMarks({}, vibeView(input()));
    expect(next.note.verdict).toBe('ok');
    expect(next.forme.verdict).toBe('ok');
  });

  it('Relire : rien', () => {
    expect(run({}, { flow: 'review' }).next).toEqual({});
  });
});

describe('targetHash : note', () => {
  const text = (forme: string) => `# T\n\n## Ce que ça fait\n\nA\n\n## Forme\n\n${forme}\n\n## Ce que ça ne doit pas faire\n\n- rien\n`;
  const view = (over: object = {}) =>
    ({ flow: 'create', note: { text: text('src/a.ts  un') }, invariants: [], commits: [], steps: [], ...over }) as unknown as Parameters<typeof targetHash>[0];

  it('note : l\'empreinte de la conception ; la Forme seule changée : la même', () => {
    expect(targetHash(view(), 'note')).toBe(blobSha(noteDesign(text('src/a.ts  un'))));
    expect(targetHash(view({ note: { text: text('src/a.ts  un autre contrat') } }), 'note')).toBe(targetHash(view(), 'note'));
    expect(targetHash(view({ note: { text: text('x').replace('A', 'B') } }), 'note')).not.toBe(targetHash(view(), 'note'));
  });

  it('« file: » et « step: » sont retirés : null, même avec un relevé de validation', () => {
    const v = view({ steps: [{ id: 'forme', status: 'done', stale: { label: 'x', since: 'a', now: 'b' } }],
      validation: { validated: [], changed: [], files: { 'src/a.ts': { blob: 'b1' } } } });
    expect(targetHash(v, 'file:src/a.ts')).toBeNull();
    expect(targetHash(v, 'step:forme')).toBeNull();
  });
});

describe('targetHash : commit:<hash>', () => {
  const view = { flow: 'review', note: null, invariants: [], commits: [{ hash: 'abc123' }, { hash: 'def456' }] } as unknown as Parameters<typeof targetHash>[0];

  it('commit:<hash> d\'un commit du relevé : son hash', () => {
    expect(targetHash(view, 'commit:def456')).toBe('def456');
  });

  it('un hash absent du relevé : null, la marque refusée', () => {
    expect(targetHash(view, 'commit:zzz')).toBeNull();
  });
});

describe('la vérification de conception de la note', () => {
  const path = '/p/note.md';
  const checked: Marks = { design: { hash: path, verdict: 'ok' } };
  const done = { path, state: 'done' as const, questions: 0, clicked: 'h1' };

  it('noteClick : créateur, pas vérifiée, ok → check ; vérifiée → mark', () => {
    expect(noteClick({}, path, 'ok', 'create')).toBe('check');
    expect(noteClick({ design: { hash: '/autre.md', verdict: 'ok' } }, path, 'ok', 'create')).toBe('check');
    expect(noteClick(checked, path, 'ok', 'create')).toBe('mark');
  });

  it('noteClick : relecteur ; ko ; null (Annuler) → mark', () => {
    expect(noteClick({}, path, 'ok', 'review')).toBe('mark');
    expect(noteClick({}, path, 'ko', 'create')).toBe('mark');
    expect(noteClick({}, path, null, 'create')).toBe('mark');
  });

  it('designChecked : la marque design sur ce chemin, vrai ; sur un autre ou sans, faux', () => {
    expect(designChecked(checked, path)).toBe(true);
    expect(designChecked(checked, '/autre.md')).toBe(false);
    expect(designChecked({}, path)).toBe(false);
  });

  it('designEnd done, sans question, clicked : validée pour clicked, même si la note a changé depuis', () => {
    const marks = designEnd({}, done);
    expect(designChecked(marks, path)).toBe(true);
    expect(markState(marks, 'note', 'h1')).toBe('ok');
    expect(markState(marks, 'note', 'h2')).toBe('changed');
  });

  it('designEnd done avec une question : vérifiée, pas validée', () => {
    const marks = designEnd({}, { ...done, questions: 1 });
    expect(designChecked(marks, path)).toBe(true);
    expect(markState(marks, 'note', 'h1')).toBeNull();
  });

  it('designEnd sans clicked (Revérifier) : vérifiée, jamais validée', () => {
    const marks = designEnd({}, { ...done, clicked: null });
    expect(designChecked(marks, path)).toBe(true);
    expect(markState(marks, 'note', 'h1')).toBeNull();
  });

  it('designEnd failed ou stopped : rien de changé, le clic suivant revérifie', () => {
    for (const state of ['failed', 'stopped'] as const) {
      const marks = designEnd({}, { ...done, state });
      expect(marks).toEqual({});
      expect(noteClick(marks, path, 'ok', 'create')).toBe('check');
    }
  });

  it('rend un nouvel état, sans toucher à l\'ancien', () => {
    const before: Marks = {};
    designEnd(before, done);
    expect(before).toEqual({});
  });
});
