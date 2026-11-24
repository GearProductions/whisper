import { describe, expect, it } from 'vitest';
import {
  addComment, blobSha, caseBlocks, CHECKED, designChecked, designEnd, designState, editComment, hasComment, keepNote, markState, noteClick, noteDesign, parseNote, removeComment, setMark, stepChecks, stepContent,
  skeletonMarks, targetHash, vibeMarks, vibeView, withdraw, withdrawn, type Drafts, type FileBlobs, type JourneyInput, type Marks,
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

describe('vibeMarks : les validations du système des étapes faites', () => {
  const NOTE = ['# G2-1 — Un bouton', '', '## Ce que ça fait', 'Un bouton.', '', '## Ce que ça ne doit pas faire',
    '- Lire un autre fichier. → invariant', '', '## Forme', '```', 'src/core/hello.ts    hello()', '```', ''].join('\n');
  const NOTE_PATH = 'docs/tickets/feat/G2-1-bouton.md';
  const TEST_PATH = 'src/core/tests/invariants/hello.test.ts';
  const TEST = 'it("dit bonjour", () => {});\nit("ne lit rien", () => {});\n';
  const BLOB = blobSha(TEST);
  const blobs: FileBlobs[] = [{ path: TEST_PATH, disk: BLOB, head: null }, { path: 'src/core/hello.ts', disk: blobSha('code'), head: null }];
  const input = (over: Partial<JourneyInput> = {}): JourneyInput => ({
    agentId: 'a1', lang: 'fr', flow: 'create', pr: null, autonomy: 'guide', vibe: true, agent: { model: 'opus', effort: 'high', mode: 'default' },
    busy: false, running: [], runs: [], error: null, readings: [],
    outputs: { 'align.md': { text: 'Aligné.', time: 1700000000000 } }, marks: {}, draft: [], actions: [],
    who: {}, model: {}, skills: [], exists: () => false, now: 1700000000000,
    note: { path: NOTE_PATH, text: NOTE, before: null }, tests: [{ path: TEST_PATH, blob: BLOB, text: TEST }],
    repo: { branch: 'feat/G2-1-bouton', base: 'origin/main', changed: [NOTE_PATH, TEST_PATH],
      commits: [{ hash: 'a'.repeat(40), subject: 'Note, forme, invariants', files: [NOTE_PATH, TEST_PATH] }] },
    ...over,
  });
  const CASES = [`case:${TEST_PATH}:dit bonjour`, `case:${TEST_PATH}:ne lit rien`];
  // Les empreintes de chaque cas et du code commun (hashes de chaque test du relevé) : celles de caseBlocks du texte.
  const hashed = (view: ReturnType<typeof vibeView>) => ({
    ...view, invariants: view.invariants.map((f) => {
      const { blocks, common } = caseBlocks(TEST);
      return { ...f, hashes: { blocks, common } };
    }),
  });
  // La note, validée par l'utilisateur (jamais par le système) pour sa conception d'aujourd'hui : le point de départ de chaque cas.
  const NOTE_OK: Marks = { note: { hash: blobSha(noteDesign(NOTE)), verdict: 'ok' } };
  const run = (given: Marks = {}, over: Partial<JourneyInput> = {}) => {
    const marks = { ...NOTE_OK, ...given };
    const view = hashed(vibeView(input({ marks, ...over })));
    return { view, next: vibeMarks(marks, view, blobs) };
  };
  // Chaque étape donnée pour faite, la note comprise, sans que la note ait son ✓ : ce que vibeMarks reçoit de plus favorable.
  const allDone = (marks: Marks, vibe: boolean) => {
    const view = hashed(vibeView(input({ marks, vibe })));
    return { ...view, steps: view.steps.map((s) => ({ ...s, status: 'done' as const })) };
  };
  const { blocks: BLOCKS, common: COMMON } = caseBlocks(TEST);
  const MARK = (i: number) => ({ hash: BLOCKS[i], verdict: 'ok', common: COMMON });
  // L'état de chaque étape d'après les marques, comme le contrôleur le calcule.
  const checks = (view: ReturnType<typeof vibeView>, marks: Marks) =>
    stepChecks(marks, Object.fromEntries(CHECKED.map((s) => [s, stepContent(view, marks, s, blobs)])));
  const status = (marks: Marks) => Object.fromEntries(vibeView(input({ vibe: false, marks, blobs })).steps.map((s) => [s.id, s.status]));

  it('forme, invariants : chaque étape validée par le système pour son contenu, et chaque cas son ✓ (les empreintes d\'un clic)', () => {
    const { next } = run();
    expect(next.note).toBe(NOTE_OK.note);
    expect(next.forme).toMatchObject({ by: 'system' });
    expect(next.invariants).toMatchObject({ by: 'system' });
    expect(next.forme).toMatchObject({ hash: blobSha(parseNote(NOTE).forme), verdict: 'ok' });
    expect(next.invariants).toMatchObject({ verdict: 'ok' });
    CASES.forEach((c, i) => expect(next[c]).toEqual(MARK(i)));
  });

  it('chaque cas : son ✓ pour son bloc et le code commun, pas pour le fichier entier', () => {
    const { next } = run();
    expect(BLOCKS[0]).not.toBe(BLOCKS[1]);
    expect(next[CASES[0]].hash).toBe(BLOCKS[0]);
    expect(next[CASES[1]].hash).toBe(BLOCKS[1]);
    CASES.forEach((c) => expect(next[c].common).toBe(COMMON));
  });

  it('un ✓ donné pour un bloc changé depuis est remplacé ; celui d\'un bloc inchangé reste', () => {
    const marks: Marks = { [CASES[0]]: { hash: 'vieux', verdict: 'ok', common: COMMON }, [CASES[1]]: MARK(1) as Marks[string] };
    const { next } = run(marks);
    expect(next[CASES[0]]).toEqual(MARK(0));
    expect(next[CASES[1]]).toBe(marks[CASES[1]]);
  });

  it('un ✓ dont seul le code commun a changé, ou d\'avant la 0.15.0 (sans common), est remplacé', () => {
    const marks: Marks = { [CASES[0]]: { hash: BLOCKS[0], verdict: 'ok', common: 'vieux' }, [CASES[1]]: { hash: BLOCKS[1], verdict: 'ok' } };
    const { next } = run(marks);
    CASES.forEach((c, i) => expect(next[c]).toEqual(MARK(i)));
  });

  it('un ✗ donné pour un bloc changé depuis est remplacé par le ✓', () => {
    const { next } = run({ [CASES[0]]: { hash: 'vieux', verdict: 'ko', common: COMMON } });
    expect(next[CASES[0]]).toEqual(MARK(0));
  });

  it('un titre en double : deux marques, « titre » et « titre n° 2 », chacune pour son bloc', () => {
    const text = 'it("a", () => {\n  x();\n});\nit("a", () => {\n  y();\n});\n';
    const view = vibeView(input({ marks: NOTE_OK, tests: [{ path: TEST_PATH, blob: blobSha(text), text }] }));
    const { blocks, common } = caseBlocks(text);
    const dup = { ...view, invariants: view.invariants.map((f) => ({ ...f, hashes: { blocks, common } })) };
    const next = vibeMarks(NOTE_OK, dup, blobs);
    expect(next[`case:${TEST_PATH}:a`]).toEqual({ hash: blocks[0], verdict: 'ok', common });
    expect(next[`case:${TEST_PATH}:a n° 2`]).toEqual({ hash: blocks[1], verdict: 'ok', common });
    expect(blocks[0]).not.toBe(blocks[1]);
  });

  it('un fichier sans hashes : aucun ✓ de cas, les étapes suivent leur chemin', () => {
    const view = vibeView(input({ marks: NOTE_OK }));
    const bare = { ...view, invariants: view.invariants.map(({ hashes: _, ...f }) => f) };
    const next = vibeMarks(NOTE_OK, bare, blobs);
    expect(Object.keys(next).filter((k) => k.startsWith('case:'))).toEqual([]);
    expect(next.note).toBe(NOTE_OK.note);
    expect(next.forme.verdict).toBe('ok');
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
    // Une note ✗ bloque les étapes du relevé : la vue est forcée à « faite » pour que vibeMarks seul en réponde.
    const next = vibeMarks(marks, allDone(marks, false), blobs);
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
    const marks: Marks = { [CASES[0]]: { hash: BLOCKS[0], verdict: 'ko', common: COMMON } };
    const { next } = run(marks);
    expect(next[CASES[0]]).toBe(marks[CASES[0]]);
    expect(next.invariants).toBeUndefined();
  });

  // Note 0.15.0-invariants-sans-ligne : sans test de la branche, l'étape Invariants faite par une course finie
  // (pas par un ✓ déjà là) doit recevoir sa marque 'nothing', comme un cas, puis être validée.
  const invariantsDone = { id: 'invariants', label: 'invariants', who: 'agent', state: 'done' as const, since: 4, end: 5, reply: '', permission: null };
  const noTests = { tests: [], repo: { branch: 'feat/G2-1-bouton', base: 'origin/main', changed: [NOTE_PATH],
    commits: [{ hash: 'a'.repeat(40), subject: 'Note, forme', files: [NOTE_PATH] }] } };

  it('sans test, l\'étape Invariants faite (course finie) : ✓ Rien à écrire pour le texte de la note, puis l\'étape validée', () => {
    const { view, next } = run({}, { ...noTests, runs: [invariantsDone] });
    expect(next.nothing).toEqual({ hash: blobSha(NOTE), verdict: 'ok' });
    expect(checks(view, next).invariants.state).toBe('ok');
  });

  it('sans test, l\'étape Invariants pas faite : aucune marque \'nothing\'', () => {
    const { next } = run({}, { tests: [] });
    expect(next.nothing).toBeUndefined();
  });

  it('un ✗ Rien à écrire déjà donné pour ce texte : gardé, l\'étape non validée', () => {
    const marks: Marks = { nothing: { hash: blobSha(NOTE), verdict: 'ko' } };
    const { view, next } = run(marks, { ...noTests, runs: [invariantsDone] });
    expect(next.nothing).toEqual(marks.nothing);
    expect(checks(view, next).invariants.state).not.toBe('ok');
  });

  it('un ✓ ou ✗ \'nothing\' d\'un autre texte (note changée depuis) est remplacé par le ✓ d\'aujourd\'hui', () => {
    const marks: Marks = { nothing: { hash: 'vieux-texte', verdict: 'ko' } };
    const { next } = run(marks, { ...noTests, runs: [invariantsDone] });
    expect(next.nothing).toEqual({ hash: blobSha(NOTE), verdict: 'ok' });
  });

  it('avec des tests de la branche, aucune marque \'nothing\' même si l\'étape est faite', () => {
    const { next } = run();
    expect(next.nothing).toBeUndefined();
  });

  it('une étape pas faite ne reçoit rien', () => {
    // Les invariants écrits mais pas commités : l'étape Invariants n'est pas faite.
    const { next } = run({}, { repo: { branch: 'b', base: 'origin/main', changed: [NOTE_PATH, TEST_PATH], dirty: [NOTE_PATH, TEST_PATH], commits: [] } });
    expect(Object.keys(next)).toEqual(['note', 'forme']);
  });

  it('sans les empreintes du disque (blobs omis), la Forme est validée', () => {
    const next = vibeMarks(NOTE_OK, vibeView(input({ marks: NOTE_OK })));
    expect(next.note).toBe(NOTE_OK.note);
    expect(next.forme.verdict).toBe('ok');
  });

  it('Vibe pas en cours : la Forme et les invariants faits sont validés par le système, comme pendant Vibe', () => {
    const next = vibeMarks(NOTE_OK, allDone(NOTE_OK, false), blobs);
    expect(next.forme).toMatchObject({ verdict: 'ok', by: 'system' });
    expect(next.invariants).toMatchObject({ verdict: 'ok', by: 'system' });
  });

  it('la note faite, jamais validée : aucune marque de note, Vibe en cours ou pas', () => {
    for (const vibe of [true, false]) expect(vibeMarks({}, allDone({}, vibe), blobs)).not.toHaveProperty(['note']);
  });

  it('une étape dont l\'étape d\'avant n\'est pas validée (la note sans ✓) : rien', () => {
    const next = vibeMarks({}, allDone({}, true), blobs);
    expect(next.forme).toBeUndefined();
    expect(next.invariants).toBeUndefined();
  });

  it('une étape déjà validée à la main pour ce contenu : sa marque reste, sans « système »', () => {
    const manual = run().next;
    const { forme: { by: _, ...hand } } = manual;
    const marks: Marks = { ...manual, forme: hand };
    const { next } = run(marks);
    expect(next.forme).toBe(marks.forme);
    expect(next.forme).not.toHaveProperty('by');
  });

  it('une étape validée à la main pour un autre contenu : revalidée, cette fois par le système', () => {
    const { next } = run({ forme: { hash: 'vieux', verdict: 'ok' } });
    expect(next.forme).toMatchObject({ hash: blobSha(parseNote(NOTE).forme), by: 'system' });
  });

  it('Relire : rien', () => {
    expect(vibeMarks({}, hashed(vibeView(input({ flow: 'review' }))), blobs)).toEqual({});
  });

  const FORME = blobSha(parseNote(NOTE).forme);

  it('la Forme faite, son retrait retenu pour ce contenu : pas validée par le système, les invariants faits non plus', () => {
    const marks = withdraw(NOTE_OK, 'forme', FORME);
    const { next } = run(marks);
    expect(next.forme).toBeUndefined();
    expect(next.invariants).toBeUndefined();
    expect(next['withdrawn:forme']).toBe(marks['withdrawn:forme']);
    CASES.forEach((c, i) => expect(next[c]).toEqual(MARK(i)));
  });

  it('le contenu de la Forme changé depuis le retrait : validée de nouveau par le système', () => {
    const { next } = run(withdraw(NOTE_OK, 'forme', 'vieux-contenu'));
    expect(next.forme).toMatchObject({ hash: FORME, verdict: 'ok', by: 'system' });
    expect(next.invariants).toMatchObject({ verdict: 'ok', by: 'system' });
  });

  it('le retrait des invariants : la Forme validée, les invariants non', () => {
    const { view } = run();
    const marks = withdraw(NOTE_OK, 'invariants', stepContent(view, run().next, 'invariants', blobs)!.hash);
    const { next } = run(marks);
    expect(next.forme).toMatchObject({ verdict: 'ok', by: 'system' });
    expect(next.invariants).toBeUndefined();
  });

  it('le retrait d\'une étape ne retient pas l\'autre : celui des modules ne change rien à la Forme', () => {
    const { next } = run(withdraw(NOTE_OK, 'modules', FORME));
    expect(next.forme).toMatchObject({ by: 'system' });
    expect(next.invariants).toMatchObject({ by: 'system' });
  });

  it('un retrait retenu ne défait pas une validation déjà là : rien n\'est écrit à sa place', () => {
    const validated = run().next;
    expect(vibeMarks(withdraw(validated, 'forme', FORME), run().view, blobs)).toEqual(withdraw(validated, 'forme', FORME));
  });
});

describe('withdraw, withdrawn : le retrait à la main d\'une validation d\'étape', () => {
  const MARKS: Marks = { note: { hash: 'n', verdict: 'ok' }, forme: { hash: 'f', verdict: 'ok', after: 'x', files: 'y' } };

  it('un retrait retenu pour une étape : son contenu relu des marques ; aucun retrait : rien', () => {
    expect(withdrawn(MARKS, 'forme')).toBeNull();
    const next = withdraw(MARKS, 'forme', 'abc');
    expect(withdrawn(next, 'forme')).toBe('abc');
    expect(withdrawn(next, 'invariants')).toBeNull();
    expect(withdrawn(next, 'modules')).toBeNull();
  });

  it('chaque étape garde son retrait ; un retrait retenu de nouveau remplace le précédent', () => {
    const next = withdraw(withdraw(withdraw(MARKS, 'forme', 'a'), 'invariants', 'b'), 'forme', 'c');
    expect(withdrawn(next, 'forme')).toBe('c');
    expect(withdrawn(next, 'invariants')).toBe('b');
  });

  it('les autres marques sont inchangées, l\'ancien état aussi', () => {
    const next = withdraw(MARKS, 'forme', 'abc');
    expect(next.note).toBe(MARKS.note);
    expect(next.forme).toBe(MARKS.forme);
    expect(Object.keys(MARKS)).toEqual(['note', 'forme']);
  });

  it('un retrait oublié : sa marque partie, les autres marques restent', () => {
    const next = withdraw(withdraw(MARKS, 'forme', 'abc'), 'forme', null);
    expect(next).toEqual(MARKS);
    expect(withdrawn(next, 'forme')).toBeNull();
    expect(withdraw(MARKS, 'forme', null)).toEqual(MARKS);
  });

  it('une empreinte vide n\'est pas un oubli : seul null oublie', () => {
    expect(withdrawn(withdraw(MARKS, 'forme', ''), 'forme')).toBe('');
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

describe('targetHash : case:<chemin>:<clé>', () => {
  const view = { flow: 'create', note: null, commits: [], steps: [],
    invariants: [{ path: 'a.test.ts', blob: 'b1', cases: ['x', 'x'], hashes: { blocks: ['h1', 'h2'], common: 'c' } }] } as unknown as Parameters<typeof targetHash>[0];

  it('un cas du relevé : null (ses empreintes : caseHashes), plus l\'empreinte du fichier', () => {
    expect(targetHash(view, 'case:a.test.ts:x')).toBeNull();
    expect(targetHash(view, 'case:a.test.ts:x n° 2')).toBeNull();
  });

  it('un cas inconnu : null aussi', () => {
    expect(targetHash(view, 'case:a.test.ts:y')).toBeNull();
    expect(targetHash(view, 'case:autre.test.ts:x')).toBeNull();
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

  it('noteClick : le créateur valide, vérifiée ou pas : une marque, aucune vérification', () => {
    expect(noteClick({}, path, 'ok', 'create')).toBe('mark');
    expect(noteClick({ design: { hash: '/autre.md', verdict: 'ok' } }, path, 'ok', 'create')).toBe('mark');
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

  it('designEnd done, sans question : la note pas validée, « rien trouvé » retenu pour la conception d\'où elle est partie', () => {
    const marks = designEnd({}, done);
    expect(designChecked(marks, path)).toBe(true);
    expect(marks).not.toHaveProperty(['note']);
    expect(markState(marks, 'verified', 'h1')).toBe('ok');
    expect(markState(marks, 'verified', 'h2')).toBe('changed');
  });

  it('designEnd done avec une question : vérifiée, pas validée, plus de « rien trouvé » (celui d\'avant est retiré)', () => {
    const before: Marks = { ...checked, verified: { hash: 'h0', verdict: 'ok' } };
    const marks = designEnd(before, { ...done, questions: 1 });
    expect(designChecked(marks, path)).toBe(true);
    expect(marks).not.toHaveProperty(['note']);
    expect(marks).not.toHaveProperty(['verified']);
    expect(designEnd({}, { ...done, questions: 1 })).toEqual(checked);
  });

  it('designEnd done sans question, conception de départ pas retenue (clicked null) : « rien trouvé » pour une empreinte vide, la note dite changée depuis', () => {
    const marks = designEnd({}, { ...done, clicked: null });
    expect(designChecked(marks, path)).toBe(true);
    expect(marks).not.toHaveProperty(['note']);
    expect(marks.verified.hash).toBe('');
    expect(designState(marks, path, 'h1')).toBe('edited');
  });

  it('designEnd failed ou stopped : rien ne bouge, le « rien trouvé » d\'avant et la vérification d\'avant restent', () => {
    const before: Marks = { ...checked, verified: { hash: 'h0', verdict: 'ok' } };
    for (const state of ['failed', 'stopped'] as const) {
      expect(designEnd({}, { ...done, state })).toEqual({});
      expect(designEnd(before, { ...done, state })).toBe(before);
    }
  });

  it('designEnd ne touche jamais à la marque de la note : une note validée avant la vérification garde la sienne', () => {
    const before: Marks = { note: { hash: 'h0', verdict: 'ok' } };
    for (const end of [done, { ...done, questions: 2 }, { ...done, clicked: null }, { ...done, state: 'failed' as const }]) {
      expect(designEnd(before, end).note).toBe(before.note);
    }
  });

  it('rend un nouvel état, sans toucher à l\'ancien', () => {
    const before: Marks = {};
    designEnd(before, done);
    expect(before).toEqual({});
  });

  it('designState : rien trouvé, la conception inchangée : clean', () => {
    expect(designState(designEnd({}, done), path, 'h1')).toBe('clean');
  });

  it('designState : rien trouvé, la conception changée depuis : edited', () => {
    expect(designState(designEnd({}, done), path, 'h2')).toBe('edited');
  });

  it('designState : note jamais vérifiée, ou dernière vérification d\'une autre note : null', () => {
    expect(designState({}, path, 'h1')).toBeNull();
    expect(designState(designEnd({}, done), '/autre.md', 'h1')).toBeNull();
  });

  it('designState : la dernière vérification a trouvé une question : null ; vérifiée mais sans « rien trouvé » : null', () => {
    expect(designState(designEnd(designEnd({}, done), { ...done, questions: 1 }), path, 'h1')).toBeNull();
    expect(designState(checked, path, 'h1')).toBeNull();
  });
});

describe('keepNote : la note validée puis changée', () => {
  const VALIDATED = ['## Ce que ça fait', '', 'Un bouton.', '', '## Ce que ça ne doit pas faire', '', '- Lire un autre fichier. → invariant'].join('\n');
  const ACCEPTED = 'Il se tait la nuit.';
  const WITH = VALIDATED.replace('Un bouton.\n', `Un bouton.\n\n${ACCEPTED}\n`);
  const MARKS: Marks = { note: { hash: blobSha(VALIDATED), verdict: 'ok' }, forme: { hash: 'f', verdict: 'ok' } };

  it('un texte accepté ajouté : la marque suit la nouvelle conception, les autres marques restent', () => {
    const next = keepNote(MARKS, { validated: VALIDATED, design: WITH, accepted: [ACCEPTED] });
    expect(next.note).toEqual({ hash: blobSha(WITH), verdict: 'ok' });
    expect(next.forme).toBe(MARKS.forme);
  });

  it('rend un nouvel état, sans toucher à l\'ancien', () => {
    keepNote(MARKS, { validated: VALIDATED, design: WITH, accepted: [ACCEPTED] });
    expect(MARKS.note.hash).toBe(blobSha(VALIDATED));
  });

  it('un autre changement : marks tel quel (« modifiée depuis »)', () => {
    const design = WITH.replace('Un bouton.', 'Deux boutons.');
    expect(keepNote(MARKS, { validated: VALIDATED, design, accepted: [ACCEPTED] })).toBe(MARKS);
  });

  it('la conception validée pas retenue : marks tel quel', () => {
    expect(keepNote(MARKS, { validated: null, design: WITH, accepted: [ACCEPTED] })).toBe(MARKS);
  });

  it('la note jamais validée, ou refusée : marks tel quel', () => {
    const refused: Marks = { note: { hash: blobSha(VALIDATED), verdict: 'ko' } };
    expect(keepNote({}, { validated: VALIDATED, design: WITH, accepted: [ACCEPTED] })).toEqual({});
    expect(keepNote(refused, { validated: VALIDATED, design: WITH, accepted: [ACCEPTED] })).toBe(refused);
  });

  it('la marque déjà à jour : marks tel quel', () => {
    const now = keepNote(MARKS, { validated: VALIDATED, design: WITH, accepted: [ACCEPTED] });
    expect(keepNote(now, { validated: VALIDATED, design: WITH, accepted: [ACCEPTED] })).toBe(now);
    expect(keepNote(MARKS, { validated: VALIDATED, design: VALIDATED, accepted: [] })).toBe(MARKS);
  });
});

describe('skeletonMarks : les squelettes que la Forme laisse', () => {
  const blobs = (o: Record<string, string | null>): FileBlobs[] => Object.entries(o).map(([path, disk]) => ({ path, disk, head: null }));
  it('un fichier nouveau ou encore squelette au départ : sa marque prend l\'empreinte laissée ; déjà généré au départ : gardée', () => {
    const marks: Marks = { 'skel:a.ts': { hash: 's1', verdict: 'ok' }, 'skel:g.ts': { hash: 's2', verdict: 'ok' } };
    const before = new Map<string, string | null>([['a.ts', 's1'], ['g.ts', 'gen'], ['n.ts', null]]);
    const next = skeletonMarks(marks, ['a.ts', 'g.ts', 'n.ts', 'x.ts'], blobs({ 'a.ts': 's1b', 'g.ts': 'gen2', 'n.ts': 'n1', 'x.ts': null }), before);
    expect(next['skel:a.ts'].hash).toBe('s1b');
    expect(next['skel:g.ts'].hash).toBe('s2');
    expect(next['skel:n.ts'].hash).toBe('n1');
    expect(next['skel:x.ts']).toBeUndefined();
  });
  it('sans départ connu : seul un fichier sans marque en reçoit une ; rien de changé : marks tel quel', () => {
    const marks: Marks = { 'skel:a.ts': { hash: 's1', verdict: 'ok' } };
    const next = skeletonMarks(marks, ['a.ts', 'n.ts'], blobs({ 'a.ts': 'other', 'n.ts': 'n1' }), null);
    expect([next['skel:a.ts'].hash, next['skel:n.ts'].hash]).toEqual(['s1', 'n1']);
    expect(skeletonMarks(marks, ['a.ts'], blobs({ 'a.ts': 's1' }), null)).toBe(marks);
  });
});
