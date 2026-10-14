/** tasks — les tâches de fond d'un agent (commande en arrière-plan,
 *  surveillance, sous-agent, flux d'agents), tenues à jour d'après ce que le
 *  SDK émet sur le flux du processus : `task_started`, `task_updated`,
 *  `task_progress`, `task_notification` (état final, fichier de sortie,
 *  résumé) ; les `tool_use` de l'agent (la commande, sa description) et les
 *  `tool_result` (« Output is being written to: … », le fichier de sortie
 *  d'une commande en cours). Tout vient du processus : jamais d'une page (I-34).
 *  Pur. Utilisé par : core/agents (runtime), core/conversation (tasks-view). */
import type { TaskStatus } from 'shared/bridge';
import type { SdkMessage } from './types';

export type { TaskStatus };
export type Task = {
  id: string;
  toolUseId: string | null;
  type: string;                 // task_type du SDK : local_bash, local_agent, monitor…
  description: string;
  command: string | null;       // Bash : la commande du tool_use
  status: TaskStatus;
  started: number;
  ended: number | null;
  progress: string | null;
  summary: string | null;
  outputFile: string | null;
  ambient: boolean;             // tâche de fond du système (skip_transcript, ambient) : pas une activité de l'agent
};
// `tools` : les derniers tool_use de l'agent par identifiant (TOOLS_KEPT au
// plus), pour retrouver la commande d'une tâche et son fichier de sortie.
export type ToolUse = { name: string; input: unknown; outputFile: string | null };
export type TaskLog = { tasks: Task[]; tools: Record<string, ToolUse> };

export const TOOLS_KEPT = 50;
export const EMPTY_LOG: TaskLog = { tasks: [], tools: {} };

// Applique un message du flux : la même référence si rien ne change.
export function applyTaskEvent(log: TaskLog, _m: SdkMessage, _now: number): TaskLog {
  return log;
}

// Les tâches en cours qui sont une activité de l'agent (ambient exclues).
export const runningTasks = (log: TaskLog) => log.tasks.filter((t) => t.status === 'running' && !t.ambient).length;
