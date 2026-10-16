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
  A('checks', 'create', 'revue', '/vibecoder:verifier {{lang}} {{out}}'),
  A('ponytail', 'create', 'revue', '/vibecoder:ponytail {{lang}} {{out}}'),
  A('fixups', 'create', 'revue', '/vibecoder:fixups {{lang}} {{out}}'),
  A('pr', 'create', 'pr', '/vibecoder:pr {{lang}} {{out}}'),
  A('prs', 'review', 'pr', '/vibecoder:prs {{lang}} {{out}}'),
  A('load-pr', 'review', 'pr', '/vibecoder:charger-pr {{lang}} {{out}} {{pr}}'),
  A('open-worktree', 'review', 'pr', '/vibecoder:worktree-pr {{lang}} {{out}} {{pr}}'),
  A('unload-worktree', 'review', 'pr', '/vibecoder:retirer-worktree {{lang}} {{out}} {{pr}}'),
  A('review-note', 'review', 'note', '/vibecoder:relire-note {{lang}} {{out}} {{pr}}'),
  A('review-commits', 'review', 'commits', '/vibecoder:relire-commits {{lang}} {{out}} {{pr}}'),
  A('screen', 'review', 'ecran', '/vibecoder:ecran {{lang}} {{out}} {{pr}}'),
  A('publish', 'review', 'revue', '/vibecoder:publier-revue {{lang}} {{out}} {{pr}} {{verdict}}\n\n{{draft}}'),
  A('vibe', 'create', null, '/vibecoder:vibe {{lang}} {{out}} {{text}}', 'text'),
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
const input = (over: Partial<JourneyInput> = {}): JourneyInput => ({
  agentId: 'a1', lang: 'fr', flow: 'create', pr: null, autonomy: 'guide', agent: { model: 'opus', effort: 'high', mode: 'default' },
  busy: false, repo: repo(), error: null, note: null, tests: [], readings: {}, outputs: {}, marks: {}, draft: [], actions: ACTIONS,
  who: {}, model: {}, skills: [], exists: () => false, now: 1700000000000, ...over,
});
// Un état de Créer : note et forme validées, invariants écrits, lus, validés et commités.
const ready = (over: Partial<JourneyInput> = {}) => input({
  note, tests: [test], readings: { [BLOB]: READING }, marks: { ...NOTE_OK, ...CASES_OK }, repo: repo([], [FIRST]), ...over,
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

  it('des tests pas encore lus : Lire en pseudo-code', () => {
    expect(primary(vibeView(input({ note, marks: NOTE_OK, tests: [test] })))).toBe('read-invariants');
  });

  it('lus mais pas tous validés (Guide) : aucune action, la validation attend', () => {
    expect(primary(vibeView(input({ note, marks: NOTE_OK, tests: [test], readings: { [BLOB]: READING }, repo: repo([NOTE_PATH, TEST_PATH]) }))))
      .toBeNull();
  });

  it('lus et validés, des fichiers pas commités : Préparer le commit', () => {
    expect(primary(vibeView(input({ note, marks: { ...NOTE_OK, ...CASES_OK }, tests: [test], readings: { [BLOB]: READING }, repo: repo([NOTE_PATH, TEST_PATH]) }))))
      .toBe('commit-prepare');
  });

  it('un commit préparé (commit.md) : Commiter', () => {
    expect(primary(vibeView(input({
      note, marks: { ...NOTE_OK, ...CASES_OK }, tests: [test], readings: { [BLOB]: READING }, repo: repo([NOTE_PATH, TEST_PATH]), outputs: { 'commit.md': out('x') },
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

  it('vérifications passées : Ponytail review', () => {
    const checks = out('{"items":[{"name":"tests","ok":true}],"time":1}');
    expect(primary(vibeView(ready({ repo: repo([], [FIRST, HELLO, BUTTON]), outputs: { 'checks.json': checks } })))).toBe('ponytail');
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
  it('pas de note : Tout dérouler', () => {
    expect(primary(vibeView(input({ autonomy: 'vibe' })))).toBe('vibe');
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

  it('note jugée, tests pas lus : Lire en pseudo-code', () => {
    expect(primary(vibeView(loaded({ marks: { note: ok(NOTE) } })))).toBe('read-invariants');
  });

  it('tests lus et jugés : Relire les commits', () => {
    const v = vibeView(loaded({ marks: { note: ok(NOTE), ...CASES_OK }, readings: { [BLOB]: READING } }));
    expect([status(v).commits, primary(v)]).toEqual(['current', 'review-commits']);
  });

  it('un plan de test pas tout coché : l\'écran reste en cours, sans action', () => {
    const outputs = { 'pr-12-commits.md': out('## abc x'), 'pr-12-ecran.md': out('- [ ] Ouvrir\n- [x] Dicter\n') };
    const v = vibeView(loaded({ marks: { note: ok(NOTE), ...CASES_OK }, readings: { [BLOB]: READING }, outputs }));
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
    const v = vibeView(loaded({ marks: { note: ok(NOTE), ...CASES_OK }, readings: { [BLOB]: READING }, outputs }));
    expect([status(v).revue, primary(v)]).toEqual(['current', 'publish']);
  });
});

describe('les actions grisées, et pourquoi', () => {
  it('l\'agent travaille : chaque action envoyée est grisée', () => {
    expect(action(vibeView(input({ busy: true })), 'note')?.disabled).toBe('L\'agent travaille');
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
    expect(action(vibeView(input({ lang: 'en', busy: true })), 'note')?.disabled).toBe('The agent is working');
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
    const x = v([{ name: 'tests', ok: true, level: 'ok' }, { name: 'lint', ok: true, level: 'warning' }]);
    expect([primary(x), revue(x)]).toEqual(['ponytail', 'vérifications ok · 1 avertissement']);
  });

  it('level l\'emporte sur ok : warning passe même si ok est faux, error échoue même si ok est vrai', () => {
    expect(primary(v([{ name: 'lint', ok: false, level: 'warning' }]))).toBe('ponytail');
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
    expect(v.modules[0]).toEqual({ path: 'main/core/x/', contract: 'pur', file: { id: 'm0', path: 'src/main/core/x' }, touched: true, commits: ['e'.repeat(40)] });
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
