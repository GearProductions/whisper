/** switcher/entries — la liste du sélecteur d'agents : par dépôt (la famille),
 *  chaque agent avec son titre (dossier principal, worktree, PR), sa branche,
 *  son étape, son état, ses tâches de fond et, s'il en pose une, sa question. Les familles : la tête,
 *  puis ses enfants, de la couleur de la tête.
 *  Ne connaît pas : Electron, le disque, git (l'état, l'étape, la branche et la
 *  question sont donnés).
 *  Utilisé par : app/controllers/agents. */
import type { AgentActivity, AgentStatus, AgentView, RunSignal, VibeStepId } from 'shared/bridge';
import type { AgentConfig } from 'core/agents';
import { agentColor, agentList, type Config } from 'core/config';
import { agentParent, familyGroups } from 'core/family';

export type SwitcherRead = {
  state(id: string): { status: AgentStatus; unread: boolean; signal: RunSignal | null; tasks: number };
  step(id: string): VibeStepId | null;
  branch(dir: string): string | null;
  question(id: string): string | null;
};

// Ce que l'agent fait, la première règle qui s'applique : une question attend,
// il travaille, il est en échec (erreur, course échouée), il vient de finir.
export function activityOf(st: { status: AgentStatus; unread: boolean; signal: RunSignal | null }): AgentActivity {
  if (st.status === 'asking' || st.signal === 'asking') return 'asking';
  if (st.status === 'working' || st.signal === 'working') return 'working';
  if (st.status === 'error' || st.signal === 'failed') return 'failed';
  if (st.unread || st.signal === 'done') return 'done';
  return 'idle';
}

export function switcherAgents(cfg: Config, read: SwitcherRead): AgentView[] {
  const view = (a: AgentConfig, head: AgentConfig, repo: string): AgentView => {
    const pr = head === a ? null : agentParent(a)?.pr ?? null;
    const st = read.state(a.id);
    const activity = activityOf(st);
    return {
      id: a.id, name: a.name, color: agentColor(head, cfg), repo,
      title: head === a ? 'main' : pr ? 'pr' : 'worktree', ...(pr ? { pr } : {}),
      branch: read.branch(a.dir), step: read.step(a.id), activity, ...(st.tasks ? { tasks: st.tasks } : {}),
      detail: activity === 'asking' ? read.question(a.id) : null, parent: head === a ? null : head.id,
    };
  };
  return familyGroups(agentList(cfg)).flatMap((g) => [view(g.agent, g.agent, g.agent.name), ...g.children.map((c) => view(c, g.agent, g.agent.name))]);
}
