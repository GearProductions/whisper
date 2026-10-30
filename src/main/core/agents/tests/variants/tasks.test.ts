import { describe, expect, it } from 'vitest';
import { applyTaskEvent, EMPTY_LOG, runningTasks, runProgress, TOOLS_KEPT, type TaskLog } from 'core/agents';

const started = (id: string, extra: Record<string, unknown> = {}) => ({ type: 'system', subtype: 'task_started', task_id: id, description: `tâche ${id}`, task_type: 'local_bash', ...extra });
const bash = (id: string, input: Record<string, unknown>) => ({ type: 'assistant', message: { content: [{ type: 'text', text: 'je lance' }, { type: 'tool_use', id, name: 'Bash', input }] } });
const result = (id: string, content: unknown) => ({ type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: id, content }] } });
const FILE = '/tmp/claude-1000/x/tasks/t1.output';
const play = (...ms: Record<string, unknown>[]) => ms.reduce<TaskLog>((log, m, i) => applyTaskEvent(log, m, 1000 + i), EMPTY_LOG);

describe('tâches de fond', () => {
  it('démarrée : en cours, avec sa description', () => {
    const log = play(started('t1'));
    expect(log.tasks).toEqual([{ id: 't1', toolUseId: null, type: 'local_bash', description: 'tâche t1', command: null, status: 'running', started: 1000, ended: null, progress: null, summary: null, outputFile: null }]);
    expect(runningTasks(log)).toBe(1);
    expect(applyTaskEvent(log, started('t1'), 2000)).toBe(log);
  });

  it('commande et description tirées de l’outil qui l’a lancée', () => {
    const log = play(bash('tu1', { command: 'sleep 9', description: 'Attend', run_in_background: true }), started('t1', { tool_use_id: 'tu1' }));
    expect(log.tasks[0]).toMatchObject({ toolUseId: 'tu1', command: 'sleep 9', description: 'Attend' });
  });

  it.each([
    ['dans le texte', `Command running in background with ID: t1. Output is being written to: ${FILE}`],
    ['dans des blocs', [{ type: 'text', text: `Output is being written to: ${FILE}` }]],
    ['phrase finie par un point', `Output is being written to: ${FILE}.`],
  ])('fichier de sortie du résultat de l’outil (%s), avant ou après le démarrage', (_, content) => {
    const tool = bash('tu1', { command: 'make' });
    expect(play(tool, result('tu1', content), started('t1', { tool_use_id: 'tu1' })).tasks[0].outputFile).toBe(FILE);
    expect(play(tool, started('t1', { tool_use_id: 'tu1' }), result('tu1', content)).tasks[0].outputFile).toBe(FILE);
  });

  it.each([
    ['completed', 'completed'], ['failed', 'failed'], ['killed', 'stopped'], ['paused', 'running'],
  ])('mise à jour %s → %s', (from, to) => {
    const [t] = play(started('t1'), { type: 'system', subtype: 'task_updated', task_id: 't1', patch: { status: from, end_time: 5000, error: from === 'failed' ? 'boum' : undefined } }).tasks;
    expect(t).toMatchObject({ status: to, ended: to === 'running' ? null : 5000, summary: from === 'failed' ? 'boum' : null });
  });

  it('avancement : le résumé, sinon le dernier outil', () => {
    const progress = (extra: Record<string, unknown>) => play(started('t1'), { type: 'system', subtype: 'task_progress', task_id: 't1', ...extra }).tasks[0].progress;
    expect(progress({ summary: 'lit les tests', last_tool_name: 'Read' })).toBe('lit les tests');
    expect(progress({ last_tool_name: 'Read' })).toBe('Read');
  });

  it.each(['completed', 'failed', 'stopped'])('notification %s : état final, fichier, résumé', (status) => {
    const log = play(started('t1'), { type: 'system', subtype: 'task_notification', task_id: 't1', status, output_file: FILE, summary: 'fini' });
    expect(log.tasks[0]).toMatchObject({ status, ended: 1001, outputFile: FILE, summary: 'fini' });
    expect(runningTasks(log)).toBe(0);
  });

  it('les tâches du système sont ignorées', () => {
    expect(play(started('t1', { ambient: true }), started('t2', { skip_transcript: true }), started('t3')).tasks.map((t) => t.id)).toEqual(['t3']);
  });

  it.each([
    ['message sans rapport', { type: 'result', subtype: 'success' }],
    ['tâche inconnue', { type: 'system', subtype: 'task_notification', task_id: 'zz', status: 'completed', output_file: FILE }],
    ['réponse sans outil', { type: 'assistant', message: { content: [{ type: 'text', text: 'ok' }] } }],
    ['résultat sans fichier', result('tu1', 'fait')],
  ])('même référence : %s', (_, m) => {
    const log = play(started('t1'));
    expect(applyTaskEvent(log, m, 2000)).toBe(log);
  });

  it(`au plus ${TOOLS_KEPT} outils retenus, les plus anciens oubliés`, () => {
    const log = play(...Array.from({ length: TOOLS_KEPT + 5 }, (_, i) => bash(`tu${i}`, { command: `c${i}` })));
    expect(Object.keys(log.tools)).toHaveLength(TOOLS_KEPT);
    expect(log.tools.tu4).toBeUndefined();
    expect(log.tools[`tu${TOOLS_KEPT + 4}`]).toMatchObject({ name: 'Bash' });
  });
});

describe('appels du fil principal', () => {
  const call = (mid: string | undefined, blocks: Record<string, unknown>[], extra: Record<string, unknown> = {}) =>
    ({ type: 'assistant', ...extra, message: { ...(mid && { id: mid }), content: blocks.map((b, i) => ({ type: 'tool_use', id: `${mid}-${i}`, ...b })) } });
  const agent = (input: Record<string, unknown> = {}) => ({ name: 'Agent', input });

  it('une vague par message d’Agent, corrections et Opus comptés', () => {
    const log = play(
      call('m1', [agent(), agent()]), call('m1', [agent()]),
      call('m2', [{ name: 'SendMessage', input: {} }]), call('m3', [agent({ model: 'opus' })]), call('m4', [{ name: 'Bash', input: {} }]),
    );
    expect(log.calls).toEqual({ waves: ['m1', 'm3'], fixes: 1, opus: true });
    expect(runProgress(log)).toEqual({ wave: 2, done: 0, fixes: 1, opus: true });
  });

  it('sous-agents, blocs déjà vus et messages sans id : pas comptés', () => {
    const m = call('m1', [agent()]);
    expect(play(call('m9', [agent(), { name: 'SendMessage', input: {} }], { parent_tool_use_id: 'tu' })).calls).toEqual(EMPTY_LOG.calls);
    expect(play(m, m).calls).toEqual({ waves: ['m1'], fixes: 0, opus: false });
    expect(play(call(undefined, [agent()])).calls.waves).toEqual([]);
  });

  it('done : les local_agent terminés', () => {
    const done = (id: string, type: string) => [started(id, { task_type: type }), { type: 'system', subtype: 'task_notification', task_id: id, status: 'completed' }];
    expect(runProgress(play(...done('a', 'local_agent'), ...done('b', 'local_bash'), started('c', { task_type: 'local_agent' })))).toEqual({ wave: 0, done: 1, fixes: 0, opus: false });
  });
});
