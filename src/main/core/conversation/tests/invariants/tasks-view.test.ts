// Invariant du volet « Tâches ». Protégé : si un test échoue, corriger le code.
//   I-34 : le principal ne lit que les fichiers de sortie que Claude Code a
//          nommés dans le flux de la session (notification de tâche, résultat
//          d'une commande en arrière-plan) — jamais un chemin venu d'une page,
//          jamais un autre fichier.
import { describe, expect, it, vi } from 'vitest';
import { applyTaskEvent, EMPTY_LOG } from 'core/agents';
import { taskViews } from 'core/conversation';
import { PANEL_CHANNELS } from 'shared/bridge';

const started = (id: string, extra: Record<string, unknown> = {}) => ({ type: 'system', subtype: 'task_started', task_id: id, description: `tâche ${id}`, task_type: 'local_bash', is_backgrounded: true, ...extra });
const notified = (id: string, output_file: string) => ({ type: 'system', subtype: 'task_notification', task_id: id, status: 'completed', output_file, summary: 'fini' });

describe('fichiers de sortie lus (I-34)', () => {
  it('seulement ceux nommés par Claude Code, une fois par tâche', () => {
    let log = EMPTY_LOG;
    log = applyTaskEvent(log, started('t1'), 1000);
    log = applyTaskEvent(log, started('t2'), 1000);
    log = applyTaskEvent(log, notified('t1', '/tmp/claude-1000/x/tasks/t1.output'), 2000);
    const readTail = vi.fn((f: string) => `sortie de ${f}`);
    const views = taskViews(log, '/tmp/projet', readTail);
    expect(readTail.mock.calls.map(([f]) => f)).toEqual(['/tmp/claude-1000/x/tasks/t1.output']);
    expect(views.find((v) => v.id === 't1')).toMatchObject({ outputFile: '/tmp/claude-1000/x/tasks/t1.output', output: 'sortie de /tmp/claude-1000/x/tasks/t1.output' });
    expect(views.find((v) => v.id === 't2')).toMatchObject({ outputFile: null, output: null });
  });

  it('le fichier d’une commande en cours vient du résultat de l’outil, pas d’ailleurs', () => {
    let log = EMPTY_LOG;
    log = applyTaskEvent(log, { type: 'assistant', message: { content: [{ type: 'tool_use', id: 'tu1', name: 'Bash', input: { command: 'sleep 9', description: 'Attend', run_in_background: true } }] } }, 1000);
    log = applyTaskEvent(log, { type: 'user', message: { content: [{ type: 'tool_result', tool_use_id: 'tu1', content: 'Command running in background with ID: t1. Output is being written to: /tmp/claude-1000/x/tasks/t1.output' }] } }, 1001);
    log = applyTaskEvent(log, started('t1', { tool_use_id: 'tu1' }), 1002);
    const readTail = vi.fn(() => 'en cours');
    const [v] = taskViews(log, '/tmp/projet', readTail);
    expect(v).toMatchObject({ id: 't1', command: 'sleep 9', description: 'Attend', status: 'running', outputFile: '/tmp/claude-1000/x/tasks/t1.output', output: 'en cours' });
    expect(readTail).toHaveBeenCalledTimes(1);
  });

  it('une page ne peut pas demander la lecture d’un fichier : aucun canal pour ça', () => {
    const all = [...PANEL_CHANNELS.send, ...PANEL_CHANNELS.invoke];
    expect(all.filter((c) => /output|tail|file/i.test(c))).toEqual(['conv:showFile']); // montré dans le gestionnaire, jamais lu ni ouvert (I-21)
  });
});
