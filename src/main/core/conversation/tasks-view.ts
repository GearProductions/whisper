/** tasks-view — ce que le volet « Tâches » du panneau montre des tâches de
 *  fond d'un agent : les plus récentes en tête, sans les tâches du système
 *  (ambient), le type en français, la commande aux chemins raccourcis, et les
 *  dernières lignes de la sortie — lues par `readTail`, pour les seuls
 *  fichiers que Claude Code a nommés dans le flux (I-34).
 *  Pur. Utilisé par : app/controllers/conversation. */
import type { TaskLog } from 'core/agents';
import type { TaskView } from 'shared/bridge';

export const TASK_KINDS: Record<string, string> = {
  local_bash: 'Commande', local_agent: 'Sous-agent', remote_agent: 'Agent distant', local_workflow: 'Flux d’agents', monitor: 'Surveillance',
};

export function taskViews(_log: TaskLog, _dir: string, _readTail: (file: string) => string | null): TaskView[] {
  return [];
}
