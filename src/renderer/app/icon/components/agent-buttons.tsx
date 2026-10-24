/** agent-buttons — un groupe (famille) par robot : le robot, puis sous lui ses
 *  enfants (worktrees du dépôt : même bouton et même taille, classe child,
 *  leur pastille tag = la branche ou « PR #n »). Chaque robot : sa
 *  couleur, son état (au travail, autorisation demandée, réponse non lue,
 *  erreur, tâches de fond au repos), sélectionné ou non ; son title porte la
 *  pastille, et le signal de ses courses (F-55 : une question, une fin, une
 *  course qui travaille) quand l'état fusionné vient de lui (data-status et data-unread : l'état fusionné, tel que reçu).
 *  Ne connaît pas : le pont (onClick est passé), git (badge vient du
 *  principal). Utilisé par : icon-app. */
import type { CSSProperties } from 'react';
import type { AgentView, RunSignal } from 'technicals/bridge';

const STATUS_TEXT: Partial<Record<AgentView['status'], string>> = {
  working: 'au travail…', asking: 'attend une autorisation', error: 'erreur',
};

const SIGNAL_TEXT: Record<RunSignal, string> = {
  asking: 'une action attend une autorisation', done: 'une action est finie', failed: 'une action a échoué',
  working: 'une action travaille',
};

// Le signal explique l'état fusionné (robotState du principal) : la conversation ne dit rien.
// ponytail: ambigu si la conversation dit la même chose (« ? » des deux côtés) — le signal l'emporte ;
// un état de conversation séparé dans AgentView si ça gêne.
const SIGNAL_STATUS = { asking: 'asking', failed: 'error', done: 'idle', working: 'working' } as const;

export const agentTitle = (a: AgentView) => `${a.name}${a.badge ? ` (${a.badge})` : ''} — ${
  (a.signal && SIGNAL_STATUS[a.signal] === a.status && SIGNAL_TEXT[a.signal]) || STATUS_TEXT[a.status]
  || (a.status === 'idle' && a.tasks ? `surveille ${a.tasks} tâche${a.tasks > 1 ? 's' : ''} de fond` : '')
  || (a.unread ? 'a répondu : cliquer pour lire' : a.selected ? 'sélectionné' : 'cliquer pour lui parler')}`;

export function AgentButtons({ agents, onClick }: { agents: AgentView[]; onClick: (id: string) => void }) {
  const robot = (a: AgentView, child = false) => (
    <button key={a.id} className={child ? 'small agent child' : 'small agent'} type="button" data-id={a.id}
      style={{ '--agent': a.color } as CSSProperties}
      data-status={a.status} data-selected={String(!!a.selected)} data-unread={String(!!a.unread)} data-tasks={a.tasks || 0}
      title={agentTitle(a)} onClick={() => onClick(a.id)}>
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 3v3" fill="none" />
        <rect x="5" y="6.5" width="14" height="11" rx="3" fill="none" />
        <circle cx="9.5" cy="12" r="1.4" /><circle cx="14.5" cy="12" r="1.4" />
        <path d="M3 11v3M21 11v3M9 20.5h6" fill="none" />
      </svg>
      <span className="badge" />
      {child && a.badge && <span className="tag">{a.badge}</span>}
    </button>
  );
  return (
    <div id="agents">
      {agents.map((a) => (
        <div key={a.id} className="family">
          {robot(a)}
          {a.children.map((c) => robot(c, true))}
        </div>
      ))}
    </div>
  );
}
