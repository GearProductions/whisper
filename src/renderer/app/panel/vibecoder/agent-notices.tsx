/** agent-notices — le bandeau des autres agents : une notice par événement (le plus récent en haut), le
 *  texte « ✓ a fini / ? te pose une question / ✗ a échoué », une pastille (étape, état, la question
 *  posée), Basculer vers cet agent et ×. `events` est dans l'ordre d'arrivée ; onDismiss reçoit
 *  l'indice de l'événement dans `events`. Un événement dont l'agent n'existe plus n'est pas montré.
 *  Ne connaît pas : le pont (que des rappels). Utilisé par : panel-app. */
import type { Strings } from 'core/vibecoder';
import type { AgentEvent, AgentView } from 'technicals/bridge';
import './agent-notices.css';

type Props = { events: AgentEvent[]; agents: AgentView[]; t: Strings; onShow(agentId: string): void; onDismiss(index: number): void };

export function AgentNotices({ events, agents, t, onShow, onDismiss }: Props) {
  const notices = events.flatMap((ev, index) => {
    const agent = agents.find((a) => a.id === ev.agentId);
    return agent ? [{ ev, index, agent }] : [];
  }).reverse();
  if (!notices.length) return null;
  return (
    <div className="vc-notices" role="status">
      {notices.map(({ ev, index, agent }) => (
        <div key={index} className="vc-notice" data-kind={ev.kind}>
          <span className="vc-notice-dot" style={{ background: agent.color }} />
          <div className="vc-notice-body">
            <div className="vc-notice-text">
              {ev.kind === 'done' ? t.notifDone(agent.name, ev.step) : ev.kind === 'asking' ? t.notifAsking(agent.name) : t.notifError(agent.name)}
            </div>
            <div className="vc-notice-meta">
              {ev.step && <span className="vc-notice-pill">{t.steps[ev.step]}</span>}
              <span>{t.activity[agent.activity]}</span>
              {ev.detail && <span className="vc-notice-detail">{ev.detail}</span>}
            </div>
          </div>
          <button type="button" className="vc-run" data-tone="accent" onClick={() => onShow(agent.id)}>{t.notifSwitch}</button>
          <button type="button" className="vc-notice-x" aria-label={t.close} title={t.close} onClick={() => onDismiss(index)}>×</button>
        </div>
      ))}
    </div>
  );
}
