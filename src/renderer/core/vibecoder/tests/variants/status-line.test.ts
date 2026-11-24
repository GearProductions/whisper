import { describe, expect, it } from 'vitest';
import { statusLine } from 'core/vibecoder';
import type { VibeNote, VibePause, VibeRun, VibeStepId, VibeView } from 'technicals/bridge';

const IDS: VibeStepId[] = ['note', 'forme', 'invariants', 'modules', 'revue', 'pr'];
const note = (over: Partial<VibeNote> = {}): VibeNote => ({
  id: 'n', path: 'docs/tickets/feat/x.md', text: '# x', before: null, filled: true, mustNot: [], mark: 'ok', formeMark: null, ...over,
});
const run = (over: Partial<VibeRun> = {}): VibeRun => ({
  id: 'generate', label: 'Générer', who: 'opus', state: 'running', since: 0, end: null, reply: '', permission: null, ...over,
});
// Une note validée, l'étape en cours ; le reste vide.
const view = (current: VibeStepId, over: Partial<VibeView> = {}): VibeView => ({
  agentId: 'a1', lang: 'fr', flow: 'create', agent: { model: '', effort: '', mode: '' }, repo: null, error: null,
  steps: IDS.map((id) => ({ id, status: id === current ? 'current' : 'todo', facts: '' })),
  note: note(), questions: [], modules: [], invariants: [], variants: [], commits: [], outputs: {}, checklist: [], actions: [], skills: [],
  pr: null, prs: null, draft: [], time: 0, ...over,
});
const ci = (first: string) => ({ 'ci.md': { text: `${first}\n`, time: 1 } });
const pr = { number: 7, title: 't', url: 'u', author: 'a', base: 'master', head: 'b', body: '', state: 'OPEN' as const };
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

  it('la note commitée qui a perdu son ✓ : elle attend sa validation (la ligne de pause)', () => {
    expect(statusLine(view('forme', { note: note({ mark: 'changed' }), pause: 'note' }))).toEqual({ text: 'La note a changé : elle attend sa validation', yours: true });
  });

  it('un ✓ d\'étape retiré à la main : la ligne nomme l\'étape', () => {
    const l = statusLine(view('invariants', { pause: 'withdrawn:invariants' }));
    expect(l?.yours).toBe(true);
    expect(l?.text).toContain('invariants');
    expect(statusLine(view('forme', { pause: 'withdrawn:forme' }))?.text).toContain('forme');
    expect(statusLine(view('modules', { pause: 'withdrawn:modules' }))?.text).toContain('modules');
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
    expect(statusLine({ ...v, steps: [] })).toEqual({ text: 'Le système travaille', yours: false });
  });

  it('la pause après les invariants et après les modules', () => {
    expect(statusLine(view('forme', { pause: 'invariants' }))).toEqual({ text: 'Regardez vos règles, puis reprenez', yours: true });
    expect(statusLine(view('revue', { pause: 'modules' }))).toEqual({ text: 'Essayez l\'appli, puis reprenez', yours: true });
  });

  it('le moteur arrêté hors d\'une pause : il est arrêté, reprenez', () => {
    expect(statusLine(view('modules'))).toEqual({ text: 'Le système est arrêté : reprenez', yours: true });
  });

  it('la PR ouverte, la CI en cours ou pas encore lue : la CI tourne', () => {
    for (const outputs of [ci('⏳ en cours'), {}, ci('?')]) {
      expect(statusLine(view('pr', { pr, outputs }))).toEqual({ text: 'La PR est ouverte, la CI tourne', yours: false });
    }
  });

  it('la PR ouverte, la CI en échec : elle le dit, sans les noms (la vue de la PR les liste)', () => {
    const outputs = { 'ci.md': { text: '✗ échec\n\n## lint\nx\n\n## test\ny\n', time: 1 } };
    const l = statusLine(view('pr', { pr, outputs }));
    expect(l?.yours).toBe(false);
    expect(l?.text).toBe('La PR est ouverte, la CI est en échec');
    expect(statusLine(view('pr', { pr, outputs: ci('✗ échec') }))?.text).toBe('La PR est ouverte, la CI est en échec');
  });

  it('la PR verte : à vous de la fusionner, à l\'utilisateur', () => {
    expect(statusLine(view('pr', { pr, outputs: ci('✓ tout passe') }))).toEqual({ text: 'La PR est verte : à vous de la fusionner', yours: true });
  });

  it('la PR fusionnée : dite, rien n\'attend l\'utilisateur ; fermée : le moteur arrêté', () => {
    expect(statusLine(view('pr', { pr: { ...pr, state: 'MERGED' } }))).toEqual({ text: 'La PR est fusionnée', yours: false });
    expect(statusLine(view('pr', { pr: { ...pr, state: 'CLOSED' } }))?.text).toBe('Le système est arrêté : reprenez');
  });

  it('l\'ordre : questions > note > ✓ retiré > moteur > pause > PR > arrêté', () => {
    const withdrawn = { pause: 'withdrawn:forme' as VibePause };
    expect(statusLine(view('forme', { note: null, questions: [q(1)] }))?.text).toContain('Demandez la note');
    expect(statusLine(view('forme', { note: note({ mark: null }), questions: [q(1)], ...withdrawn }))?.text).toContain('question');
    expect(statusLine(view('forme', { note: note({ mark: null }), ...withdrawn }))?.text).toBe('Vérifiez, puis validez la note');
    expect(statusLine(view('forme', { vibe: true, ...withdrawn }))?.text).toContain('forme');
    expect(statusLine(view('modules', { vibe: true, pause: 'modules', pr, outputs: ci('✓') }))?.text).toBe('Le système écrit les modules');
    expect(statusLine(view('revue', { pause: 'modules', pr, outputs: ci('✓') }))?.text).toBe('Essayez l\'appli, puis reprenez');
  });

  it('le relecteur, ou un relevé en erreur : aucune ligne', () => {
    expect(statusLine(view('note', { flow: 'review', note: null }))).toBeNull();
    expect(statusLine(view('pr', { flow: 'review', pr, outputs: ci('✓') }))).toBeNull();
    expect(statusLine(view('note', { error: 'pas un dépôt', note: null }))).toBeNull();
  });

  it('en anglais : la même ligne, en anglais', () => {
    const en = (current: VibeStepId, over: Partial<VibeView> = {}) => statusLine(view(current, { lang: 'en', ...over }));
    expect(en('note', { note: null })).toEqual({ text: 'Ask the agent for the note, in the conversation', yours: true });
    expect(en('note', { questions: [q(1), q(2)] })?.text).toBe('2 questions: answer in the questionnaire');
    expect(en('note', { questions: [q(1)] })?.text).toBe('1 question: answer in the questionnaire');
    expect(en('note', { note: note({ mark: null }) })?.text).toBe('Check, then approve the note');
    expect(en('forme', { note: note({ mark: null }), pause: 'note' })?.text).toBe('The note changed: it awaits its validation');
    expect(en('invariants', { pause: 'withdrawn:invariants' })?.text).toContain('invariants');
    expect(en('modules', { vibe: true, runs: [run({ progress: { wave: 1, done: 0, total: 2, fixes: 0, opus: false } })] })?.text).toBe('The system is working: Générer · wave 1 · 0/2 modules');
    expect(en('modules', { vibe: true })?.text).toBe('The system is writing the modules');
    expect(en('forme', { pause: 'invariants' })?.text).toBe('Look at your rules, then resume');
    expect(en('revue', { pause: 'modules' })?.text).toBe('Try the app, then resume');
    expect(en('modules')?.text).toBe('The system is stopped: resume');
    expect(en('pr', { pr, outputs: ci('⏳') })?.text).toBe('The PR is open, the CI is running');
    expect(en('pr', { pr, outputs: ci('✗') })?.text).toBe('The PR is open, the CI failed');
    expect(en('pr', { pr, outputs: ci('✓') })?.text).toBe('The PR is green: yours to merge');
    expect(en('pr', { pr: { ...pr, state: 'MERGED' } })?.text).toBe('The PR is merged');
  });
});
