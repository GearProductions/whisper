import { describe, expect, it } from 'vitest';
import { applyTaskEvent, EMPTY_LOG, runningTasks, runProgress, TOOLS_KEPT, unreadAgents, type TaskLog } from 'core/agents';

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

describe('le sous-agent relancé (T-32, fil mesuré le 12 novembre)', () => {
  const use = (id: string, name: string, parent: string | null = null, input: unknown = {}) =>
    ({ type: 'assistant', parent_tool_use_id: parent, message: { id: `m-${id}`, content: [{ type: 'tool_use', id, name, input }] } });
  const agentStarted = (extra: Record<string, unknown> = {}) => started('a1', { task_type: 'local_agent', tool_use_id: 'ag', ...extra });
  const notif = { type: 'system', subtype: 'task_notification', task_id: 'a1', status: 'completed' };
  const thread = [use('ag', 'Agent'), agentStarted(), notif];

  it('SendMessage, puis task_started de même task_id : la tâche en cours ; sa notification la finit', () => {
    const log = play(...thread, use('sm', 'SendMessage'));
    expect(runningTasks(log)).toBe(0);
    const again = applyTaskEvent(log, agentStarted({ tool_use_id: 'sm', is_backgrounded: true }), 5000);
    expect(again.tasks).toHaveLength(1);
    expect(again.tasks[0]).toMatchObject({ id: 'a1', status: 'running', ended: null, toolUseId: 'sm', started: 1001 });
    expect(runningTasks(again)).toBe(1);
    const progress = applyTaskEvent(again, { type: 'system', subtype: 'task_progress', task_id: 'a1', summary: 'écrit' }, 5100);
    expect(runningTasks(progress)).toBe(1);
    const done = applyTaskEvent(progress, notif, 6000);
    expect(done.tasks[0]).toMatchObject({ status: 'completed', ended: 6000 });
    expect(runningTasks(done)).toBe(0);
  });

  it('calls.fixes compte le SendMessage comme avant, la relance ne change pas les appels', () => {
    const log = play(...thread, use('sm', 'SendMessage'), agentStarted({ tool_use_id: 'sm' }));
    expect(log.calls.fixes).toBe(1);
    expect(log.calls.waves).toEqual(['m-ag']);
  });

  it('une tâche encore en cours : un task_started de plus ne change rien (même référence)', () => {
    const log = play(use('ag', 'Agent'), agentStarted());
    expect(applyTaskEvent(log, agentStarted({ tool_use_id: 'sm' }), 9000)).toBe(log);
  });

  it('une relance d’une tâche du système reste ignorée', () => {
    const log = play(...thread);
    expect(applyTaskEvent(log, agentStarted({ ambient: true }), 9000)).toBe(log);
  });

  it('relancée, une tâche échouée repart aussi', () => {
    const log = play(agentStarted(), { ...notif, status: 'failed' }, agentStarted({ tool_use_id: 'sm' }));
    expect(log.tasks[0]).toMatchObject({ status: 'running', ended: null });
  });
});

describe('les refus', () => {
  const use = (id: string, name: string, input: unknown, parent: string | null = null) =>
    ({ type: 'assistant', parent_tool_use_id: parent, message: { id: `m-${id}`, content: [{ type: 'tool_use', id, name, input }] } });
  const refused = (id: string, text = 'Permission to use Bash has been denied because Claude Code is running in don\'t ask mode.', parent: string | null = null, isError = true) =>
    ({ type: 'user', parent_tool_use_id: parent, message: { content: [{ type: 'tool_result', tool_use_id: id, is_error: isError, content: text }] } });

  it('un refus de l’agent, un d’un sous-agent : deux denials, dans l’ordre', () => {
    const log = play(
      use('w1', 'Write', { file_path: '/p/a.ts' }), refused('w1'),
      use('r1', 'Read', { file_path: '/etc/passwd' }, 'ag'),
      refused('r1', '<tool_use_error>File is in a directory that is denied by your permission settings.', 'ag'),
    );
    expect(log.denials).toEqual([
      expect.objectContaining({ toolUseId: 'w1', tool: 'Write' }),
      expect.objectContaining({ toolUseId: 'r1', tool: 'Read' }),
    ]);
  });

  it('le même toolUseId deux fois : un seul', () => {
    const log = play(use('w1', 'Write', { file_path: '/p/a.ts' }), refused('w1'), refused('w1'));
    expect(log.denials).toHaveLength(1);
  });

  it('une erreur ordinaire, ou un texte de refus hors erreur : pas un refus', () => {
    const log = play(use('b1', 'Bash', { command: 'ls' }), refused('b1', 'Blocked: sleep 25'), refused('b1', 'Permission to use Bash has been denied', null, false));
    expect(log.denials).toEqual([]);
  });

  it('un tool_use inconnu ou oublié (TOOLS_KEPT) : le refus est gardé, l’outil est « ? »', () => {
    const unknown = play(refused('zz'));
    expect(unknown.denials).toEqual([expect.objectContaining({ toolUseId: 'zz', tool: '?' })]);
    const trimmed = play(...Array.from({ length: TOOLS_KEPT + 5 }, (_, i) => use(`tu${i}`, 'Bash', { command: `c${i}` })), refused('tu0'));
    expect(trimmed.denials).toEqual([expect.objectContaining({ toolUseId: 'tu0', tool: '?' })]);
  });

  it('un refus dont le texte porte aussi un fichier de sortie : refus et fichier gardés', () => {
    const log = play(use('b1', 'Bash', { command: 'make' }), refused('b1', `Permission to use Bash has been denied. Output is being written to: ${FILE}`));
    expect(log.denials).toHaveLength(1);
    expect(log.tools.b1.outputFile).toBe(FILE);
  });

  it('un tool_result sans refus ni fichier : même référence', () => {
    const log = play(use('b1', 'Bash', { command: 'ls' }));
    expect(applyTaskEvent(log, refused('b1', 'fait', null, false), 2000)).toBe(log);
  });
});

describe('unreadAgents', () => {
  const agentDone = (id: string, type = 'local_agent') => [started(id, { task_type: type }), { type: 'system', subtype: 'task_notification', task_id: id, status: 'completed' }];
  // finis à 1001 (play : maintenant = 1000 + rang)
  it('fini avant turnEnd : 0 ; après : 1 ; turnEnd null : 0', () => {
    const log = play(...agentDone('a'));
    expect(unreadAgents(log, 2000)).toBe(0);
    expect(unreadAgents(log, 500)).toBe(1);
    expect(unreadAgents(log, null)).toBe(0);
  });

  it('seuls les local_agent finis comptent : ni un en cours, ni une commande de fond', () => {
    const log = play(...agentDone('a'), ...agentDone('b', 'local_bash'), started('c', { task_type: 'local_agent' }));
    expect(unreadAgents(log, 0)).toBe(1);
  });

  it('un sous-agent relancé et fini après turnEnd compte ; relancé et en cours, non', () => {
    const log = play(...agentDone('a'));
    const again = applyTaskEvent(log, started('a', { task_type: 'local_agent' }), 3000);
    expect(unreadAgents(again, 500)).toBe(0);
    expect(unreadAgents(applyTaskEvent(again, { type: 'system', subtype: 'task_notification', task_id: 'a', status: 'completed' }, 4000), 3500)).toBe(1);
  });
});
