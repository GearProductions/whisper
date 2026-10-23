import { describe, expect, it } from 'vitest';
import type { VibeView } from 'shared/bridge';
import { blobSha, parseNote, vibeView, type ActionDef, type JourneyInput, type Marks } from 'core/vibecoder';

// Les actions du brief (celles dont le parcours a besoin), en français.
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
  { ...A('checks', 'create', 'revue', '/vibecoder:verifier {{lang}} {{out}}'), reads: true },
  { ...A('ponytail', 'create', 'revue', '/vibecoder:ponytail {{lang}} {{out}}'), reads: true },
  A('fixups', 'create', 'revue', '/vibecoder:fixups {{lang}} {{out}}'),
  A('pr', 'create', 'pr', '/vibecoder:pr {{lang}} {{out}}'),
  A('ci', 'create', 'pr', '/vibecoder:ci {{lang}} {{out}}'),
  A('rc', 'create', 'pr', '/vibecoder:rc {{lang}} {{out}}'),
  A('base', 'create', 'pr', '/vibecoder:base {{lang}} {{out}}'),
  A('release', 'create', 'pr', '/vibecoder:release {{lang}} {{out}}'),
  A('prs', 'review', 'pr', '/vibecoder:prs {{lang}} {{out}}'),
  A('load-pr', 'review', 'pr', '/vibecoder:charger-pr {{lang}} {{out}} {{pr}}'),
  A('open-worktree', 'review', 'pr', '/vibecoder:worktree-pr {{lang}} {{out}} {{pr}}'),
  A('unload-worktree', 'review', 'pr', '/vibecoder:retirer-worktree {{lang}} {{out}} {{pr}}'),
  A('review-note', 'review', 'note', '/vibecoder:relire-note {{lang}} {{out}} {{pr}}'),
  A('review-commits', 'review', 'commits', '/vibecoder:relire-commits {{lang}} {{out}} {{pr}}'),
  A('screen', 'review', 'ecran', '/vibecoder:ecran {{lang}} {{out}} {{pr}}'),
  A('publish', 'review', 'revue', '/vibecoder:publier-revue {{lang}} {{out}} {{pr}} {{verdict}}\n\n{{draft}}'),
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
const NOTE_OK: Marks = { note: ok(NOTE), forme: ok(parseNote(NOTE).forme) };
const CASES_OK: Marks = {
  [`case:${TEST_PATH}:dit bonjour`]: { hash: BLOB, verdict: 'ok' },
  [`case:${TEST_PATH}:ne lit rien d'autre`]: { hash: BLOB, verdict: 'ok' },
};
const commit = (hash: string, subject: string, files: string[]) => ({ hash: hash.repeat(40).slice(0, 40), subject, files });
const FIRST = commit('a', 'Note, forme, invariants', [NOTE_PATH, TEST_PATH]);
const HELLO = commit('b', 'core/hello', ['src/core/hello.ts']);
const BUTTON = commit('c', 'app/button', ['src/app/button.tsx']);

const repo = (changed: string[] = [], commits: ReturnType<typeof commit>[] = []) =>
  ({ branch: 'feat/G2-1-bouton', base: 'origin/main', changed: [...new Set([...changed, ...commits.flatMap((c) => c.files)])], commits });
const out = (text = '') => ({ text, time: 1 });
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

describe('Créer, Guide : les étapes et la prochaine action', () => {
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
    expect(vibeView(input({ note: { ...note, text: `${NOTE}\nUne ligne de plus.` }, marks: NOTE_OK })).note?.mark).toBe('changed');
  });

  it('note validée, pas de Forme : Poser la forme', () => {
    const text = NOTE.slice(0, NOTE.indexOf('## Forme'));
    const v = vibeView(input({ note: { ...note, text }, marks: { note: ok(text) } }));
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
    expect(status(vibeView(input({ note, marks: NOTE_OK, autonomy: 'vibe' }))).invariants).toBe('current');
  });

  it('✓ Rien à écrire puis la note changée : à revalider, pas faits', () => {
    const text = `${NOTE}\nUne ligne de plus.`;
    const v = vibeView(input({ note: { ...note, text }, marks: { note: ok(text), forme: ok(parseNote(text).forme), nothing: ok(NOTE) } }));
    expect([v.note?.nothingMark, status(v).invariants]).toEqual(['changed', 'current']);
  });

  it('des tests d\'invariant de la branche pas validés : ni course finie ni ✓ Rien à écrire ne font l\'étape', () => {
    const v = vibeView(input({ note, marks: NOTHING_OK, tests: [test], readings: READINGS, runs: [run('invariants', 'done', 4)],
      repo: repo([], [FIRST]) }));
    expect(status(v).invariants).toBe('current');
  });

  it('des tests pas encore lus (Guide) : aucune action, la validation des cas passe avant la lecture', () => {
    expect(primary(vibeView(input({ note, marks: NOTE_OK, tests: [test] })))).toBeNull();
  });

  it('des tests pas encore lus (Vibe) : Lire en pseudo-code', () => {
    expect(primary(vibeView(input({ note, marks: NOTE_OK, tests: [test], autonomy: 'vibe', repo: repo([NOTE_PATH, TEST_PATH]) })))).toBe('read-invariants');
  });

  it('lus mais pas tous validés (Guide) : aucune action, la validation attend', () => {
    expect(primary(vibeView(input({ note, marks: NOTE_OK, tests: [test], readings: READINGS, repo: repo([NOTE_PATH, TEST_PATH]) }))))
      .toBeNull();
  });

  it('lus et validés, des fichiers pas commités : Préparer le commit', () => {
    expect(primary(vibeView(input({ note, marks: { ...NOTE_OK, ...CASES_OK }, tests: [test], readings: READINGS, repo: repo([NOTE_PATH, TEST_PATH]) }))))
      .toBe('commit-prepare');
  });

  it('un commit préparé (commit.md) : Commiter', () => {
    expect(primary(vibeView(input({
      note, marks: { ...NOTE_OK, ...CASES_OK }, tests: [test], readings: READINGS, repo: repo([NOTE_PATH, TEST_PATH]), outputs: { 'commit.md': out('x') },
    })))).toBe('commit');
  });

  it('les cas pas tous validés : l\'étape des invariants reste en cours', () => {
    expect(status(vibeView(ready({ marks: NOTE_OK }))).invariants).toBe('current');
  });

  it('invariants validés et commités, aucun module touché : Générer ce module', () => {
    const v = vibeView(ready());
    expect([status(v).modules, primary(v)]).toEqual(['current', 'module']);
  });

  it('un module modifié, pas commité, un autre reste : Valider → commit → suivant', () => {
    expect(primary(vibeView(ready({ repo: repo(['src/core/hello.ts'], [FIRST]) })))).toBe('next');
  });

  it('le dernier module modifié, pas commité : Préparer le commit', () => {
    expect(primary(vibeView(ready({ repo: repo(['src/app/button.tsx'], [FIRST, HELLO]) })))).toBe('commit-prepare');
  });

  it('chaque module commité : la revue, d\'abord les vérifications', () => {
    const v = vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]) }));
    expect([status(v).modules, status(v).revue, primary(v)]).toEqual(['done', 'current', 'checks']);
  });

  it('vérifications passées sans ponytail review : relancer les vérifications (elles la demandent)', () => {
    const checks = out('{"items":[{"name":"tests","ok":true}],"time":1}');
    expect(primary(vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs: { 'checks.json': checks } })))).toBe('checks');
  });

  it('ponytail review sans vérifications : Lancer les vérifications', () => {
    expect(primary(vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs: { 'ponytail.md': out('- rien') } })))).toBe('checks');
  });

  it('un commit fixup! : Replier les fixups', () => {
    const outputs = { 'checks.json': out('{"items":[{"name":"tests","ok":true}]}'), 'ponytail.md': out('- rien') };
    const fix = commit('d', 'fixup! core/hello', ['src/core/hello.ts']);
    expect(primary(vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON, fix]), outputs })))).toBe('fixups');
  });

  it('revue faite : ouvrir la PR', () => {
    const outputs = { 'checks.json': out('{"items":[{"name":"tests","ok":true}]}'), 'ponytail.md': out('- rien') };
    const v = vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs }));
    expect([status(v).pr, primary(v)]).toEqual(['current', 'pr']);
  });

  it('PR ouverte (pr.json) : tout est fait, plus de prochaine action', () => {
    const outputs = {
      'checks.json': out('{"items":[{"name":"tests","ok":true}]}'), 'ponytail.md': out('- rien'),
      'pr.json': out('{"number":31,"url":"https://github.com/o/d/pull/31","title":"G2-1"}'),
    };
    const v = vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs }));
    expect([v.steps.every((s) => s.status === 'done'), primary(v), v.pr?.number]).toEqual([true, null, 31]);
  });
});

describe('Créer, Vibe : aucune validation attendue', () => {
  it('pas de note : Rédiger la note', () => {
    expect(primary(vibeView(input({ autonomy: 'vibe' })))).toBe('note');
  });

  it('note rédigée avec des questions : Envoyer les réponses', () => {
    expect(primary(vibeView(input({ autonomy: 'vibe', note, outputs: { 'questions.md': out('## 1. Quelle couleur ?\n') } })))).toBe('answers');
  });

  it('note rédigée sans question, forme pas faite : Valider et développer', () => {
    const text = NOTE.slice(0, NOTE.indexOf('## Forme'));
    expect(primary(vibeView(input({ autonomy: 'vibe', note: { ...note, text } })))).toBe('vibe');
  });

  it('note rédigée sans validation : note et forme faites', () => {
    const v = vibeView(input({ autonomy: 'vibe', note }));
    expect([status(v).note, status(v).forme]).toEqual(['done', 'done']);
  });

  it('un test d\'invariant, ni lu ni validé : invariants faits', () => {
    expect(status(vibeView(input({ autonomy: 'vibe', note, tests: [test] }))).invariants).toBe('done');
  });
});

describe('Relire : les étapes et la prochaine action', () => {
  const PR = '{"number":12,"title":"G2-1 — Un bouton","url":"https://github.com/o/d/pull/12","author":{"login":"kb"},"base":"main","head":"feat/G2-1","body":"…"}';
  const loaded = (over: Partial<JourneyInput> = {}) => input({
    flow: 'review', pr: 12, note, tests: [test], repo: repo([], [FIRST, HELLO]), ...over,
    outputs: { 'pr-12.json': out(PR), ...over.outputs },
  });

  it('aucune PR suivie : Mes PR à relire', () => {
    const v = vibeView(input({ flow: 'review', repo: null }));
    expect([status(v).pr, primary(v)]).toEqual(['current', 'prs']);
  });

  it('la liste des PR à relire est lue', () => {
    const v = vibeView(input({ flow: 'review', repo: null, outputs: { 'prs.json': out('[{"number":12,"title":"t","author":"kb","url":"u"},{"number":"x"}]') } }));
    expect(v.prs).toEqual([{ number: 12, title: 't', author: 'kb', url: 'u' }]);
  });

  it('une PR suivie, pas chargée : Charger la PR', () => {
    expect(primary(vibeView(input({ flow: 'review', pr: 12, repo: null })))).toBe('load-pr');
  });

  it('une PR suivie, pas chargée : son numéro est dans le relevé', () => {
    expect(vibeView(input({ flow: 'review', pr: 12, repo: null })).pr?.number).toBe(12);
  });

  it('chargée : sa fiche, l\'auteur par son login', () => {
    expect(vibeView(loaded()).pr).toMatchObject({ number: 12, title: 'G2-1 — Un bouton', author: 'kb', base: 'main', head: 'feat/G2-1' });
  });

  it('chargée : Relire la note', () => {
    const v = vibeView(loaded());
    expect([status(v).pr, status(v).note, primary(v)]).toEqual(['done', 'current', 'review-note']);
  });

  it('la note refusée : un verdict suffit, l\'étape est faite', () => {
    expect(status(vibeView(loaded({ marks: { note: { hash: blobSha(NOTE), verdict: 'ko' } } }))).note).toBe('done');
  });

  it('note jugée, cas pas jugés : l\'étape attend leurs verdicts, sans action', () => {
    const v = vibeView(loaded({ marks: { note: ok(NOTE) } }));
    expect([status(v).invariants, primary(v)]).toEqual(['current', null]);
  });

  it('tests pas lus, chaque cas jugé : l\'étape Invariants est faite', () => {
    expect(status(vibeView(loaded({ marks: { note: ok(NOTE), ...CASES_OK } }))).invariants).toBe('done');
  });

  it('tests lus et jugés : Relire les commits', () => {
    const v = vibeView(loaded({ marks: { note: ok(NOTE), ...CASES_OK }, readings: READINGS }));
    expect([status(v).commits, primary(v)]).toEqual(['current', 'review-commits']);
  });

  it('un plan de test pas tout coché : l\'écran reste en cours, sans action', () => {
    const outputs = { 'pr-12-commits.md': out('## abc x'), 'pr-12-ecran.md': out('- [ ] Ouvrir\n- [x] Dicter\n') };
    const v = vibeView(loaded({ marks: { note: ok(NOTE), ...CASES_OK }, readings: READINGS, outputs }));
    expect([status(v).ecran, primary(v)]).toEqual(['current', null]);
  });

  it('une case validée pour ce plan-là compte comme cochée', () => {
    const plan = '- [ ] Ouvrir\n- [x] Dicter\n';
    const v = vibeView(loaded({ marks: { 'check:12:0': ok(plan) }, outputs: { 'pr-12-ecran.md': out(plan) } }));
    expect(v.checklist.map((c) => c.done)).toEqual([true, true]);
  });

  it('une case cochée dans le fichier, refusée pour ce plan-là : décochée', () => {
    const plan = '- [x] Ouvrir\n';
    const v = vibeView(loaded({ marks: { 'check:12:0': { hash: blobSha(plan), verdict: 'ko' } }, outputs: { 'pr-12-ecran.md': out(plan) } }));
    expect(v.checklist.map((c) => c.done)).toEqual([false]);
  });

  it('tout coché : Publier la revue', () => {
    const outputs = { 'pr-12-commits.md': out('## abc x'), 'pr-12-ecran.md': out('- [x] Ouvrir\n') };
    const v = vibeView(loaded({ marks: { note: ok(NOTE), ...CASES_OK }, readings: READINGS, outputs }));
    expect([status(v).revue, primary(v)]).toEqual(['current', 'publish']);
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
    const v = vibeView(input({ flow: 'review', pr: 12, outputs: { 'pr-12.json': out('{}') } }));
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
      'Un commit par module, fixups repliés', 'AGENTS.md à jour si une convention a changé']);
  });

  it('rien de fait : rien de coché', () => {
    expect(done(vibeView(input()))).toEqual([false, false, null, false, null]);
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
    expect(done(vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs: { 'checks.json': checks } })))).toEqual([true, true, null, true, null]);
  });

  it('un fixup! pas replié : « un commit par module » n\'est pas coché', () => {
    const fix = commit('d', 'fixup! core/hello', ['src/core/hello.ts']);
    expect(done(vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON, fix]) })))[3]).toBe(false);
  });

  it('moins de commits que de modules + 1 : pas coché', () => {
    expect(done(vibeView(ready({ repo: repo([], [FIRST, HELLO]) })))[3]).toBe(false);
  });

  it('relecture et AGENTS.md : à cocher à la main ; cochés pour le commit de tête, décochés par un commit de plus', () => {
    const marks = { ...NOTE_OK, ...CASES_OK, 'a3:2': { hash: BUTTON.hash, verdict: 'ok' as const } };
    const v = vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), marks }));
    expect(v.checklist.map((c) => [c.done, !!c.manual])).toEqual([[true, false], [false, false], [true, true], [true, false], [null, true]]);
    const fix = commit('d', 'core/hello encore', ['src/core/hello.ts']);
    expect(done(vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON, fix]), marks })))[2]).toBeNull();
  });

  it('refusée (✗) ou sans commit : pas cochée', () => {
    expect(done(vibeView(ready({ marks: { ...NOTE_OK, 'a3:4': { hash: FIRST.hash, verdict: 'ko' } } })))[4]).toBeNull();
    expect(done(vibeView(input({ marks: { 'a3:2': { hash: '', verdict: 'ok' } } })))[2]).toBeNull();
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
      exists: (p) => p === 'src/main/core/x' }));
    expect(v.modules[0]).toEqual({ path: 'main/core/x/', contract: 'pur', file: { id: 'm0', path: 'src/main/core/x' }, touched: true, commits: ['e'.repeat(40)],
      files: [], locked: null });
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

  it('les validations d\'un cas valent pour l\'empreinte du fichier', () => {
    const marks: Marks = { [`case:${TEST_PATH}:dit bonjour`]: { hash: 'autre', verdict: 'ok' } };
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

  it('une PR fusionnée : les actions de relecture grisées, avec cette raison', () => {
    expect([action(merged(), 'review-note')?.disabled, action(merged(), 'publish')?.disabled])
      .toEqual(['PR déjà fusionnée : rien à relire', 'PR déjà fusionnée : rien à relire']);
  });

  it('une PR fermée : la raison le dit', () => {
    expect(action(merged('CLOSED'), 'read-invariants')?.disabled).toBe('PR fermée : rien à relire');
  });

  it('une PR fusionnée se charge encore (l\'étape PR)', () => {
    expect([action(merged(), 'load-pr')?.disabled, action(merged(), 'prs')?.disabled]).toEqual([null, null]);
  });

  it('un test d\'invariant : la ligne de chaque cas, d\'après son texte', () => {
    expect(vibeView(ready()).invariants[0]).toMatchObject({ cases: ['dit bonjour', 'ne lit rien d\'autre'], lines: [1, 2], source: TEST });
  });

  it('un test d\'invariant trop long (plus de 200 000 caractères) : son texte n\'est pas montré', () => {
    const big = { ...test, text: `${TEST}//${'x'.repeat(200_000)}` };
    expect(vibeView(input({ tests: [big] })).invariants[0]).toMatchObject({ cases: ['dit bonjour', 'ne lit rien d\'autre'], source: '' });
  });

  it('chaque commit, avec ses fichiers', () => {
    expect(vibeView(ready()).commits).toEqual([{ hash: FIRST.hash, subject: FIRST.subject, fixup: false, files: [NOTE_PATH, TEST_PATH] }]);
  });
});

describe('Relire dans un worktree (F-110)', () => {
  const loaded = (over: Partial<JourneyInput> = {}) => input({ flow: 'review', pr: 12, outputs: { 'pr-12.json': out('{"number":12}') }, ...over });
  const why = (v: VibeView, id: string) => v.actions.find((a) => a.id === id)?.disabled;

  it('Ouvrir dans un worktree : une PR chargée, pas encore dans un worktree', () => {
    expect(why(vibeView(loaded()), 'open-worktree')).toBeNull();
    expect(why(vibeView(input({ flow: 'review', pr: 12 })), 'open-worktree')).toBe('Charger d\'abord la PR');
    expect(why(vibeView(input({ flow: 'review' })), 'open-worktree')).toBe('Aucune PR choisie');
    for (const state of ['creating', 'open', 'robot'] as const) {
      expect(why(vibeView(loaded({ worktree: { state, temp: false, dir: '/w' } })), 'open-worktree')).toBe('Déjà ouverte dans un worktree');
    }
  });

  it('Décharger : seulement sur le robot du worktree ; l’état du worktree passe au relevé', () => {
    expect(why(vibeView(loaded()), 'unload-worktree')).toBe('Seulement sur le robot d\'un worktree');
    const robot = vibeView(loaded({ worktree: { state: 'robot', temp: true, dir: '/w' } }));
    expect(why(robot, 'unload-worktree')).toBeNull();
    expect(robot.worktree).toEqual({ state: 'robot', temp: true, dir: '/w' });
    expect(vibeView(loaded()).worktree).toBeNull();
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

  it('Relire : les PR à relire d\'après gh, avant prs.json', () => {
    const v = vibeView(input({
      flow: 'review', repo: null, outputs: { 'prs.json': out('[{"number":1}]') },
      github: { prs: [{ number: 3, title: 't', author: { login: 'kb' }, url: 'u' }] },
    }));
    expect(v.prs).toEqual([{ number: 3, title: 't', author: 'kb', url: 'u' }]);
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
    expect([action(v, 'forme')?.disabled, action(v, 'module')?.disabled, action(v, 'ponytail')?.disabled, action(v, 'vibe')?.disabled])
      .toEqual(['Cette action est déjà en cours', 'Une autre action est en cours', 'Une action modifie la branche', null]);
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
  const opened = (v: VibeView) => v.steps.filter((s) => s.open).map((s) => s.id);
  const shown = (v: VibeView, ids: string[]) => ids.filter((id) => !action(v, id)?.hidden);
  const PR_STEP = ['pr', 'ci', 'rc', 'base', 'release'];
  const reviewed = { 'checks.json': out('{"items":[{"name":"tests","ok":true}]}'), 'ponytail.md': out('- rien') };
  const withPr = (pr: Record<string, unknown> | null, outputs: JourneyInput['outputs'] = reviewed) =>
    vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs, github: { pr } }));

  it('Créer, Guide : les étapes faites et celle en cours s\'ouvrent, pas celles à venir', () => {
    expect(opened(vibeView(ready()))).toEqual(['note', 'forme', 'invariants', 'modules']);
    expect(opened(vibeView(input()))).toEqual(['note']);
  });

  it('Relire : toutes s\'ouvrent ; Créer en Vibe : aucune (fil d\'Ariane)', () => {
    expect(opened(vibeView(input({ flow: 'review' })))).toEqual(['pr', 'note', 'invariants', 'commits', 'ecran', 'revue']);
    expect(opened(vibeView(ready({ autonomy: 'vibe' })))).toEqual([]);
  });

  it('l\'étape PR sans PR : seulement Valider la feature', () => {
    expect(shown(withPr(null), PR_STEP)).toEqual(['pr']);
  });

  it('PR ouverte : Diagnostiquer la CI et Release candidate ; PR fusionnée : revenir sur la base et Release officielle', () => {
    expect(shown(withPr({ number: 31, state: 'OPEN' }), PR_STEP)).toEqual(['ci', 'rc']);
    expect(shown(withPr({ number: 31, state: 'MERGED' }), PR_STEP)).toEqual(['base', 'release']);
    expect(shown(withPr({ number: 31, state: 'CLOSED' }), PR_STEP)).toEqual([]);
  });

  it('une PR sans état connu (pr.json, avant gh) : comme ouverte', () => {
    expect(shown(withPr(null, { ...reviewed, 'pr.json': out('{"number":9}') }), PR_STEP)).toEqual(['ci', 'rc']);
  });

  it('l\'état de la PR masque sans griser', () => {
    const v = withPr({ number: 31, state: 'OPEN' });
    expect(PR_STEP.map((id) => action(v, id)?.disabled)).toEqual([null, null, null, null, null]);
  });

  it('pas encore de sens : masquée, sa raison gardée', () => {
    const v = vibeView(input());
    expect([action(v, 'commit'), action(v, 'answers'), action(v, 'fixups'), action(v, 'forme')].map((a) => [a?.hidden, a?.disabled]))
      .toEqual([[true, 'Préparer d\'abord le commit'], [true, 'Aucune question ouverte'], [true, 'Aucun commit fixup!'], [true, 'Pas encore de note']]);
    expect(action(vibeView(ready({ tests: [] })), 'read-invariants')?.hidden).toBe(true);
  });

  it('Relire dans un worktree : Ouvrir déjà fait et Décharger hors du robot masqués', () => {
    const v = vibeView(input({ flow: 'review', pr: 12, outputs: { 'pr-12.json': out('{"number":12}') }, worktree: { state: 'open', temp: false, dir: '/w' } }));
    expect([action(v, 'open-worktree')?.hidden, action(v, 'unload-worktree')?.hidden]).toEqual([true, true]);
  });

  it('grisée par une course ou la conversation : affichée ; masquée tout de même si elle n\'a pas de sens', () => {
    const v = vibeView(ready({ running: [{ id: 'forme', reads: false }], busy: true, runs: ANSWERED }));
    expect([action(v, 'module')?.hidden, action(v, 'vibe')?.hidden, action(v, 'commit')?.hidden]).toEqual([false, false, true]);
    expect(action(v, 'commit')?.disabled).toBe('Une autre action est en cours');
  });

  it('une PR fusionnée, en Relire : grisée, pas masquée', () => {
    const v = vibeView(input({ flow: 'review', pr: 12, repo: repo([], [FIRST]), outputs: { 'pr-12.json': out('{"number":12,"state":"MERGED"}') } }));
    expect([action(v, 'publish')?.hidden, action(v, 'publish')?.disabled]).toEqual([false, 'PR déjà fusionnée : rien à relire']);
  });

  it('Valider et développer : masquée sans note ou avec des questions ouvertes, et refusée', () => {
    const questions = { 'questions.md': out('## 1. Quelle couleur ?\n') };
    expect([vibeView(input()), vibeView(input({ note, outputs: questions })), vibeView(input({ note }))]
      .map((v) => [action(v, 'vibe')?.hidden, action(v, 'vibe')?.disabled]))
      .toEqual([[true, 'Pas encore de note'], [true, 'Répondre d\'abord aux questions de la note'], [false, null]]);
  });

  it('Valider et développer : masquée tant que la note n\'est pas rédigée', () => {
    const text = NOTE.replace('Un bouton qui dit bonjour.', '');
    const v = vibeView(input({ note: { ...note, text } }));
    expect([action(v, 'vibe')?.hidden, action(v, 'vibe')?.disabled]).toEqual([true, 'Pas encore de note']);
  });

  it('Valider et développer : masquée et refusée la forme faite', () => {
    const v = vibeView(ready());
    expect([action(v, 'vibe')?.hidden, action(v, 'vibe')?.disabled]).toEqual([true, 'Déjà lancée : la forme est posée']);
  });

  it('Valider et développer : la forme faite, revient quand des réponses ont vidé questions.md', () => {
    const v = vibeView(ready({ runs: ANSWERED, outputs: { 'questions.md': out() } }));
    expect([action(v, 'vibe')?.hidden, action(v, 'vibe')?.disabled]).toEqual([false, null]);
  });

  it('Valider et développer : la forme faite, des réponses suivies d\'une autre course : masquée', () => {
    const forme = { ...ANSWERED[0], id: 'forme', since: 4, end: 5 };
    expect(action(vibeView(ready({ runs: [forme, ...ANSWERED] })), 'vibe')?.hidden).toBe(true);
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
    expect(primary(revue({ 'checks.json': green(100), 'ponytail.md': out('- rien') }))).toBe('pr');
  });

  it('ancien : l\'état de la PR ne change pas (pr.json lu)', () => {
    const v = revue({ 'checks.json': green(50), 'ponytail.md': out('- rien'), 'pr.json': out('{"number":31,"url":"u","title":"G2-1"}') });
    expect([v.pr?.number, primary(v)]).toEqual([31, 'checks']);
  });
});

// Le bug de la 0.9.0-rc.3 (docs/tickets/fix/0.9.0-vibecoder-etape-invariants.md) : rouge avant le correctif.
describe('l\'étape Invariants, sans invariant et sans lecture (0.9.0-rc.4)', () => {
  const text = NOTE.replace('- Lire un autre fichier. → invariant\n', '');
  const marks: Marks = { note: ok(text), forme: ok(parseNote(text).forme) };

  it('une note sans ligne « → invariant », pas commitée : l\'étape Invariants est faite, les Modules s\'ouvrent', () => {
    const v = vibeView(input({ note: { ...note, text }, marks, repo: repo([NOTE_PATH]) }));

    // Rien à écrire : l'étape n'attend ni test ni commit.
    expect(status(v).invariants).toBe('done');
    // Depuis le parcours guidé, on peut aller aux Modules.
    expect(v.steps.find((s) => s.id === 'modules')?.open).toBe(true);
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
});

describe('Voir le code : les fichiers d\'un module et pourquoi il est grisé (0.11.0)', () => {
  const list = (rel: string) => [`${rel}/z.ts`, `${rel}/a.ts`];
  const modules = (over: Partial<JourneyInput> = {}) =>
    vibeView(ready({ repo: repo(['src/core/hello.ts'], [FIRST]), exists: () => true, list, ...over })).modules;

  it('un module touché : ses fichiers d\'après list, triés, ids m<rang>/<i> ; pas touché : aucun', () => {
    const [hello, button] = modules();
    expect(hello.files).toEqual([{ id: 'm0/0', path: 'src/core/hello.ts/a.ts' }, { id: 'm0/1', path: 'src/core/hello.ts/z.ts' }]);
    expect(button.files).toEqual([]);
  });

  it('sans list (relevé d\'avant la 0.11.0) : aucun fichier', () => {
    expect(modules({ list: undefined })[0].files).toEqual([]);
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

  it('Vibe : une lecture périmée remet Lire en pseudo-code en tête', () => {
    const at = (readings: JourneyInput['readings']) =>
      primary(vibeView(input({ note, marks: NOTE_OK, tests: [test], autonomy: 'vibe', repo: repo([NOTE_PATH, TEST_PATH]), readings })));
    expect(at([OLD])).toBe('read-invariants');
    expect(at([OLD, ...READINGS])).not.toBe('read-invariants');
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
