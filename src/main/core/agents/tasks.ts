/** tasks — les tâches de fond d'un agent (commande en arrière-plan,
 *  surveillance, sous-agent, flux d'agents), tenues à jour d'après ce que le
 *  SDK émet sur le flux du processus : `task_started`, `task_updated`,
 *  `task_progress`, `task_notification` (état final, fichier de sortie,
 *  résumé) ; les `tool_use` de l'agent (la commande, sa description) et les
 *  `tool_result` (« Output is being written to: … », le fichier de sortie
 *  d'une commande en cours). Compte aussi les appels du fil principal (vagues
 *  d'`Agent`, corrections `SendMessage`, relance Opus) : `calls`, résumé par
 *  `runProgress`. Tout vient du processus : jamais d'une page (I-34).
 *  Pur. Ne connaît pas : Electron, la Forme, le total.
 *  Utilisé par : core/agents (runtime), core/conversation (tasks-view),
 *  controllers/runs. */
import type { TaskStatus } from 'shared/bridge';
import type { SdkMessage } from './types';

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
};
// `tools` : les derniers tool_use de l'agent par identifiant (TOOLS_KEPT au
// plus), pour retrouver la commande d'une tâche et son fichier de sortie.
export type ToolUse = { name: string; input: unknown; outputFile: string | null };
// `calls` : les appels du fil principal seulement (ceux des sous-agents ne
// comptent pas) ; `waves` : les identifiants de message des `Agent` (un message
// par bloc, même id : les appels d'une vague partagent le leur).
export type Calls = { waves: string[]; fixes: number; opus: boolean };
export type TaskLog = { tasks: Task[]; tools: Record<string, ToolUse>; calls: Calls };

export const TOOLS_KEPT = 50;
export const EMPTY_LOG: TaskLog = { tasks: [], tools: {}, calls: { waves: [], fixes: 0, opus: false } };

const STATUS: Record<string, TaskStatus> = { completed: 'completed', failed: 'failed', killed: 'stopped', stopped: 'stopped' };
const OUTPUT = /Output is being written to: (\S+?)\.?(?:\s|$)/; // sans le point qui finit la phrase
const blocks = (m: SdkMessage, type: string): SdkMessage[] => (Array.isArray(m.message?.content) ? m.message.content : []).filter((b: SdkMessage) => b && b.type === type);
// Le texte d'un tool_result : son content en texte, ou ses blocs text à la suite.
export const resultText = (c: unknown): string => (typeof c === 'string' ? c : Array.isArray(c) ? c.map((b) => (b && typeof b.text === 'string' ? b.text : '')).join('\n') : '');

// La tâche `id` modifiée par `change` ; la même référence si elle n'existe pas.
function patch(log: TaskLog, id: unknown, change: (t: Task) => Partial<Task>): TaskLog {
  const i = log.tasks.findIndex((t) => t.id === id);
  if (i < 0) return log;
  const t = log.tasks[i];
  const tasks = [...log.tasks];
  tasks[i] = { ...t, ...change(t) };
  return { ...log, tasks };
}

// Un appel du fil principal compté : une vague par message d'`Agent` (sans id de
// message, pas de vague), une correction par `SendMessage`, Opus si demandé.
function countCall(calls: Calls, messageId: unknown, b: SdkMessage): Calls {
  if (b.name === 'SendMessage') return { ...calls, fixes: calls.fixes + 1 };
  if (b.name !== 'Agent') return calls;
  const waves = typeof messageId === 'string' && !calls.waves.includes(messageId) ? [...calls.waves, messageId] : calls.waves;
  return { ...calls, waves, opus: calls.opus || b.input?.model === 'opus' };
}

// Applique un message du flux : la même référence s'il ne concerne aucune tâche.
// Les tâches du système (ambient, skip_transcript) ne sont pas une activité de
// l'agent : ignorées à leur arrivée, leurs événements suivants le sont aussi.
export function applyTaskEvent(log: TaskLog, m: SdkMessage, now: number): TaskLog {
  if (m.type === 'assistant') {
    const uses = blocks(m, 'tool_use');
    if (!uses.length) return log;
    const tools = { ...log.tools };
    let calls = log.calls;
    for (const b of uses) {
      if (!m.parent_tool_use_id && !(b.id in log.tools)) calls = countCall(calls, m.message?.id, b);
      tools[b.id] = { name: b.name, input: b.input, outputFile: null };
    }
    const keys = Object.keys(tools);
    for (const k of keys.slice(0, Math.max(0, keys.length - TOOLS_KEPT))) delete tools[k]; // les plus anciens
    return { ...log, tools, calls };
  }
  if (m.type === 'user') {
    for (const b of blocks(m, 'tool_result')) {
      const file = OUTPUT.exec(resultText(b.content))?.[1];
      if (!file) continue;
      const tool = log.tools[b.tool_use_id];
      if (tool && !tool.outputFile) log = { ...log, tools: { ...log.tools, [b.tool_use_id]: { ...tool, outputFile: file } } };
      const task = log.tasks.find((t) => t.toolUseId === b.tool_use_id);
      if (task && !task.outputFile) log = patch(log, task.id, () => ({ outputFile: file }));
    }
    return log;
  }
  if (m.type !== 'system') return log;
  switch (m.subtype) {
    case 'task_started': {
      if (m.ambient || m.skip_transcript || log.tasks.some((t) => t.id === m.task_id)) return log;
      const tool = m.tool_use_id ? log.tools[m.tool_use_id] : undefined;
      const input = (tool?.input || {}) as Record<string, unknown>;
      // La description que l'agent donne à son outil d'abord : celle du SDK
      // n'est parfois que la commande.
      return { ...log, tasks: [...log.tasks, {
        id: m.task_id, toolUseId: m.tool_use_id ?? null, type: m.task_type || '',
        description: String(input.description || m.description || ''),
        command: tool?.name === 'Bash' && typeof input.command === 'string' ? input.command : null,
        status: 'running', started: now, ended: null, progress: null, summary: null,
        outputFile: tool?.outputFile ?? null,
      }] };
    }
    case 'task_updated': {
      const p = m.patch || {};
      return patch(log, m.task_id, () => {
        const status = p.status ? STATUS[p.status] || 'running' : undefined;
        return {
          ...(status && { status }),
          ...(status && status !== 'running' && { ended: p.end_time ?? now }),
          ...(p.description && { description: p.description }),
          ...(p.error && { summary: p.error }),
        };
      });
    }
    case 'task_progress':
      return patch(log, m.task_id, () => ({ progress: m.summary || m.last_tool_name || null }));
    case 'task_notification':
      return patch(log, m.task_id, (t) => ({
        status: STATUS[m.status] || 'completed', ended: now,
        outputFile: m.output_file || t.outputFile, summary: m.summary || t.summary,
      }));
    default:
      return log;
  }
}

// Les tâches en cours.
export const runningTasks = (log: TaskLog) => log.tasks.filter((t) => t.status === 'running').length;

// L'avancement d'un run : la vague, les sous-agents finis, les corrections, Opus.
export const runProgress = (log: TaskLog) => ({
  wave: log.calls.waves.length,
  done: log.tasks.filter((t) => t.type === 'local_agent' && t.status === 'completed').length,
  fixes: log.calls.fixes,
  opus: log.calls.opus,
});
