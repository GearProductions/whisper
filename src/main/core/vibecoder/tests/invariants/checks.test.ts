// Invariant des vérifications : un ancien résultat ne compte pas.
// Protégé : si un test échoue, corriger le code.
//   Note 0.9.0 (fix/0.9.0-vibecoder-pr-verifications-courses), « Ce que ça ne
//   doit pas faire » : compter un checks.json dont le time précède le départ
//   de la course de vérifications (vert affiché sans rien avoir lancé) ;
//   SPEC I-46, F-115. La garantie est dans le relevé (vibeView), pas dans le skill :
//   un tel checks.json est ignoré partout — sorties à l'écran, prochaine
//   action, étape Revue, liste de contrôle — comme s'il n'existait pas ; sans
//   course checks connue (appli relancée), il compte.
// Sur la fonction pure : vibeView, appelée sur un relevé où chaque module est
// commité (l'étape Revue) ; seuls checks.json et les courses changent.
import { describe, expect, it } from 'vitest';
import type { VibeRun, VibeView } from 'shared/bridge';
import { blobSha, parseNote, vibeView, type ActionDef, type JourneyInput, type Marks } from 'core/vibecoder';

// Les actions du brief, en français.
const A = (id: string, flow: ActionDef['flow'], step: ActionDef['step'], text: string, needs: ActionDef['needs'] = 'none',
  kind: ActionDef['kind'] = 'send'): ActionDef => ({ id, flow, step, kind, needs, label: id, hint: '', text });
const ACTIONS: ActionDef[] = [
  A('note', 'create', 'note', '/vibecoder:note {{lang}} {{out}} {{text}}', 'text'),
  A('answers', 'create', 'note', 'Réponses :\n{{answers}}'),
  A('forme', 'create', 'forme', '/vibecoder:forme {{lang}} {{out}} {{text}}'),
  A('invariants', 'create', 'invariants', '/vibecoder:invariants {{lang}} {{out}} {{text}}'),
  A('read-invariants', 'both', 'invariants', '/vibecoder:lire-invariants {{lang}} {{out}} {{ref}} {{files}}'),
  A('align', 'both', 'invariants', '/vibecoder:aligner {{lang}} {{out}} {{ref}}'),
  A('commit-prepare', 'create', 'modules', '/vibecoder:commit-preparer {{lang}} {{out}}'),
  A('commit', 'create', 'modules', '/vibecoder:commit {{lang}} {{out}}'),
  A('module', 'create', 'modules', '/vibecoder:module {{lang}} {{out}} {{module}}'),
  A('next', 'create', 'modules', '/vibecoder:suivant {{lang}} {{out}} {{module}}'),
  { ...A('checks', 'create', 'revue', '/vibecoder:verifier {{lang}} {{out}} {{prefix}}'), reads: true },
  { ...A('ponytail', 'create', 'revue', '/vibecoder:ponytail {{lang}} {{out}}'), reads: true },
  A('fixups', 'create', 'revue', '/vibecoder:fixups {{lang}} {{out}}'),
  A('pr', 'create', 'pr', '/vibecoder:pr {{lang}} {{out}}'),
  A('ci', 'create', 'pr', '/vibecoder:ci {{lang}} {{out}}'),
  A('rc', 'create', 'pr', '/vibecoder:rc {{lang}} {{out}}'),
  A('base', 'create', 'pr', '/vibecoder:base {{lang}} {{out}}'),
  A('release', 'create', 'pr', '/vibecoder:release {{lang}} {{out}}'),
  A('vibe', 'create', null, '/vibecoder:vibe {{lang}} {{out}}'),
];

// La note du ticket, validée ; son test d'invariant, lu et validé ; chaque module commité.
const NOTE_PATH = 'docs/tickets/feat/G2-1-bouton.md';
const NOTE = ['# G2-1 — Un bouton', '', '## Ce que ça fait', 'Un bouton qui dit bonjour.', '',
  '## Ce que ça ne doit pas faire', '- Lire un autre fichier. → invariant', '',
  '## Forme', '```', 'src/core/hello.ts    hello() · ne connaît pas : le DOM', '```', ''].join('\n');
const TEST_PATH = 'src/core/tests/invariants/hello.test.ts';
const TEST = 'it("ne lit rien d\'autre", () => {});\n';
const BLOB = blobSha(TEST);
const ok = (text: string) => ({ hash: blobSha(text), verdict: 'ok' as const });
const MARKS: Marks = {
  note: ok(NOTE), forme: ok(parseNote(NOTE).forme),
  [`case:${TEST_PATH}:ne lit rien d'autre`]: { hash: BLOB, verdict: 'ok' },
};
const commit = (hash: string, subject: string, files: string[]) => ({ hash: hash.repeat(40).slice(0, 40), subject, files });
const COMMITS = [commit('a', 'Note, forme, invariants', [NOTE_PATH, TEST_PATH]), commit('b', 'core/hello', ['src/core/hello.ts'])];

// Les heures (ms) : le relevé, le départ de la course checks, avant et après lui.
const NOW = 1_700_000_000_000;
const CHECKS_START = NOW - 60_000;
const BEFORE_START = CHECKS_START - 3_600_000;
const AFTER_START = CHECKS_START + 30_000;

// Un checks.json tout vert, écrit à t (son time, le champ du résultat, et l'heure du fichier).
const checksAt = (t: number) => ({ text: JSON.stringify({ items: [{ name: 'invariants', ok: true }, { name: 'tests', ok: true }], time: t }), time: t });
const PONYTAIL = { text: '- rien', time: NOW - 120_000 };
// Une course finie, partie à since.
const run = (id: string, since: number): VibeRun => (
  { id, label: id, who: 'agent', state: 'done', since, end: since + 20_000, reply: '', permission: null });

const input = (over: Partial<JourneyInput> = {}): JourneyInput => ({
  agentId: 'a1', lang: 'fr', flow: 'create', pr: null, autonomy: 'guide', agent: { model: 'opus', effort: 'high', mode: 'default' },
  busy: false, running: [], runs: [],
  repo: { branch: 'feat/G2-1-bouton', base: 'origin/main', changed: [NOTE_PATH, TEST_PATH, 'src/core/hello.ts'], commits: COMMITS },
  error: null, note: { path: NOTE_PATH, text: NOTE, before: null }, tests: [{ path: TEST_PATH, blob: BLOB, text: TEST }],
  readings: { [BLOB]: '## ne lit rien d\'autre\n' }, outputs: {}, marks: MARKS, draft: [], actions: ACTIONS,
  who: {}, model: {}, skills: [], exists: () => false, now: NOW, ...over,
});

const primary = (v: VibeView) => v.actions.find((a) => a.primary)?.id ?? null;
const revue = (v: VibeView) => v.steps.find((s) => s.id === 'revue');
const ticks = (v: VibeView) => v.checklist.map((c) => c.done);

describe('un checks.json antérieur au départ de la course checks est ignoré partout', () => {
  // La course checks est partie, n'a rien écrit : seul l'ancien checks.json est là.
  const stale = () => vibeView(input({ runs: [run('checks', CHECKS_START)], outputs: { 'checks.json': checksAt(BEFORE_START), 'ponytail.md': PONYTAIL } }));
  // Le même relevé, sans checks.json du tout.
  const none = () => vibeView(input({ runs: [run('checks', CHECKS_START)], outputs: { 'ponytail.md': PONYTAIL } }));

  it('l’écran ne montre pas l’ancien checks.json', () => {
    const v = stale();

    // il n'est pas dans les sorties du relevé
    expect(v.outputs).not.toHaveProperty(['checks.json']);
  });

  it('la prochaine action est la même que sans checks.json', () => {
    const v = stale();

    // l'ancien vert ne fait pas passer à la suite de la revue
    expect(primary(v)).toEqual(primary(none()));
  });

  it('l’étape Revue est la même que sans checks.json', () => {
    const v = stale();

    // ni son état ni ce qu'elle dit ne tiennent compte de l'ancien vert
    expect(revue(v)).toEqual(revue(none()));
  });

  it('la liste de contrôle est la même que sans checks.json', () => {
    const v = stale();

    // « Les invariants passent » n'est pas coché d'après l'ancien vert
    expect(ticks(v)).toEqual(ticks(none()));
  });

  // La course checks tourne encore : l'ancien vert n'est pas montré en attendant.
  it('pendant la course checks : ignoré', () => {
    const runs = [{ ...run('checks', CHECKS_START), state: 'running' as const, end: null }];

    const v = vibeView(input({ busy: true, running: [{ id: 'checks', reads: true }], runs, outputs: { 'checks.json': checksAt(BEFORE_START) } }));

    // antérieur au départ de la course en cours : ignoré
    expect(v.outputs).not.toHaveProperty(['checks.json']);
  });

  // Le skill a récrit l'ancien résultat tel quel : le fichier est récent, son time ne l'est pas.
  it('récrit après le départ avec son ancien time : ignoré', () => {
    const rewritten = { text: checksAt(BEFORE_START).text, time: AFTER_START };

    const v = vibeView(input({ runs: [run('checks', CHECKS_START)], outputs: { 'checks.json': rewritten } }));

    // c'est le time du résultat qui compte, pas l'heure du fichier
    expect(v.outputs).not.toHaveProperty(['checks.json']);
  });

  it('écrit entre une course checks et la suivante : ignoré, c’est la dernière qui compte', () => {
    const runs = [run('checks', BEFORE_START - 60_000), run('checks', CHECKS_START)];

    const v = vibeView(input({ runs, outputs: { 'checks.json': checksAt(BEFORE_START) } }));

    // postérieur à la première course, mais antérieur à la dernière : ignoré
    expect(v.outputs).not.toHaveProperty(['checks.json']);
  });
});

describe('un checks.json écrit depuis le départ de la course checks compte', () => {
  it('écrit après le départ : montré', () => {
    const v = vibeView(input({ runs: [run('checks', CHECKS_START)], outputs: { 'checks.json': checksAt(AFTER_START) } }));

    // il est dans les sorties du relevé
    expect(v.outputs).toHaveProperty(['checks.json']);
  });

  // Limite : « antérieur » est strict.
  it('écrit à l’instant même du départ : montré', () => {
    const v = vibeView(input({ runs: [run('checks', CHECKS_START)], outputs: { 'checks.json': checksAt(CHECKS_START) } }));

    // pas antérieur au départ : il compte
    expect(v.outputs).toHaveProperty(['checks.json']);
  });

  // Appli relancée : aucune course checks connue.
  it('sans course checks connue : montré', () => {
    const v = vibeView(input({ runs: [], outputs: { 'checks.json': checksAt(BEFORE_START) } }));

    // rien à quoi le comparer : il compte
    expect(v.outputs).toHaveProperty(['checks.json']);
  });

  // Seule la course checks fixe le départ : une autre course, partie après, ne change rien.
  it('une course ponytail partie après lui : montré', () => {
    const runs = [run('checks', BEFORE_START - 60_000), run('ponytail', CHECKS_START)];

    const v = vibeView(input({ runs, outputs: { 'checks.json': checksAt(BEFORE_START) } }));

    // postérieur à la dernière course checks : il compte
    expect(v.outputs).toHaveProperty(['checks.json']);
  });
});
