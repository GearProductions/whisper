/** switcher/events — ce qui vaut une notification du système quand la liste du
 *  sélecteur change : un autre agent que l'affiché vient de poser une question
 *  ou d'échouer (une fin se voit sur la liste, pas besoin du système).
 *  Ne connaît pas : Electron, la fenêtre.
 *  Utilisé par : app/controllers/agents. */
import type { AgentEvent, AgentView } from 'shared/bridge';

const KIND = { asking: 'asking', paused: 'error' } as const;

export function agentEvents(before: AgentView[], after: AgentView[], shown: string | null): AgentEvent[] {
  const events: AgentEvent[] = [];
  for (const a of after) {
    if (a.id === shown) continue;
    const was = before.find((b) => b.id === a.id)?.activity ?? 'idle';
    if (a.activity === was || !(a.activity in KIND)) continue;
    events.push({ agentId: a.id, kind: KIND[a.activity as keyof typeof KIND], detail: a.detail });
  }
  return events;
}
