/** signal — ce que les courses d'un agent signalent sur son robot (F-55) :
 *  runSignal, dans cet ordre : asking tant qu'une course attend sa réponse,
 *  vue ou pas ; failed puis done tant que l'utilisateur ne les a pas vues dans
 *  cet état ; working quand une course travaille (ce qui attend l'utilisateur
 *  prime sur ce qui travaille seul) ; une course arrêtée, gardée ou annulée ne
 *  signale rien. robotState : l'état du robot qui en découle, la conversation
 *  d'abord, le signal seulement par-dessus un état au repos (working → le
 *  clignotement d'un tour).
 *  Ne connaît pas : Electron, le runtime (états passés), la page.
 *  Utilisé par : app/controllers (runs, agents). */
import type { AgentStatus, RunSignal } from 'shared/bridge';
import type { RunState } from './runs';

export function runSignal(runs: { state: RunState; noticed: RunState | null }[]): RunSignal | null {
  if (runs.some((r) => r.state === 'asking')) return 'asking';
  const unseen = (s: RunState) => runs.some((r) => r.state === s && r.noticed !== s);
  if (unseen('failed')) return 'failed';
  if (unseen('done')) return 'done';
  return runs.some((r) => r.state === 'running') ? 'working' : null;
}

export function robotState(conv: { status: AgentStatus; unread: boolean }, signal: RunSignal | null): { status: AgentStatus; unread: boolean } {
  if (conv.status !== 'idle' || !signal) return { status: conv.status, unread: conv.unread };
  if (signal === 'asking' || signal === 'working') return { status: signal, unread: conv.unread };
  if (signal === 'failed') return { status: 'error', unread: conv.unread };
  return { status: 'idle', unread: true };
}
