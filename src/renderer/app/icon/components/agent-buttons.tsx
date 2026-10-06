/** agent-buttons — un robot par agent : sa couleur, son état (au travail,
 *  autorisation demandée, réponse non lue, erreur), sélectionné ou non.
 *  Ne connaît pas : le pont (onClick est passé). Utilisé par : icon-app. */
import type { CSSProperties } from 'react';
import type { AgentView } from 'technicals/bridge';

const STATUS_TEXT: Partial<Record<AgentView['status'], string>> = {
  working: 'au travail…', asking: 'attend une autorisation', error: 'erreur',
};

export const agentTitle = (a: AgentView) => `${a.name} — ${STATUS_TEXT[a.status]
  || (a.unread ? 'a répondu : cliquer pour lire' : a.selected ? 'sélectionné' : 'cliquer pour lui parler')}`;

export function AgentButtons({ agents, onClick }: { agents: AgentView[]; onClick: (id: string) => void }) {
  return (
    <div id="agents">
      {agents.map((a) => (
        <button key={a.id} className="small agent" type="button" data-id={a.id}
          style={{ '--agent': a.color } as CSSProperties}
          data-status={a.status} data-selected={String(!!a.selected)} data-unread={String(!!a.unread)}
          title={agentTitle(a)} onClick={() => onClick(a.id)}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 3v3" fill="none" />
            <rect x="5" y="6.5" width="14" height="11" rx="3" fill="none" />
            <circle cx="9.5" cy="12" r="1.4" /><circle cx="14.5" cy="12" r="1.4" />
            <path d="M3 11v3M21 11v3M9 20.5h6" fill="none" />
          </svg>
          <span className="badge" />
        </button>
      ))}
    </div>
  );
}
