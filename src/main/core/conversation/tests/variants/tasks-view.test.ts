import { describe, expect, it } from 'vitest';
import type { Task } from 'core/agents';
import { taskViews } from 'core/conversation';

const task = (id: string, extra: Partial<Task> = {}): Task => ({
  id, toolUseId: null, type: 'local_bash', description: id, command: null, status: 'running', started: 0, ended: null,
  progress: null, summary: null, outputFile: null, ...extra,
});

describe('volet « Tâches »', () => {
  const log = { tools: {}, tasks: [
    task('a', { started: 1, command: 'cat /var/home/u/p/src/a.ts', outputFile: '/tmp/a.output' }),
    task('b', { started: 3, type: 'inconnu' }),
  ] };
  const read: string[] = [];
  const views = taskViews(log, '/home/u/p', (f) => { read.push(f); return `fin de ${f}`; });

  it('plus récentes en tête', () => expect(views.map((v) => v.id)).toEqual(['b', 'a']));
  it('type inconnu : « Tâche »', () => expect(views.map((v) => v.kind)).toEqual(['Tâche', 'Commande']));
  it('commande aux chemins raccourcis', () => expect(views.map((v) => v.command)).toEqual([null, 'cat src/a.ts']));
  it('sortie lue pour les seuls fichiers nommés', () => {
    expect(read).toEqual(['/tmp/a.output']);
    expect(views.map((v) => v.output)).toEqual([null, 'fin de /tmp/a.output']);
  });
});
