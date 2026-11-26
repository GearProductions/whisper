import { describe, expect, it } from 'vitest';
import type { VibeView } from 'shared/bridge';
import {
  blobSha, caseBlocks, caseTarget, CHECKED, EFFORT_LEVELS, noteDesign, parseNote, stepContent, stepContents, validateStep, vibeView, withdraw, type ActionDef, type JourneyInput, type Marks,
} from 'core/vibecoder';

// Les actions du brief (celles dont le parcours a besoin), en français.
const A = (id: string, flow: ActionDef['flow'], step: ActionDef['step'], text: string, needs: ActionDef['needs'] = 'none',
  kind: ActionDef['kind'] = 'send'): ActionDef => ({ id, flow, step, kind, needs, label: id, hint: '', text });
const ACTIONS: ActionDef[] = [
  A('note', 'create', 'note', '/vibecoder:note {{lang}} {{out}} {{text}}', 'text'),
  A('answers', 'create', 'note', 'Réponses :\n{{answers}}'),
  { ...A('design-check', 'create', 'note', '/vibecoder:conception {{lang}} {{out}}'), reads: true },
  A('forme', 'create', 'forme', '/vibecoder:forme {{lang}} {{out}} {{text}}'),
  A('invariants', 'create', 'invariants', '/vibecoder:invariants {{lang}} {{out}} {{text}}'),
  A('read-invariants', 'both', 'invariants', '/vibecoder:lire-invariants {{lang}} {{out}} {{ref}} {{files}}'),
  A('align', 'both', 'invariants', '/vibecoder:aligner {{lang}} {{out}} {{ref}}'),
  A('commit-prepare', 'create', 'modules', '/vibecoder:commit-preparer {{lang}} {{out}}'),
  A('commit', 'create', 'modules', '/vibecoder:commit {{lang}} {{out}}'),
  A('commit-modules', 'create', 'modules', '/vibecoder:commiter-modules {{lang}} {{out}} {{prefix}}'),
  { ...A('prove', 'create', 'modules', '/vibecoder:prouver {{lang}} {{out}} note={{note}}'), reads: true },
  { ...A('review-diff', 'create', 'modules', '/vibecoder:relire {{lang}} {{out}} base={{base}} {{commit}}'), reads: true },
  A('module', 'create', 'modules', '/vibecoder:module {{lang}} {{out}} {{module}}'),
  A('modules', 'create', 'modules', '/vibecoder:modules {{lang}} {{out}}'),
  { ...A('checks', 'create', 'revue', '/vibecoder:verifier {{lang}} {{out}}'), reads: true },
  { ...A('ponytail', 'create', 'revue', '/vibecoder:ponytail {{lang}} {{out}}'), reads: true },
  A('fixups', 'create', 'revue', '/vibecoder:fixups {{lang}} {{out}}'),
  A('pr', 'create', 'pr', '/vibecoder:pr {{lang}} {{out}}'),
  A('ci', 'create', 'pr', '/vibecoder:ci {{lang}} {{out}}'),
  A('base', 'create', 'pr', '/vibecoder:base {{lang}} {{out}}'),
  // La vue des branches (0.12.0-gestion-des-branches) : les deux parcours, sans étape.
  A('load-pr', 'both', null, '/vibecoder:charger-pr {{lang}} {{out}} {{pr}}'),
  A('pr-here', 'both', null, '/vibecoder:ici {{lang}} {{out}} {{pr}}'),
  A('pr-worktree', 'both', null, '/vibecoder:pr-worktree {{lang}} {{out}} {{pr}}'),
  A('remove-worktree', 'both', null, '/vibecoder:retirer {{lang}} {{out}}'),
  A('unload-pr', 'both', null, 'Revenir sur la branche principale : seulement par l\'appli.'),
  A('stash', 'both', null, 'Mettre de côté : seulement par l\'appli.'),
  A('new-request', 'both', null, '/vibecoder:nouvelle-demande {{lang}} {{out}} {{text}}', 'text'),
  A('new-here', 'both', null, 'Changer de branche pour une demande : seulement par l\'appli.'),
  A('new-worktree', 'both', null, 'Nouvelle demande dans un worktree : seulement par l\'appli.'),
  A('switch-branch', 'both', null, 'Aller sur la branche : seulement par l\'appli.'),
  A('pull', 'both', null, 'Pull : seulement par l\'appli.'),
  A('rebase', 'both', null, 'Rebase : seulement par l\'appli.'),
  A('push', 'both', null, 'Pousser : seulement par l\'appli.'),
  A('fetch', 'both', null, 'Actualiser : seulement par l\'appli.'),
  A('request-review', 'both', null, 'Me demander en relecture : seulement par l\'appli.'),
  A('assign-pr', 'both', null, 'S\'assigner la PR : seulement par l\'appli.'),
  A('unassign-pr', 'both', null, 'Me retirer de la PR : seulement par l\'appli.'),
  A('copy-artifact', 'both', null, 'Copier dans le projet : seulement par l\'appli.'),
  A('review-note', 'review', 'note', '/vibecoder:relire-note {{lang}} {{out}} {{pr}}'),
  A('review-commits', 'review', 'modules', '/vibecoder:relire-commits {{lang}} {{out}} {{pr}}'),
  A('screen', 'both', 'revue', '/vibecoder:ecran {{lang}} {{out}} {{ref}}'),
  A('publish', 'review', 'pr', '/vibecoder:publier-revue {{lang}} {{out}} {{pr}} {{verdict}}\n\n{{draft}}'),
  A('vibe', 'create', null, '/vibecoder:vibe {{lang}} {{out}}'),
  A('guide', 'both', null, '/gear-guide {{text}}'),
  A('comment', 'both', null, 'À propos de « {{quote}} » : ', 'none', 'prefill'),
];

// La note du ticket : une ligne → invariant, deux modules.
const NOTE_PATH = 'docs/tickets/feat/G2-1-bouton.md';
const NOTE = ['# G2-1 — Un bouton', '', '## Ce que ça fait', 'Un bouton qui dit bonjour.', '',
  '## Ce que ça ne doit pas faire', '- Lire un autre fichier. → invariant', '- Planter. → variant suffit', '',
  '## Forme', '```', 'src/core/hello.ts    hello() · ne connaît pas : le DOM', 'src/app/button.tsx   le bouton', '```', ''].join('\n');
const note = { path: NOTE_PATH, text: NOTE, before: null };
// Son test d'invariant, deux cas.
const TEST_PATH = 'src/core/tests/invariants/hello.test.ts';
const TEST = 'it("dit bonjour", () => {});\nit("ne lit rien d\'autre", () => {});\n';
const BLOB = blobSha(TEST);
const test = { path: TEST_PATH, blob: BLOB, text: TEST };
const READING = '## dit bonjour\n\n## ne lit rien d\'autre\n';
const READINGS = [{ blob: BLOB, text: READING, time: 1 }];

// Validé, pour ce contenu-là.
const ok = (text: string) => ({ hash: blobSha(text), verdict: 'ok' as const });
// La note validée pour sa conception (noteDesign), la Forme validée à sa suite (after : l'empreinte de la marque de la note).
const afterOf = (m: Marks[string]) => blobSha(`${m.hash}\n${m.after ?? ''}`);
const noteMarks = (text: string): Marks => {
  const n = ok(noteDesign(text));
  return { note: n, forme: { ...ok(parseNote(text).forme), after: afterOf(n) } };
};
const NOTE_OK: Marks = noteMarks(NOTE);
// Les validations de chaque cas d'un test (par sa clé : son bloc et le code commun du fichier, comme le geste les pose).
const casesOk = (text: string, verdict: 'ok' | 'ko' = 'ok'): Marks => {
  const { keys, blocks, common } = caseBlocks(text);
  return Object.fromEntries(keys.map((k, i) => [caseTarget(TEST_PATH, k), { hash: blocks[i], common, verdict }]));
};
const CASES_OK: Marks = casesOk(TEST);
const commit = (hash: string, subject: string, files: string[]) => ({ hash: hash.repeat(40).slice(0, 40), subject, files });
const FIRST = commit('a', 'Note, forme, invariants', [NOTE_PATH, TEST_PATH]);
const HELLO = commit('b', 'core/hello', ['src/core/hello.ts']);
const BUTTON = commit('c', 'app/button', ['src/app/button.tsx']);

// changed : les fichiers changés hors des commits, donc aussi dans dirty (git status), comme git.ts.
const repo = (changed: string[] = [], commits: ReturnType<typeof commit>[] = []) => ({
  branch: 'feat/G2-1-bouton', base: 'origin/main', changed: [...new Set([...changed, ...commits.flatMap((c) => c.files)])], commits,
  dirty: changed.filter((f) => !commits.some((c) => c.files.includes(f))),
});
const out = (text = '') => ({ text, time: 1 });
// La preuve des invariants qui passe (preuve.md) : sans elle, l'étape Modules n'est pas faite quand la note a une ligne « → invariant ».
const PROOF = { 'preuve.md': out(`## [prouvé] ${parseNote(NOTE).mustNot[0].text}\n\nMutant : un autre fichier lu ; le test échoue.\n`) };
// La dernière course : des réponses envoyées (la course arrêtée sur une question qui bloque).
const ANSWERED = [{ id: 'answers', label: 'answers', who: 'agent', state: 'done' as const, since: 2, end: 3, reply: '', permission: null }];
const input = (over: Partial<JourneyInput> = {}): JourneyInput => ({
  agentId: 'a1', lang: 'fr', flow: 'create', pr: null, autonomy: 'guide', agent: { model: 'opus', effort: 'high', mode: 'default' },
  busy: false, running: [], runs: [], repo: repo(), error: null, note: null, tests: [], readings: [], outputs: {}, marks: {}, draft: [], actions: ACTIONS,
  who: {}, model: {}, skills: [], exists: () => false, now: 1700000000000, ...over,
});
// Un état de Créer : note et forme validées, invariants écrits, lus, validés et commités.
const ready = (over: Partial<JourneyInput> = {}) => input({
  note, tests: [test], readings: READINGS, marks: { ...NOTE_OK, ...CASES_OK }, repo: repo([], [FIRST]), ...over,
});

const status = (v: VibeView) => Object.fromEntries(v.steps.map((s) => [s.id, s.status]));
const primary = (v: VibeView) => v.actions.find((a) => a.primary)?.id ?? null;
const action = (v: VibeView, id: string) => v.actions.find((a) => a.id === id);

describe('Créer, hors Vibe : les étapes et la prochaine action', () => {
  it('pas de note : la note est en cours, rien d\'autre n\'est fait', () => {
    expect(status(vibeView(input()))).toEqual({ note: 'current', forme: 'todo', invariants: 'todo', modules: 'todo', revue: 'todo', pr: 'todo' });
  });

  it('pas de note : Rédiger la note', () => {
    expect(primary(vibeView(input()))).toBe('note');
  });

  it('des questions ouvertes : Envoyer les réponses', () => {
    expect(primary(vibeView(input({ note, outputs: { 'questions.md': out('## 1. Quelle couleur ?\n- Bleu\n') } })))).toBe('answers');
  });

  it('note rédigée mais pas validée : toujours en cours, valider est un bouton de l\'étape', () => {
    const v = vibeView(input({ note }));
    expect([status(v).note, primary(v)]).toEqual(['current', null]);
  });

  it('note validée puis modifiée : à revalider', () => {
    expect(vibeView(input({ note: { ...note, text: NOTE.replace('dit bonjour.', 'dit bonjour, fort.') }, marks: NOTE_OK })).note?.mark).toBe('changed');
  });

  it('note validée, pas de Forme : Poser la forme', () => {
    const text = NOTE.slice(0, NOTE.indexOf('## Forme'));
    const v = vibeView(input({ note: { ...note, text }, marks: { note: ok(noteDesign(text)) } }));
    expect([status(v).forme, primary(v)]).toEqual(['current', 'forme']);
  });

  it('note et forme validées, pas de test : Écrire les invariants', () => {
    const v = vibeView(input({ note, marks: NOTE_OK }));
    expect([status(v).invariants, primary(v)]).toEqual(['current', 'invariants']);
  });

  // Bogue 0.11.0 : la ligne « → invariant » déjà observée par un test existant, aucun test de la branche.
  it('ligne « → invariant » sans test de la branche, Écrire les invariants finie : invariants faits, Modules en cours', () => {
    const wrote = { id: 'invariants', label: 'invariants', who: 'agent', state: 'done' as const, since: 4, end: 5, reply: '', permission: null };
    const v = vibeView(input({ note, marks: NOTE_OK, runs: [wrote], repo: repo([], [commit('a', 'Note, forme', [NOTE_PATH])]) }));
    expect([status(v).invariants, status(v).modules]).toEqual(['done', 'current']);
  });

  const run = (id: string, state: 'done' | 'failed' | 'stopped', since: number) =>
    ({ id, label: id, who: 'agent', state, since, end: since + 1, reply: '', permission: null });
  const NOTHING_OK: Marks = { ...NOTE_OK, nothing: ok(NOTE) };

  it('ligne « → invariant » sans test de la branche, Vérifier l\'alignement finie : invariants faits', () => {
    expect(status(vibeView(input({ note, marks: NOTE_OK, runs: [run('align', 'done', 4)] }))).invariants).toBe('done');
  });

  it('ligne « → invariant » sans test de la branche, la dernière course en échec ou arrêtée : pas faits', () => {
    for (const state of ['failed', 'stopped'] as const) {
      // La plus récente d'abord : une course finie plus ancienne ne compte pas.
      const v = vibeView(input({ note, marks: NOTE_OK, runs: [run('invariants', state, 6), run('align', 'done', 4)] }));
      expect(status(v).invariants).toBe('current');
    }
  });

  it('ligne « → invariant » sans test de la branche, ✓ Rien à écrire : invariants faits', () => {
    const v = vibeView(input({ note, marks: NOTHING_OK }));
    expect([v.note?.nothingMark, status(v).invariants, status(v).modules]).toEqual(['ok', 'done', 'current']);
  });

  it('Vibe, ligne « → invariant » sans test de la branche, sans course finie ni ✓ Rien à écrire : pas faits', () => {
    expect(status(vibeView(input({ note, marks: NOTE_OK, vibe: true }))).invariants).toBe('current');
  });

  it('✓ Rien à écrire puis la note changée : à revalider, pas faits', () => {
    const text = `${NOTE}\nUne ligne de plus.`;
    const v = vibeView(input({ note: { ...note, text }, marks: { note: ok(noteDesign(text)), forme: ok(parseNote(text).forme), nothing: ok(NOTE) } }));
    expect([v.note?.nothingMark, status(v).invariants]).toEqual(['changed', 'current']);
  });

  it('des tests d\'invariant de la branche pas validés : ni course finie ni ✓ Rien à écrire ne font l\'étape', () => {
    const v = vibeView(input({ note, marks: NOTHING_OK, tests: [test], readings: READINGS, runs: [run('invariants', 'done', 4)],
      repo: repo([], [FIRST]) }));
    expect(status(v).invariants).toBe('current');
  });

  it('des tests pas encore lus, rien à commiter : Lire en pseudo-code (0.16.0-ecran-essentiel)', () => {
    expect(primary(vibeView(input({ note, marks: NOTE_OK, tests: [test] })))).toBe('read-invariants');
  });

  it('des tests pas encore lus (Vibe) : Lire en pseudo-code avant Préparer le commit (0.16.0-ecran-essentiel)', () => {
    expect(primary(vibeView(input({ note, marks: NOTE_OK, tests: [test], vibe: true, repo: repo([NOTE_PATH, TEST_PATH]) })))).toBe('read-invariants');
  });

  it('lus mais pas tous validés : la pause avant le premier commit (Vibe), aucun ✓ ne se fait attendre (0.16.0)', () => {
    expect(primary(vibeView(input({ note, marks: NOTE_OK, tests: [test], readings: READINGS, repo: repo([NOTE_PATH, TEST_PATH]) }))))
      .toBe('vibe');
  });

  it('lus et validés, des fichiers pas commités : la pause avant le premier commit (Vibe) ; Préparer le commit reste proposée', () => {
    const v = vibeView(input({ note, marks: { ...NOTE_OK, ...CASES_OK }, tests: [test], readings: READINGS, repo: repo([NOTE_PATH, TEST_PATH]) }));
    expect([v.pause, primary(v), action(v, 'commit-prepare')?.hidden]).toEqual(['invariants', 'vibe', false]);
  });

  it('un commit préparé (commit.md) : Commiter, et plus de pause (le moteur a été repris)', () => {
    const v = vibeView(input({
      note, marks: { ...NOTE_OK, ...CASES_OK }, tests: [test], readings: READINGS, repo: repo([NOTE_PATH, TEST_PATH]), outputs: { 'commit.md': out('x') },
    }));
    expect([v.pause ?? null, primary(v)]).toEqual([null, 'commit']);
  });

  it('les cas pas tous validés : l\'étape des invariants reste en cours', () => {
    expect(status(vibeView(ready({ marks: NOTE_OK }))).invariants).toBe('current');
  });

  it('la note commitée puis modifiée, aucun module touché : la Forme n\'est plus faite, Préparer le commit (puis ✓ Commiter) la fait avancer, dit pourquoi', () => {
    const changed = { ...repo([], [FIRST]), dirty: [NOTE_PATH] };
    const v = vibeView(ready({ repo: changed }));
    expect([status(v).forme, primary(v)]).toEqual(['current', 'commit-prepare']);
    expect(v.steps.find((st) => st.id === 'forme')?.facts).not.toContain('note modifiée depuis son commit');   // la Forme périmée le remplace
    expect(primary(vibeView(ready({ repo: changed, outputs: { 'commit.md': out('fixup! x') } })))).toBe('commit');
    // la note revalidée d'abord : sans sa validation, la Note est l'étape en cours, sans action
    expect(status(vibeView(ready({ repo: changed, marks: CASES_OK }))).note).toBe('current');
  });

  it('modules générés, puis la note et un test d\'invariant retouchés (une passe, des harnais) : le parcours ne recule pas, Commiter les modules les range', () => {
    // la génération a touché les deux modules ; la note et le test, déjà commités, sont modifiés à côté
    const modules = ['src/core/hello.ts', 'src/app/button.tsx'];
    const v = vibeView(ready({ repo: { ...repo(modules, [FIRST]), dirty: [...modules, NOTE_PATH, TEST_PATH] }, outputs: PROOF }));
    expect([status(v).forme, status(v).invariants, status(v).modules, primary(v)]).toEqual(['done', 'done', 'current', 'commit-modules']);
    expect(v.steps.find((st) => st.id === 'forme')?.facts).not.toContain('note modifiée depuis son commit');   // plus dit : « Forme périmée » le remplace
    // un module commité, l'autre pas encore généré : on continue de générer, la note attend
    expect(primary(vibeView(ready({ repo: { ...repo([], [FIRST, HELLO]), dirty: [NOTE_PATH] }, outputs: PROOF })))).toBe('modules');
    // tous les modules commités, la note encore modifiée : l'étape Modules n'est pas faite, Préparer le commit (son fixup)
    const all = vibeView(ready({ repo: { ...repo([], [FIRST, HELLO, BUTTON]), dirty: [NOTE_PATH] }, outputs: PROOF }));
    expect([status(all).forme, status(all).modules, primary(all)]).toEqual(['done', 'current', 'commit-prepare']);
  });

  it('modules commités, puis la note et un test retouchés après leur validation (validations « changed ») : la Forme, les Invariants et les Modules le restent, la note non, Vibe attend sa validation', () => {
    // les validations portent sur l'ancien contenu : la note, sa Forme et un cas ont changé depuis
    const stale: Marks = { note: { hash: 'x', verdict: 'ok' }, forme: { hash: 'y', verdict: 'ok' },
      ...CASES_OK, [caseTarget(TEST_PATH, 'dit bonjour')]: { hash: 'z', common: 'c', verdict: 'ok' } };
    const v = vibeView(ready({ marks: stale, repo: repo([], [FIRST, HELLO, BUTTON]), outputs: PROOF }));
    expect([status(v).note, status(v).forme, status(v).invariants, status(v).modules]).toEqual(['current', 'done', 'done', 'done']);
    expect(v.actions.find((a) => a.id === 'vibe')?.disabled).toBe('Valider d\'abord la note');
    // aucun module touché : une validation « changed » ne compte pas (on revalide avant de générer)
    expect(status(vibeView(ready({ marks: stale }))).note).toBe('current');
  });

  it('modules commités, des tests d\'invariants retouchés par les modules (un harnais), aucun cas validé, hors Vibe : l\'étape Invariants est faite', () => {
    // le premier commit ne porte que la note ; le test protégé n'est modifié que par un commit de module
    const first = commit('a', 'Note, forme', [NOTE_PATH]);
    const harness = commit('d', 'core/hello et son harnais', ['src/core/hello.ts', TEST_PATH]);
    const v = vibeView(ready({ marks: NOTE_OK, repo: repo([], [first, harness, BUTTON]), outputs: PROOF }));
    expect([status(v).invariants, status(v).modules]).toEqual(['done', 'done']);
  });

  it('la note jamais commitée, modifiée : rien ne change (elle part avec le premier commit)', () => {
    const v = vibeView(ready({ repo: { ...repo([NOTE_PATH]), dirty: [NOTE_PATH] } }));
    expect(status(v).forme).toBe('done');
  });

  it('invariants validés et commités, aucun module touché : Générer les modules (la pause après les invariants est avant le premier commit)', () => {
    const v = vibeView(ready());
    expect([status(v).modules, primary(v), action(v, 'modules')?.hidden]).toEqual(['current', 'modules', false]);
  });

  it('un module généré (un à un), pas commité, un autre reste : toujours Générer les modules ; on commite à la fin', () => {
    expect(primary(vibeView(ready({ repo: repo(['src/core/hello.ts'], [FIRST]) })))).toBe('modules');
  });

  it('Préparer le commit, masqué sans rien à commiter ; Générer les modules, sans module pas touché', () => {
    const hidden = (v: VibeView) => ['commit-prepare', 'modules'].map((id) => v.actions.find((a) => a.id === id)!.hidden);
    expect(hidden(vibeView(ready()))).toEqual([true, false]);                                                       // rien de changé
    expect(hidden(vibeView(ready({ repo: repo(['src/core/hello.ts'], [FIRST]) })))).toEqual([false, false]);
    expect(hidden(vibeView(ready({ repo: repo(['src/app/button.tsx'], [FIRST, HELLO]) })))).toEqual([false, true]); // tous générés
  });

  it('le dernier module modifié, pas commité : Commiter les modules', () => {
    expect(primary(vibeView(ready({ repo: repo(['src/app/button.tsx'], [FIRST, HELLO]), outputs: PROOF })))).toBe('commit-modules');
  });

  it('les deux modules modifiés, aucun commité : Commiter les modules', () => {
    expect(primary(vibeView(ready({ repo: repo(['src/core/hello.ts', 'src/app/button.tsx'], [FIRST]), outputs: PROOF })))).toBe('commit-modules');
  });

  it('uncommitted : un module aux fichiers changés hors de tout commit ; commité (pas retouché) ou pas touché, non', () => {
    const v = vibeView(ready({ repo: repo(['src/app/button.tsx'], [FIRST, HELLO]) }));
    expect(v.modules.map((m) => m.uncommitted)).toEqual([false, true]);
  });

  it('git de chaque fichier, comme VS Code : nouveau (added), modifié (dirty), rien une fois commité ; aussi dans view.files', () => {
    const v = vibeView(ready({
      repo: { ...repo(['src/app/button.tsx'], [FIRST, HELLO]), dirty: ['src/app/button.tsx'], added: ['src/app/button.tsx'] }, exists: () => true,
    }));
    expect(v.modules.map((m) => m.files?.map((f) => f.git ?? null))).toEqual([[null], ['new']]);
    const w = vibeView(ready({ repo: { ...repo([], [FIRST, HELLO]), dirty: ['src/core/hello.ts'] }, exists: () => true }));
    expect(w.modules[0].files?.[0].git).toBe('modified');
    expect(w.files?.find((f) => f.path === 'src/core/hello.ts')?.git).toBe('modified');
    expect(w.files?.find((f) => f.path === NOTE_PATH)?.git).toBeUndefined();
  });

  it('uncommitted : un module commité puis retouché (dirty), oui', () => {
    const v = vibeView(ready({ repo: { ...repo([], [FIRST, HELLO]), dirty: ['src/core/hello.ts'] } }));
    expect(v.modules.map((m) => m.uncommitted)).toEqual([true, false]);
  });

  it('chaque module commité : la revue, d\'abord les vérifications', () => {
    const v = vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs: PROOF }));
    expect([status(v).modules, status(v).revue, primary(v)]).toEqual(['done', 'current', 'vibe']);   // la pause après les modules (0.16.0)
  });

  it('vérifications passées sans ponytail review : relancer les vérifications (elles la demandent)', () => {
    const checks = out('{"items":[{"name":"tests","ok":true}],"time":1}');
    expect(primary(vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs: { ...PROOF, 'checks.json': checks } })))).toBe('checks');
  });

  it('ponytail review sans vérifications : Lancer les vérifications', () => {
    expect(primary(vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs: { ...PROOF, 'ponytail.md': out('- rien') } })))).toBe('checks');
  });

  it('un commit fixup! : Replier les fixups', () => {
    const outputs = { ...PROOF, 'checks.json': out('{"items":[{"name":"tests","ok":true}]}'), 'ponytail.md': out('- rien') };
    const fix = commit('d', 'fixup! core/hello', ['src/core/hello.ts']);
    expect(primary(vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON, fix]), outputs })))).toBe('fixups');
  });

  it('revue faite : ouvrir la PR', () => {
    const outputs = { ...PROOF, 'checks.json': out('{"items":[{"name":"tests","ok":true}]}'), 'ponytail.md': out('- rien') };
    const v = vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs }));
    expect([status(v).pr, primary(v)]).toEqual(['current', 'pr']);
  });

  it('PR ouverte (pr.json) : tout est fait, plus de prochaine action', () => {
    const outputs = {
      ...PROOF, 'checks.json': out('{"items":[{"name":"tests","ok":true}]}'), 'ponytail.md': out('- rien'),
      'pr.json': out('{"number":31,"url":"https://github.com/o/d/pull/31","title":"G2-1"}'),
    };
    const v = vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs }));
    expect([v.steps.every((s) => s.status === 'done'), primary(v), v.pr?.number]).toEqual([true, null, 31]);
  });
});

describe('Créer, Vibe en cours : aucune validation attendue', () => {
  it('pas de note : Rédiger la note', () => {
    expect(primary(vibeView(input({ vibe: true })))).toBe('note');
  });

  it('note rédigée avec des questions : Envoyer les réponses', () => {
    expect(primary(vibeView(input({ vibe: true, note, outputs: { 'questions.md': out('## 1. Quelle couleur ?\n') } })))).toBe('answers');
  });

  it('note rédigée sans question, forme pas faite : Poser la forme (primary suit next, plus Vibe)', () => {
    const text = NOTE.slice(0, NOTE.indexOf('## Forme'));
    expect(primary(vibeView(input({ vibe: true, note: { ...note, text }, marks: { note: ok(noteDesign(text)) } })))).toBe('forme');
  });

  it('note rédigée sans ✓, Vibe en cours : la note n\'est pas faite (seul l\'utilisateur la valide), la Forme l\'est', () => {
    const v = vibeView(input({ vibe: true, note }));
    expect([status(v).note, status(v).forme]).toEqual(['current', 'done']);
  });

  it('un test d\'invariant, ni lu ni validé, la note validée et les tests alignés : invariants faits', () => {
    const aligned = { 'align.md': out('## [agent] Un cas corrigé\n') };
    expect(status(vibeView(input({ vibe: true, note, tests: [test], marks: { note: ok(noteDesign(NOTE)) }, outputs: aligned, repo: repo([], [FIRST]) }))).invariants).toBe('done');
    // pas alignés, aucun cas validé : pas faits, Vibe ou non
    expect(status(vibeView(input({ vibe: true, note, tests: [test], marks: { note: ok(noteDesign(NOTE)) }, repo: repo([], [FIRST]) }))).invariants).toBe('current');
  });

  it('le relevé dit si Vibe est en cours ; autonomy ne compte plus, ni rendue', () => {
    expect([vibeView(input({ vibe: true })).vibe, vibeView(input()).vibe]).toEqual([true, undefined]);
    expect(status(vibeView(input({ autonomy: 'vibe', note }))).note).toBe('current');
    expect('autonomy' in vibeView(input({ autonomy: 'vibe' }))).toBe(false);
  });
});

describe('Relecteur : les étapes et la prochaine action', () => {
  const PR = '{"number":12,"title":"G2-1 — Un bouton","url":"https://github.com/o/d/pull/12","author":{"login":"kb"},"base":"main","head":"feat/G2-1","body":"…"}';
  // Chargée, le dossier sur sa tête.
  const loaded = (over: Partial<JourneyInput> = {}) => input({
    flow: 'review', pr: 12, note, tests: [test], repo: repo([], [FIRST, HELLO]), checkout: { branch: 'feat/G2-1', dirty: false }, ...over,
    outputs: { 'pr-12.json': out(PR), ...over.outputs },
  });

  it('quatre arrêts (note, invariants, revue, PR) ; aucune PR suivie, aucune action en tête', () => {
    const v = vibeView(input({ flow: 'review', repo: null }));
    expect([v.steps.map((s) => s.id), v.pr, primary(v)]).toEqual([['note', 'invariants', 'revue', 'pr'], null, null]);
  });

  it('une PR suivie, pas chargée : pas de loaded', () => {
    expect(vibeView(input({ flow: 'review', pr: 12, repo: null })).loaded).toBeNull();
  });

  it('une PR suivie, pas chargée : son numéro est dans le relevé', () => {
    expect(vibeView(input({ flow: 'review', pr: 12, repo: null })).pr?.number).toBe(12);
  });

  it('chargée : sa fiche, l\'auteur par son login', () => {
    expect(vibeView(loaded()).pr).toMatchObject({ number: 12, title: 'G2-1 — Un bouton', author: 'kb', base: 'main', head: 'feat/G2-1' });
  });

  it('chargée, le dossier sur sa tête : la note en cours, aucune action en tête (Relire la note reste à portée)', () => {
    const v = vibeView(loaded());
    expect([status(v).note, primary(v), action(v, 'review-note')?.disabled]).toEqual(['current', null, null]);
  });

  it('la note refusée : un verdict suffit, l\'étape est faite', () => {
    expect(status(vibeView(loaded({ marks: { note: { hash: blobSha(noteDesign(NOTE)), verdict: 'ko' } } }))).note).toBe('done');
  });

  it('note jugée, cas pas jugés : l\'étape attend leurs verdicts, sans action', () => {
    const v = vibeView(loaded({ marks: { note: ok(noteDesign(NOTE)) } }));
    expect([status(v).invariants, primary(v)]).toEqual(['current', null]);
  });

  it('tests pas lus, chaque cas jugé : l\'étape Invariants est faite', () => {
    expect(status(vibeView(loaded({ marks: { note: ok(noteDesign(NOTE)), ...CASES_OK } }))).invariants).toBe('done');
  });

  it('tests lus et jugés : la Revue en cours, aucune action en tête', () => {
    const v = vibeView(loaded({ marks: { note: ok(noteDesign(NOTE)), ...CASES_OK }, readings: READINGS }));
    expect([status(v).revue, primary(v)]).toEqual(['current', null]);
  });

  it('les commits relus (pr-<n>-commits.md) ne font plus une étape : la Revue attend le plan à l\'écran', () => {
    const outputs = { 'pr-12-commits.md': out('## abc x') };
    const v = vibeView(loaded({ marks: { note: ok(noteDesign(NOTE)), ...CASES_OK }, readings: READINGS, outputs }));
    expect([status(v).revue, primary(v), v.steps.map((s) => s.id)]).toEqual(['current', null, ['note', 'invariants', 'revue', 'pr']]);
  });

  it('un plan de test pas tout coché : la Revue reste en cours, sans action', () => {
    const outputs = { 'pr-12-commits.md': out('## abc x'), 'ecran.md': out('- [ ] Ouvrir\n- [x] Dicter\n') };
    const v = vibeView(loaded({ marks: { note: ok(noteDesign(NOTE)), ...CASES_OK }, readings: READINGS, outputs }));
    expect([status(v).revue, primary(v), v.steps[2].facts]).toEqual(['current', null, '1 / 2 cases']);
  });

  it('une case validée pour ce plan-là compte comme cochée', () => {
    const plan = '- [ ] Ouvrir\n- [x] Dicter\n';
    const v = vibeView(loaded({ marks: { 'check:0': ok(plan) }, outputs: { 'ecran.md': out(plan) } }));
    expect(v.screen?.map((c) => c.done)).toEqual([true, true]);
  });

  it('une case cochée dans le fichier, refusée pour ce plan-là : décochée', () => {
    const plan = '- [x] Ouvrir\n';
    const v = vibeView(loaded({ marks: { 'check:0': { hash: blobSha(plan), verdict: 'ko' } }, outputs: { 'ecran.md': out(plan) } }));
    expect(v.screen?.map((c) => c.done)).toEqual([false]);
  });

  it('une case validée pour un autre texte du plan : plus validée', () => {
    const v = vibeView(loaded({ marks: { 'check:0': ok('- [ ] Avant\n') }, outputs: { 'ecran.md': out('- [ ] Ouvrir\n') } }));
    expect(v.screen?.map((c) => c.done)).toEqual([false]);
  });

  it('pas de liste du § A.3 en relecteur', () => {
    expect(vibeView(loaded()).checklist).toEqual([]);
  });

  it('tout coché : la PR en cours, aucune action en tête (Publier la revue reste à portée)', () => {
    const outputs = { 'pr-12-commits.md': out('## abc x'), 'ecran.md': out('- [x] Ouvrir\n') };
    const v = vibeView(loaded({ marks: { note: ok(noteDesign(NOTE)), ...CASES_OK }, readings: READINGS, outputs }));
    expect([status(v).revue, status(v).pr, primary(v)]).toEqual(['done', 'current', null]);
  });

  it('la revue publiée (pr-<n>-review.json) : la PR est faite', () => {
    const outputs = { 'pr-12-review.json': out('{}') };
    expect(status(vibeView(loaded({ outputs }))).pr).toBe('done');
  });

  it('un plan à l\'écran sans case ne fait pas la Revue du relecteur', () => {
    expect(status(vibeView(loaded({ outputs: { 'ecran.md': out('Rien à essayer.\n') } }))).revue).not.toBe('done');
  });
});

describe('Relecteur : rien de ce qui édite, génère ou commite ; tout ce que faisait Relire reste là', () => {
  const CARD = JSON.stringify({ number: 12, head: 'feat/G2-1', author: 'kb' });
  const reviewer = (over: Partial<JourneyInput> = {}) => vibeView(input({
    flow: 'review', pr: 12, note, tests: [test], repo: repo([], [FIRST, HELLO]), checkout: { branch: 'feat/G2-1', dirty: false },
    outputs: { 'pr-12.json': out(CARD) }, ...over,
  }));
  const shown = (v: VibeView) => v.actions.filter((a) => !a.hidden).map((a) => a.id);
  const CREATE_ONLY = ['note', 'answers', 'forme', 'invariants', 'commit-prepare', 'commit', 'commit-modules', 'prove', 'review-diff', 'module', 'checks',
    'ponytail', 'fixups', 'pr', 'ci', 'base', 'vibe'];

  it('aucune action create au relevé ; rebase, push et copier dans le projet masquées', () => {
    const direct = { rebase: { running: false, last: { ok: true, line: '', detail: '', time: 5 } } };
    const v = reviewer({ direct });
    expect(v.actions.map((a) => a.id).filter((id) => CREATE_ONLY.includes(id))).toEqual([]);
    expect(['rebase', 'push', 'copy-artifact'].map((id) => action(v, id)?.hidden)).toEqual([true, true, true]);
    const c = vibeView(input({ checkout: { branch: 'feat/G2-1', dirty: false }, direct }));
    expect(['rebase', 'push', 'copy-artifact'].map((id) => action(c, id)?.hidden)).toEqual([false, false, false]);
  });

  it('juger la note et les cas, Relire la note, Vérifier l\'alignement, Lire les tests : à portée de clic', () => {
    const v = reviewer();
    expect(['review-note', 'align', 'read-invariants'].map((id) => [action(v, id)?.hidden, action(v, id)?.disabled]))
      .toEqual([[false, null], [false, null], [false, null]]);
    expect(v.note?.mark).toBeNull();
    expect(v.invariants[0].cases).toHaveLength(2);
  });

  it('les commits et leurs fichiers en lecture seule, Relire les commits', () => {
    const v = reviewer();
    expect([action(v, 'review-commits')?.hidden, v.commits.map((c) => c.files)]).toEqual([false, [FIRST.files, HELLO.files]]);
  });

  it('le plan de test à l\'écran : Plan de test à l\'écran, avec la PR chargée sur sa tête', () => {
    expect([action(reviewer(), 'screen')?.hidden, action(reviewer(), 'screen')?.disabled]).toEqual([false, null]);
    expect(action(reviewer({ outputs: {} }), 'screen')?.disabled).toBe('Charger d\'abord la PR');
  });

  it('le brouillon, le verdict, Publier la revue : montrée, grisée tant que le brouillon est vide', () => {
    expect([action(reviewer(), 'publish')?.hidden, action(reviewer(), 'publish')?.disabled]).toEqual([false, 'Le brouillon de revue est vide']);
    const v = reviewer({ draft: [{ id: 1, target: 'note', text: 'trop long' }] });
    expect([action(v, 'publish')?.disabled, v.draft]).toEqual([null, [{ id: 1, target: 'note', text: 'trop long' }]]);
  });

  it('une PR fusionnée ou fermée : plus de raison grisée, elle se relit comme une autre (une fermée ne fait plus un créateur du relevé)', () => {
    for (const state of ['MERGED', 'CLOSED']) {
      const v = reviewer({ github: { state } });
      expect([v.pr?.state, action(v, 'review-note')?.disabled, action(v, 'screen')?.disabled]).toEqual([state, null, null]);
    }
  });

  it('S\'assigner la PR : montrée si ni auteur ni assigné ; Me retirer : jamais en relecteur', () => {
    const people = (assignees: string[], author = 'kb') => ({ author, assignees });
    const ids = (over: Partial<JourneyInput>) => shown(reviewer(over)).filter((id) => id === 'assign-pr' || id === 'unassign-pr');
    expect(ids({ people: people([]), login: 'moi' })).toEqual(['assign-pr']);
    expect(ids({ people: people([]), login: 'KB' })).toEqual([]);
    expect(ids({ people: people(['moi']), login: 'moi' })).toEqual([]);
    expect(ids({ people: null, login: 'moi' })).toEqual([]);
    expect(ids({ people: people([]), login: null })).toEqual([]);
    expect(ids({})).toEqual([]);
  });
});

describe('Relecteur : la revue essentielle, quatre arrêts (0.16.0)', () => {
  const PR = '{"number":12,"title":"G2-1","url":"u","author":{"login":"kb"},"base":"main","head":"feat/G2-1","body":""}';
  const HEAD = HELLO.hash;
  const loaded = (over: Partial<JourneyInput> = {}) => input({
    flow: 'review', pr: 12, note, tests: [test], repo: repo([], [FIRST, HELLO]), checkout: { branch: 'feat/G2-1', dirty: false }, ...over,
    outputs: { 'pr-12.json': out(PR), ...over.outputs },
  });
  const NOTE_J: Marks = { note: ok(noteDesign(NOTE)) };
  const PLAN = '- [x] Ouvrir\n- [x] Dicter\n';
  const shown = (v: VibeView) => v.steps.map((s) => `${s.id}:${s.status}`);
  const READ = ['review-note', 'read-invariants', 'align', 'review-commits', 'screen'];

  it('relecteur : quatre étapes, dans l\'ordre, ni Forme ni Modules ; créateur : ses six, comme avant', () => {
    expect(vibeView(loaded()).steps.map((s) => s.id)).toEqual(['note', 'invariants', 'revue', 'pr']);
    expect(vibeView(input({ flow: 'review', repo: null })).steps.map((s) => s.id)).toEqual(['note', 'invariants', 'revue', 'pr']);
    expect(vibeView(input()).steps.map((s) => s.id)).toEqual(['note', 'forme', 'invariants', 'modules', 'revue', 'pr']);
  });

  it('la note jugée : la première faite ; pas jugée : en cours ; refusée : faite aussi', () => {
    expect(shown(vibeView(loaded()))[0]).toBe('note:current');
    expect(shown(vibeView(loaded({ marks: NOTE_J })))[0]).toBe('note:done');
    expect(shown(vibeView(loaded({ marks: { note: { hash: blobSha(noteDesign(NOTE)), verdict: 'ko' } } })))[0]).toBe('note:done');
  });

  it('chaque test jugé : les invariants faits ; un test sans verdict : non', () => {
    expect(shown(vibeView(loaded({ marks: { ...NOTE_J, ...CASES_OK } })))).toEqual(['note:done', 'invariants:done', 'revue:current', 'pr:todo']);
    const [first] = Object.keys(CASES_OK);
    expect(shown(vibeView(loaded({ marks: { ...NOTE_J, [first]: CASES_OK[first] } })))[1]).toBe('invariants:current');
  });

  it('le plan écrit, chaque case cochée : la revue faite ; pas de plan, ou une case pas cochée : non', () => {
    const at = (plan: string | null) => shown(vibeView(loaded({ marks: { ...NOTE_J, ...CASES_OK }, outputs: plan === null ? {} : { 'ecran.md': out(plan) } })))[2];
    expect([at(PLAN), at(null), at('- [x] Ouvrir\n- [ ] Dicter\n')]).toEqual(['revue:done', 'revue:current', 'revue:current']);
  });

  it('la revue publiée : la PR faite', () => {
    expect(shown(vibeView(loaded({ outputs: { 'pr-12-review.json': out('{}') } })))[3]).toBe('pr:done');
    expect(shown(vibeView(loaded()))[3]).toBe('pr:todo');
  });

  it('le dossier ailleurs que sur la tête de la PR : aucune étape faite', () => {
    const v = vibeView(loaded({
      checkout: { branch: 'autre', dirty: false }, marks: { ...NOTE_J, ...CASES_OK },
      outputs: { 'ecran.md': out(PLAN), 'pr-12-review.json': out('{}') },
    }));
    expect(shown(v)).toEqual(['note:current', 'invariants:todo', 'revue:todo', 'pr:todo']);
  });

  it('aucune action mise en avant, à aucun arrêt', () => {
    const states: Partial<JourneyInput>[] = [
      {}, { marks: NOTE_J }, { marks: { ...NOTE_J, ...CASES_OK } },
      { marks: { ...NOTE_J, ...CASES_OK }, outputs: { 'pr-12-note.md': out('x'), 'pr-12-commits.md': out('x') } },
      { marks: { ...NOTE_J, ...CASES_OK }, outputs: { 'ecran.md': out(PLAN) } },
      { marks: { ...NOTE_J, ...CASES_OK }, outputs: { 'ecran.md': out(PLAN), 'pr-12-review.json': out('{}') } },
    ];
    for (const over of states) expect(vibeView(loaded(over)).actions.filter((a) => a.primary).map((a) => a.id)).toEqual([]);
  });

  it('une PR chargée, rien de lu : les cinq lectures à lancer', () => {
    expect(vibeView(loaded()).prepare).toEqual(READ);
  });

  it('une lecture en file ou en cours n\'est pas à lancer ; une lue sur la tête d\'aujourd\'hui, sortie présente, non plus', () => {
    expect(vibeView(loaded({ queued: ['align'] })).prepare).toEqual(READ.filter((a) => a !== 'align'));
    expect(vibeView(loaded({ runs: [{ id: 'screen', label: '', who: 'agent', state: 'running', since: 1, end: null }] as JourneyInput['runs'] })).prepare)
      .not.toContain('screen');
    const read = vibeView(loaded({ marks: { 'read:12:screen': { hash: HEAD, verdict: 'ok' } }, outputs: { 'ecran.md': out(PLAN) } })).prepare;
    expect(read).not.toContain('screen');
    const stale = vibeView(loaded({ marks: { 'read:12:screen': { hash: 'autre', verdict: 'ok' } }, outputs: { 'ecran.md': out(PLAN) } })).prepare;
    expect(stale).toContain('screen');
  });

  it('les tests lus : read-invariants n\'est plus à lancer', () => {
    expect(vibeView(loaded({ readings: READINGS })).prepare).not.toContain('read-invariants');
  });

  it('la PR pas chargée, ou le dossier ailleurs : aucune lecture à lancer', () => {
    expect(vibeView(input({ flow: 'review', pr: 12, repo: null })).prepare).toEqual([]);
    expect(vibeView(input({ flow: 'review' })).prepare).toEqual([]);
    expect(vibeView(loaded({ checkout: { branch: 'autre', dirty: false } })).prepare).toEqual([]);
  });

  it('créateur : pas de lectures à lancer au relevé', () => {
    expect('prepare' in vibeView(ready())).toBe(false);
  });

  describe('changedFromBase : un test d\'avant la branche que la PR a modifié', () => {
    const BASE = 'it("dit bonjour", () => {});\nit("ne lit rien d\'autre", () => { return 1; });\n';
    const changed = (base: string | null | undefined, flow: 'review' | 'create' = 'review') =>
      vibeView(loaded({ flow, tests: [{ ...test, base }] })).invariants[0].changedFromBase;

    it('un cas dont le bloc a changé : dit sur lui, pas sur les autres cas du fichier', () => {
      expect(changed(BASE)).toEqual(['ne lit rien d\'autre']);
    });

    it('le texte à la base identique : rien', () => {
      expect(changed(TEST)).toBeUndefined();
    });

    it('le code commun du fichier a changé (setup, helper) : tous les cas d\'avant la branche', () => {
      expect(changed(`const x = 1;\n${TEST}`)).toEqual(['dit bonjour', 'ne lit rien d\'autre']);
      expect(changed(`const x = 1;\nit("dit bonjour", () => {});\n`)).toEqual(['dit bonjour']);
    });

    it('un fichier ajouté par la branche (base null), une base inconnue : rien', () => {
      expect(changed(null)).toBeUndefined();
      expect(changed(undefined)).toBeUndefined();
    });

    it('un cas ajouté par la branche : pas dit ; un cas retiré : pas dit non plus', () => {
      expect(changed('it("dit bonjour", () => {});\n')).toBeUndefined();
      expect(changed(`${TEST}it("ancien", () => {});\n`)).toBeUndefined();
    });

    it('créateur : absent', () => {
      expect(changed(BASE, 'create')).toBeUndefined();
    });
  });

  it('une lecture en cours ne grise pas l\'alignement (sans qu\'il soit une modification)', () => {
    const v = vibeView(loaded({ running: [{ id: 'screen', reads: true }] }));
    expect(action(v, 'align')?.disabled).toBeNull();
    expect(action(v, 'screen')?.disabled).toBe('Cette action est déjà en cours');
    // créateur : l'alignement modifie les tests, une lecture en cours le grise
    expect(action(vibeView(input({ note, running: [{ id: 'screen', reads: true }] })), 'align')?.disabled).toBe('Une autre action est en cours');
  });

  it('les actions du relevé : les mêmes qu\'avant, aucune retirée', () => {
    const ids = vibeView(loaded()).actions.map((a) => a.id);
    expect(ids).toEqual(ACTIONS.filter((a) => a.flow !== 'create' && a.id !== 'guide').map((a) => a.id));
    expect(ids).toEqual(expect.arrayContaining(READ));
  });
});

describe('Créateur : Me retirer de la PR, et le plan à l\'écran dans la Revue', () => {
  it('Me retirer de la PR : montrée au créateur assigné (pas l\'auteur) ; S\'assigner la PR : jamais en créateur', () => {
    const ids = (people: { author: string; assignees: string[] } | null, login: string | null) =>
      vibeView(input({ people, login })).actions.filter((a) => !a.hidden && a.id.endsWith('assign-pr')).map((a) => a.id);
    expect(ids({ author: 'kb', assignees: ['moi'] }, 'moi')).toEqual(['unassign-pr']);
    expect(ids({ author: 'kb', assignees: ['Moi'] }, 'moi')).toEqual(['unassign-pr']);
    expect(ids({ author: 'moi', assignees: ['moi'] }, 'moi')).toEqual([]);
    expect(ids({ author: 'kb', assignees: [] }, 'moi')).toEqual([]);
    expect(ids(null, 'moi')).toEqual([]);
  });

  const done = (v: VibeView) => status(v).revue === 'done';
  const checked = { 'checks.json': out('{"items":[{"name":"tests","ok":true}]}'), 'ponytail.md': out('- rien') };
  const withPlan = (plan: string | null, marks: Marks = {}) => vibeView(ready({
    repo: repo([], [FIRST, HELLO, BUTTON]), marks: { ...NOTE_OK, ...CASES_OK, ...marks },
    outputs: { ...checked, ...(plan === null ? {} : { 'ecran.md': out(plan) }) },
  }));

  it('sans plan à l\'écran : la Revue est faite comme avant', () => {
    expect([done(withPlan(null)), withPlan(null).screen]).toEqual([true, []]);
  });

  it('un plan avec une case pas cochée : la Revue attend ; tout coché, ou validé case par case (check:<rang>) : faite', () => {
    const plan = '- [ ] Ouvrir\n- [x] Dicter\n';
    expect([done(withPlan(plan)), withPlan(plan).steps[4].facts]).toEqual([false, 'vérifications ok · ponytail faite · 1 / 2 cases']);
    expect(done(withPlan(plan, { 'check:0': ok(plan) }))).toBe(true);
    expect(done(withPlan('- [x] Ouvrir\n'))).toBe(true);
  });

  it('le plan ne remplace pas la liste du § A.3', () => {
    expect(withPlan('- [x] Ouvrir\n').checklist).toHaveLength(5);
  });
});

describe('les actions grisées, et pourquoi', () => {
  it('la conversation travaille : chaque action envoyée à la conversation est grisée', () => {
    expect(action(vibeView(input({ busy: true })), 'vibe')?.disabled).toBe('L\'agent travaille');
  });

  it('l\'agent travaille : une action qui prépare le champ reste possible', () => {
    expect(action(vibeView(input({ busy: true })), 'comment')?.disabled).toBeNull();
  });

  it('pas de note : Poser la forme est grisé', () => {
    expect(action(vibeView(input()), 'forme')?.disabled).toBe('Pas encore de note');
  });

  it('aucun test d\'invariant : Lire en pseudo-code est grisé', () => {
    expect(action(vibeView(ready({ tests: [] })), 'read-invariants')?.disabled).toBe('Aucun test d\'invariant à lire');
  });

  it('tout est lu : Lire en pseudo-code reste possible (relire)', () => {
    expect(action(vibeView(ready()), 'read-invariants')?.disabled).toBeNull();
  });

  it('pas de commit.md : Commiter est grisé', () => {
    expect(action(vibeView(ready()), 'commit')?.disabled).toBe('Préparer d\'abord le commit');
  });

  it('aucune question : Envoyer les réponses est grisé', () => {
    expect(action(vibeView(input({ note })), 'answers')?.disabled).toBe('Aucune question ouverte');
  });

  it('tous les modules touchés : Générer ce module reste possible (un module choisi se regénère)', () => {
    expect(action(vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]) })), 'module')?.disabled).toBeNull();
  });

  it('Relire, PR pas chargée : Relire la note attend le chargement', () => {
    expect(action(vibeView(input({ flow: 'review', pr: 12, repo: null })), 'review-note')?.disabled).toBe('Charger d\'abord la PR');
  });

  it('Relire, PR pas chargée : Charger la PR reste possible', () => {
    expect(action(vibeView(input({ flow: 'review', pr: 12, repo: null })), 'load-pr')?.disabled).toBeNull();
  });

  it('Relire, brouillon vide : Publier la revue est grisé', () => {
    const v = vibeView(input({ flow: 'review', pr: 12, outputs: { 'pr-12.json': out('{"head":"feat/x"}') }, checkout: { branch: 'feat/x', dirty: false } }));
    expect(action(v, 'publish')?.disabled).toBe('Le brouillon de revue est vide');
  });

  it('en anglais', () => {
    expect(action(vibeView(input({ lang: 'en', busy: true })), 'vibe')?.disabled).toBe('The agent is working');
  });
});

describe('les actions montrées', () => {
  it('seulement celles du flow choisi (et des deux)', () => {
    expect(vibeView(input({ flow: 'review' })).actions.map((a) => a.id)).not.toContain('note');
  });

  it('Où j\'en suis ? masqué sans le skill gear-guide', () => {
    expect(action(vibeView(input()), 'guide')).toBeUndefined();
  });

  it('Où j\'en suis ? montré avec le skill gear-guide', () => {
    expect(action(vibeView(input({ skills: ['gear-guide'] })), 'guide')).toBeDefined();
  });

  it('une action qui prépare le champ porte son texte', () => {
    expect(action(vibeView(input()), 'comment')?.text).toBe('À propos de « {{quote}} » : ');
  });

  it('usesText : le gabarit prend le texte du champ, même facultatif (Poser la forme), pas les autres', () => {
    const v = vibeView(input());
    expect([action(v, 'forme')?.usesText, action(v, 'checks')?.usesText, action(v, 'comment')?.usesText]).toEqual([true, false, false]);
  });

  it('une action envoyée ne livre pas son gabarit à la page', () => {
    expect(action(vibeView(input()), 'note')).not.toHaveProperty('text');
  });

  it('qui travaille : celui donné, sinon l\'agent', () => {
    const v = vibeView(input({ who: { note: 'opus · élevé' } }));
    expect([action(v, 'note')?.who, action(v, 'forme')?.who]).toEqual(['opus · élevé', 'agent']);
  });
});

describe('Créer : la liste du § A.3', () => {
  const done = (v: VibeView) => v.checklist.map((c) => c.done);

  it('ses cinq points', () => {
    expect(vibeView(input()).checklist.map((c) => c.text)).toEqual(['La note est à jour', 'Les invariants passent', 'Chaque diff a été relu',
      'Chaque module commité, aucun fixup à replier', 'AGENTS.md à jour si une convention a changé']);
  });

  it('rien de fait : rien de coché', () => {
    expect(done(vibeView(input()))).toEqual([false, false, false, false, null]);
  });

  it('des invariants par partie (« invariants (backend) », « invariants (frontend) ») tous passés : cochés', () => {
    const checks = out('{"items":[{"name":"invariants (frontend)","ok":true},{"name":"invariants (backend)","ok":true},{"name":"lint (backend)","ok":true,"level":"warning"}]}');
    expect(done(vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs: { 'checks.json': checks } })))[1]).toBe(true);
  });

  it('un des invariants par partie en échec : pas coché', () => {
    const checks = out('{"items":[{"name":"invariants (frontend)","ok":true},{"name":"invariants (backend)","ok":false}]}');
    expect(done(vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs: { 'checks.json': checks } })))[1]).toBe(false);
  });

  it('la note commitée, les invariants passés, un commit par module : cochés ; relecture et AGENTS.md restent à vérifier', () => {
    const checks = out('{"items":[{"name":"invariants","ok":true},{"name":"tests","ok":true}]}');
    expect(done(vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs: { 'checks.json': checks } })))).toEqual([true, true, false, true, null]);
  });

  it('un fixup! pas replié : « un commit par module » n\'est pas coché', () => {
    const fix = commit('d', 'fixup! core/hello', ['src/core/hello.ts']);
    expect(done(vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON, fix]) })))[3]).toBe(false);
  });

  it('moins de commits que de modules + 1 : pas coché', () => {
    expect(done(vibeView(ready({ repo: repo([], [FIRST, HELLO]) })))[3]).toBe(false);
  });

  it('AGENTS.md : à cocher à la main ; coché pour le commit de tête, décoché par un commit de plus ; la relecture, plus à la main (0.16.0)', () => {
    const marks = { ...NOTE_OK, ...CASES_OK, 'a3:4': { hash: BUTTON.hash, verdict: 'ok' as const } };
    const v = vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), marks }));
    expect(v.checklist.map((c) => [c.done, !!c.manual])).toEqual([[true, false], [false, false], [false, false], [true, false], [true, true]]);
    const fix = commit('d', 'core/hello encore', ['src/core/hello.ts']);
    expect(done(vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON, fix]), marks })))[4]).toBeNull();
  });

  it('refusée (✗) ou sans commit : pas cochée', () => {
    expect(done(vibeView(ready({ marks: { ...NOTE_OK, 'a3:4': { hash: FIRST.hash, verdict: 'ko' } } })))[4]).toBeNull();
    expect(done(vibeView(input({ marks: { 'a3:4': { hash: '', verdict: 'ok' } } })))[4]).toBeNull();
  });
});

// Les deux historiques d'un projet (note 0.16.0-flow-allege) : un seul commit pour le code de tous les modules
// suit les mêmes règles ; seul le libellé de la case de l'étape PR change.
describe('Créer : la case « Chaque module commité, aucun fixup à replier »', () => {
  const CODE = commit('d', 'Les modules', ['src/core/hello.ts', 'src/app/button.tsx']);
  const REVIEW = commit('e', 'revue : le bouton', ['src/app/button.tsx']);
  const CHECKED = { 'checks.json': out('{"items":[{"name":"tests","ok":true}]}'), 'ponytail.md': out('- rien') };

  it('le libellé, en français et en anglais', () => {
    expect([vibeView(input()).checklist[3].text, vibeView(input({ lang: 'en' })).checklist[3].text])
      .toEqual(['Chaque module commité, aucun fixup à replier', 'Every module committed, no fixup to fold']);
  });

  it('un seul commit après le premier pour tous les modules : étape Modules faite, case cochée (déjà vert)', () => {
    const v = vibeView(ready({ repo: repo([], [FIRST, CODE]), outputs: PROOF }));
    expect([status(v).modules, v.checklist[3].done]).toEqual(['done', true]);
  });

  it('le même, un fichier d\'un module modifié depuis : étape Modules pas faite (déjà vert)', () => {
    const v = vibeView(ready({ repo: { ...repo([], [FIRST, CODE]), dirty: ['src/core/hello.ts'] } }));
    expect(status(v).modules).not.toBe('done');
  });

  it('le même, un fichier hors de la Forme pas commité : Préparer le commit reste proposée (déjà vert)', () => {
    const v = vibeView(ready({ repo: { ...repo([], [FIRST, CODE]), dirty: ['scripts/outil.sh'], added: ['scripts/outil.sh'] }, outputs: PROOF }));
    expect([status(v).modules, action(v, 'commit-prepare')?.hidden]).toEqual(['done', false]);
  });

  it('des commits « revue : … » après lui, aucun fixup : étape Revue faite, Replier les fixups masquée (déjà vert)', () => {
    const v = vibeView(ready({ repo: repo([], [FIRST, CODE, REVIEW]), outputs: CHECKED }));
    expect([status(v).revue, action(v, 'fixups')?.hidden]).toEqual(['done', true]);
  });

  it('un commit par module puis un fixup : case décochée, Replier les fixups proposée', () => {
    const fix = commit('f', 'fixup! core/hello', ['src/core/hello.ts']);
    const v = vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON, fix]), outputs: { ...PROOF, ...CHECKED } }));
    expect([v.checklist[3].done, primary(v)]).toEqual([false, 'fixups']);
  });
});

describe('Créer : les vérifications et leurs avertissements (level)', () => {
  const v = (items: unknown[]) => vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs: { 'checks.json': out(JSON.stringify({ items })) } }));
  const revue = (x: VibeView) => x.steps.find((s) => s.id === 'revue')!.facts;

  it('des avertissements seulement : passées, « n avertissements » dans les faits', () => {
    expect(revue(v([{ name: 'tests', ok: true, level: 'ok' }, { name: 'lint', ok: true, level: 'warning' }]))).toBe('vérifications ok · 1 avertissement');
  });

  it('level l\'emporte sur ok : warning passe même si ok est faux, error échoue même si ok est vrai', () => {
    expect(revue(v([{ name: 'lint', ok: false, level: 'warning' }]))).toBe('vérifications ok · 1 avertissement');
    expect(revue(v([{ name: 'lint', ok: true, level: 'error' }]))).toBe('vérifications en échec');
  });

  it('ancien format, sans level : d\'après ok ; level inconnu : d\'après ok', () => {
    expect(revue(v([{ name: 'lint', ok: false }]))).toBe('vérifications en échec');
    expect(revue(v([{ name: 'lint', ok: true, level: 'bizarre' }]))).toBe('vérifications ok');
  });

  it('les invariants avec des avertissements : cochés au § A.3', () => {
    expect(v([{ name: 'invariants', ok: true, level: 'warning' }]).checklist[1].done).toBe(true);
  });
});

describe('le relevé : modules, tests, faits', () => {
  it('un module de la Forme sans src/ : trouvé sous src/, touché par les fichiers de la branche', () => {
    const text = '# x\n\n## Ce que ça fait\nx\n\n## Forme\nmain/core/x/   pur\n';
    const v = vibeView(input({ note: { ...note, text }, repo: repo([], [commit('e', 'core/x', ['src/main/core/x/a.ts'])]),
      exists: (p) => p.startsWith('src/main/core/x') }));
    expect(v.modules[0]).toEqual({ path: 'main/core/x/', paths: ['main/core/x/'], contract: 'pur', file: { id: 'm0', path: 'src/main/core/x' }, touched: true, started: true, commits: ['e'.repeat(40)],
      files: [{ id: 'm0/0', path: 'src/main/core/x/a.ts' }], locked: null, uncommitted: false });
  });

  it('un module introuvable n\'a pas de fichier', () => {
    expect(vibeView(input({ note })).modules[0].file).toBeNull();
  });

  it('un fichier de test sans cas n\'est pas montré', () => {
    expect(vibeView(input({ tests: [{ path: 'tests/invariants/main.rs', blob: 'x', text: 'mod a;' }] })).invariants).toEqual([]);
  });

  it('un variant : son nombre de cas', () => {
    const variant = { path: 'src/core/tests/variants/hello.test.ts', blob: 'v', text: 'it("a", f); it("b", f);' };
    expect(vibeView(input({ tests: [variant] })).variants).toEqual([{ id: 'v0', path: variant.path, cases: 2 }]);
  });

  it('les validations d\'un cas valent pour son bloc', () => {
    const marks: Marks = { [caseTarget(TEST_PATH, 'dit bonjour')]: { hash: 'autre', common: 'c', verdict: 'ok' } };
    expect(vibeView(input({ tests: [test], marks })).invariants[0].marks).toEqual({ 'dit bonjour': 'changed', 'ne lit rien d\'autre': null });
  });

  it('les faits des invariants : fichiers, cas, cas lus', () => {
    expect(vibeView(ready()).steps.find((s) => s.id === 'invariants')?.facts).toBe('1 fichier · 2 cas · 2 lus');
  });

  it('les faits des modules : commités sur le total', () => {
    expect(vibeView(ready({ repo: repo([], [FIRST, HELLO]) })).steps.find((s) => s.id === 'modules')?.facts).toBe('1 / 2 modules');
  });

  it('les commits fixup!, squash! et amend! sont marqués', () => {
    const v = vibeView(input({ repo: repo([], [FIRST, commit('d', 'squash! x', []), commit('f', 'amend! y', [])]) }));
    expect(v.commits.map((c) => c.fixup)).toEqual([false, true, true]);
  });

  it('l\'heure du relevé : celle qu\'on lui donne', () => {
    expect(vibeView(input({ now: 42 })).time).toBe(42);
  });

  it('sans dépôt : le relevé dit pourquoi', () => {
    const v = vibeView(input({ repo: null, error: 'pas un dépôt' }));
    expect([v.repo, v.error]).toEqual([null, 'pas un dépôt']);
  });
});

describe('rc.2 : modèle au choix, PR fermée, fichiers des commits', () => {
  const PR = (state: string) => JSON.stringify({ number: 12, title: 't', url: 'u', author: 'kb', base: 'main', head: 'feat/G2-1', body: '', state });
  const merged = (state = 'MERGED') => vibeView(input({
    flow: 'review', pr: 12, note, tests: [test], repo: repo([], [FIRST]), outputs: { 'pr-12.json': out(PR(state)) },
    checkout: { branch: 'feat/G2-1', dirty: false },
  }));

  it('une action dont le skill tourne en sous-contexte : les trois modèles, le conseillé', () => {
    const v = vibeView(input({ model: { checks: 'haiku' } }));
    expect([action(v, 'checks')?.models, action(v, 'checks')?.model]).toEqual([['haiku', 'sonnet', 'opus'], 'haiku']);
  });

  it('une action dans la conversation : aucun choix', () => {
    const v = vibeView(input({ model: { checks: 'haiku' } }));
    expect([action(v, 'note')?.models, action(v, 'note')?.model]).toEqual([[], null]);
  });

  it('l\'état de la PR, d\'après sa fiche ; inconnu : null', () => {
    expect([merged('OPEN').pr?.state, merged('MERGED').pr?.state, merged('draft').pr?.state]).toEqual(['OPEN', 'MERGED', null]);
  });

  it('une PR fusionnée ou fermée : les actions de relecture ne sont plus grisées pour cela', () => {
    expect([action(merged(), 'review-note')?.disabled, action(merged('CLOSED'), 'read-invariants')?.disabled]).toEqual([null, null]);
  });

  it('une PR fusionnée se charge encore (la vue des branches)', () => {
    expect(action(merged(), 'load-pr')?.disabled).toBeNull();
  });

  it('un test d\'invariant : la ligne de chaque cas, d\'après son texte', () => {
    expect(vibeView(ready()).invariants[0]).toMatchObject({ cases: ['dit bonjour', 'ne lit rien d\'autre'], lines: [1, 2], source: TEST });
  });

  it('un test d\'invariant trop long (plus de 200 000 caractères) : son texte n\'est pas montré', () => {
    const big = { ...test, text: `${TEST}//${'x'.repeat(200_000)}` };
    expect(vibeView(input({ tests: [big] })).invariants[0]).toMatchObject({ cases: ['dit bonjour', 'ne lit rien d\'autre'], source: '' });
  });

  it('le texte d\'un test à la base, passé tel quel ; null (absent à la base, ajouté par la branche) tel quel ; absent, ou plus de 200 000 caractères : inconnu (undefined)', () => {
    expect(vibeView(input({ tests: [{ ...test, base: 'avant' }] })).invariants[0].base).toBe('avant');
    expect(vibeView(input({ tests: [{ ...test, base: null }] })).invariants[0].base).toBeNull();
    expect(vibeView(input({ tests: [test] })).invariants[0].base).toBeUndefined();
    expect(vibeView(input({ tests: [{ ...test, base: 'x'.repeat(200_001) }] })).invariants[0].base).toBeUndefined();
  });

  it('chaque commit, avec ses fichiers', () => {
    expect(vibeView(ready()).commits).toEqual([{ hash: FIRST.hash, subject: FIRST.subject, fixup: false, files: [NOTE_PATH, TEST_PATH] }]);
  });
});

describe('Créer et Relire sur le même dossier : les choix de lieu (0.12.0)', () => {
  const CARD = JSON.stringify({ number: 12, head: 'feat/G2-1' });
  const MAIN = { branch: 'main', dirty: false };
  const DIRTY = { branch: 'main', dirty: true };
  const loaded = (over: Partial<JourneyInput> = {}) => vibeView(input({ flow: 'review', pr: 12, outputs: { 'pr-12.json': out(CARD) }, checkout: MAIN, ...over }));
  // Montrées : présentes dans ce parcours et pas masquées.
  const seen = (v: VibeView, ids: string[]) => ids.filter((id) => action(v, id)?.hidden === false);
  const PLACES = ['pr-here', 'pr-worktree', 'unload-pr', 'stash', 'switch-branch', 'new-here', 'new-worktree'];
  const BRANCH = ['switch-branch', 'new-here', 'new-worktree'];   // aller sur une branche, en créer une : toujours
  const RUNNING = { op: 'create' as const, running: true, last: null };

  it('Relire, la fiche chargée, le dossier propre sur la base : la charger ici ou dans un worktree, revenir ; sans fiche, les branches seules', () => {
    expect(seen(loaded(), PLACES)).toEqual(['pr-here', 'pr-worktree', 'unload-pr', ...BRANCH]);
    expect(seen(vibeView(input({ flow: 'review', pr: 12, checkout: MAIN })), PLACES)).toEqual(BRANCH);
    expect(seen(vibeView(input({ flow: 'review', checkout: MAIN })), PLACES)).toEqual(BRANCH);
  });

  it('la fiche chargée sans dépôt relevé : ses choix quand même', () => {
    expect(seen(loaded({ repo: null }), PLACES)).toEqual(['pr-here', 'pr-worktree', 'unload-pr', ...BRANCH]);
  });

  it('des modifications : en plus mettre de côté ; les changements de branche grisés, pas masqués', () => {
    const v = loaded({ checkout: DIRTY });
    expect(seen(v, PLACES)).toEqual(PLACES);
    expect(['pr-here', 'unload-pr', 'switch-branch', 'new-here', 'pr-worktree', 'stash', 'new-worktree'].map((id) => action(v, id)?.disabled))
      .toEqual(['Des modifications en cours', 'Des modifications en cours', 'Des modifications en cours', 'Des modifications en cours', null, null, null]);
    expect(action(loaded({ lang: 'en', checkout: DIRTY }), 'pr-here')?.disabled).toBe('Uncommitted changes');
  });

  it('sur la tête de la PR : plus de la charger ; revenir sur la base reste', () => {
    expect(seen(loaded({ checkout: { branch: 'feat/G2-1', dirty: true } }), PLACES)).toEqual(['unload-pr', 'stash', ...BRANCH]);
  });

  it('sur le robot d\'une PR : rien qui change sa branche (ni charger une PR), mettre de côté seulement', () => {
    const v = loaded({ child: true, checkout: DIRTY, worktree: { state: 'robot', temp: true, dir: '/w' } });
    expect(seen(v, PLACES)).toEqual(['stash']);
    expect(action(v, 'load-pr')?.hidden).toBe(true);
  });

  it('revenir sur la base : hors de la base, même sans PR suivie ; sur la base (origin/ ou pas), masqué', () => {
    const at = (branch: string) => action(vibeView(input({ flow: 'review', checkout: { branch, dirty: false } })), 'unload-pr')?.hidden;
    expect([at('feat/x'), at('main')]).toEqual([false, true]);
  });

  it('un nouveau worktree : masqué la PR déjà dans un worktree, ou sur un enfant', () => {
    expect(action(loaded({ checkout: DIRTY, worktree: { state: 'open', temp: false, dir: '/w' } }), 'pr-worktree')?.hidden).toBe(true);
    expect(action(loaded({ checkout: DIRTY, child: true }), 'pr-worktree')?.hidden).toBe(true);
  });

  it('Relire : le dossier hors de la tête de la PR suivie, ses étapes grisées (elsewhere) ; sur la tête ou le robot, non', () => {
    const away = loaded({ note, tests: [test], repo: repo([], [FIRST]) });
    expect(status(away).note).toBe('current');
    expect([action(away, 'review-note')?.disabled, action(away, 'read-invariants')?.disabled, action(away, 'load-pr')?.disabled])
      .toEqual(['Passer d\'abord sur la branche de la PR', 'Passer d\'abord sur la branche de la PR', null]);
    expect(action(loaded({ lang: 'en' }), 'review-note')?.disabled).toBe('Switch to the PR branch first');
    for (const on of [{ checkout: { branch: 'feat/G2-1', dirty: false } }, { worktree: { state: 'robot' as const, temp: true, dir: '/w' } }]) {
      const v = loaded({ note, tests: [test], repo: repo([], [FIRST]), ...on });
      expect([primary(v), action(v, 'review-note')?.disabled]).toEqual([null, null]);
    }
  });

  it('une nouvelle demande retenue : sa branche au relevé, dans les deux parcours ; les choix de branche comme sans elle', () => {
    for (const flow of ['create', 'review'] as const) {
      const v = vibeView(input({ flow, request: 'feat/G3-1', checkout: MAIN }));
      expect([v.request, seen(v, PLACES)]).toEqual([{ branch: 'feat/G3-1' }, BRANCH]);
    }
    expect(seen(vibeView(input({ request: 'feat/G3-1', checkout: DIRTY })), PLACES)).toEqual(['stash', ...BRANCH]);
    expect(action(vibeView(input({ request: 'feat/G3-1', checkout: DIRTY })), 'new-here')?.disabled).toBe('Des modifications en cours');
    expect(seen(vibeView(input({ request: 'feat/G3-1', checkout: DIRTY, child: true })), PLACES)).toEqual(['stash']);   // un worktree reste sur sa branche
  });

  it('aucune demande retenue : pas de branche au relevé ; Nouvelle demande sur la base seulement', () => {
    const v = vibeView(input({ checkout: DIRTY }));
    expect([v.request, seen(v, PLACES)]).toEqual([null, ['stash', ...BRANCH]]);
    expect(action(v, 'new-request')).toMatchObject({ hidden: false, usesText: true });
    expect(action(vibeView(input({ checkout: { branch: 'feat/G2-1-bouton', dirty: false } })), 'new-request')?.hidden).toBe(true);
    expect(action(vibeView(input({ checkout: null })), 'new-request')?.hidden).toBe(true);
  });

  it('une recette en cours : les choix de lieu et Retirer le worktree grisés, avec sa raison', () => {
    const v = loaded({ recipe: RUNNING, checkout: DIRTY, request: 'feat/G3-1' });
    const ids = [...PLACES, 'remove-worktree'];
    expect(ids.map((id) => action(v, id)?.disabled)).toEqual(ids.map(() => 'Une recette du projet est en cours'));
    expect(action(loaded({ recipe: { ...RUNNING, running: false }, checkout: DIRTY }), 'pr-worktree')?.disabled).toBeNull();
  });

  it('les choix de lieu, Retirer le worktree : directs ; pr-here, pr-worktree avec leur via, les autres par l\'appli seule', () => {
    const v = loaded();
    expect(['pr-here', 'pr-worktree'].map((id) => action(v, id)?.direct)).toEqual([{ running: false, last: null }, { running: false, last: null, elsewhere: true }]);
    expect(action(v, 'new-worktree')?.direct).toEqual({ running: false, last: null, only: true, elsewhere: true });
    for (const id of ['unload-pr', 'stash', 'new-here', 'remove-worktree', 'switch-branch', 'pull', 'rebase', 'push', 'fetch', 'request-review']) {
      expect(action(v, id)?.direct).toEqual({ running: false, last: null, only: true });
    }
    expect(action(vibeView(input()), 'new-request')?.direct).toBeUndefined();
  });

  it('leur dernier résultat suit dans le relevé', () => {
    const last = { ok: false, line: 'No base branch found for this repository: no worktree created.', detail: '', time: 1 };
    expect(action(vibeView(input({ direct: { 'new-worktree': { running: false, last } } })), 'new-worktree')?.direct?.last).toEqual(last);
  });

  it('un choix de lieu grisé quand la conversation travaille, sauf ceux qui travaillent ailleurs (ELSEWHERE) ; une directe en cours les grise tous', () => {
    const v = vibeView(input({ busy: true, request: 'feat/G3-1' }));
    expect(['new-here', 'new-worktree'].map((id) => action(v, id)?.disabled)).toEqual(['L\'agent travaille', null]);
    const d = vibeView(input({ request: 'feat/G3-1', direct: { 'new-here': { running: true, last: null } } }));
    expect(action(d, 'new-worktree')?.disabled).toBe('Une commande directe est en cours');
  });

  it('l\'effort se choisit pour une action dont le skill fixe son modèle', () => {
    const v = vibeView(input({ model: { checks: 'haiku' } }));
    expect([action(v, 'checks')?.efforts, action(v, 'note')?.efforts]).toEqual([EFFORT_LEVELS, []]);
  });

  it('Retirer le worktree, en Créer : sur un enfant, sa PR fusionnée ; revenir sur la base masqué sur un enfant', () => {
    const merged = (child: boolean) => vibeView(ready({ child, github: { pr: { number: 31, state: 'MERGED' } } }));
    expect(seen(merged(true), ['remove-worktree', 'base'])).toEqual(['remove-worktree']);
    expect(seen(merged(false), ['remove-worktree', 'base'])).toEqual(['base']);
    expect(action(vibeView(ready({ child: true, github: { pr: { number: 31, state: 'OPEN' } } })), 'remove-worktree')?.hidden).toBe(true);
  });

  it('Retirer le worktree, en Relire : sur le robot d\'une PR seulement ; l\'état du worktree passe au relevé', () => {
    const robot = loaded({ child: true, worktree: { state: 'robot', temp: true, dir: '/w' } });
    expect([action(robot, 'remove-worktree')?.hidden, action(robot, 'remove-worktree')?.disabled]).toEqual([false, null]);
    expect(robot.worktree).toEqual({ state: 'robot', temp: true, dir: '/w' });
    expect(action(loaded({ worktree: { state: 'robot', temp: false, dir: '/w' } }), 'remove-worktree')?.hidden).toBe(true);
    expect(loaded().worktree).toBeNull();
  });
});

describe('rc.10 : GitHub lu par gh, sans agent', () => {
  const checks = { 'checks.json': out('{"items":[{"name":"tests","ok":true}]}'), 'ponytail.md': out('- rien') };
  const GH = { number: 31, title: 'G2-1', url: 'https://github.com/o/d/pull/31', state: 'OPEN', base: 'main', head: 'feat/G2-1' };

  it('Créer : une PR pour la branche (gh), sans pr.json : l\'étape PR est faite', () => {
    const v = vibeView(input({ note, repo: repo([], [FIRST]), outputs: checks, github: { pr: GH } }));
    expect([status(v).pr, v.pr?.number, v.pr?.base, v.pr?.state]).toEqual(['done', 31, 'main', 'OPEN']);
  });

  it('Créer : gh sans réponse, pr.json encore lu', () => {
    const v = vibeView(input({ note, repo: repo([], [FIRST]), outputs: { 'pr.json': out('{"number":9}') }, github: { pr: null } }));
    expect(v.pr?.number).toBe(9);
  });

  it('Relire : l\'état de la PR chargée d\'après gh l\'emporte sur sa fiche', () => {
    const card = JSON.stringify({ number: 12, title: 't', url: 'u', base: 'main', head: 'feat/G2-1', state: 'OPEN' });
    const v = vibeView(input({ flow: 'review', pr: 12, repo: repo([], [FIRST]), outputs: { 'pr-12.json': out(card) }, github: { state: 'MERGED' } }));
    expect([v.pr?.state, v.pr?.title]).toEqual(['MERGED', 't']);
  });

  it('les PR ouvertes du dépôt, les trois listes, dans les deux parcours ; une PR sans numéro écartée', () => {
    const one = { number: 3, title: 't', author: { login: 'kb' }, url: 'u' };
    for (const flow of ['create', 'review'] as const) {
      const v = vibeView(input({ flow, github: { prs: { mine: [one], review: [{ number: 'x' }], all: [one, null] } } }));
      const item = { number: 3, title: 't', author: 'kb', url: 'u' };
      expect(v.prs).toEqual({ mine: [item], review: [], all: [item] });
    }
    expect(vibeView(input({ flow: 'review', outputs: { 'prs.json': out('[{"number":1}]') } })).prs).toBeNull();
  });
});

describe('les actions que l\'appli fait elle-même (F-114)', () => {
  it('commit, publish, load-pr : direct, jamais lancées, sans résultat ; les autres sans direct', () => {
    const v = vibeView(input());
    const r = vibeView(input({ flow: 'review' }));
    expect([action(v, 'commit')?.direct, action(r, 'publish')?.direct, action(r, 'load-pr')?.direct])
      .toEqual([{ running: false, last: null }, { running: false, last: null }, { running: false, last: null }]);
    expect(action(v, 'note')?.direct).toBeUndefined();
  });

  it('leur dernier résultat suit dans le relevé', () => {
    const last = { ok: false, line: 'nothing to commit', detail: '$ git commit -F …', time: 1 };
    expect(action(vibeView(input({ direct: { commit: { running: false, last } } })), 'commit')?.direct?.last).toEqual(last);
  });

  it('une en cours : elle-même grisée, et elle retient les courses comme une modification (0.9.0) ; pas la conversation', () => {
    const v = vibeView(ready({ outputs: { 'commit.md': out('x') }, direct: { commit: { running: true, last: null } }, runs: ANSWERED }));
    expect([action(v, 'commit')?.disabled, action(v, 'module')?.disabled, action(v, 'vibe')?.disabled])
      .toEqual(['Cette action est déjà en cours', 'Une autre action est en cours', null]);
  });
});

describe('les actions qui courent à part (0.9.0)', () => {
  const forme = [{ id: 'forme', reads: false }];

  it('la conversation travaille : une action d\'étape reste possible', () => {
    expect(action(vibeView(input({ busy: true })), 'note')?.disabled).toBeNull();
  });

  it('une modification en cours : elle-même, une autre modification et une lecture attendent ; la conversation non', () => {
    const v = vibeView(ready({ running: forme, runs: ANSWERED }));
    expect([action(v, 'forme')?.disabled, action(v, 'module')?.disabled, action(v, 'ponytail')?.disabled])
      .toEqual(['Cette action est déjà en cours', 'Une autre action est en cours', 'Une action modifie la branche']);
  });

  it('une lecture en cours : une autre lecture part, une modification attend', () => {
    const v = vibeView(ready({ running: [{ id: 'ponytail', reads: true }] }));
    expect([action(v, 'checks')?.disabled, action(v, 'module')?.disabled]).toEqual([null, 'Une autre action est en cours']);
  });

  it('la course de la note en cours : Envoyer les réponses attend (même agent)', () => {
    expect(action(vibeView(input({ note, running: [{ id: 'note', reads: false }] })), 'answers')?.disabled).toBe('Cette action est déjà en cours');
  });

  it('une commande directe en cours (Commiter) retient les courses comme une modification', () => {
    const v = vibeView(ready({ direct: { commit: { running: true, last: null } } }));
    expect([action(v, 'forme')?.disabled, action(v, 'ponytail')?.disabled]).toEqual(['Une autre action est en cours', 'Une action modifie la branche']);
  });

  it('les courses passent telles quelles dans le relevé', () => {
    const runs = [{ id: 'forme', label: 'forme', who: 'opus', state: 'done' as const, since: 1, end: 2, reply: 'ok', permission: null }];
    expect(vibeView(input({ runs })).runs).toEqual(runs);
  });

  it('en anglais', () => {
    expect(action(vibeView(ready({ lang: 'en', running: forme })), 'ponytail')?.disabled).toBe('An action is changing the branch');
  });
});

describe('le parcours guidé (0.9.0) : étapes ouvertes, actions masquées', () => {
  const shown = (v: VibeView, ids: string[]) => ids.filter((id) => !action(v, id)?.hidden);
  const PR_STEP = ['pr', 'ci', 'base'];
  const reviewed = { 'checks.json': out('{"items":[{"name":"tests","ok":true}]}'), 'ponytail.md': out('- rien') };
  const withPr = (pr: Record<string, unknown> | null, outputs: JourneyInput['outputs'] = reviewed) =>
    vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs, github: { pr } }));

  it('l\'étape en cours est la première pas faite ; le relevé ne dit plus lesquelles s\'ouvrent (elles le sont toutes)', () => {
    expect(vibeView(ready()).steps.map((s) => s.status)).toEqual(['done', 'done', 'done', 'current', 'todo', 'todo']);
    expect(vibeView(input()).steps.map((s) => s.status)).toEqual(['current', 'todo', 'todo', 'todo', 'todo', 'todo']);
    expect(vibeView(ready()).steps.every((s) => !('open' in s))).toBe(true);
  });

  it('l\'étape PR sans PR : seulement Valider la feature', () => {
    expect(shown(withPr(null), PR_STEP)).toEqual(['pr']);
  });

  it('PR ouverte : seulement Diagnostiquer la CI (ni rc ni release) ; PR fusionnée : revenir sur la base seule', () => {
    expect(shown(withPr({ number: 31, state: 'OPEN' }), PR_STEP)).toEqual(['ci']);
    expect(shown(withPr({ number: 31, state: 'MERGED' }), PR_STEP)).toEqual(['base']);
    expect(shown(withPr({ number: 31, state: 'CLOSED' }), PR_STEP)).toEqual([]);
  });

  it('une PR sans état connu (pr.json, avant gh) : comme ouverte', () => {
    expect(shown(withPr(null, { ...reviewed, 'pr.json': out('{"number":9}') }), PR_STEP)).toEqual(['ci']);
  });

  it('l\'état de la PR masque sans griser', () => {
    const v = withPr({ number: 31, state: 'OPEN' });
    expect(PR_STEP.map((id) => action(v, id)?.disabled)).toEqual([null, null, null]);
  });

  it('pas encore de sens : masquée, sa raison gardée ; sans note : la Forme et les invariants grisés, sa raison au survol', () => {
    const v = vibeView(input());
    expect([action(v, 'commit'), action(v, 'answers'), action(v, 'fixups')].map((a) => [a?.hidden, a?.disabled]))
      .toEqual([[true, 'Préparer d\'abord le commit'], [true, 'Aucune question ouverte'], [true, 'Aucun commit fixup!']]);
    expect(['forme', 'invariants'].map((id) => [action(v, id)?.hidden, action(v, id)?.disabled]))
      .toEqual([[false, 'Pas encore de note'], [false, 'Pas encore de note']]);
    expect(action(vibeView(ready({ tests: [] })), 'read-invariants')?.hidden).toBe(true);
  });

  it('grisée par une course ou la conversation : affichée ; masquée tout de même si elle n\'a pas de sens', () => {
    const v = vibeView(ready({ running: [{ id: 'forme', reads: false }], busy: true, runs: ANSWERED }));
    expect([action(v, 'module')?.hidden, action(v, 'commit')?.hidden]).toEqual([false, true]);
    expect(action(v, 'commit')?.disabled).toBe('Une autre action est en cours');
  });

  it('Vibe : grisée sans note, masquée avec des questions ouvertes ou la note pas validée, et refusée', () => {
    const questions = { 'questions.md': out('## 1. Quelle couleur ?\n') };
    expect([vibeView(input()), vibeView(input({ note, outputs: questions })), vibeView(input({ note })), vibeView(input({ note, marks: NOTE_OK }))]
      .map((v) => [action(v, 'vibe')?.hidden, action(v, 'vibe')?.disabled]))
      .toEqual([[false, 'Pas encore de note'], [true, 'Répondre d\'abord aux questions de la note'], [true, 'Valider d\'abord la note'],
        [false, null]]);
  });

  it('Vibe : grisée tant que la note n\'est pas rédigée', () => {
    const text = NOTE.replace('Un bouton qui dit bonjour.', '');
    const v = vibeView(input({ note: { ...note, text }, marks: { note: ok(noteDesign(text)) } }));
    expect([action(v, 'vibe')?.hidden, action(v, 'vibe')?.disabled]).toEqual([false, 'Pas encore de note']);
  });

  it('Vibe : se lance à n\'importe quelle étape après la note', () => {
    const v = vibeView(ready({ repo: repo([], [FIRST, HELLO]) }));
    expect([status(v).modules, action(v, 'vibe')?.hidden, action(v, 'vibe')?.disabled]).toEqual(['current', false, null]);
  });

  it('Vibe : masquée pendant Vibe, un tour de la conversation ou une course qui retient', () => {
    const vibe = (over: Partial<JourneyInput>) => action(vibeView(input({ note, marks: NOTE_OK, ...over })), 'vibe')?.hidden;
    expect([vibe({}), vibe({ vibe: true }), vibe({ busy: true }), vibe({ running: [{ id: 'forme', reads: false }] })])
      .toEqual([false, true, true, true]);
    expect(action(vibeView(ready({ vibe: true })), 'vibe')?.disabled).toBe('Déjà en cours');
  });

  it('en anglais : la raison des questions ouvertes', () => {
    expect(action(vibeView(input({ lang: 'en', note, outputs: { 'questions.md': out('## 1. ?\n') } })), 'vibe')?.disabled)
      .toBe('Answer the note\'s questions first');
  });
});

describe('checks.json et la dernière course checks (I-46)', () => {
  const checksRun = (since: number) => ({ id: 'checks', label: 'checks', who: 'agent', state: 'done' as const, since, end: since + 1, reply: '', permission: null });
  const green = (time?: number) => out(JSON.stringify({ items: [{ name: 'tests', ok: true }], time }));
  const revue = (outputs: JourneyInput['outputs'], since = 100) =>
    vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), runs: [checksRun(since)], outputs }));

  it('sans time, une course checks connue : ignoré', () => {
    expect(revue({ 'checks.json': green(), 'ponytail.md': out('- rien') }).outputs).not.toHaveProperty(['checks.json']);
  });

  it('ignoré : les autres sorties restent', () => {
    expect(Object.keys(revue({ 'checks.json': green(50), 'ponytail.md': out('- rien') }).outputs)).toEqual(['ponytail.md']);
  });

  it('frais : la revue passe à la PR', () => {
    expect(primary(revue({ ...PROOF, 'checks.json': green(100), 'ponytail.md': out('- rien') }))).toBe('pr');
  });

  it('ancien : l\'état de la PR ne change pas (pr.json lu)', () => {
    const v = revue({ ...PROOF, 'checks.json': green(50), 'ponytail.md': out('- rien'), 'pr.json': out('{"number":31,"url":"u","title":"G2-1"}') });
    expect([v.pr?.number, primary(v)]).toEqual([31, 'checks']);
  });
});

// Le bug de la 0.9.0-rc.3 (docs/tickets/fix/0.9.0-vibecoder-etape-invariants.md) : rouge avant le correctif.
describe('l\'étape Invariants, sans invariant et sans lecture (0.9.0-rc.4)', () => {
  const text = NOTE.replace('- Lire un autre fichier. → invariant\n', '');
  // La note et la forme validées.
  const marks: Marks = noteMarks(text);

  it('une note sans ligne « → invariant », la forme validée, pas commitée : l\'étape Invariants est faite, les Modules s\'ouvrent', () => {
    const v = vibeView(input({ note: { ...note, text }, marks, repo: repo([NOTE_PATH]) }));

    // Rien à écrire : l'étape n'attend ni test ni commit.
    expect(status(v).invariants).toBe('done');
    expect(status(v).modules).toBe('current');
  });

  it('un fichier d\'invariants pas lu, chaque cas validé : l\'étape Invariants est faite', () => {
    const v = vibeView(ready({ readings: [] }));

    // La lecture en pseudo-code n'est pas exigée.
    expect(status(v).invariants).toBe('done');
  });

  it('une note sans ligne « → invariant » : Écrire les invariants masquée ; elle revient avec une ligne', () => {
    expect(action(vibeView(input({ note: { ...note, text }, marks })), 'invariants')?.hidden).toBe(true);
    expect(action(vibeView(input({ note, marks: NOTE_OK })), 'invariants')?.hidden).toBe(false);
  });

  it('une ligne « → invariant », cas validés, pas commités : l\'étape reste en cours (le premier commit)', () => {
    expect(status(vibeView(ready({ readings: [], repo: repo([NOTE_PATH, TEST_PATH]) }))).invariants).toBe('current');
  });

  it('la note validée puis dévalidée, sans ligne « → invariant » : l\'étape Invariants n\'est pas faite (0.12.0)', () => {
    // Dévalider oublie le ✓ de la note seule (setMark à null) : celui de la forme reste.
    const v = vibeView(input({ note: { ...note, text }, marks: { forme: ok(parseNote(text).forme) }, repo: repo([NOTE_PATH]) }));

    expect(status(v).invariants).not.toBe('done');
  });

  it('sans ligne « → invariant », la note validée mais pas de Forme posée : l\'étape Invariants n\'est pas faite (0.12.0 ; la Forme ne se valide plus à la main, 0.16.0)', () => {
    const bare = text.slice(0, text.indexOf('## Forme'));
    const v = vibeView(input({ note: { ...note, text: bare }, marks: { note: ok(noteDesign(bare)) }, repo: repo([NOTE_PATH]) }));

    expect(status(v).invariants).not.toBe('done');
  });
});

describe('Voir le code : les fichiers d\'un module et pourquoi il est grisé (0.11.0)', () => {
  const modules = (over: Partial<JourneyInput> = {}) =>
    vibeView(ready({ repo: repo(['src/core/hello.ts/z.ts', 'src/core/hello.ts/a.ts', 'src/core/other.ts'], [FIRST]), exists: () => true, ...over })).modules;

  it('un module touché : ses fichiers que la branche change, sous son chemin, triés, ids m<rang>/<i> ; pas touché : aucun', () => {
    const [hello, button] = modules();
    expect(hello.files).toEqual([{ id: 'm0/0', path: 'src/core/hello.ts/a.ts', git: 'modified' }, { id: 'm0/1', path: 'src/core/hello.ts/z.ts', git: 'modified' }]);
    expect(button.files).toEqual([]);
  });

  it('un fichier changé absent du disque : deleted (le dossier du module supprimé compris)', () => {
    expect(modules({ exists: (p) => p !== 'src/core/hello.ts/z.ts' })[0].files)
      .toEqual([{ id: 'm0/0', path: 'src/core/hello.ts/a.ts', git: 'modified' }, { id: 'm0/1', path: 'src/core/hello.ts/z.ts', deleted: true }]);
    expect(modules({ exists: () => false })[0].files?.map((f) => f.deleted)).toEqual([true, true]);
  });

  it('locked : la conversation travaille, une course génère ce module ou tous ; sinon éditable', () => {
    expect(modules().map((m) => m.locked)).toEqual([null, null]);
    expect(modules({ busy: true }).map((m) => m.locked)).toEqual(['La conversation travaille', 'La conversation travaille']);
    const one = modules({ running: [{ id: 'module', reads: false, module: 'src/core/hello.ts' }] });
    expect(one.map((m) => m.locked)).toEqual(['Ce module est en cours de génération', null]);
    const all = modules({ running: [{ id: 'modules', reads: false, module: '*' }] });
    expect(all.every((m) => m.locked === 'Ce module est en cours de génération')).toBe(true);
    expect(modules({ running: [{ id: 'checks', reads: true }] }).map((m) => m.locked)).toEqual([null, null]);
  });
});

describe('Lecture périmée et grisé de la note et des tests (0.11.0-editer-invariants-et-note)', () => {
  // Une lecture d'une version précédente du test : commence par `# <chemin du test>`, empreinte d'avant.
  const OLD = { blob: 'f'.repeat(40), text: `# ${TEST_PATH}\n${READING}`, time: 1 };
  const facts = (v: VibeView) => v.steps.find((s) => s.id === 'invariants')?.facts;

  it('le test a changé depuis sa lecture : elle est montrée, périmée, et ne compte pas comme lue', () => {
    const v = vibeView(ready({ readings: [OLD] }));
    expect(v.invariants[0]).toMatchObject({ stale: true, reading: [{ title: 'dit bonjour' }, { title: 'ne lit rien d\'autre' }] });
    expect(facts(v)).toBe('1 fichier · 2 cas · 0 lu');
  });

  it('Vibe : pas lu ou lecture périmée, Lire en pseudo-code est en tête ; la lecture de son empreinte la laisse à la pause avant le premier commit (0.16.0-ecran-essentiel)', () => {
    const at = (readings: JourneyInput['readings']) =>
      primary(vibeView(input({ note, marks: NOTE_OK, tests: [test], vibe: true, repo: repo([NOTE_PATH, TEST_PATH]), readings })));
    expect([at([]), at([OLD]), at([OLD, ...READINGS])]).toEqual(['read-invariants', 'read-invariants', 'vibe']);
  });

  it('la lecture de son empreinte : à jour, lue', () => {
    const v = vibeView(ready({ readings: [{ ...OLD, time: 9 }, ...READINGS] }));
    expect(v.invariants[0].stale).toBe(false);
    expect(facts(v)).toBe('1 fichier · 2 cas · 2 lus');
  });

  it('locked de la note et des tests : la conversation, ou n\'importe quelle course qui retient ; sinon éditable', () => {
    const locks = (over: Partial<JourneyInput>) => { const v = vibeView(ready(over)); return [v.note?.locked, v.invariants[0].locked]; };
    expect(locks({})).toEqual([null, null]);
    expect(locks({ busy: true })).toEqual(['La conversation travaille', 'La conversation travaille']);
    expect(locks({ running: [{ id: 'checks', reads: true }] })).toEqual(['Une action de l’agent est en cours', 'Une action de l’agent est en cours']);
  });
});

describe('la gestion des branches (0.12.0) : la PR suivie, Pull, Rebase, Pousser', () => {
  const CARD = out(JSON.stringify({ number: 12, title: 'G3', head: 'feat/G3', base: 'main', state: 'OPEN' }));
  const at = (time: number, ok = true) => ({ running: false, last: { ok, line: '', detail: '', time } });

  it('Créer : la PR suivie et sa fiche (loaded), à part de la PR de la branche ; son état d\'après gh ; elle ouvre ses choix', () => {
    const v = vibeView(input({ pr: 12, outputs: { 'pr-12.json': CARD }, github: { pr: { number: 31 }, state: 'MERGED' },
      checkout: { branch: 'main', dirty: false } }));
    expect([v.pr?.number, v.loaded?.number, v.loaded?.head, v.loaded?.state]).toEqual([31, 12, 'feat/G3', 'MERGED']);
    expect([vibeView(input({ pr: 12 })).loaded, vibeView(input()).loaded]).toEqual([null, null]);
  });

  it('les branches locales et l\'état distant passent tels quels ; absents : null', () => {
    const v = vibeView(input({ branches: ['main', 'feat/x'], sync: { behind: 2, baseAhead: 0 } }));
    expect([v.branches, v.sync]).toEqual([['main', 'feat/x'], { behind: 2, baseAhead: 0 }]);
    expect([vibeView(input()).branches, vibeView(input()).sync]).toEqual([null, null]);
  });

  it('Créer : la PR suivie chargée ouvre ses choix ; Charger la PR, sans fiche, jamais grisée', () => {
    const v = vibeView(input({ pr: 12, outputs: { 'pr-12.json': CARD }, checkout: { branch: 'main', dirty: false } }));
    expect(['load-pr', 'pr-here', 'pr-worktree', 'unload-pr'].map((id) => [action(v, id)?.hidden, action(v, id)?.disabled]))
      .toEqual([[false, null], [false, null], [false, null], [false, null]]);
    for (const flow of ['create', 'review'] as const) expect(action(vibeView(input({ flow, pr: 12 })), 'load-pr')?.disabled).toBeNull();
  });

  it('Pull : grisé sans branche distante suivie ou à jour ; en retard, actif, même avec des modifications', () => {
    const pull = (over: Partial<JourneyInput>) => action(vibeView(input(over)), 'pull');
    expect([pull({}), pull({ sync: { behind: null, baseAhead: 1 } }), pull({ sync: { behind: 0, baseAhead: 1 } }),
      pull({ sync: { behind: 2, baseAhead: 0 }, checkout: { branch: 'main', dirty: true } })].map((a) => [a?.hidden, a?.disabled]))
      .toEqual([[false, 'Pas de branche distante suivie'], [false, 'Pas de branche distante suivie'], [false, 'Déjà à jour'], [false, null]]);
    expect(action(vibeView(input({ lang: 'en', sync: { behind: 0, baseAhead: 0 } })), 'pull')?.disabled).toBe('Already up to date');
  });

  it('child : un worktree (enfant ou robot) au relevé, pour la vue des branches', () => {
    expect([vibeView(input({ child: true })).child, vibeView(input()).child]).toEqual([true, false]);
  });

  it('Rebase : montré hors de la base, jamais grisé par l\'état distant ; masqué sur la base', () => {
    const v = vibeView(input({ sync: { behind: 0, baseAhead: 0 }, checkout: { branch: 'feat/G2-1-bouton', dirty: true } }));
    expect([action(v, 'rebase')?.hidden, action(v, 'rebase')?.disabled]).toEqual([false, null]);
    expect(action(vibeView(input({ checkout: { branch: 'main', dirty: false } })), 'rebase')?.hidden).toBe(true);
  });

  it('Pousser : montré après un rebase réussi, jusqu\'à un push réussi ; un push en échec le laisse', () => {
    const push = (direct: JourneyInput['direct']) => action(vibeView(input({ direct })), 'push')?.hidden;
    expect([push(undefined), push({ rebase: at(5, false) }), push({ rebase: at(5) }), push({ rebase: at(5), push: at(6) }),
      push({ rebase: at(5), push: at(6, false) }), push({ rebase: at(7), push: at(6) })]).toEqual([true, true, false, true, false, false]);
  });
});

describe('les fichiers de la branche et le réglage de la vue Modules (0.13.0)', () => {
  it('files : repo.changed triés, ids b<i>, supprimé s\'il manque au disque, locked par codeLock', () => {
    const exists = (p: string) => p !== 'src/gone.ts';
    const v = vibeView(input({ repo: repo(['src/z.ts', 'src/gone.ts', 'a.md']), exists }));
    expect(v.files).toEqual([
      { id: 'b0', path: 'a.md', git: 'modified', locked: null },
      { id: 'b1', path: 'src/gone.ts', deleted: true, locked: null },
      { id: 'b2', path: 'src/z.ts', git: 'modified', locked: null },
    ]);
    expect(vibeView(input({ repo: null })).files).toEqual([]);
  });

  it('files : grisés comme la note quand l\'agent travaille', () => {
    const v = vibeView(input({ repo: repo(['a.md']), busy: true, note }));
    expect(v.files?.[0].locked).toBe(v.note?.locked);
    expect(v.files?.[0].locked).toBeTruthy();
  });

  it('modulesView : recopié de l\'entrée', () => {
    expect(vibeView(input({ modulesView: 'ide' })).modulesView).toBe('ide');
    expect(vibeView(input({ modulesView: 'list' })).modulesView).toBe('list');
  });
});

describe('la stabilisation 0.15.0 : les modules à plusieurs chemins, la marque d\'un commit, les actions directes faites (T-15, T-23, T-24)', () => {
  // Un module à deux chemins : « a + b  contrat » (T-15).
  const TWO = NOTE.replace('src/core/hello.ts    hello()', 'src/core/hello.ts + src/app/other.ts   hello()');
  const two = (changed: string[], commits: ReturnType<typeof commit>[] = []) =>
    vibeView(input({ note: { ...note, text: TWO }, repo: repo(changed, commits), exists: () => true })).modules;

  it('un module à deux chemins : ses fichiers sous l\'un et l\'autre, touché si l\'un l\'est', () => {
    expect(two([]).map((m) => m.touched)).toEqual([false, false]);
    const [only] = two(['src/app/other.ts/b.ts']);
    expect([only.touched, only.files?.map((f) => f.path)]).toEqual([true, ['src/app/other.ts/b.ts']]);
    const [both] = two(['src/core/hello.ts/a.ts', 'src/app/other.ts/b.ts', 'src/app/button.tsx']);
    expect(both.files?.map((f) => [f.id, f.path])).toEqual([['m0/0', 'src/app/other.ts/b.ts'], ['m0/1', 'src/core/hello.ts/a.ts']]);
    expect(two([], [commit('d', 'hello', ['src/app/other.ts/b.ts'])])[0].commits).toEqual(['d'.repeat(40)]);
  });

  it('un module à deux chemins expose paths (le panneau ne découpe pas « a + b ») ; un seul chemin : un seul', () => {
    const [m, other] = two([]);
    expect([m.path, m.paths, other.paths]).toEqual(['src/core/hello.ts + src/app/other.ts', ['src/core/hello.ts', 'src/app/other.ts'], ['src/app/button.tsx']]);
  });

  it('un commit marqué À revoir : sa marque dans le relevé ; sans marque, absente', () => {
    const v = vibeView(input({ repo: repo([], [HELLO, BUTTON]), marks: { [`commit:${HELLO.hash}`]: { hash: HELLO.hash, verdict: 'ko' } } }));
    expect(v.commits.map((c) => c.mark)).toEqual(['ko', undefined]);
  });

  it('une action directe faite et inchangée : grisée, sa raison ; relançable dès que l\'état a changé', () => {
    const base = (over: Partial<JourneyInput>) => action(vibeView(input(over)), 'base')?.disabled;
    const done = { base: { running: false, last: { ok: true, line: '', detail: '', time: 5 } } };
    const onMain = { branch: 'main', dirty: false };
    expect([base({ direct: done, checkout: onMain }), base({ direct: done, checkout: onMain, lang: 'en' })])
      .toEqual(['Déjà sur la base', 'Already on the base']);
    // Pas faite, en échec, ou le dossier a quitté la base depuis : un second clic fait quelque chose.
    expect([base({ checkout: onMain }), base({ direct: { base: { running: false, last: { ok: false, line: '', detail: '', time: 5 } } }, checkout: onMain }),
      base({ direct: done, checkout: { branch: 'feat/x', dirty: false } })]).toEqual([null, null, null]);
  });

  it('Mettre de côté et Actualiser faits : toujours relançables', () => {
    const last = { ok: true, line: '', detail: '', time: 5 };
    const v = vibeView(input({ direct: { stash: { running: false, last }, fetch: { running: false, last } }, checkout: { branch: 'main', dirty: true } }));
    expect(['stash', 'fetch'].map((id) => action(v, id)?.disabled)).toEqual([null, null]);
  });
});

describe('un module n\'est commencé que si un fichier a changé depuis son squelette (0.15.0-skills-humain-ia)', () => {
  const HELLO_PATH = 'src/core/hello.ts', BUTTON_PATH = 'src/app/button.tsx';
  // Les squelettes : les fichiers des deux modules, créés vides avec la note.
  const WITH_SKELETONS = commit('a', 'Note, forme, invariants', [NOTE_PATH, TEST_PATH, HELLO_PATH, BUTTON_PATH]);
  const view = (over: Partial<JourneyInput> = {}) => vibeView(ready({ repo: repo([], [WITH_SKELETONS]), exists: () => true, ...over }));
  // Un fichier commité puis retouché : dans changed et dans dirty (git status).
  const retouched = (files: string[], commits: ReturnType<typeof commit>[]) => ({ ...repo([], commits), dirty: files });
  const started = (v: VibeView) => v.modules.map((m) => m.started);

  it('squelettes pas commités, aucun commit : aucun module commencé, Générer les modules montrée, Invariants pas faite d\'office', () => {
    const v = vibeView(input({ note, marks: NOTE_OK, repo: repo([HELLO_PATH, BUTTON_PATH]), exists: () => true }));
    expect(started(v)).toEqual([false, false]);
    expect([action(v, 'modules')?.hidden, status(v).invariants]).toEqual([false, 'current']);
  });

  it('squelettes portés par le commit de la note : pas commencés, commits vides, l\'étape Modules pas faite', () => {
    const v = view();
    expect([started(v), v.modules.map((m) => m.commits), status(v).modules]).toEqual([[false, false], [[], []], 'current']);
    expect(action(v, 'modules')?.hidden).toBe(false);
  });

  it('la note commitée, un fichier d\'un module modifié : commencé', () => {
    expect(started(view({ repo: retouched([HELLO_PATH], [WITH_SKELETONS]) }))).toEqual([true, false]);
  });

  it('un commit de module : commencé, ce commit seul dans commits', () => {
    const v = view({ repo: repo([], [WITH_SKELETONS, HELLO]) });
    expect([started(v), v.modules.map((m) => m.commits)]).toEqual([[true, false], [[HELLO.hash], []]]);
  });

  it('un module à plusieurs chemins : commencé si l\'un l\'est', () => {
    const TWO = NOTE.replace('src/core/hello.ts    hello()', 'src/core/hello.ts + src/app/other.ts   hello()');
    const skeletons = commit('a', 'Note', [NOTE_PATH, HELLO_PATH, 'src/app/other.ts']);
    const two = (changed: string[]) => started(vibeView(input({ note: { ...note, text: TWO }, repo: retouched(changed, [skeletons]), exists: () => true })));
    expect([two([]), two(['src/app/other.ts'])]).toEqual([[false, false], [true, false]]);
  });

  it('un squelette : touched vrai, ses fichiers listés', () => {
    const [hello] = view().modules;
    expect([hello.touched, hello.files?.map((f) => f.path)]).toEqual([true, [HELLO_PATH]]);
  });

  it('queued : recopié dans l\'ordre ; absent : []', () => {
    expect([vibeView(input({ queued: ['b', 'a'] })).queued, vibeView(input()).queued]).toEqual([['b', 'a'], []]);
  });
});

// Une note ignorée par git (note 0.16.0-notes-hors-projet) : jamais commitée ; le plus ancien commit de la branche tient lieu
// du commit de la note (squelettes, tests d'invariants rouges), et la case « note commitée » suit ce premier commit.
describe('une note ignorée par git : le premier commit tient lieu du commit de la note', () => {
  const HELLO_PATH = 'src/core/hello.ts', BUTTON_PATH = 'src/app/button.tsx';
  const SKELS = commit('a', 'Squelettes, invariants', [TEST_PATH, HELLO_PATH, BUTTON_PATH]);   // pas la note
  const ignored = { ...note, ignored: true };
  const view = (over: Partial<JourneyInput> = {}) => vibeView(ready({ note: ignored, repo: repo([], [SKELS]), exists: () => true, ...over }));
  const started = (v: VibeView) => v.modules.map((m) => m.started);
  const a3 = (v: VibeView) => v.checklist[0].done;

  it('un commit de squelettes : aucun module commencé, commits vides, Modules en cours', () => {
    const v = view();
    expect([started(v), v.modules.map((m) => m.commits), status(v).modules]).toEqual([[false, false], [[], []], 'current']);
    expect(action(v, 'modules')?.hidden).toBe(false);
  });

  it('un commit qui touche un module après le premier : commencé, ce commit seul dans commits', () => {
    const v = view({ repo: repo([], [SKELS, HELLO]) });
    expect([started(v), v.modules.map((m) => m.commits)]).toEqual([[true, false], [[HELLO.hash], []]]);
  });

  it('un fichier d\'un module retouché après le premier commit : commencé', () => {
    expect(started(view({ repo: { ...repo([], [SKELS]), dirty: [HELLO_PATH] } }))).toEqual([true, false]);   // commité puis retouché
  });

  it('les tests d\'invariants du premier commit sont ceux de l\'étape, une fois un module commencé', () => {
    const begun = repo([], [SKELS, HELLO]);
    expect(status(view({ repo: begun, marks: NOTE_OK })).invariants).toBe('current');   // un cas pas validé
    expect(status(view({ repo: begun })).invariants).toBe('done');
  });

  it('« note commitée » : pas cochée sans commit, cochée dès le premier', () => {
    expect([a3(view({ repo: repo() })), a3(view())]).toEqual([false, true]);
  });

  it('pas de commit du tout : rien ne plante, aucun module commencé', () => {
    const v = view({ repo: repo() });
    expect([started(v), status(v).modules]).toEqual([[false, false], 'current']);
  });

  it('un seul commit, de module : c\'est lui le commit de la note, le module n\'est pas commencé', () => {
    expect(started(view({ repo: repo([], [HELLO]) }))).toEqual([false, false]);
  });

  it('ignored: false ou absent : le même parcours que la note commitée', () => {
    const a = vibeView(ready()), b = vibeView(ready({ note: { ...note, ignored: false } }));
    expect(b).toEqual(a);
  });

  it('note non ignorée : « note commitée » vraie seulement si un commit la porte', () => {
    expect([a3(vibeView(ready({ repo: repo([], [SKELS]) }))), a3(vibeView(ready()))]).toEqual([false, true]);
  });
});

// Les en-têtes sans doublon (note 0.15.0-ecran-epure) : head ne garde que ce que l'étape ne montre pas en dessous ;
// facts reste entier (l'infobulle du fil d'Ariane).
describe('en-têtes d\'étape sans doublon : head et facts', () => {
  const step = (v: VibeView, id: string) => v.steps.find((s) => s.id === id)!;
  const pair = (v: VibeView, id: string) => [step(v, id).facts, step(v, id).head];
  const QUESTIONS = { 'questions.md': out('## 1. Quelle couleur ?\n- Bleu\n') };
  const UNFILLED = { path: NOTE_PATH, text: '# T\n\n## Ce que ça fait\n\n## Forme\n```\nsrc/core/hello.ts   x\n```\n', before: null };
  const all = [FIRST, HELLO, BUTTON];
  const checks = (items: unknown[]) => ({ 'checks.json': out(JSON.stringify({ items })) });
  const OK = [{ name: 'tests', ok: true, level: 'ok' }];

  describe('Créer', () => {
    const create = (name: string, v: VibeView, id: string, facts: string, head: string) =>
      it(name, () => expect(pair(v, id)).toEqual([facts, head]));

    // Note : seul « rédigée » / « à rédiger » reste (questions et validation sont dessous), « pas de note » sans note.
    create('Note, sans note : pas de note, des deux côtés', vibeView(input()), 'note', 'pas de note', 'pas de note');
    create('Note rédigée, 2 questions, validée : facts entier, head « rédigée »',
      vibeView(input({ note, marks: NOTE_OK, outputs: { 'questions.md': out('## 1. A ?\n- x\n\n## 2. B ?\n- y\n') } })), 'note',
      'rédigée · 2 questions · validée', 'rédigée');
    create('Note rédigée, 1 question, pas validée', vibeView(input({ note, outputs: QUESTIONS })), 'note', 'rédigée · 1 question', 'rédigée');
    create('Note à rédiger', vibeView(input({ note: UNFILLED })), 'note', 'à rédiger', 'à rédiger');
    create('Note rédigée, refusée', vibeView(input({ note, marks: { note: { hash: blobSha(noteDesign(NOTE)), verdict: 'ko' } } })), 'note', 'rédigée · refusée', 'rédigée');

    // Forme : rien en en-tête (la Forme périmée est dite dans facts seulement) ; sans note, « pas de note ».
    create('Forme, sans note', vibeView(input()), 'forme', 'pas de note', 'pas de note');
    create('Forme validée : head vide', vibeView(ready()), 'forme', '2 modules · validée', '');
    it('Forme, note modifiée depuis son commit : « note modifiée depuis son commit » n\'est plus dit', () => {
      const v = vibeView(ready({ repo: { ...repo([], [FIRST]), dirty: [NOTE_PATH] } }));
      expect(pair(v, 'forme')).toEqual(['2 modules · validée', '']);
    });

    // Invariants, Modules : rien (leurs cartes disent tout) ; facts entier.
    create('Invariants : head vide, facts entier', vibeView(ready()), 'invariants', '1 fichier · 2 cas · 2 lus', '');
    create('Invariants sans test : head vide', vibeView(input({ note })), 'invariants', '0 fichier · 0 cas · 0 lu', '');
    create('Modules : head vide, facts entier', vibeView(ready({ repo: repo([], [FIRST, HELLO]) })), 'modules', '1 / 2 modules', '');

    // Revue : « pas vérifiée » sans vérification, sinon les fixups seuls.
    it('Revue : vérifications ok, 1 avertissement, ponytail, 2 fixups, 3 / 5 cases → head « 2 fixups »', () => {
      const fix = [commit('d', 'fixup! core/hello', []), commit('e', 'fixup! app/button', [])];
      const plan = '- [x] a\n- [x] b\n- [x] c\n- [ ] d\n- [ ] e\n';
      const v = vibeView(ready({
        repo: repo([], [...all, ...fix]),
        outputs: { ...checks([...OK, { name: 'lint', ok: true, level: 'warning' }]), 'ponytail.md': out('- rien'), 'ecran.md': out(plan) },
      }));
      expect(pair(v, 'revue')).toEqual(['vérifications ok · 1 avertissement · ponytail faite · 2 fixups · 3 / 5 cases', '2 fixups']);
    });
    create('Revue sans vérification : « pas vérifiée »', vibeView(ready({ repo: repo([], all) })), 'revue', 'pas vérifiée', 'pas vérifiée');
    it('Revue sans vérification mais des fixups : « pas vérifiée · 1 fixup » (le fixup n\'est dit nulle part ailleurs)', () => {
      const v = vibeView(ready({ repo: repo([], [...all, commit('d', 'fixup! x', [])]) }));
      expect(pair(v, 'revue')).toEqual(['pas vérifiée · 1 fixup', 'pas vérifiée · 1 fixup']);
    });
    create('Revue, vérifications en échec, sans fixup : head vide', vibeView(ready({ repo: repo([], all), outputs: checks([{ name: 't', ok: false, level: 'error' }]) })),
      'revue', 'vérifications en échec', '');
    create('Revue, vérifications ok, sans fixup ni ponytail : head vide', vibeView(ready({ repo: repo([], all), outputs: checks(OK) })), 'revue', 'vérifications ok', '');

    // PR : « pas de PR » sans PR ; avec, la carte dit le numéro.
    create('PR, sans PR : « pas de PR »', vibeView(ready()), 'pr', 'pas de PR', 'pas de PR');
    create('PR ouverte : head vide, facts « PR #12 »', vibeView(ready({ outputs: { 'pr.json': out('{"number":12,"title":"t"}') } })), 'pr', 'PR #12', '');
    it('PR ouverte (gh) : head vide', () => {
      const v = vibeView(ready({ github: { pr: { number: 12, title: 't', state: 'OPEN' } } }));
      expect(pair(v, 'pr')).toEqual(['PR #12', '']);
    });
  });

  describe('Relire', () => {
    const PR = '{"number":12,"title":"t","head":"feat/G2-1"}';
    const loaded = (over: Partial<JourneyInput> = {}) => input({
      flow: 'review', pr: 12, note, tests: [test], repo: repo([], [FIRST, HELLO]), checkout: { branch: 'feat/G2-1', dirty: false }, ...over,
      outputs: { 'pr-12.json': out(PR), ...over.outputs },
    });
    const review = (name: string, v: VibeView, id: string, facts: string, head: string) =>
      it(name, () => expect(pair(v, id)).toEqual([facts, head]));

    review('Note, sans note : pas de note', vibeView(input({ flow: 'review' })), 'note', 'pas de note', 'pas de note');
    review('Note jugée, 1 question : facts entier, head « rédigée »', vibeView(loaded({ marks: { note: ok(noteDesign(NOTE)) }, outputs: QUESTIONS })), 'note',
      'rédigée · 1 question · validée', 'rédigée');
    review('Note à rédiger', vibeView(loaded({ note: UNFILLED })), 'note', 'à rédiger', 'à rédiger');
    review('Invariants : rien', vibeView(loaded()), 'invariants', '1 fichier · 2 cas · 0 lu', '');
    review('Revue sans plan : « pas de plan »', vibeView(loaded()), 'revue', 'pas de plan', 'pas de plan');
    review('Revue avec plan : head vide, facts entier', vibeView(loaded({ outputs: { 'ecran.md': out('- [ ] Ouvrir\n- [x] Dicter\n') } })), 'revue', '1 / 2 cases', '');
    review('PR, un brouillon pas publié : rien', vibeView(loaded({ draft: [{ target: 'note', text: 'x' } as never] })), 'pr', '1 remarque', '');
    review('PR publiée : rien', vibeView(loaded({ outputs: { 'pr-12-review.json': out('{}') } })), 'pr', '0 remarque · publiée', '');
  });

  it('en anglais, les mêmes faits : head en est un sous-ensemble, dans la langue', () => {
    const en = (over: Partial<JourneyInput> = {}) => ready({ lang: 'en', ...over });
    expect(pair(vibeView(en({ outputs: QUESTIONS })), 'note')).toEqual(['written · 1 question · approved', 'written']);
    expect(pair(vibeView(input({ lang: 'en', note: UNFILLED })), 'note')).toEqual(['to write', 'to write']);
    expect(pair(vibeView(input({ lang: 'en' })), 'note')).toEqual(['no note', 'no note']);
    expect(pair(vibeView(en({ repo: { ...repo([], [FIRST]), dirty: [NOTE_PATH] } })), 'forme')).toEqual(['2 modules · approved', '']);
    expect(pair(vibeView(en({ repo: repo([], all) })), 'revue')).toEqual(['not checked', 'not checked']);
    expect(pair(vibeView(en({ repo: repo([], [...all, commit('d', 'fixup! x', [])]), outputs: checks(OK) })), 'revue'))
      .toEqual(['checks pass · 1 fixup', '1 fixup']);
    expect(pair(vibeView(en()), 'pr')).toEqual(['no PR', 'no PR']);
    expect(pair(vibeView(en({ outputs: { 'pr.json': out('{"number":3}') } })), 'pr')).toEqual(['PR #3', '']);
    expect(pair(vibeView(en({ flow: 'review', pr: 12, outputs: {} })), 'revue')).toEqual(['no plan', 'no plan']);
  });

  it('chaque étape a un head (une chaîne, vide au besoin), jamais plus long que ses facts', () => {
    for (const v of [vibeView(input()), vibeView(ready()), vibeView(input({ flow: 'review' }))]) {
      for (const s of v.steps) expect([s.id, typeof s.head, s.head!.length <= s.facts.length]).toEqual([s.id, 'string', true]);
    }
  });
});


// Les validations d'étape et le menu de diff (note 0.15.0-ecran-statuts).
describe('les validations d\'étape et le menu de diff', () => {
  const step = (v: VibeView, id: string) => v.steps.find((s) => s.id === id)!;
  const sha = (c: string) => c.repeat(40);
  const H = 'src/core/hello.ts';
  const B = 'src/app/button.tsx';
  const CHANGED_NOTE = { ...note, text: NOTE.replace('Un bouton qui dit bonjour.', 'Un bouton qui dit bonjour, fort.') };
  const CHANGED_FORME = { ...note, text: NOTE.replace('le bouton', 'le gros bouton') };
  // Les deux modules commités, leurs fichiers relevés.
  const files = {
    repo: repo([], [FIRST, HELLO, BUTTON]), exists: () => true, outputs: PROOF,
    blobs: [{ path: H, disk: sha('a'), head: sha('a') }, { path: B, disk: sha('b'), head: sha('b') }],
  };
  // Les marques des étapes données, posées par le geste (validateStep), dans l'ordre, après la note et la Forme.
  const validated = (over: Partial<JourneyInput>, ...steps: ('invariants' | 'modules')[]): Marks =>
    steps.reduce((marks, s) => {
      const v = vibeView(ready({ ...over, marks }));
      const contents = Object.fromEntries(CHECKED.map((c) => [c, stepContent(v, marks, c, over.blobs ?? [])]));
      return validateStep(marks, contents, s, 'ok')!;
    }, { ...NOTE_OK, ...CASES_OK } as Marks);

  it('un fichier de module encore identique à son squelette (marque skel:<chemin>) : skeleton ; différent : non', () => {
    const v = vibeView(ready({ ...files, marks: { ...NOTE_OK, [`skel:${H}`]: { hash: sha('a'), verdict: 'ok' }, [`skel:${B}`]: { hash: sha('x'), verdict: 'ok' } } }));
    const f = (p: string) => v.modules.flatMap((m) => m.files ?? []).find((x) => x.path === p);
    expect([f(H)?.skeleton, f(B)?.skeleton]).toEqual([true, undefined]);
    expect(v.modules.find((m) => m.files?.some((x) => x.path === H))?.skeleton).toBe(true);
  });

  describe('check', () => {
    it('la note et la Forme validées : cochées, les autres jamais validées, rien dit en en-tête ; ni la Revue ni la PR n\'en ont', () => {
      const v = vibeView(ready());
      expect(v.steps.map((s) => s.check?.state)).toEqual(['ok', 'ok', null, null, undefined, undefined]);
      expect(Object.hasOwn(step(v, 'revue'), 'check')).toBe(false);
      expect([step(v, 'forme').facts, step(v, 'forme').head]).toEqual(['2 modules · validée', '']);
    });

    it('la note changée : son en-tête « modifiée depuis la validation », la Forme « à revoir : la note a changé »', () => {
      const v = vibeView(ready({ note: CHANGED_NOTE }));
      expect(step(v, 'note').check).toMatchObject({ state: 'changed' });
      expect(step(v, 'note').head).toBe('rédigée · modifiée depuis la validation');
      expect(step(v, 'note').facts).toBe('rédigée · modifiée depuis la validation');
      expect(step(v, 'forme').check).toMatchObject({ state: 'cascade', cause: 'note' });
      expect(step(v, 'forme').head).toBe('à revoir : la note a changé');
      expect(step(v, 'forme').facts).toBe('2 modules · à revoir : la note a changé');
    });

    it('la Forme seule changée : la note reste cochée, la Forme est « modifiée depuis la validation »', () => {
      const v = vibeView(ready({ note: CHANGED_FORME }));
      expect([step(v, 'note').check?.state, step(v, 'forme').check?.state]).toEqual(['ok', 'changed']);
      expect([step(v, 'note').head, step(v, 'forme').head]).toEqual(['rédigée', 'modifiée depuis la validation']);
      // la marque de la note suit sa conception, pas la note entière
      expect([v.note?.mark, v.note?.formeMark]).toEqual(['ok', 'changed']);
    });

    it('en anglais', () => {
      const v = vibeView(ready({ lang: 'en', note: CHANGED_NOTE }));
      expect(step(v, 'note').head).toBe('written · changed since approval');
      expect(step(v, 'forme').head).toBe('to review: the note changed');
    });

    it('la cause d\'une cascade est la première étape pas cochée : la Forme changée, les invariants à revoir', () => {
      const marks = validated({}, 'invariants');
      expect(step(vibeView(ready({ marks })), 'invariants').check?.state).toBe('ok');
      const v = vibeView(ready({ marks, note: CHANGED_FORME }));
      expect(step(v, 'invariants').check).toMatchObject({ state: 'cascade', cause: 'forme' });
      expect(step(v, 'invariants').head).toBe('à revoir : la Forme a changé');
      expect(step(v, 'invariants').facts).toBe('1 fichier · 2 cas · 2 lus · à revoir : la Forme a changé');
      expect(step(v, 'modules').check?.state).toBeNull();
    });

    it('un module modifié depuis sa validation : les modules « modifiés depuis la validation »', () => {
      const marks = validated(files, 'invariants', 'modules');
      expect(step(vibeView(ready({ ...files, marks })), 'modules').check?.state).toBe('ok');
      const moved = { ...files, blobs: [{ path: H, disk: sha('c'), head: sha('a') }, files.blobs[1]] };
      const v = vibeView(ready({ ...moved, marks }));
      expect(step(v, 'modules').check?.state).toBe('changed');
      expect(step(v, 'modules').head).toBe('modifiée depuis la validation');
      expect(step(v, 'modules').facts).toBe('2 / 2 modules · modifiée depuis la validation');   // la preuve : à l'étape Invariants
    });

    it('un commit ne change pas une validation : même disque, autre dernier commit', () => {
      const marks = validated(files, 'invariants', 'modules');
      const later = { ...files, repo: repo([], [FIRST, HELLO, BUTTON, commit('d', 'fixup! x', [])]) };
      expect(vibeView(ready({ ...later, marks })).steps.map((s) => s.check?.state)).toEqual(['ok', 'ok', 'ok', 'ok', undefined, undefined]);
    });

    it('relecteur : ni check ni diffs', () => {
      const v = vibeView(input({ flow: 'review', note, blobs: files.blobs, validated: { modules: { [H]: sha('a') } }, marks: NOTE_OK }));
      expect(v.steps.some((s) => Object.hasOwn(s, 'check'))).toBe(false);
      expect(v.diffs).toBeUndefined();
    });

    it('retirés : plus de validation par fichier, plus de step.stale, même conception changée et tout validé', () => {
      const v = vibeView(ready({ ...files, note: CHANGED_NOTE }));
      expect(Object.hasOwn(v, 'validation')).toBe(false);
      expect(v.steps.some((s) => Object.hasOwn(s, 'stale'))).toBe(false);
      expect(v.steps.map((s) => s.facts).join(' ')).not.toMatch(/périmé/);
    });
  });

  describe('Commiter les modules', () => {
    const disabled = (marks: Marks, over: Partial<JourneyInput> = {}) => action(vibeView(ready({ ...files, ...over, marks })), 'commit-modules')?.disabled ?? null;

    it('modules validés : offert ; pas validés : grisé avec sa raison, en français et en anglais', () => {
      expect(disabled(validated(files, 'invariants', 'modules'))).toBeNull();
      expect(disabled(validated(files, 'invariants'))).toBe('modules pas validés');
      expect(disabled(validated(files, 'invariants'), { lang: 'en' })).toBe('modules not approved');
    });

    it('modules validés puis modifiés, ou une étape d\'avant changée : grisé de nouveau', () => {
      const marks = validated(files, 'invariants', 'modules');
      expect(disabled(marks, { blobs: [{ path: H, disk: sha('c'), head: sha('a') }, files.blobs[1]] })).toBe('modules pas validés');
      expect(disabled(marks, { note: CHANGED_NOTE })).toBe('modules pas validés');
    });

    it('pendant Vibe aussi : grisé tant que les modules ne sont pas validés (l\'orchestrateur les valide par step.validate)', () => {
      expect(disabled(NOTE_OK, { vibe: true })).toBe('modules pas validés');
    });

    it('grisé sans rien changer à l\'étape en cours ni à la prochaine action', () => {
      const v = vibeView(ready({ repo: repo(['src/app/button.tsx'], [FIRST, HELLO]), outputs: PROOF }));
      expect([primary(v), action(v, 'commit-modules')?.disabled]).toEqual(['commit-modules', 'modules pas validés']);
    });
  });

  describe('diffs', () => {
    it('head : un module modifié depuis le dernier commit ; un fichier identique, absent', () => {
      const v = vibeView(ready({ ...files, blobs: [{ path: H, disk: sha('c'), head: sha('a') }, files.blobs[1]] }));
      expect(v.diffs).toEqual({ head: [{ path: H }], validated: {} });
    });

    it('head : nouveau (added), absent du disque (deleted), triés ; un supprimé qui a déjà son id (m0/0) n\'en reçoit pas', () => {
      const v = vibeView(ready({
        ...files, exists: (p: string) => p === B,
        blobs: [{ path: 'z.ts', disk: sha('z'), head: null }, { path: H, disk: null, head: sha('a') }, files.blobs[1]],
      }));
      expect(v.modules[0].files).toEqual([{ id: 'm0/0', path: H, deleted: true }]);
      expect(v.diffs?.head).toEqual([{ path: H, deleted: true }, { path: 'z.ts', added: true }]);
    });

    it('un fichier validé puis supprimé, sans autre id : r0 ; le même dans head et dans la liste : un seul r0', () => {
      const GONE = 'src/core/gone.ts';
      const v = vibeView(ready({
        ...files, blobs: [...files.blobs, { path: GONE, disk: null, head: sha('g') }],
        validated: { modules: { [H]: sha('a'), [B]: sha('b'), [GONE]: sha('g') } },
      }));
      expect(v.diffs).toEqual({
        head: [{ path: GONE, id: 'r0', deleted: true }],
        validated: { modules: [{ path: GONE, id: 'r0', deleted: true }] },
      });
    });

    it('un chemin de la liste absent des blobs : supprimé, numéroté', () => {
      const v = vibeView(ready({ ...files, validated: { modules: { [H]: sha('a'), [B]: sha('b'), 'old.ts': sha('o') } } }));
      expect(v.diffs?.validated.modules).toEqual([{ path: 'old.ts', id: 'r0', deleted: true }]);
    });

    it('l\'ordre des r<i> : head, puis la Forme, les invariants, les modules ; le même chemin garde son numéro', () => {
      const v = vibeView(ready({
        ...files, blobs: [...files.blobs, { path: 'z.ts', disk: null, head: sha('z') }, { path: 'm.ts', disk: null, head: sha('m') }],
        validated: {
          forme: { [H]: sha('a'), [B]: sha('b'), 'a.ts': sha('1') },
          modules: { [H]: sha('a'), [B]: sha('b'), 'z.ts': sha('z') },
        },
      }));
      expect(v.diffs).toEqual({
        head: [{ path: 'm.ts', id: 'r0', deleted: true }, { path: 'z.ts', id: 'r1', deleted: true }],
        validated: { forme: [{ path: 'a.ts', id: 'r2', deleted: true }], modules: [{ path: 'z.ts', id: 'r1', deleted: true }] },
      });
    });

    it('validated : chaque étape ne compare que les fichiers de sa vue (les tests pour les invariants, les modules pour les autres)', () => {
      const v = vibeView(ready({
        ...files, blobs: [...files.blobs, { path: TEST_PATH, disk: sha('t'), head: sha('t') }],
        validated: { forme: { [H]: sha('a'), [B]: sha('b') }, invariants: { [TEST_PATH]: sha('u') }, modules: { [H]: sha('a'), [B]: sha('c') } },
      }));
      expect(v.diffs?.validated).toEqual({ forme: [], invariants: [{ path: TEST_PATH }], modules: [{ path: B }] });
    });

    it('modules : un fichier que la branche change hors de la Forme (SPEC.md) compte, comme dans la validation ; la note et les tests, non', () => {
      const SPEC = 'SPEC.md';
      const v = vibeView(ready({
        ...files, repo: repo([SPEC, TEST_PATH, note.path], [FIRST, HELLO, BUTTON]),
        blobs: [...files.blobs, { path: SPEC, disk: sha('s'), head: sha('s') }, { path: note.path, disk: sha('n'), head: sha('n') }],
        validated: { modules: { [H]: sha('a'), [B]: sha('b') } },
      }));
      expect(v.diffs?.validated.modules).toEqual([{ path: SPEC, added: true }]);
    });

    it('une liste illisible (null) ou absente : pas d\'entrée pour l\'étape', () => {
      const v = vibeView(ready({ ...files, validated: { modules: null, forme: { [H]: sha('a'), [B]: sha('b') } } }));
      expect(v.diffs?.validated).toEqual({ forme: [] });
    });

    it('blobs absents : rien ne diffère, aucune liste comparée', () => {
      const v = vibeView(ready({ validated: { modules: { [H]: sha('a') } } }));
      expect(v.diffs).toEqual({ head: [], validated: {} });
    });
  });
});

// Les cas d'un test d'invariant, un par un : leur validation, leur lecture (note 0.15.0-invariants-par-cas).
describe('les cas un par un', () => {
  const SRC = 'import { x } from \'./x\';\n\nit("a", () => {\n  expect(x()).toBe(1);\n});\n\nit("b", () => {\n  expect(x()).toBe(2);\n});\n';
  const at = (text: string) => ({ path: TEST_PATH, blob: blobSha(text), text });
  const file = (over: Partial<JourneyInput>, text = SRC) => vibeView(input({ tests: [at(text)], ...over })).invariants[0];
  const facts = (v: VibeView) => v.steps.find((s) => s.id === 'invariants')?.facts;

  it('un cas retouché : lui seul « changed », les autres ok', () => {
    const f = file({ marks: casesOk(SRC) }, SRC.replace('toBe(1)', 'toBe(11)'));
    expect(f.marks).toEqual({ a: 'changed', b: 'ok' });
    expect(f.commonChanged).toBeUndefined();
  });

  it('un import changé : tous « changed », leurs clés dans commonChanged', () => {
    const f = file({ marks: casesOk(SRC) }, SRC.replace('./x', './y'));
    expect(f.marks).toEqual({ a: 'changed', b: 'changed' });
    expect(f.commonChanged).toEqual(['a', 'b']);
  });

  it('un cas refusé garde son verdict tant que rien n\'a changé ; sans validation : null', () => {
    const marks = casesOk(SRC, 'ko');
    delete marks[caseTarget(TEST_PATH, 'b')];
    expect(file({ marks }).marks).toEqual({ a: 'ko', b: null });
  });

  it('les hashes : le bloc de chaque cas et le code commun (caseBlocks)', () => {
    const { blocks, common } = caseBlocks(SRC);
    expect(file({}).hashes).toEqual({ blocks, common });
  });

  it('deux cas de même titre : deux clés, deux marques', () => {
    const twice = 'it("a", () => {\n  expect(1).toBe(1);\n});\n\nit("a", () => {\n  expect(2).toBe(2);\n});\n';
    const marks = casesOk(twice);
    delete marks[caseTarget(TEST_PATH, 'a n° 2')];
    expect(file({ marks }, twice).marks).toEqual({ a: 'ok', 'a n° 2': null });
    // le second retouché : le premier reste validé
    const edited = twice.replace('toBe(2)', 'toBe(3)');
    expect(file({ marks: casesOk(twice) }, edited).marks).toEqual({ a: 'ok', 'a n° 2': 'changed' });
  });

  describe('une lecture d\'une autre version du test', () => {
    const OLD_SRC = SRC.replace('toBe(1)', 'toBe(0)');
    const old = { blob: 'f'.repeat(40), text: `# ${TEST_PATH}\n## a\n\n## b\n`, time: 1, blocks: Object.fromEntries(
      caseBlocks(OLD_SRC).keys.map((k, i) => [k, caseBlocks(OLD_SRC).blocks[i]])) };

    it('staleCases : le cas changé seul ; stale ; readCount compte les autres', () => {
      const v = vibeView(input({ tests: [at(SRC)], readings: [old] }));
      expect(v.invariants[0]).toMatchObject({ stale: true, staleCases: ['a'] });
      expect(facts(v)).toBe('1 fichier · 2 cas · 1 lu');
    });

    it('une lecture sans empreintes de blocs : tous les cas périmés, aucun lu', () => {
      const v = vibeView(input({ tests: [at(SRC)], readings: [{ ...old, blocks: undefined }] }));
      expect(v.invariants[0].staleCases).toEqual(['a', 'b']);
      expect(facts(v)).toBe('1 fichier · 2 cas · 0 lu');
    });

    it('la lecture de son empreinte, ou aucune : ni stale, ni staleCases', () => {
      for (const readings of [[{ ...old, blob: blobSha(SRC) }], []]) {
        const f = file({ readings });
        expect([f.stale, f.staleCases]).toEqual([false, undefined]);
      }
    });

    it('l\'ancienne forme (texte par empreinte, d\'avant la 0.11.0) : la lecture de son empreinte, à jour', () => {
      const v = vibeView(input({ tests: [at(SRC)], readings: { [blobSha(SRC)]: '## a\n\n## b\n' } }));
      expect(v.invariants[0]).toMatchObject({ stale: false, reading: [{ title: 'a' }, { title: 'b' }] });
      expect(facts(v)).toBe('1 fichier · 2 cas · 2 lus');
    });
  });

  it('la lecture de son empreinte qui a sauté un cas : ce cas n\'est pas lu', () => {
    const v = vibeView(input({ tests: [at(SRC)], readings: [{ blob: blobSha(SRC), text: '## a\n', time: 1 }] }));
    expect(facts(v)).toBe('1 fichier · 2 cas · 1 lu');
  });

  it('le cas retouché : l\'étape Invariants décochée', () => {
    const base = { note, repo: repo([], [FIRST]) };
    // l'empreinte du fichier sur le disque : ce que valide l'étape (les verdicts des cas n'y comptent plus)
    const state = (marks: Marks, text: string) => ({ ...base, tests: [at(text)], marks, blobs: [{ path: TEST_PATH, disk: blobSha(text), head: null }] });
    let marks: Marks = { ...NOTE_OK, ...casesOk(SRC) };
    for (const s of ['invariants'] as const) {
      const over = state(marks, SRC);
      const v = vibeView(input(over));
      const contents = Object.fromEntries(CHECKED.map((c) => [c, stepContent(v, marks, c, over.blobs)]));
      marks = validateStep(marks, contents, s, 'ok')!;
    }
    expect(vibeView(input(state(marks, SRC))).steps.find((s) => s.id === 'invariants')?.check?.state).toBe('ok');
    expect(vibeView(input(state(marks, SRC.replace('toBe(1)', 'toBe(11)')))).steps.find((s) => s.id === 'invariants')?.check?.state).toBe('changed');
  });
});

// Le contrôle en trois points (note 0.16.0-controle-en-trois-points) : la note faite par le seul ✓ de l'utilisateur, la
// Forme, les invariants et les modules faits sans validation à la main, la preuve des invariants, la pause du parcours.
describe('le contrôle en trois points (0.16.0)', () => {
  const HELLO_PATH = 'src/core/hello.ts', BUTTON_PATH = 'src/app/button.tsx';
  const LINE = parseNote(NOTE).mustNot[0].text;
  const PROVED = `## [prouvé] ${LINE}\n\nMutant : hello() lit un autre fichier ; le test échoue sur son assertion.\n`;
  const TOI = `## [toi] ${LINE}\n\nLe test reste vert sur chaque mutant essayé.\n`;
  const ALIGNED = '## [agent] Un cas corrigé\n\nFait.\n';
  const STILL_GREEN = '## [toi] Un cas reste vert\n\nÀ trancher.\n';
  const proof = (md: string) => ({ 'preuve.md': out(md) });
  const ALL = repo([], [FIRST, HELLO, BUTTON]);
  const FIX = commit('d', 'revue : un détail', [HELLO_PATH]);
  // La note validée par l'utilisateur ; la Forme, jamais validée à la main ; chaque cas validé.
  const NOTE_ONLY: Marks = { note: ok(noteDesign(NOTE)) };
  const MARKED: Marks = { ...NOTE_ONLY, ...CASES_OK };
  // Les deux modules commités, la preuve qui passe : l'étape Modules faite.
  const modulesDone = (over: Partial<JourneyInput> = {}) => vibeView(ready({ marks: MARKED, repo: ALL, outputs: proof(PROVED), ...over }));
  // Une note à deux lignes « → invariant ».
  const TWO = NOTE.replace('- Planter. → variant suffit', '- Écrire hors du dossier. → invariant');
  // Une note sans ligne « → invariant » ; son premier commit ne porte que la note.
  const NO_INV = NOTE.replace('- Lire un autre fichier. → invariant\n', '');
  const noInv = (over: Partial<JourneyInput> = {}) => vibeView(input({
    note: { ...note, text: NO_INV }, marks: { note: ok(noteDesign(NO_INV)) }, repo: repo([], [commit('a', 'Note, forme', [NOTE_PATH])]), ...over,
  }));
  const step = (v: VibeView, id: string) => v.steps.find((s) => s.id === id)!;

  describe('la note, la Forme, les invariants', () => {
    it('la note sans ✓, Vibe en cours (au rythme par défaut ou en express) : l\'étape Note pas faite', () => {
      const checked = vibeView(ready({ vibe: true, marks: MARKED }));
      expect(status(checked).note).toBe('done');
      for (const express of [false, true]) {
        const v = vibeView(ready({ vibe: true, express, marks: CASES_OK }));
        expect(status(v).note).toBe('current');
        expect(status(v).invariants).not.toBe('done');
      }
    });

    it('la Forme posée, jamais validée à la main : l\'étape Forme faite', () => {
      const v = vibeView(ready({ marks: NOTE_ONLY }));
      expect([status(v).note, status(v).forme]).toEqual(['done', 'done']);
      // sans module posé : pas faite
      const text = NOTE.slice(0, NOTE.indexOf('## Forme'));
      expect(status(vibeView(input({ note: { ...note, text }, marks: { note: ok(noteDesign(text)) } }))).forme).toBe('current');
    });

    it('les tests alignés (align.md sans [toi]), aucun cas coché, le premier commit fait : l\'étape Invariants faite', () => {
      const aligned = (md: string, over: Partial<JourneyInput> = {}) => vibeView(input({
        note, tests: [test], marks: NOTE_ONLY, repo: repo([], [FIRST]), outputs: { 'align.md': out(md) }, ...over,
      }));
      const v = aligned(ALIGNED);
      expect([status(v).invariants, status(v).modules]).toEqual(['done', 'current']);
      // le premier commit pas fait (les tests encore à commiter) : pas faite
      expect(status(aligned(ALIGNED, { repo: repo([NOTE_PATH, TEST_PATH]) })).invariants).toBe('current');
    });

    it('un align.md avec une rubrique [toi], aucun cas coché : l\'étape Invariants pas faite', () => {
      const aligned = (md: string) => vibeView(input({
        note, tests: [test], marks: NOTE_ONLY, repo: repo([], [FIRST]), outputs: { 'align.md': out(md) },
      }));
      // témoin : le même align.md sans [toi] la fait
      expect(status(aligned(ALIGNED)).invariants).toBe('done');
      expect(status(aligned(STILL_GREEN)).invariants).toBe('current');
      expect(status(aligned(`${ALIGNED}\n${STILL_GREEN}`)).invariants).toBe('current');
    });

    it('chaque cas validé à la main, sans align.md : l\'étape Invariants faite', () => {
      expect(status(vibeView(ready({ marks: MARKED }))).invariants).toBe('done');
      // un cas sans ✓, sans align.md : pas faite
      expect(status(vibeView(ready({ marks: NOTE_ONLY }))).invariants).toBe('current');
    });

    it('les cas pas validés, pas alignés : Écrire les invariants fait, la pause (Vibe) une fois lus, jamais attendre un ✓', () => {
      // lus : la lecture passe avant (Lire en pseudo-code, 0.16.0-ecran-essentiel)
      const v = vibeView(input({ note, tests: [test], readings: READINGS, marks: NOTE_ONLY, repo: repo([NOTE_PATH, TEST_PATH]) }));
      expect([status(v).invariants, primary(v)]).toEqual(['current', 'vibe']);
    });
  });

  describe('la preuve et l\'étape Modules', () => {
    it('les modules commités, la preuve qui passe : l\'étape Modules faite', () => {
      const v = modulesDone();
      expect([status(v).modules, status(v).revue, v.proof?.state]).toEqual(['done', 'current', 'ok']);
    });

    it('les modules commités, pas de preuve.md, une preuve bloquée ou incomplète : pas faite, en express aussi', () => {
      const two = { note: { ...note, text: TWO }, marks: { note: ok(noteDesign(TWO)), ...CASES_OK } };
      const cases: [string, Partial<JourneyInput>, string][] = [
        ['pas de preuve.md', { outputs: {} }, 'missing'],
        ['une ligne [toi]', { outputs: proof(TOI) }, 'blocked'],
        ['une ligne de la note sans rubrique', { ...two, outputs: proof(PROVED) }, 'missing'],
      ];
      for (const [, over, state] of cases) {
        for (const express of [false, true]) {
          const v = modulesDone({ ...over, express, vibe: express });
          expect([status(v).modules, primary(v), v.proof?.state]).toEqual(['current', 'prove', state]);
        }
      }
      // la ligne non prouvée reste dans le relevé
      expect(modulesDone({ outputs: proof(TOI) }).proof?.lines.filter((l) => !l.proved).map((l) => l.line)).toEqual([LINE]);
    });

    it('la preuve passée, un module corrigé ensuite : l\'étape Modules reste faite, Prouver les invariants n\'est pas la prochaine action', () => {
      // un commit de plus qui touche un module
      const later = modulesDone({ repo: repo([], [FIRST, HELLO, BUTTON, FIX]) });
      expect([status(later).modules, primary(later)]).toEqual(['done', 'vibe']);   // la pause après les modules : jamais la preuve
      // une correction pas encore commitée : l'étape attend son commit (comme avant), jamais la preuve
      const fixing = modulesDone({ repo: { ...ALL, dirty: [HELLO_PATH] } });
      expect([status(fixing).modules, primary(fixing)]).toEqual(['current', 'commit-modules']);
    });

    it('la note sans ligne « → invariant » : rien à prouver, l\'étape faite, Prouver les invariants masquée, ses faits le disent', () => {
      const v = noInv({ repo: repo([], [commit('a', 'Note, forme', [NOTE_PATH]), HELLO, BUTTON]) });
      expect([status(v).modules, v.proof?.state, action(v, 'prove')?.hidden]).toEqual(['done', 'none', true]);
      expect(step(v, 'invariants').facts).toBe('0 fichier · 0 cas · 0 lu · rien à prouver');
      expect(step(noInv({ lang: 'en', repo: repo([], [commit('a', 'Note, forme', [NOTE_PATH]), HELLO, BUTTON]) }), 'invariants').facts)
        .toBe('0 files · 0 cases · 0 read · nothing to prove');
      // avec la ligne, l'action est montrée
      expect(action(modulesDone(), 'prove')?.hidden).toBe(false);
    });

    it('chaque module commencé, la preuve pas passée : Prouver les invariants est la prochaine action, avant Commiter les modules', () => {
      const both = repo([HELLO_PATH, BUTTON_PATH], [FIRST]);
      expect(primary(vibeView(ready({ marks: MARKED, repo: both })))).toBe('prove');
      // la preuve passée : Commiter les modules
      expect(primary(vibeView(ready({ marks: MARKED, repo: both, outputs: proof(PROVED) })))).toBe('commit-modules');
      // un module pas encore commencé : Générer les modules d'abord
      expect(primary(vibeView(ready({ marks: MARKED, repo: repo([HELLO_PATH], [FIRST]) })))).toBe('modules');
      // un commit préparé passe avant
      expect(primary(vibeView(ready({ marks: MARKED, repo: both, outputs: { 'commit.md': out('x') } })))).toBe('commit');
      // sans ligne « → invariant » : rien à prouver, Commiter les modules directement
      expect(primary(noInv({ repo: repo([HELLO_PATH, BUTTON_PATH], [commit('a', 'Note, forme', [NOTE_PATH])]) }))).toBe('commit-modules');
    });

    it('les faits de l\'étape Invariants disent l\'état de la preuve, une fois chaque module commencé ; ceux des Modules, jamais', () => {
      const facts = (v: VibeView) => [step(v, 'invariants').facts, step(v, 'modules').facts];
      expect(facts(modulesDone())).toEqual(['1 fichier · 2 cas · 2 lus · invariants prouvés', '2 / 2 modules']);
      expect(facts(modulesDone({ outputs: proof(TOI) }))).toEqual(['1 fichier · 2 cas · 2 lus · preuve bloquée : à toi', '2 / 2 modules']);
      expect(facts(modulesDone({ outputs: {} }))).toEqual(['1 fichier · 2 cas · 2 lus · invariants pas prouvés', '2 / 2 modules']);
      // en anglais
      expect(step(modulesDone({ lang: 'en', outputs: proof(TOI) }), 'invariants').facts).toBe('1 file · 2 cases · 2 read · proof blocked: yours to decide');
      // pas un module commencé : rien à dire de la preuve
      expect(facts(vibeView(ready({ marks: MARKED })))).toEqual(['1 fichier · 2 cas · 2 lus', '0 / 2 modules']);
    });

    it('un preuve.md d\'avant (une autre ligne) ne prouve pas la ligne d\'aujourd\'hui', () => {
      const other = '## [prouvé] Une ligne qui n\'est pas dans la note.\n\nMutant.\n';
      expect(status(modulesDone({ outputs: proof(other) })).modules).not.toBe('done');
      expect(modulesDone({ outputs: proof(other) }).proof?.state).toBe('missing');
    });
  });

  describe('la pause', () => {
    // Les tests écrits, alignés ou validés, lus, encore à commiter : rien n'est commité avant que l'utilisateur ait regardé.
    const UNCOMMITTED = repo([NOTE_PATH, TEST_PATH]);

    it('les tests prêts et lus, rien de commité : la pause après les invariants, avant le premier commit, Vibe la prochaine action', () => {
      const v = vibeView(ready({ marks: MARKED, repo: UNCOMMITTED }));
      expect([v.pause, status(v).invariants, primary(v)]).toEqual(['invariants', 'current', 'vibe']);
      expect(action(v, 'vibe')).toMatchObject({ hidden: false, disabled: null });
      // Préparer le commit reste à portée : c'est ce que le moteur demande une fois repris
      expect(action(v, 'commit-prepare')).toMatchObject({ hidden: false });
      // alignés sans aucun cas coché : la pause de même
      const aligned = vibeView(ready({ marks: NOTE_ONLY, repo: UNCOMMITTED, outputs: { 'align.md': out(ALIGNED) } }));
      expect([aligned.pause, primary(aligned)]).toEqual(['invariants', 'vibe']);
      // ni alignés ni validés : la pause de même (les tests sont écrits et lus ; l'alignement ne la conditionne pas)
      const unaligned = vibeView(ready({ marks: NOTE_ONLY, repo: UNCOMMITTED }));
      expect([unaligned.pause, primary(unaligned)]).toEqual(['invariants', 'vibe']);
      // un écart [toi] de l'alignement : la pause de même, le moteur ne fait pas le premier commit sans la reprise de l'utilisateur
      const gap = vibeView(ready({ marks: NOTE_ONLY, repo: UNCOMMITTED, outputs: { 'align.md': out(STILL_GREEN) } }));
      expect([gap.pause, primary(gap)]).toEqual(['invariants', 'vibe']);
    });

    it('le premier commit fait : plus de pause après les invariants, Générer les modules', () => {
      const v = vibeView(ready({ marks: MARKED }));
      expect([v.pause ?? null, status(v).invariants, primary(v)]).toEqual([null, 'done', 'modules']);
      // un module commencé : pas de pause non plus
      expect(vibeView(ready({ marks: MARKED, repo: repo([HELLO_PATH], [FIRST]) })).pause ?? null).toBeNull();
    });

    it('sans ligne « → invariant », la Forme posée, pas encore de commit : la pause (la forme est à voir) ; le premier commit fait : plus de pause', () => {
      const before = noInv({ repo: repo() });
      expect([before.pause, primary(before)]).toEqual(['invariants', 'vibe']);
      expect(noInv().pause ?? null).toBeNull();
    });

    it('les modules faits, ni vérifications ni ponytail review : la pause après les modules', () => {
      const v = modulesDone();
      expect([v.pause, primary(v)]).toEqual(['modules', 'vibe']);
    });

    it('la revue commencée : plus de pause', () => {
      const checks = out('{"items":[{"name":"tests","ok":true}]}');
      expect(modulesDone({ outputs: { ...proof(PROVED), 'checks.json': checks } }).pause ?? null).toBeNull();
      expect(modulesDone({ outputs: { ...proof(PROVED), 'ponytail.md': out('- rien') } }).pause ?? null).toBeNull();
      // des vérifications en échec comptent aussi : la revue est commencée
      expect(modulesDone({ outputs: { ...proof(PROVED), 'checks.json': out('{"items":[{"name":"tests","ok":false}]}') } }).pause ?? null).toBeNull();
      // les modules pas faits (la preuve manque) : pas de pause après les modules
      expect(modulesDone({ outputs: {} }).pause ?? null).toBeNull();
    });

    it('la note commitée puis changée, son ✓ tombé : la pause de la note', () => {
      const changed = { ...note, text: NOTE.replace('dit bonjour.', 'dit bonjour, fort.') };
      const v = vibeView(ready({ note: changed, marks: MARKED }));
      expect([v.pause, status(v).note]).toEqual(['note', 'current']);
      // la note jamais commitée : pas de pause
      expect(vibeView(input({ note: changed, marks: NOTE_ONLY, repo: repo() })).pause ?? null).toBeNull();
      // ignorée par git : le premier commit tient lieu du commit de la note
      const skels = commit('a', 'Squelettes, invariants', [TEST_PATH, HELLO_PATH]);
      expect(vibeView(ready({ note: { ...changed, ignored: true }, marks: MARKED, repo: repo([], [skels]) })).pause).toBe('note');
      expect(vibeView(ready({ note: { ...changed, ignored: true }, marks: MARKED, repo: repo() })).pause ?? null).toBeNull();
      // un module commencé : la pause revient aussi (0.16.0-ligne-apres-pr), le parcours ne recule pas pour autant
      expect(vibeView(ready({ note: changed, marks: MARKED, repo: repo([], [FIRST, HELLO]) })).pause).toBe('note');
      // la note refusée (✗), commitée : sans ✓, la pause de la note
      const refused: Marks = { note: { hash: blobSha(noteDesign(NOTE)), verdict: 'ko' }, ...CASES_OK };
      expect(vibeView(ready({ marks: refused })).pause).toBe('note');
    });

    it('le rythme express au relevé : les mêmes pauses (il ne les calcule pas), recopié', () => {
      const at = (over: Partial<JourneyInput>, express?: boolean) => vibeView(ready({ marks: MARKED, ...over, ...(express === undefined ? {} : { express }) }));
      for (const over of [{}, { repo: repo([NOTE_PATH, TEST_PATH]) }, { repo: ALL, outputs: proof(PROVED) }, { marks: { ...CASES_OK } }]) {
        const pauses = [undefined, false, true].map((express) => at(over, express).pause ?? null);
        expect(new Set(pauses).size).toBe(1);
      }
      expect([at({}).express, at({}, false).express, at({}, true).express]).toEqual([undefined, false, true]);
      expect(at({ repo: repo([NOTE_PATH, TEST_PATH]) }, true).pause).toBe('invariants');
      expect(at({ repo: ALL, outputs: proof(PROVED) }, true).pause).toBe('modules');
    });

    it('le relecteur : jamais de pause ni de preuve', () => {
      const CARD = JSON.stringify({ number: 12, head: 'feat/G2-1', author: 'kb' });
      const v = vibeView(input({
        flow: 'review', pr: 12, note, tests: [test], repo: repo([], [FIRST]), checkout: { branch: 'feat/G2-1', dirty: false },
        outputs: { 'pr-12.json': out(CARD) }, marks: MARKED, express: false,
      }));
      expect([v.pause ?? null, v.proof]).toEqual([null, undefined]);
    });
  });

  describe('Lire en pseudo-code, une action du moteur (0.16.0-ecran-essentiel)', () => {
    // Une lecture d'une version précédente du test : ses cas sont tous périmés.
    const OLD = { blob: 'f'.repeat(40), text: `# ${TEST_PATH}\n${READING}`, time: 1 };
    // La note validée, le test écrit et à commiter ; la Forme se pose sans ✓.
    const written = (over: Partial<JourneyInput> = {}) => vibeView(input({
      note, marks: NOTE_ONLY, tests: [test], readings: [], repo: repo([NOTE_PATH, TEST_PATH]), ...over,
    }));

    it('des tests écrits, pas lus : Lire en pseudo-code, la prochaine action, au rythme par défaut, en Vibe, en express', () => {
      for (const over of [{}, { vibe: true }, { vibe: true, express: true }, { repo: repo() }]) {
        const v = written(over);
        expect([status(v).invariants, primary(v)]).toEqual(['current', 'read-invariants']);
      }
    });

    it('un test dont la lecture est périmée : de même ; la lecture de son empreinte la remplace, tous lus : la pause (Vibe)', () => {
      expect(primary(written({ readings: [OLD] }))).toBe('read-invariants');
      expect(primary(written({ readings: [OLD, ...READINGS] }))).toBe('vibe');
    });

    it('plusieurs tests, un seul pas lu : Lire en pseudo-code ; tous lus : la pause (Vibe)', () => {
      const other = 'it("autre cas", () => {});\n';
      const second = { path: 'src/app/tests/invariants/other.test.ts', blob: blobSha(other), text: other };
      const both = { tests: [test, second], repo: repo([NOTE_PATH, TEST_PATH, second.path]) };
      expect(primary(written({ ...both, readings: READINGS }))).toBe('read-invariants');
      expect(primary(written({ ...both, readings: [...READINGS, { blob: second.blob, text: '## autre cas\n', time: 1 }] }))).toBe('vibe');
    });

    it('tous lus : la pause (Vibe), Préparer le commit à portée ; un commit préparé : Commiter, comme avant', () => {
      expect(primary(written({ readings: READINGS }))).toBe('vibe');
      expect(action(written({ readings: READINGS }), 'commit-prepare')).toMatchObject({ hidden: false });
      expect(primary(written({ readings: READINGS, outputs: { 'commit.md': out('x') } }))).toBe('commit');
    });

    it('des tests pas lus, un commit préparé : lire d\'abord (le commit attend la lecture)', () => {
      expect(primary(written({ outputs: { 'commit.md': out('x') } }))).toBe('read-invariants');
    });

    it('des tests prêts mais pas lus, rien de commité : la lecture d\'abord, pas de pause ; lus : la pause', () => {
      const waiting = (over: Partial<JourneyInput> = {}) => vibeView(ready({ marks: MARKED, repo: repo([NOTE_PATH, TEST_PATH]), ...over }));
      const unread = waiting({ readings: [] });
      expect([unread.pause ?? null, primary(unread)]).toEqual([null, 'read-invariants']);
      // une lecture périmée attend aussi
      expect(waiting({ readings: [OLD] }).pause ?? null).toBeNull();
      // la lecture de son empreinte venue : la pause
      expect(waiting({ readings: [OLD, ...READINGS] }).pause).toBe('invariants');
      // témoin : tous lus d'emblée, la pause
      expect(waiting().pause).toBe('invariants');
    });

    it('des tests pas lus, le premier commit fait : plus la prochaine action, et aucune pause, lus ou pas', () => {
      const v = vibeView(ready({ marks: MARKED, readings: [] }));
      expect([status(v).invariants, v.pause ?? null, primary(v)]).toEqual(['done', null, 'modules']);
      expect(vibeView(ready({ marks: MARKED })).pause ?? null).toBeNull();
    });

    it('tous lus, rien de commité : la pause, Vibe ; le premier commit fait ou un module commencé : plus de pause', () => {
      const v = vibeView(ready({ marks: MARKED, repo: repo([NOTE_PATH, TEST_PATH]) }));
      expect([v.pause, primary(v)]).toEqual(['invariants', 'vibe']);
      expect(vibeView(ready({ marks: MARKED })).pause ?? null).toBeNull();
      expect(vibeView(ready({ marks: MARKED, repo: repo([HELLO_PATH], [FIRST]), readings: [] })).pause ?? null).toBeNull();
    });

    it('sans ligne « → invariant » : rien à lire, comme avant', () => {
      // un test de la branche pas lu, aucune ligne : jamais Lire en pseudo-code, la pause d'avant le premier commit
      const v = noInv({ tests: [test], repo: repo() });
      expect([v.pause, primary(v)]).toEqual(['invariants', 'vibe']);
      expect(noInv({ tests: [test] }).pause ?? null).toBeNull();
    });

    it('le relecteur : Lire en pseudo-code n\'est jamais la prochaine action, aucun ✓', () => {
      const CARD = JSON.stringify({ number: 12, head: 'feat/G2-1', author: 'kb' });
      const v = vibeView(input({
        flow: 'review', pr: 12, note, tests: [test], readings: [], repo: repo([], [FIRST]), checkout: { branch: 'feat/G2-1', dirty: false },
        outputs: { 'pr-12.json': out(CARD) }, marks: MARKED,
      }));
      expect([primary(v), v.pause ?? null, v.steps.some((st) => Object.hasOwn(st, 'check'))]).toEqual([null, null, false]);
      expect(action(v, 'read-invariants')).toMatchObject({ primary: false, hidden: false });
      expect(step(v, 'invariants').facts).not.toMatch(/prouv|prove/);
    });

    it('les actions du relevé : les mêmes qu\'avant, aucune retirée, quel que soit l\'état', () => {
      const ids = (flow: ActionDef['flow']) => ACTIONS.filter((a) => a.flow === 'both' || a.flow === flow).map((a) => a.id).filter((id) => id !== 'guide');
      for (const v of [written(), written({ readings: READINGS }), vibeView(ready({ marks: MARKED })), modulesDone(), noInv()]) {
        expect(v.actions.map((a) => a.id)).toEqual(ids('create'));
      }
      const review = vibeView(input({ flow: 'review', pr: 12, note }));
      expect(review.actions.map((a) => a.id)).toEqual(ids('review'));
      // la liste « Avant la PR » et le réglage de la vue Modules restent au relevé
      const v = vibeView(ready({ marks: MARKED, modulesView: 'list' }));
      expect([v.checklist.length, v.modulesView]).toEqual([5, 'list']);
    });
  });

  describe('un ✓ d\'étape retiré à la main : la pause sur cette étape', () => {
    const STEPS = ['forme', 'invariants', 'modules'] as const;
    const BLOBS = [TEST_PATH, HELLO_PATH, BUTTON_PATH].map((path) => ({ path, disk: blobSha(path), head: blobSha(path) }));
    // Les trois étapes faites, la preuve passée, les empreintes du disque relevées : sans retrait, la pause après les modules.
    const build = (over: Partial<JourneyInput> = {}) => vibeView(ready({ marks: MARKED, repo: ALL, outputs: proof(PROVED), blobs: BLOBS, ...over }));
    // Ce que valide l'étape aujourd'hui, comme le relevé le voit.
    const hashOf = (s: typeof STEPS[number], over: Partial<JourneyInput> = {}) => {
      const v = build(over);
      return stepContents({ note: v.note, invariants: v.invariants, modules: v.modules, changed: (over.repo ?? ALL).changed }, MARKED, over.blobs ?? BLOBS)[s]!.hash;
    };
    // Les marques d'un retrait : celles de l'utilisateur, plus le retrait des étapes dites pour le contenu d'aujourd'hui.
    const without = (steps: typeof STEPS[number][], over: Partial<JourneyInput> = {}, base: Marks = MARKED): Marks =>
      steps.reduce((m, s) => withdraw(m, s, hashOf(s, over)), base);
    const FIRST_ONLY = { repo: repo([], [FIRST]), outputs: {} };

    it('le ✓ de la Forme, des invariants, des modules retiré, son contenu inchangé : la pause sur cette étape', () => {
      for (const s of STEPS) expect(build({ marks: without([s]) }).pause).toBe(`withdrawn:${s}`);
    });

    it('cette pause, en express au relevé : la même', () => {
      for (const s of STEPS) for (const express of [false, true]) expect(build({ marks: without([s]), express }).pause).toBe(`withdrawn:${s}`);
    });

    it('le contenu de l\'étape changé depuis le retrait : plus cette pause', () => {
      // les invariants et les modules : un fichier retouché sur le disque
      const edited = BLOBS.map((b) => ({ ...b, disk: blobSha(`${b.path} retouché`) }));
      for (const s of ['invariants', 'modules'] as const) expect(build({ marks: without([s]), blobs: edited }).pause).toBe('modules');
      // la Forme : sa section réécrite (la conception de la note, elle, ne change pas)
      const marks = without(['forme']);
      expect(build({ marks, note: { ...note, text: NOTE.replace('le bouton', 'le gros bouton') } }).pause).toBe('modules');
    });

    it('le retrait oublié (l\'étape revalidée à la main) : plus cette pause', () => {
      for (const s of STEPS) expect(build({ marks: withdraw(without([s]), s, null) }).pause).toBe('modules');
    });

    it('la Forme et les modules retirés tous les deux : la pause sur la Forme', () => {
      expect(build({ marks: without(['modules', 'forme']) }).pause).toBe('withdrawn:forme');
      expect(build({ marks: without(['modules', 'invariants']) }).pause).toBe('withdrawn:invariants');
    });

    it('la note sans son ✓ et une étape retirée : la pause de la note', () => {
      expect(build({ marks: without(['forme'], {}, CASES_OK) }).pause).toBe('note');
    });

    it('une étape retirée, rien de commité, aucun module commencé : sa pause, pas celle d\'après les invariants', () => {
      const UNCOMMITTED = { repo: repo([NOTE_PATH, TEST_PATH]), outputs: {} };
      expect(vibeView(ready({ marks: MARKED, blobs: BLOBS, ...UNCOMMITTED })).pause).toBe('invariants');
      for (const s of ['forme', 'invariants'] as const) {
        expect(build({ ...UNCOMMITTED, marks: without([s], UNCOMMITTED) }).pause).toBe(`withdrawn:${s}`);
      }
      // le premier commit fait : la pause du retrait tient toujours
      for (const s of ['forme', 'invariants'] as const) {
        expect(build({ ...FIRST_ONLY, marks: without([s], FIRST_ONLY) }).pause).toBe(`withdrawn:${s}`);
      }
    });

    // Après l'essai sur gt-plugins (0.16.0-ecran-essentiel, 25 novembre) : un test écrit ou réécrit après le premier regard
    // (une correction, l'alignement d'une preuve) ramène la pause après les invariants, à tout moment du parcours.
    describe('les tests changés après leur validation', () => {
      const VALID = (['forme', 'invariants'] as const).reduce((marks: Marks, s) => {
        const v = build({ marks });
        return validateStep(marks, stepContents({ note: v.note, invariants: v.invariants, modules: v.modules, changed: ALL.changed }, marks, BLOBS), s, 'ok')!;
      }, MARKED);
      const EDITED = BLOBS.map((b) => (b.path === TEST_PATH ? { ...b, disk: blobSha('le test réécrit') } : b));
      const checkOf = (v: VibeView) => v.steps.find((x) => x.id === 'invariants')?.check?.state;

      it('au rythme par défaut, lus : la pause après les invariants revient, les modules faits ou seulement le premier commit ; Reprendre proposé', () => {
        // témoin : rien de changé, la pause après les modules
        expect([checkOf(build({ marks: VALID })), build({ marks: VALID }).pause]).toEqual(['ok', 'modules']);
        for (const over of [{}, FIRST_ONLY]) {
          const v = build({ ...over, marks: VALID, blobs: EDITED });
          expect([checkOf(v), v.pause]).toEqual(['changed', 'invariants']);
          expect(action(v, 'vibe')).toMatchObject({ hidden: false });
        }
      });

      it('pas encore lus (la lecture en pseudo-code d\'abord) : pas de pause', () => {
        expect(build({ marks: VALID, blobs: EDITED, readings: [] }).pause ?? null).not.toBe('invariants');
      });

      it('en express : pas de pause (le système revalide)', () => {
        expect(build({ marks: VALID, blobs: EDITED, express: true }).pause).toBe('modules');
      });

      it('jamais validés (avant le tout premier regard, le premier commit fait) : pas cette pause', () => {
        expect(build({ marks: MARKED, blobs: EDITED }).pause).toBe('modules');
      });

      it('un test noté « À revoir » en plus : sa pause passe devant', () => {
        const ko = { ...VALID, [caseTarget(TEST_PATH, 'dit bonjour')]: { ...CASES_OK[caseTarget(TEST_PATH, 'dit bonjour')], verdict: 'ko' as const } };
        expect(build({ marks: ko, blobs: EDITED }).pause).toBe('withdrawn:invariants');
      });
    });

    // Après l'essai (0.16.0-ecran-essentiel) : un test noté « À revoir » par l'utilisateur retient le moteur, comme un ✓ retiré.
    describe('un test noté « À revoir »', () => {
      const KO_ONE: Marks = { ...MARKED, [caseTarget(TEST_PATH, 'dit bonjour')]: { ...CASES_OK[caseTarget(TEST_PATH, 'dit bonjour')], verdict: 'ko' } };
      const UNCOMMITTED = { repo: repo([NOTE_PATH, TEST_PATH]), outputs: {} };

      it('avant le premier commit, aux deux rythmes : la pause sur l\'étape Invariants, l\'action du moteur masquée', () => {
        for (const express of [false, true]) {
          const v = vibeView(ready({ marks: KO_ONE, ...UNCOMMITTED, express }));
          expect(v.pause).toBe('withdrawn:invariants');
          expect(action(v, 'vibe')).toMatchObject({ hidden: true, disabled: 'étape refusée' });
          expect(primary(v)).not.toBe('vibe');
        }
        // témoin : tous validés, la pause d'après les invariants, le moteur proposé
        expect(vibeView(ready({ marks: MARKED, ...UNCOMMITTED })).pause).toBe('invariants');
      });

      it('plus tard aussi (le premier commit fait, les modules faits) : la même pause', () => {
        expect(vibeView(ready({ marks: KO_ONE })).pause).toBe('withdrawn:invariants');
        expect(vibeView(ready({ marks: KO_ONE, repo: ALL, outputs: proof(PROVED) })).pause).toBe('withdrawn:invariants');
      });

      it('le test corrigé (sa marque tombe), ou revalidé : plus cette pause', () => {
        // le bloc du cas a changé depuis la marque : elle ne vaut plus pour ce contenu
        const moved: Marks = { ...MARKED, [caseTarget(TEST_PATH, 'dit bonjour')]: { hash: 'autre', common: 'c', verdict: 'ko' } };
        expect(vibeView(ready({ marks: moved, ...UNCOMMITTED })).pause).not.toBe('withdrawn:invariants');
        expect(vibeView(ready({ marks: MARKED, ...UNCOMMITTED })).pause).toBe('invariants');
      });

      it('la Forme retirée et un test à revoir : la pause sur la Forme d\'abord', () => {
        expect(build({ marks: without(['forme'], {}, KO_ONE) }).pause).toBe('withdrawn:forme');
      });

      it('le relecteur : un test à revoir ne fait aucune pause', () => {
        const CARD = JSON.stringify({ number: 12, head: 'feat/G2-1', author: 'kb' });
        const v = vibeView(input({
          flow: 'review', pr: 12, note, tests: [test], readings: READINGS, repo: repo([], [FIRST]), checkout: { branch: 'feat/G2-1', dirty: false },
          outputs: { 'pr-12.json': out(CARD) }, marks: KO_ONE,
        }));
        expect(v.pause ?? null).toBeNull();
      });
    });

    it('à cette pause : l\'action du moteur masquée, sa raison « étape refusée » ; la pause levée : proposée de nouveau', () => {
      for (const s of STEPS) {
        const v = build({ marks: without([s]) });
        expect(action(v, 'vibe')).toMatchObject({ hidden: true, disabled: 'étape refusée' });
        expect(primary(v)).not.toBe('vibe');
        expect(action(build({ marks: without([s]), lang: 'en' }), 'vibe')).toMatchObject({ hidden: true, disabled: 'step rejected' });
        // levée : revalidée à la main (le retrait oublié)
        expect(action(build({ marks: withdraw(without([s]), s, null) }), 'vibe')).toMatchObject({ hidden: false, disabled: null });
      }
      // la note sans son ✓ passe avant : sa raison
      expect(action(build({ marks: without(['forme'], {}, CASES_OK) }), 'vibe')).toMatchObject({ hidden: true, disabled: 'Valider d\'abord la note' });
      // les invariants retirés, au premier commit : pas Reprendre non plus
      const first = build({ ...FIRST_ONLY, marks: without(['invariants'], FIRST_ONLY) });
      expect([action(first, 'vibe')?.hidden, primary(first)]).toEqual([true, 'modules']);
    });

    it('à cette pause : l\'étape reste faite, ses actions à la main restent proposées', () => {
      for (const s of STEPS) {
        const v = build({ marks: without([s]) });
        expect(status(v)[s]).toBe('done');
      }
      const v = build({ marks: without(['forme', 'invariants', 'modules']) });
      for (const id of ['forme', 'invariants', 'prove']) expect(action(v, id)).toMatchObject({ hidden: false, disabled: null });
    });

    it('chaque étape dont le ✓ retiré tient le dit (check.withdrawn), pas seulement la première que nomme la pause', () => {
      const flags = (v: VibeView) => v.steps.map((st) => st.check?.withdrawn ?? false);
      // aucun retrait : aucune étape ne le dit
      expect(flags(build())).toEqual([false, false, false, false, false, false]);
      // une étape : elle seule
      for (const s of STEPS) expect(flags(build({ marks: without([s]) }))).toEqual([false, ...STEPS.map((x) => x === s), false, false]);
      // la Forme et les modules : les deux, la pause nomme la Forme
      const two = build({ marks: without(['modules', 'forme']) });
      expect([flags(two), two.pause]).toEqual([[false, true, false, true, false, false], 'withdrawn:forme']);
      // les trois
      expect(flags(build({ marks: without([...STEPS]) }))).toEqual([false, true, true, true, false, false]);
    });

    it('le retrait qui ne tient plus (contenu changé, étape revalidée à la main) : l\'étape ne le dit plus, les autres le disent encore', () => {
      const marks = without(['invariants', 'modules']);
      expect(step(build({ marks }), 'modules').check?.withdrawn).toBe(true);   // témoin
      // un module retouché sur le disque : les modules ne le disent plus, les invariants si ; la pause suit
      const edited = BLOBS.map((b) => (b.path === TEST_PATH ? b : { ...b, disk: blobSha(`${b.path} retouché`) }));
      const v = build({ marks, blobs: edited });
      expect([step(v, 'invariants').check?.withdrawn, step(v, 'modules').check?.withdrawn, v.pause]).toEqual([true, undefined, 'withdrawn:invariants']);
      // la Forme réécrite
      const forme = build({ marks: without(['forme']), note: { ...note, text: NOTE.replace('le bouton', 'le gros bouton') } });
      expect(step(forme, 'forme').check?.withdrawn).toBeUndefined();
      // le retrait oublié : revalidée à la main
      for (const s of STEPS) {
        expect(step(build({ marks: without([s]) }), s).check?.withdrawn).toBe(true);
        expect(step(build({ marks: withdraw(without([s]), s, null) }), s).check?.withdrawn).toBeUndefined();
      }
    });

    it('la preuve bloquée : les faits des Invariants le disent, pas ceux des Modules, un ✓ retiré ou non', () => {
      for (const marks of [MARKED, without(['invariants'])]) {
        const v = build({ marks, outputs: proof(TOI) });
        expect(step(v, 'invariants').facts).toContain('preuve bloquée : à toi');
        expect(step(v, 'modules').facts).not.toMatch(/preuve|prouv/);
      }
    });

    it('le relecteur, un retrait dans les marques : aucune pause', () => {
      const CARD = JSON.stringify({ number: 12, head: 'feat/G2-1', author: 'kb' });
      const v = vibeView(input({
        flow: 'review', pr: 12, note, tests: [test], repo: repo([], [FIRST]), checkout: { branch: 'feat/G2-1', dirty: false },
        outputs: { 'pr-12.json': out(CARD) }, marks: withdraw(MARKED, 'forme', blobSha(parseNote(NOTE).forme)), express: false,
      }));
      expect(v.pause ?? null).toBeNull();
    });
  });

  describe('qui a validé, et ce qui reste à la main', () => {
    it('une étape validée par le système : son relevé le dit ; à la main : non', () => {
      const system: Marks = { ...MARKED, forme: { ...NOTE_OK.forme, by: 'system' } };
      const v = vibeView(ready({ marks: system }));
      expect([step(v, 'note').check?.by, step(v, 'forme').check?.by]).toEqual([undefined, 'system']);
      expect(step(v, 'forme').check?.state).toBe('ok');
      const hand = vibeView(ready({ marks: { ...NOTE_OK, ...CASES_OK } }));
      expect(Object.hasOwn(step(hand, 'forme').check!, 'by')).toBe(false);
      // pas validée : pas de by
      expect(Object.hasOwn(step(hand, 'invariants').check!, 'by')).toBe(false);
    });

    describe('Vérifier la conception, et ce qu\'a rendu la dernière vérification', () => {
      const DESIGN: Marks = { design: { hash: NOTE_PATH, verdict: 'ok' } };
      const verifiedFor = (text: string): Marks => ({ ...DESIGN, verified: ok(noteDesign(text)) });
      const check = (over: Partial<JourneyInput>) => action(vibeView(input({ note, ...over })), 'design-check');
      const EMPTY = { path: NOTE_PATH, text: '# T\n\n## Ce que ça fait\n\n## Forme\n```\nsrc/core/hello.ts   x\n```\n', before: null };

      it('proposée dès que la note est rédigée, vérifiée ou pas, validée ou pas', () => {
        for (const marks of [{}, NOTE_OK, DESIGN, { ...NOTE_OK, ...verifiedFor(NOTE) }, { ...CASES_OK }]) {
          expect(check({ marks })?.hidden).toBe(false);
          expect(check({ marks })?.disabled).toBeNull();
        }
        // hors de la note de départ : les étapes d'après, Vibe en cours, la note commitée
        for (const over of [{ vibe: true }, { repo: repo([], [FIRST]) }, { tests: [test], marks: { ...NOTE_OK, ...CASES_OK } }]) {
          expect(check(over)?.hidden).toBe(false);
        }
      });

      it('masquée sans note rédigée (pas de note, note à rédiger)', () => {
        expect([check({ note: null })?.hidden, check({ note: EMPTY })?.hidden]).toEqual([true, true]);
      });

      it('jamais la prochaine action, quel que soit l\'état de la note', () => {
        for (const over of [{}, { marks: NOTE_OK }, { marks: verifiedFor(NOTE) }, { note: EMPTY }, { vibe: true },
          { outputs: { 'questions.md': out('## 1. Quelle couleur ?\n- Bleu\n') } }]) {
          expect(check(over)?.primary).toBe(false);
        }
      });

      it('relançable : la conversation qui travaille ne la grise pas (course d\'étape à part), sa propre course oui', () => {
        expect(check({ busy: true, marks: verifiedFor(NOTE) })?.disabled).toBeNull();
        expect(check({ running: [{ id: 'design-check', reads: true }], marks: verifiedFor(NOTE) })?.disabled).toBeTruthy();
      });

      it('le relecteur : ni action ni vérification au relevé', () => {
        const v = vibeView(input({ flow: 'review', pr: 12, note, marks: verifiedFor(NOTE) }));
        expect([action(v, 'design-check'), v.note?.verified]).toEqual([undefined, undefined]);
      });

      it('la note jamais vérifiée, ou une vérification qui a trouvé quelque chose : le relevé ne dit pas « rien trouvé »', () => {
        const verified = (marks: Marks, over: Partial<JourneyInput> = {}) => vibeView(input({ note, marks, ...over })).note?.verified;
        expect(verified({})).toBeNull();
        expect(verified(NOTE_OK)).toBeNull();
        expect(verified(DESIGN)).toBeNull();   // vérifiée, des questions : 'verified' retirée
        // une empreinte 'verified' sans la marque design de cette note : une autre note, jamais vérifiée
        expect(verified({ verified: ok(noteDesign(NOTE)) })).toBeNull();
        expect(verified({ design: { hash: 'docs/tickets/autre.md', verdict: 'ok' }, verified: ok(noteDesign(NOTE)) })).toBeNull();
        // pas de note : rien à dire
        expect(vibeView(input({ marks: verifiedFor(NOTE) })).note).toBeNull();
      });

      it('une vérification qui n\'a rien trouvé : le relevé le dit ; la conception changée depuis : « changée depuis »', () => {
        const verified = (text: string, marks: Marks) => vibeView(input({ note: { ...note, text }, marks })).note?.verified;
        expect(verified(NOTE, verifiedFor(NOTE))).toBe('clean');
        const edited = NOTE.replace('dit bonjour.', 'dit bonjour, fort.');
        expect(verified(edited, verifiedFor(NOTE))).toBe('edited');
        // la Forme seule changée ne change pas la conception
        expect(verified(NOTE.replace('le bouton', 'le gros bouton'), verifiedFor(NOTE))).toBe('clean');
        // la validation de la note n'y change rien
        expect(verified(NOTE, { ...NOTE_OK, ...verifiedFor(NOTE) })).toBe('clean');
        expect(verified(edited, { ...NOTE_OK, ...verifiedFor(NOTE) })).toBe('edited');
      });
    });

    it('Relire le diff, Lire en pseudo-code : proposées, jamais la prochaine action une fois les tests lus', () => {
      const views = [vibeView(ready({ marks: MARKED })), modulesDone(), vibeView(ready({ marks: MARKED, vibe: true })),
        vibeView(ready({ marks: MARKED, repo: repo([HELLO_PATH], [FIRST]) })), modulesDone({ outputs: {} })];
      for (const v of views) {
        for (const id of ['review-diff', 'read-invariants']) expect([id, action(v, id)?.hidden, action(v, id)?.primary]).toEqual([id, false, false]);
      }
    });

    describe('« Chaque diff a été relu »', () => {
      const sha = (c: string) => c.repeat(40);
      const files = {
        repo: ALL, exists: () => true, outputs: proof(PROVED),
        blobs: [{ path: HELLO_PATH, disk: sha('a'), head: sha('a') }, { path: BUTTON_PATH, disk: sha('b'), head: sha('b') }],
      };
      // Les validations d'étape, posées par le geste (validateStep), dans l'ordre.
      const validated = (...steps: ('invariants' | 'modules')[]): Marks => steps.reduce((marks, s) => {
        const v = vibeView(ready({ ...files, marks }));
        const contents = Object.fromEntries(CHECKED.map((c) => [c, stepContent(v, marks, c, files.blobs)]));
        return validateStep(marks, contents, s, 'ok')!;
      }, { ...NOTE_OK, ...CASES_OK } as Marks);
      const PONYTAIL = { 'ponytail.md': out('- rien') };
      const read = (marks: Marks, outputs = {}) => vibeView(ready({ ...files, marks, outputs: { ...files.outputs, ...outputs } })).checklist[2];

      it('cochée quand les modules sont validés et la ponytail review faite, décochée sinon, plus à la main', () => {
        const done = validated('invariants', 'modules');
        expect(read(done, PONYTAIL)).toEqual({ text: 'Chaque diff a été relu', done: true });
        expect(read(done)).toEqual({ text: 'Chaque diff a été relu', done: false });                          // pas de ponytail review
        expect(read(validated('invariants'), PONYTAIL)).toEqual({ text: 'Chaque diff a été relu', done: false });  // modules pas validés
        // la marque à la main d'avant (a3:2 pour le commit de tête) ne coche plus rien
        const old: Marks = { ...validated('invariants'), 'a3:2': { hash: ALL.commits.at(-1)!.hash, verdict: 'ok' } };
        expect(read(old, PONYTAIL)?.done).toBe(false);
      });

      it('les modules validés puis modifiés : décochée', () => {
        const done = validated('invariants', 'modules');
        const moved = { ...files, blobs: [{ path: HELLO_PATH, disk: sha('c'), head: sha('a') }, files.blobs[1]] };
        expect(vibeView(ready({ ...moved, marks: done, outputs: { ...files.outputs, ...PONYTAIL } })).checklist[2].done).toBe(false);
      });

      it('« AGENTS.md à jour… » : toujours à la main', () => {
        const [item] = vibeView(ready({ ...files, marks: validated('invariants', 'modules') })).checklist.slice(4);
        expect(item).toMatchObject({ text: 'AGENTS.md à jour si une convention a changé', done: null, manual: true });
        const head = ALL.commits.at(-1)!.hash;
        const marked = vibeView(ready({ ...files, marks: { ...validated('invariants'), 'a3:4': { hash: head, verdict: 'ok' } } })).checklist[4];
        expect(marked).toMatchObject({ done: true, manual: true });
      });
    });
  });
});

// La ligne d'état après la PR (note 0.16.0-ligne-apres-pr) : la note d'abord, la CI lue par gh, un module complet dès la Forme (T-47).
describe('la ligne d\'état après la PR (0.16.0)', () => {
  const HELLO_PATH = 'src/core/hello.ts', BUTTON_PATH = 'src/app/button.tsx';
  const sha = (c: string) => c.repeat(40);
  const status = (v: VibeView) => Object.fromEntries(v.steps.map((s) => [s.id, s.status]));

  describe('la note d\'abord : son ✓ ne vaut que pour sa conception d\'aujourd\'hui', () => {
    const CHANGED = { ...note, text: NOTE.replace('dit bonjour.', 'dit bonjour, fort.') };
    const ALL = repo([], [FIRST, HELLO, BUTTON]);
    // La note changée depuis son ✓, un module commencé (ou tous faits).
    const begun = (over: Partial<JourneyInput> = {}) => vibeView(ready({ note: CHANGED, repo: repo([], [FIRST, HELLO]), outputs: PROOF, ...over }));

    it('la note « changed » après un module commencé : Note pas faite', () => {
      const v = begun();
      expect([v.note?.mark, status(v).note]).toEqual(['changed', 'current']);
      expect(primary(v)).toBeNull();   // la note rédigée : rien à faire que la valider
      expect(status(vibeView(ready({ note: CHANGED, repo: ALL, outputs: PROOF }))).note).toBe('current');
    });

    it('même cas : la pause « note », Vibe masquée (unvalidated)', () => {
      const v = begun();
      expect(v.pause).toBe('note');
      expect(action(v, 'vibe')).toMatchObject({ hidden: true, disabled: 'Valider d\'abord la note' });
      // tous les modules faits : la pause de la note passe devant celle des modules
      expect(vibeView(ready({ note: CHANGED, repo: ALL, outputs: PROOF })).pause).toBe('note');
    });

    it('même cas : la Forme, les Invariants et les Modules faits le restent', () => {
      const v = vibeView(ready({ note: CHANGED, repo: ALL, outputs: PROOF }));
      expect([status(v).forme, status(v).invariants, status(v).modules]).toEqual(['done', 'done', 'done']);
      // un seul module commencé : la Forme et les Invariants le restent aussi
      const one = begun();
      expect([status(one).forme, status(one).invariants, status(one).modules]).toEqual(['done', 'done', 'todo']);   // la Note, en cours, passe devant
    });

    it('la note revalidée, pas commitée : note.git « modified », plus de pause', () => {
      const v = vibeView(ready({
        note: CHANGED, marks: { ...noteMarks(CHANGED.text), ...CASES_OK }, outputs: PROOF,
        repo: { ...repo([], [FIRST, HELLO]), dirty: [NOTE_PATH], changed: [NOTE_PATH, TEST_PATH, HELLO_PATH] },
      }));
      expect([v.note?.git, v.pause ?? null, status(v).note]).toEqual(['modified', null, 'done']);
      // commitée et inchangée : pas de git ; jamais commitée : « new »
      expect(vibeView(ready()).note?.git).toBeUndefined();
      expect(vibeView(input({ note, repo: { ...repo([NOTE_PATH]), added: [NOTE_PATH] } })).note?.git).toBe('new');
    });

    it('la note refusée (✗) après un module commencé : pas faite non plus', () => {
      const refused: Marks = { note: { hash: blobSha(noteDesign(NOTE)), verdict: 'ko' }, ...CASES_OK };
      const v = vibeView(ready({ marks: refused, repo: ALL, outputs: PROOF }));
      expect([status(v).note, v.pause]).toEqual(['current', 'note']);
    });

    it('un cas d\'invariant « changed » après un module commencé : compte encore', () => {
      const stale: Marks = { ...NOTE_OK, ...CASES_OK, [caseTarget(TEST_PATH, 'dit bonjour')]: { hash: 'z', common: 'c', verdict: 'ok' } };
      const v = vibeView(ready({ marks: stale, repo: ALL, outputs: PROOF }));
      expect([v.invariants[0].marks['dit bonjour'], status(v).note, status(v).invariants, v.pause ?? null]).toEqual(['changed', 'done', 'done', 'modules']);
      // aucun module commencé : il ne compte pas
      expect(status(vibeView(ready({ marks: stale }))).invariants).toBe('current');
    });

    it('le relecteur : sa note jugée ou non, rien ne change', () => {
      const v = vibeView(input({
        flow: 'review', pr: 12, note, repo: repo([], [FIRST, HELLO]), checkout: { branch: 'feat/G2-1', dirty: false },
        outputs: { 'pr-12.json': out(JSON.stringify({ number: 12, head: 'feat/G2-1' })) }, marks: { note: ok(noteDesign(NOTE)) },
      }));
      expect([v.pause ?? null, v.note?.git, status(v).note]).toEqual([null, undefined, 'done']);
    });
  });

  describe('pr.ci : celui de gh, jamais d\'une fiche ni de ci.md', () => {
    const GH = { number: 31, title: 'G2-1', url: 'u', state: 'OPEN', base: 'main', head: 'feat/G2-1' };
    const CI = { state: 'ko', failed: ['tests'] };
    const view = (over: Partial<JourneyInput>) => vibeView(input({ note, repo: repo([], [FIRST]), ...over }));

    it('pr.ci repris de github.pr, tel quel ; sans ci chez gh : absent', () => {
      expect(view({ github: { pr: { ...GH, ci: CI } } }).pr?.ci).toEqual(CI);
      expect(view({ github: { pr: { ...GH, ci: { state: 'ok', failed: [] } } } }).pr?.ci).toEqual({ state: 'ok', failed: [] });
      expect(view({ github: { pr: GH } }).pr?.ci).toBeUndefined();
      expect(view({ github: { pr: { ...GH, ci: null } } }).pr).not.toHaveProperty('ci');
    });

    it('pr.json seul (gh sans réponse) : absent', () => {
      const v = view({ outputs: { 'pr.json': out('{"number":9}') }, github: { pr: null } });
      expect([v.pr?.number, v.pr?.ci]).toEqual([9, undefined]);
      expect(view({ outputs: { 'pr.json': out('{"number":9}') } }).pr?.ci).toBeUndefined();
    });

    it('un ci dans pr.json ou pr-<n>.json : ignoré ; un ci.md ✓ aussi', () => {
      const card = JSON.stringify({ number: 9, state: 'OPEN', ci: { state: 'ok', failed: [] } });
      const md = out('✓ 2/2 checks');
      expect(view({ outputs: { 'pr.json': out(card), 'ci.md': md }, github: { pr: null } }).pr?.ci).toBeUndefined();
      const reviewed = vibeView(input({ flow: 'review', pr: 9, repo: repo([], [FIRST]), outputs: { 'pr-9.json': out(card), 'ci.md': md } }));
      expect([reviewed.pr?.ci, reviewed.loaded?.ci]).toEqual([undefined, undefined]);
      // le relecteur ne lit pas la PR de la branche : le ci de gh.pr ne lui est pas donné
      expect(vibeView(input({ flow: 'review', pr: 9, outputs: { 'pr-9.json': out(card) }, github: { pr: { ...GH, ci: CI } } })).pr?.ci).toBeUndefined();
    });
  });

  // Un module complet dès la Forme (T-47) : button.tsx, que seul son squelette décrit, resté tel que la Forme l'a laissé.
  describe('un module complet dès la Forme', () => {
    const WITH_SKELETONS = commit('a', 'Note, forme, invariants', [NOTE_PATH, TEST_PATH, HELLO_PATH, BUTTON_PATH]);
    const BLOBS = [{ path: BUTTON_PATH, disk: sha('s'), head: sha('s') }];
    const SKEL: Marks = { [`skel:${BUTTON_PATH}`]: { hash: sha('s'), verdict: 'ok' } };
    const view = (over: Partial<JourneyInput> = {}) => vibeView(ready({
      marks: { ...NOTE_OK, ...CASES_OK, ...SKEL }, blobs: BLOBS, exists: () => true, repo: repo([], [WITH_SKELETONS]), ...over,
    }));
    const started = (v: VibeView) => v.modules.map((m) => m.started);
    const dirtyHello = { ...repo([], [WITH_SKELETONS]), dirty: [HELLO_PATH] };

    it('les autres commencés : commencé, ses commits restent vides, plus de Générer les modules', () => {
      for (const v of [view({ repo: repo([], [WITH_SKELETONS, HELLO]) }), view({ repo: dirtyHello })]) {
        expect(started(v)).toEqual([true, true]);
        expect(v.modules[1].commits).toEqual([]);
        expect([action(v, 'modules')?.hidden, primary(v)]).not.toEqual([false, 'modules']);
        expect(action(v, 'modules')?.hidden).toBe(true);
      }
    });

    it('les autres commités : l\'étape Modules est faite', () => {
      const v = view({ repo: repo([], [WITH_SKELETONS, HELLO]), outputs: PROOF });
      expect([started(v), status(v).modules, v.modules[1].commits]).toEqual([[true, true], 'done', []]);
    });

    it('même cas : le décompte et la case « chaque module a son commit » le comptent', () => {
      const v = view({ repo: repo([], [WITH_SKELETONS, HELLO]), outputs: PROOF });
      expect([v.steps.find((s) => s.id === 'modules')?.facts, v.checklist[3].done]).toEqual(['2 / 2 modules', true]);
    });

    it('les autres commencés, pas commités : commencé, mais l\'étape Modules pas faite, pas de commit compté', () => {
      const v = view({ repo: dirtyHello, outputs: PROOF });
      expect([status(v).modules, v.steps.find((s) => s.id === 'modules')?.facts, v.checklist[3].done]).toEqual(['current', '0 / 2 modules', false]);
    });

    it('un autre pas commencé : pas commencé, Générer les modules', () => {
      const v = view();
      expect([started(v), status(v).modules, primary(v), action(v, 'modules')?.hidden]).toEqual([[false, false], 'current', 'modules', false]);
    });

    it('un fichier changé depuis son squelette, pas commité : pas complet, pas compté comme fait', () => {
      const v = view({
        repo: { ...repo([], [WITH_SKELETONS, HELLO]), dirty: [BUTTON_PATH] }, blobs: [{ path: BUTTON_PATH, disk: sha('t'), head: sha('s') }], outputs: PROOF,
      });
      expect([v.modules[1].skeleton, v.modules[1].uncommitted, status(v).modules, primary(v)]).toEqual([undefined, true, 'current', 'commit-modules']);
      expect(v.checklist[3].done).toBe(false);
    });

    it('un fichier hors du premier commit : pas complet', () => {
      // la note pas commitée : le seul commit est celui de hello ; button.tsx, un squelette pas encore commité, n'est dans aucun commit
      const v = view({ repo: { ...repo([], [HELLO]), dirty: [BUTTON_PATH], added: [BUTTON_PATH], changed: [HELLO_PATH, BUTTON_PATH] } });
      expect([started(v), v.modules[1].skeleton]).toEqual([[true, false], true]);
    });

    it('seul module de la Forme, resté squelette : Générer les modules', () => {
      const ONE = NOTE.replace('src/core/hello.ts    hello() · ne connaît pas : le DOM\n', '');
      const v = view({ note: { ...note, text: ONE }, marks: { ...noteMarks(ONE), ...CASES_OK, ...SKEL }, repo: repo([], [WITH_SKELETONS]) });
      expect([v.modules.length, started(v), status(v).modules, primary(v)]).toEqual([1, [false], 'current', 'modules']);
    });

    it('deux modules complets et un vrai : chacun attend le vrai, pas l\'autre complet', () => {
      const TYPES = 'src/shared/types.ts';
      const THREE = NOTE.replace('```\n', `\`\`\`\n${TYPES}   les types\n`);
      const first = commit('a', 'Note, forme, invariants', [NOTE_PATH, TEST_PATH, HELLO_PATH, BUTTON_PATH, TYPES]);
      const over = (commits: ReturnType<typeof commit>[]): Partial<JourneyInput> => ({
        note: { ...note, text: THREE }, marks: { ...noteMarks(THREE), ...CASES_OK, ...SKEL, [`skel:${TYPES}`]: { hash: sha('s'), verdict: 'ok' } },
        blobs: [...BLOBS, { path: TYPES, disk: sha('s'), head: sha('s') }], repo: repo([], commits), outputs: PROOF,
      });
      const at = (commits: ReturnType<typeof commit>[]) => view(over(commits));
      expect(started(at([first])).slice(0, 3)).toEqual([false, false, false]);
      const v = at([first, HELLO]);
      expect([v.modules.map((m) => m.path), started(v), status(v).modules]).toEqual([[TYPES, HELLO_PATH, BUTTON_PATH], [true, true, true], 'done']);
    });
  });
});
