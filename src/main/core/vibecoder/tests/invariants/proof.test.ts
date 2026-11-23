// Invariant de la preuve des invariants par mutation (note 0.16.0, docs/tickets/feat/0.16.0-controle-en-trois-points.md,
// « Ce que ça ne doit pas faire ») :
//   - I-66 « Accepter en silence un invariant non prouvé : il remonte à l'utilisateur, en express aussi ».
// Une ligne « → invariant » de la note n'est prouvée que par une rubrique [prouvé] à son nom dans preuve.md : une
// rubrique [toi], une étiquette inconnue, une rubrique absente ou pas de preuve.md ne font jamais passer la preuve, et
// l'étape Modules reste pas faite, en express et pendant Vibe compris ; la ligne non prouvée reste dans le relevé.
// Les refus de la CLI (step.validate) : app/controllers/tests/invariants/proof-gate.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur les fonctions pures : proofOf (l'état de la preuve pour les lignes de la note) et vibeView, appelée sur un relevé
// où chaque module est commité ; seuls preuve.md, le rythme et le mode Vibe changent.
import { describe, expect, it } from 'vitest';
import { blobSha, noteDesign, parseNote, proofOf, vibeView, type ActionDef, type JourneyInput, type Marks } from 'core/vibecoder';

// Les actions du brief, en français.
const A = (id: string, flow: ActionDef['flow'], step: ActionDef['step'], text: string, needs: ActionDef['needs'] = 'none'): ActionDef =>
  ({ id, flow, step, kind: 'send', needs, label: id, hint: '', text });
const ACTIONS: ActionDef[] = [
  A('note', 'create', 'note', '/vibecoder:note {{lang}} {{out}} {{text}}', 'text'),
  A('forme', 'create', 'forme', '/vibecoder:forme {{lang}} {{out}} {{text}}'),
  A('invariants', 'create', 'invariants', '/vibecoder:invariants {{lang}} {{out}} {{text}}'),
  A('align', 'both', 'invariants', '/vibecoder:aligner {{lang}} {{out}} {{ref}}'),
  A('commit-prepare', 'create', 'modules', '/vibecoder:commit-preparer {{lang}} {{out}}'),
  A('commit', 'create', 'modules', '/vibecoder:commit {{lang}} {{out}}'),
  A('modules', 'create', 'modules', '/vibecoder:modules {{lang}} {{out}}'),
  { ...A('prove', 'create', 'modules', '/vibecoder:prouver {{lang}} {{out}} note={{note}}'), reads: true },
  A('commit-modules', 'create', 'modules', '/vibecoder:commiter-modules {{lang}} {{out}}'),
  { ...A('checks', 'create', 'revue', '/vibecoder:verifier {{lang}} {{out}} {{prefix}}'), reads: true },
  { ...A('ponytail', 'create', 'revue', '/vibecoder:ponytail {{lang}} {{out}}'), reads: true },
  A('pr', 'create', 'pr', '/vibecoder:pr {{lang}} {{out}}'),
  A('vibe', 'create', null, '/vibecoder:vibe {{lang}} {{out}}'),
];

// La note du ticket, validée, avec une ligne « → invariant » ; son test d'invariant, son cas validé ; chaque module commité.
const NOTE_PATH = 'docs/tickets/feat/G2-1-bouton.md';
const NOTE = ['# G2-1 — Un bouton', '', '## Ce que ça fait', 'Un bouton qui dit bonjour.', '',
  '## Ce que ça ne doit pas faire', '- Lire un autre fichier. → invariant', '',
  '## Forme', '```', 'src/core/hello.ts    hello() · ne connaît pas : le DOM', '```', ''].join('\n');
// La ligne « → invariant » de la note, telle que la note la donne.
const LINE = parseNote(NOTE).mustNot[0].text;
// Une seconde ligne « → invariant », pour une note qui en a deux.
const LINE_2 = 'Écrire hors du dossier. → invariant';
const TEST_PATH = 'src/core/tests/invariants/hello.test.ts';
const TEST = 'it("ne lit rien d\'autre", () => {});\n';
const BLOB = blobSha(TEST);
const ok = (text: string) => ({ hash: blobSha(text), verdict: 'ok' as const });
const MARKS: Marks = {
  note: ok(noteDesign(NOTE)), forme: ok(parseNote(NOTE).forme),
  [`case:${TEST_PATH}:ne lit rien d'autre`]: { hash: BLOB, verdict: 'ok' },
};
const commit = (hash: string, subject: string, files: string[]) => ({ hash: hash.repeat(40).slice(0, 40), subject, files });
const COMMITS = [commit('a', 'Note, forme, invariants', [NOTE_PATH, TEST_PATH]), commit('b', 'Les modules', ['src/core/hello.ts'])];
const NOW = 1_700_000_000_000;

// preuve.md : la ligne prouvée par un mutant ; la ligne pour l'utilisateur ; sous une étiquette que personne n'écrit ;
// une rubrique prouvée pour une ligne qui n'est pas dans la note.
const PROVED = `## [prouvé] ${LINE}\n\nMutant : hello() lit /etc/passwd ; le test échoue sur son assertion.\n`;
const TOI = `## [toi] ${LINE}\n\nLe test reste vert sur chaque mutant essayé.\n`;
const UNKNOWN = `## [vert] ${LINE}\n\nLe test passe.\n`;
const OTHER_LINE = '## [prouvé] Une ligne qui n’est pas dans la note.\n\nMutant : un autre.\n';
const out = (text: string) => ({ 'preuve.md': { text, time: NOW - 60_000 } });

const input = (over: Partial<JourneyInput> = {}): JourneyInput => ({
  agentId: 'a1', lang: 'fr', flow: 'create', pr: null, agent: { model: 'opus', effort: 'high', mode: 'default' },
  busy: false, running: [], runs: [],
  repo: { branch: 'feat/G2-1-bouton', base: 'origin/main', changed: [NOTE_PATH, TEST_PATH, 'src/core/hello.ts'], commits: COMMITS },
  error: null, note: { path: NOTE_PATH, text: NOTE, before: null }, tests: [{ path: TEST_PATH, blob: BLOB, text: TEST }],
  readings: {}, outputs: {}, marks: MARKS, draft: [], actions: ACTIONS,
  who: {}, model: {}, skills: [], exists: () => false, now: NOW, ...over,
});
// L'étape Modules du relevé.
const modulesStep = (v: ReturnType<typeof vibeView>) => v.steps.find((s) => s.id === 'modules')!;

describe('I-66 : une ligne « → invariant » ne passe que prouvée par sa rubrique [prouvé]', () => {
  it('la ligne de la note en [toi] : la preuve ne passe pas', () => {
    const proved = proofOf(PROVED, [LINE]);

    const blocked = proofOf(TOI, [LINE]);

    // témoin : la même ligne prouvée passe
    expect(proved.state).toBe('ok');
    // la ligne pour l'utilisateur ne passe pas
    expect(blocked.state).not.toBe('ok');
  });

  // Une étiquette que le skill n'écrit pas (ni [prouvé], ni [proved], ni [toi]).
  it('la rubrique de la ligne sous une étiquette inconnue : la preuve ne passe pas', () => {
    const proved = proofOf(PROVED, [LINE]);

    const unknown = proofOf(UNKNOWN, [LINE]);

    // témoin : la même ligne prouvée passe
    expect(proved.state).toBe('ok');
    // une étiquette inconnue ne vaut pas une preuve
    expect(unknown.state).not.toBe('ok');
  });

  // Deux lignes dans la note, une seule rubrique.
  it('une ligne de la note sans rubrique, l’autre prouvée : la preuve ne passe pas', () => {
    const one = proofOf(PROVED, [LINE]);

    const two = proofOf(PROVED, [LINE, LINE_2]);

    // témoin : la ligne prouvée seule passe
    expect(one.state).toBe('ok');
    // la ligne sans rubrique empêche la preuve de passer
    expect(two.state).not.toBe('ok');
  });

  it('une rubrique [prouvé] pour une ligne qui n’est pas dans la note : la ligne de la note n’est pas prouvée', () => {
    const proved = proofOf(PROVED, [LINE]);

    const other = proofOf(OTHER_LINE, [LINE]);

    // témoin : la ligne de la note prouvée passe
    expect(proved.state).toBe('ok');
    // une preuve d'une autre ligne ne vaut pas pour celle de la note
    expect(other.state).not.toBe('ok');
  });

  it('pas de preuve.md, une ligne dans la note : la preuve ne passe pas', () => {
    const proved = proofOf(PROVED, [LINE]);

    const none = proofOf(null, [LINE]);

    // témoin : le fichier là, la ligne prouvée passe
    expect(proved.state).toBe('ok');
    // sans fichier, rien n'est prouvé
    expect(none.state).not.toBe('ok');
  });

  it('la ligne en [toi] reste dans la preuve, non prouvée : elle remonte', () => {
    const blocked = proofOf(TOI, [LINE]);

    // la ligne de la note est parmi celles qui ne sont pas prouvées
    expect(blocked.lines.filter((l) => !l.proved).map((l) => l.line)).toContain(LINE);
  });
});

describe('I-66 : en express et pendant Vibe, l’étape Modules n’est pas faite sans preuve qui passe', () => {
  it('en express, Vibe en cours, la preuve en [toi] : l’étape Modules n’est pas faite', () => {
    const proved = vibeView(input({ vibe: true, express: true, outputs: out(PROVED) }));

    const blocked = vibeView(input({ vibe: true, express: true, outputs: out(TOI) }));

    // témoin : les mêmes modules, la preuve passée, l'étape est faite
    expect(modulesStep(proved).status).toBe('done');
    // la ligne pour l'utilisateur laisse l'étape pas faite
    expect(modulesStep(blocked).status).not.toBe('done');
  });

  it('en express, Vibe en cours, pas de preuve.md : l’étape Modules n’est pas faite', () => {
    const proved = vibeView(input({ vibe: true, express: true, outputs: out(PROVED) }));

    const missing = vibeView(input({ vibe: true, express: true, outputs: {} }));

    // témoin : les mêmes modules, la preuve passée, l'étape est faite
    expect(modulesStep(proved).status).toBe('done');
    // sans preuve, l'étape n'est pas faite
    expect(modulesStep(missing).status).not.toBe('done');
  });

  // Une rubrique sous une étiquette que le skill n'écrit pas.
  it('en express, la rubrique sous une étiquette inconnue : l’étape Modules n’est pas faite', () => {
    const proved = vibeView(input({ vibe: true, express: true, outputs: out(PROVED) }));

    const unknown = vibeView(input({ vibe: true, express: true, outputs: out(UNKNOWN) }));

    // témoin : les mêmes modules, la preuve passée, l'étape est faite
    expect(modulesStep(proved).status).toBe('done');
    // une étiquette inconnue laisse l'étape pas faite
    expect(modulesStep(unknown).status).not.toBe('done');
  });

  it('en express, la preuve en [toi] : le relevé porte la ligne non prouvée', () => {
    const v = vibeView(input({ vibe: true, express: true, outputs: out(TOI) }));

    // la ligne de la note est montrée parmi celles qui ne sont pas prouvées
    expect((v.proof?.lines ?? []).filter((l) => !l.proved).map((l) => l.line)).toContain(LINE);
  });
});
