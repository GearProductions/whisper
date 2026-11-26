import { describe, expect, it } from 'vitest';
import { statusLine } from 'core/vibecoder';
import type { VibeCi, VibeNote, VibePause, VibeRun, VibeStepId, VibeView } from 'technicals/bridge';

const IDS: VibeStepId[] = ['note', 'forme', 'invariants', 'modules', 'revue', 'pr'];
const note = (over: Partial<VibeNote> = {}): VibeNote => ({
  id: 'n', path: 'docs/tickets/feat/x.md', text: '# x', before: null, filled: true, mustNot: [], mark: 'ok', formeMark: null, ...over,
});
const run = (over: Partial<VibeRun> = {}): VibeRun => ({
  id: 'generate', label: 'Générer', who: 'opus', state: 'running', since: 0, end: null, reply: '', permission: null, ...over,
});
// Une note validée, l'étape en cours ; le reste vide. L'étape Note est faite si la note a son ✓ et que l'étape en cours la suit
// (comme le relevé) ; les autres étapes avant l'étape en cours le sont.
const view = (current: VibeStepId, over: Partial<VibeView> = {}): VibeView => {
  const n = over.note === undefined ? note() : over.note;
  const done = (id: VibeStepId) => IDS.indexOf(id) < IDS.indexOf(current) && (id !== 'note' || n?.mark === 'ok');
  return {
    agentId: 'a1', lang: 'fr', flow: 'create', agent: { model: '', effort: '', mode: '' }, repo: null, error: null,
    steps: IDS.map((id) => ({ id, status: id === current ? 'current' : done(id) ? 'done' : 'todo', facts: '' })),
    note: n, questions: [], modules: [], invariants: [], variants: [], commits: [], outputs: {}, checklist: [], actions: [], skills: [],
    pr: null, prs: null, draft: [], time: 0, ...over,
  };
};
// Le relecteur : quatre arrêts, la PR chargée et le dossier sur sa tête, rien à lancer ; les arrêts d'avant le courant sont faits.
const RIDS: VibeStepId[] = ['note', 'invariants', 'revue', 'pr'];
const rview = (current: VibeStepId | null, over: Partial<VibeView> = {}): VibeView => ({
  ...view('note', { note: null }), flow: 'review', pr: { ...pr, head: 'feat/x' }, repo: { branch: 'feat/x', base: 'master', changed: 3 }, prepare: [], screen: [],
  steps: RIDS.map((id) => ({ id, status: current === null || RIDS.indexOf(id) < RIDS.indexOf(current) ? 'done' : id === current ? 'current' : 'todo', facts: '' })),
  ...over,
});
const tests = (marks: Record<string, 'ok' | 'ko' | null>) => [{ id: 't0', path: 'tests/invariants/a.test.ts', blob: 'b', cases: Object.keys(marks), lines: [1, 2, 3], source: '', reading: null, marks }] as VibeView['invariants'];
const ci = (first: string) => ({ 'ci.md': { text: `${first}\n`, time: 1 } });
const pr = { number: 7, title: 't', url: 'u', author: 'a', base: 'master', head: 'b', body: '', state: 'OPEN' as const };
// La CI d'une PR : lue par gh (view.pr.ci), jamais ci.md.
const withCi = (state: VibeCi['state'], failed: string[] = []) => ({ ...pr, ci: { state, failed } });
const ok = withCi('ok'), pending = withCi('pending'), ko = withCi('ko', ['lint']);
const q = (n: number) => ({ n, text: `question ${n}`, options: [] });

describe('statusLine', () => {
  it('pas de note : demander la note à l\'agent', () => {
    expect(statusLine(view('note', { note: null }))).toEqual({ text: 'Demandez la note à l\'agent, dans la conversation', yours: true });
    expect(statusLine(view('note', { note: note({ filled: false }) }))?.text).toBe('Demandez la note à l\'agent, dans la conversation');
  });

  it('deux questions ouvertes : leur nombre, le questionnaire, à l\'utilisateur ; une seule : au singulier', () => {
    expect(statusLine(view('note', { questions: [q(1), q(2)] }))).toEqual({ text: '2 questions : répondez dans le questionnaire', yours: true });
    expect(statusLine(view('forme', { questions: [q(1)] }))?.text).toBe('1 question : répondez dans le questionnaire');
  });

  it('des questions pendant que le moteur enchaîne : les questions d\'abord', () => {
    expect(statusLine(view('modules', { vibe: true, questions: [q(1)], runs: [run()] }))).toEqual({ text: '1 question : répondez dans le questionnaire', yours: true });
  });

  it('la note rédigée, sans son ✓ : vérifier, puis valider', () => {
    for (const mark of [null, 'changed'] as const) {
      expect(statusLine(view('note', { note: note({ mark }) }))).toEqual({ text: 'Vérifiez, puis validez la note', yours: true });
    }
  });

  it('la note retouchée pendant les modules (étape Note faite, ✓ « changed » qui compte encore) : la ligne du moteur, pas « validez la note »', () => {
    const steps = IDS.map((id) => ({ id, status: id === 'modules' ? 'current' : IDS.indexOf(id) < 3 ? 'done' : 'todo', facts: '' })) as VibeView['steps'];
    expect(statusLine(view('modules', { vibe: true, note: note({ mark: 'changed' }), steps }))).toEqual({ text: 'Le système écrit les modules', yours: false });
  });

  it('la note commitée qui a perdu son ✓ : elle attend sa validation (la ligne de pause)', () => {
    expect(statusLine(view('forme', { note: note({ mark: 'changed' }), pause: 'note' }))).toEqual({ text: 'La note a changé : vérifiez-la, puis validez-la', yours: true });
  });

  it('la pause \'note\', la PR ouverte : la note d\'abord, à l\'utilisateur, pas over (même PR verte, chaque étape faite)', () => {
    const v = view('pr', { note: note({ mark: 'changed' }), pause: 'note', pr: ok });
    const steps = v.steps.map((x) => ({ ...x, status: x.id === 'note' ? 'todo' as const : 'done' as const }));
    expect(statusLine({ ...v, steps })).toEqual({ text: 'La note a changé : vérifiez-la, puis validez-la', yours: true });
    expect(statusLine({ ...v, steps, lang: 'en' })?.text).toBe('The note changed: check it, then approve it');
  });

  it('la note revalidée, pas commitée (note.git \'modified\'), la PR ouverte : reprendre pour que le système l\'applique, pas over', () => {
    const v = view('pr', { note: note({ git: 'modified' }), pr: ok });
    expect(statusLine(v)).toEqual({ text: 'La note est validée : reprenez pour que le système l\'applique', yours: true });
    expect(statusLine({ ...v, lang: 'en' })?.text).toBe('The note is approved: resume for the system to apply it');
    const allDone = { ...v, steps: v.steps.map((x) => ({ ...x, status: 'done' as const })) };
    expect(statusLine(allDone)?.over).toBeUndefined();
    // aux pauses et le moteur en route : leur ligne d'abord
    expect(statusLine(view('forme', { note: note({ git: 'modified' }), pause: 'invariants' }))?.text).toBe('Regardez vos règles, puis reprenez');
    expect(statusLine(view('modules', { note: note({ git: 'modified' }), vibe: true }))?.text).toBe('Le système écrit les modules');
  });

  it('la note jamais commitée (note.git \'new\') ou commitée (absent) : pas « validée : reprenez »', () => {
    expect(statusLine(view('pr', { note: note({ git: 'new' }), pr: ok }))?.text).toBe('La PR est verte : à vous de la fusionner');
    expect(statusLine(view('forme', { note: note({ git: 'new' }) }))?.text).toBe('Le système est arrêté : reprenez');
  });

  it('un ✓ d\'étape retiré à la main : la ligne nomme l\'étape', () => {
    const l = statusLine(view('invariants', { pause: 'withdrawn:invariants' }));
    expect(l?.yours).toBe(true);
    expect(l?.text).toContain('invariants');
    expect(statusLine(view('forme', { pause: 'withdrawn:forme' }))?.text).toContain('forme');
    expect(statusLine(view('modules', { pause: 'withdrawn:modules' }))?.text).toContain('modules');
  });

  it('des tests notés « À revoir » : leur nombre, et à qui le dire ; à l\'utilisateur', () => {
    const tests = (marks: Record<string, 'ok' | 'ko' | null>) => [{ id: 't0', path: 'tests/invariants/a.test.ts', blob: 'b', cases: Object.keys(marks), lines: [1, 2, 3], source: '', reading: null, marks }];
    const at = (marks: Record<string, 'ok' | 'ko' | null>, over: Partial<VibeView> = {}) =>
      statusLine(view('invariants', { pause: 'withdrawn:invariants', invariants: tests(marks) as VibeView['invariants'], ...over }));
    expect(at({ x: 'ko', y: 'ok', z: null })).toEqual({ text: '1 test à revoir : dites à l\'agent quoi corriger', yours: true });
    expect(at({ x: 'ko', y: 'ko' })?.text).toBe('2 tests à revoir : dites à l\'agent quoi corriger');
    // le moteur en route : la même ligne (la pause l'arrête)
    expect(at({ x: 'ko' }, { vibe: true })?.text).toBe('1 test à revoir : dites à l\'agent quoi corriger');
    // aucun test à revoir : la ligne du ✓ retiré, comme avant
    expect(at({ x: 'ok' })?.text).toContain('retiré');
    expect(at({ x: 'ko' }, { lang: 'en' })?.text).toBe('1 test to review: tell the agent what to fix');
  });

  it('le moteur en route, une course en cours : ce que fait cette course, son avancement compris', () => {
    const progress = { wave: 2, done: 1, total: 3, fixes: 0, opus: false };
    const l = statusLine(view('modules', { vibe: true, runs: [run({ progress })] }));
    expect(l).toEqual({ text: 'Le système travaille : Générer · vague 2 · 1/3 modules', yours: false });
    expect(statusLine(view('modules', { vibe: true, runs: [run({ id: 'x', label: 'Prouver', state: 'asking' })] }))?.text).toBe('Le système travaille : Prouver');
  });

  it('une course finie, arrêtée ou en échec n\'est pas ce que le système fait', () => {
    const done = [run({ state: 'done' }), run({ state: 'failed' }), run({ state: 'stopped' })];
    expect(statusLine(view('modules', { vibe: true, runs: done }))?.text).toBe('Le système écrit les modules');
  });

  it('le moteur en route, aucune course : ce que fait l\'étape en cours', () => {
    expect(statusLine(view('modules', { vibe: true }))).toEqual({ text: 'Le système écrit les modules', yours: false });
    expect(statusLine(view('forme', { vibe: true }))?.text).toBe('Le système pose la forme');
    expect(statusLine(view('invariants', { vibe: true }))?.text).toBe('Le système écrit les invariants');
    expect(statusLine(view('revue', { vibe: true }))?.text).toBe('Le système relit le diff');
    expect(statusLine(view('pr', { vibe: true }))?.yours).toBe(false);
  });

  it('le moteur en route sans étape en cours : une phrase quand même', () => {
    const v = view('modules', { vibe: true });
    expect(statusLine({ ...v, steps: v.steps.map((x) => ({ ...x, status: x.id === 'modules' ? 'todo' as const : x.status })) })).toEqual({ text: 'Le système travaille', yours: false });
  });

  it('la pause après les invariants et après les modules', () => {
    expect(statusLine(view('forme', { pause: 'invariants' }))).toEqual({ text: 'Regardez vos règles, puis reprenez', yours: true });
    expect(statusLine(view('revue', { pause: 'modules' }))).toEqual({ text: 'Essayez l\'appli, puis reprenez', yours: true });
  });

  it('la pause après les invariants revenue (des tests changés depuis leur validation) : elle le dit', () => {
    const v = view('modules', { pause: 'invariants' });
    const changed = { ...v, steps: v.steps.map((x) => (x.id === 'invariants' ? { ...x, check: { state: 'changed' as const, now: 'h' } } : x)) };
    expect(statusLine(changed)).toEqual({ text: 'Des tests ont changé : regardez vos règles, puis reprenez', yours: true });
    expect(statusLine({ ...changed, lang: 'en' })?.text).toBe('Some tests changed: look at your rules, then resume');
    // témoin : la première fois (jamais validés), la ligne d'avant
    expect(statusLine(v)?.text).toBe('Regardez vos règles, puis reprenez');
  });

  it('le moteur arrêté hors d\'une pause : il est arrêté, reprenez', () => {
    expect(statusLine(view('modules'))).toEqual({ text: 'Le système est arrêté : reprenez', yours: true });
  });

  it('la PR ouverte, la CI en cours (pr.ci pending) : la CI tourne, pas over', () => {
    expect(statusLine(view('pr', { pr: pending }))).toEqual({ text: 'La PR est ouverte, la CI tourne', yours: false });
  });

  it('la PR ouverte, la CI en échec (pr.ci ko) : elle le dit, sans les noms (la vue de la PR les liste), pas over', () => {
    expect(statusLine(view('pr', { pr: ko }))).toEqual({ text: 'La PR est ouverte, la CI est en échec', yours: false });
  });

  it('la PR ouverte, la CI inconnue (pr.ci absent ou null, gh sans réponse) : elle le dit, ni verte ni over', () => {
    for (const p of [pr, { ...pr, ci: null }]) {
      expect(statusLine(view('pr', { pr: p }))).toEqual({ text: 'La PR est ouverte : état de la CI inconnu', yours: false });
    }
    expect(statusLine(view('pr', { pr, lang: 'en' }))?.text).toBe('The PR is open: CI state unknown');
  });

  it('la PR verte (pr.ci ok) : à vous de la fusionner, à l\'utilisateur', () => {
    expect(statusLine(view('pr', { pr: ok }))).toEqual({ text: 'La PR est verte : à vous de la fusionner', yours: true });
  });

  it('un ci.md ✓ sans pr.ci : jamais vert ; un ci.md ⏳ avec pr.ci ok : vert (gh seul fait foi)', () => {
    for (const p of [pr, { ...pr, ci: null }]) {
      const allDone = view('pr', { pr: p, outputs: ci('✓ tout passe') });
      const l = statusLine({ ...allDone, steps: allDone.steps.map((x) => ({ ...x, status: 'done' as const })) });
      expect(l).toEqual({ text: 'La PR est ouverte : état de la CI inconnu', yours: false });
    }
    expect(statusLine(view('pr', { pr: ok, outputs: ci('⏳ 0/2') }))?.text).toBe('La PR est verte : à vous de la fusionner');
    expect(statusLine(view('pr', { pr: pending, outputs: ci('✓ tout passe') }))?.text).toBe('La PR est ouverte, la CI tourne');
  });

  it('le parcours fini (over) : la PR verte et chaque étape faite, fusionnée, fermée — rien à reprendre ; verte avec une étape pas faite, la CI en cours ou en échec : non', () => {
    const allDone = (over: Partial<VibeView>) => { const v = view('pr', over); return { ...v, steps: v.steps.map((x) => ({ ...x, status: 'done' as const })) }; };
    expect(statusLine(allDone({ pr: ok }))).toEqual({ text: 'La PR est verte : à vous de la fusionner', yours: true, over: true });
    expect(statusLine(view('pr', { pr: ok }))).toEqual({ text: 'La PR est verte : à vous de la fusionner', yours: true });   // une étape reste : Reprendre garde son sens
    for (const p of [pending, ko, pr]) expect(statusLine(allDone({ pr: p }))?.over).toBeUndefined();
    expect(statusLine(view('modules'))?.over).toBeUndefined();
  });

  it('la PR fusionnée : dite, rien n\'attend l\'utilisateur ; fermée sans être fusionnée : dite aussi, sans « reprenez »', () => {
    expect(statusLine(view('pr', { pr: { ...pr, state: 'MERGED' } }))).toEqual({ text: 'La PR est fusionnée', yours: false, over: true });
    expect(statusLine(view('pr', { pr: { ...pr, state: 'CLOSED' } }))).toEqual({ text: 'La PR est fermée, sans avoir été fusionnée', yours: false, over: true });
    expect(statusLine(view('pr', { lang: 'en', pr: { ...pr, state: 'CLOSED' } }))?.text).toBe('The PR is closed, not merged');
  });

  it('une PR dont l\'état est inconnu (fiche d\'avant la 0.8.0-rc.2) : ouverte, comme pr-view', () => {
    const unknown = { ...pr, state: null };
    expect(statusLine(view('pr', { pr: { ...unknown, ci: pending.ci } }))).toEqual({ text: 'La PR est ouverte, la CI tourne', yours: false });
    expect(statusLine(view('pr', { pr: { ...unknown, ci: ok.ci } }))?.text).toBe('La PR est verte : à vous de la fusionner');
  });

  it('l\'ordre : questions > note > ✓ retiré > moteur > pause > PR > arrêté', () => {
    const withdrawn = { pause: 'withdrawn:forme' as VibePause };
    expect(statusLine(view('forme', { note: null, questions: [q(1)] }))?.text).toContain('Demandez la note');
    expect(statusLine(view('forme', { note: note({ mark: null }), questions: [q(1)], ...withdrawn }))?.text).toContain('question');
    expect(statusLine(view('forme', { note: note({ mark: null }), ...withdrawn }))?.text).toBe('Vérifiez, puis validez la note');
    expect(statusLine(view('forme', { vibe: true, ...withdrawn }))?.text).toContain('forme');
    expect(statusLine(view('modules', { vibe: true, pause: 'modules', pr: ok }))?.text).toBe('Le système écrit les modules');
    expect(statusLine(view('revue', { pause: 'modules', pr: ok }))?.text).toBe('Essayez l\'appli, puis reprenez');
  });

  it('un relevé en erreur : aucune ligne', () => {
    expect(statusLine(view('note', { error: 'pas un dépôt', note: null }))).toBeNull();
    expect(statusLine(rview('note', { error: 'pas un dépôt' }))).toBeNull();
  });

  it('en anglais : la même ligne, en anglais', () => {
    const en = (current: VibeStepId, over: Partial<VibeView> = {}) => statusLine(view(current, { lang: 'en', ...over }));
    expect(en('note', { note: null })).toEqual({ text: 'Ask the agent for the note, in the conversation', yours: true });
    expect(en('note', { questions: [q(1), q(2)] })?.text).toBe('2 questions: answer in the questionnaire');
    expect(en('note', { questions: [q(1)] })?.text).toBe('1 question: answer in the questionnaire');
    expect(en('note', { note: note({ mark: null }) })?.text).toBe('Check, then approve the note');
    expect(en('forme', { note: note({ mark: null }), pause: 'note' })?.text).toBe('The note changed: check it, then approve it');
    expect(en('invariants', { pause: 'withdrawn:invariants' })?.text).toContain('invariants');
    expect(en('modules', { vibe: true, runs: [run({ progress: { wave: 1, done: 0, total: 2, fixes: 0, opus: false } })] })?.text).toBe('The system is working: Générer · wave 1 · 0/2 modules');
    expect(en('modules', { vibe: true })?.text).toBe('The system is writing the modules');
    expect(en('forme', { pause: 'invariants' })?.text).toBe('Look at your rules, then resume');
    expect(en('revue', { pause: 'modules' })?.text).toBe('Try the app, then resume');
    expect(en('modules')?.text).toBe('The system is stopped: resume');
    expect(en('pr', { pr: pending })?.text).toBe('The PR is open, the CI is running');
    expect(en('pr', { pr: ko })?.text).toBe('The PR is open, the CI failed');
    expect(en('pr', { pr: ok })?.text).toBe('The PR is green: yours to merge');
    expect(en('pr', { pr: { ...pr, state: 'MERGED' } })?.text).toBe('The PR is merged');
  });
});

// 0.16.0 : la revue essentielle (docs/tickets/feat/0.16.0-revue-essentielle.md), la ligne du relecteur.
describe('statusLine du relecteur', () => {
  const text = (current: VibeStepId | null, over: Partial<VibeView> = {}) => statusLine(rview(current, over));

  it('pas de PR chargée : choisir la PR à relire, à l\'utilisateur', () => {
    expect(text('note', { pr: null })).toEqual({ text: 'Choisissez la PR à relire, dans la vue des branches', yours: true });
  });

  it('le dossier sur une autre branche : passer sur la branche de la PR, avant toute lecture', () => {
    const elsewhere = { repo: { branch: 'master', base: 'master', changed: 0 }, prepare: ['review-note'], runs: [run()] };
    expect(text('note', elsewhere)).toEqual({ text: 'Passez sur la branche de la PR', yours: true });
  });

  it('deux lectures en cours : ce que le système lit, pas à l\'utilisateur ; une lecture finie n\'y est pas', () => {
    const runs = [run({ id: 'review-note', label: 'Relire la note' }), run({ id: 'align', label: 'Vérifier l\'alignement', state: 'asking' }), run({ id: 'screen', label: 'Plan', state: 'done' })];
    expect(text('note', { runs, prepare: ['read-invariants'] })).toEqual({ text: 'Le système lit : Relire la note, Vérifier l\'alignement', yours: false });
  });

  it('des lectures à lancer : préparer la revue', () => {
    expect(text('note', { prepare: ['review-note', 'screen'] })).toEqual({ text: 'Préparez la revue', yours: true });
  });

  it('tout lu, la note pas jugée : la lire, puis la juger', () => {
    expect(text('note')).toEqual({ text: 'Lisez la note, puis jugez-la', yours: true });
  });

  it('des tests sans verdict : leur nombre, à juger ; un seul au singulier ; un « À revoir » est jugé', () => {
    const at = (marks: Record<string, 'ok' | 'ko' | null>) => text('invariants', { invariants: tests(marks) })?.text;
    expect(at({ a: null, b: null, c: null, d: 'ok', e: 'ko' })).toBe('3 tests à juger');
    expect(at({ a: null, b: 'ok' })).toBe('1 test à juger');
    expect(text('invariants', { invariants: tests({ a: null }), lang: 'en' })?.text).toBe('1 test to judge');
  });

  it('deux cases du plan pas cochées : leur nombre, essayer l\'appli', () => {
    const screen = [{ text: 'a', done: true }, { text: 'b', done: false }, { text: 'c', done: null }];
    expect(text('revue', { screen })).toEqual({ text: 'Essayez l\'appli : 2 cases à cocher', yours: true });
    expect(text('revue', { screen: [{ text: 'a', done: false }] })?.text).toBe('Essayez l\'appli : 1 case à cocher');
    expect(text('revue', { screen: [{ text: 'a', done: false }, { text: 'b', done: false }], lang: 'en' })?.text).toBe('Try the app: 2 boxes to tick');
  });

  it('pas de plan, rien à lancer : essayer l\'appli, sans nombre', () => {
    expect(text('revue')?.text).toBe('Essayez l\'appli');
  });

  it('tout jugé, la revue pas publiée : la publier', () => {
    expect(text('pr')).toEqual({ text: 'Publiez la revue', yours: true });
  });

  it('la revue publiée : la ligne le dit, parcours fini', () => {
    expect(text(null)).toEqual({ text: 'La revue est publiée', yours: false, over: true });
  });

  it('l\'ordre : PR > branche > lectures en cours > à lancer > les arrêts dans leur ordre', () => {
    expect(text('note', { pr: null, repo: null })?.text).toContain('Choisissez');
    expect(text('note', { runs: [run()], prepare: ['screen'] })?.text).toContain('lit');
    expect(text('invariants', { prepare: ['screen'] })?.text).toBe('Préparez la revue');
    // un arrêt pas fait plus loin dans le fil ne passe pas devant le courant
    const steps = rview('note').steps.map((x) => ({ ...x, status: x.id === 'pr' ? 'done' as const : x.status }));
    expect(text('note', { steps })?.text).toBe('Lisez la note, puis jugez-la');
  });

  it('un relevé sans lectures (prepare absent) : rien à lancer', () => {
    expect(text('pr', { prepare: undefined })?.text).toBe('Publiez la revue');
  });

  it('en anglais : la même ligne, en anglais', () => {
    const en = (current: VibeStepId | null, over: Partial<VibeView> = {}) => text(current, { lang: 'en', ...over })?.text;
    expect(en('note', { pr: null })).toBe('Pick the PR to review, in the branch view');
    expect(en('note', { repo: { branch: 'master', base: 'master', changed: 0 } })).toBe('Switch to the PR\'s branch');
    expect(en('note', { runs: [run({ label: 'Review the note' })] })).toBe('The system is reading: Review the note');
    expect(en('note', { prepare: ['screen'] })).toBe('Prepare the review');
    expect(en('note')).toBe('Read the note, then judge it');
    expect(en('revue', { screen: [{ text: 'a', done: false }] })).toBe('Try the app: 1 box to tick');
    expect(en('pr')).toBe('Publish the review');
    expect(en(null)).toBe('The review is published');
  });

  it('le créateur : ses lignes, comme avant', () => {
    expect(statusLine(view('modules'))?.text).toBe('Le système est arrêté : reprenez');
    expect(statusLine(view('note', { note: null }))?.text).toBe('Demandez la note à l\'agent, dans la conversation');
  });
});
