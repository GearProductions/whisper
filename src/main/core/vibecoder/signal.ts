/** signal — ce que les courses d'un agent signalent sur son robot (F-55) : la
 *  course qui attend, a échoué ou a fini sans que l'utilisateur l'ait vue
 *  dans cet état (runSignal : asking d'abord, puis failed, puis done ; une
 *  course arrêtée, gardée, annulée ou en cours ne signale rien), et l'état du
 *  robot qui en découle (robotState : la conversation d'abord, le signal
 *  seulement par-dessus un état au repos).
 *  Ne connaît pas : Electron, le runtime (états passés), la page.
 *  Utilisé par : app/controllers (runs, agents). */
import type { AgentStatus, RunSignal } from 'shared/bridge';
import type { RunState } from './runs';

const ORDER: RunSignal[] = ['asking', 'failed', 'done'];

export function runSignal(runs: { state: RunState; noticed: RunState | null }[]): RunSignal | null {
  return ORDER.find((s) => runs.some((r) => r.state === s && r.noticed !== s)) ?? null;
}

export function robotState(conv: { status: AgentStatus; unread: boolean }, signal: RunSignal | null): { status: AgentStatus; unread: boolean } {
  if (conv.status !== 'idle' || !signal) return { status: conv.status, unread: conv.unread };
  if (signal === 'asking') return { status: 'asking', unread: conv.unread };
  if (signal === 'failed') return { status: 'error', unread: conv.unread };
  return { status: 'idle', unread: true };
}
