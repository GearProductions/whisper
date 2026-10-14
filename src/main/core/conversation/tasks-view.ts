/** tasks-view — ce que le volet « Tâches » du panneau montre des tâches de
 *  fond d'un agent : les plus récentes en tête, le type en français, la commande aux chemins raccourcis, et les
 *  dernières lignes de la sortie — lues par `readTail`, pour les seuls
 *  fichiers que Claude Code a nommés dans le flux (I-34).
 *  Pur. Utilisé par : app/controllers/conversation. */
import type { TaskLog } from 'core/agents';
import type { TaskView } from 'shared/bridge';
import { relativeTo } from './tool-text';

export const TASK_KINDS: Record<string, string> = {
  local_bash: 'Commande', local_agent: 'Sous-agent', remote_agent: 'Agent distant', local_workflow: 'Flux d’agents', monitor: 'Surveillance',
};

// Champ par champ : rien d'autre de la tâche ne part vers la page.
export function taskViews(log: TaskLog, dir: string, readTail: (file: string) => string | null): TaskView[] {
  return [...log.tasks].sort((a, b) => b.started - a.started).map((t) => ({
    id: t.id, kind: TASK_KINDS[t.type] || 'Tâche', description: t.description, command: t.command && relativeTo(dir, t.command),
    status: t.status, started: t.started, ended: t.ended, progress: t.progress, summary: t.summary, outputFile: t.outputFile,
    output: t.outputFile ? readTail(t.outputFile) : null,
  }));
}
