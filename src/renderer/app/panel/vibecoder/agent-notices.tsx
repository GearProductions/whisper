/** agent-notices — les robots des agents, tout à gauche de l'en-tête de VibeCoder (ceux de l'ancienne icône,
 *  F-55) : tous les agents, dans l'ordre du relevé (la configuration, chaque enfant après son parent) — en
 *  montrer un autre ne les déplace pas. Chacun son robot à sa couleur éclaircie, plus petit pour un worktree
 *  ou une PR ; il clignote au travail, pulse lentement au repos (ou fini) quand des tâches de fond tournent
 *  (data-tasks, l'infobulle les compte, T-13) ; une pastille dit ce qui attend l'utilisateur : « ? » (il
 *  attend une réponse, jusqu'à ce qu'elle parte), un point vert (il a fini, une réponse non lue), « ! » (il
 *  a échoué : « en échec », T-14).
 *  L'agent affiché, à sa place, en pastille allumée : son robot et son nom (le titre d'un worktree ou
 *  d'une PR en étiquette), jamais de pastille d'état (sa réponse est lue d'office) ; clic : onOpen (la
 *  palette, portée Agents). Un autre : clic → onShow (il est affiché). Clic droit sur n'importe lequel :
 *  onMenu (son menu, F-56). Infobulle : l'agent, son titre s'il est un enfant, son état, sa question.
 *  Puis + : Nouvel agent (onAdd).
 *  Ne connaît pas : le pont (que des rappels), le bip (panel-app). Utilisé par : panel-app (dans l'en-tête de vibe-coder). */
import type { CSSProperties } from 'react';
import { agentWhere } from 'core/switcher';
import type { Strings } from 'core/vibecoder';
import type { AgentView } from 'technicals/bridge';
import { Robot } from './icons';
import './agent-notices.css';

type Props = {
  agents: AgentView[]; shown: string | null; t: Strings;
  onShow(agentId: string): void; onOpen(): void; onMenu(agentId: string): void; onAdd(): void;
};

export function AgentNotices({ agents, shown, t, onShow, onOpen, onMenu, onAdd }: Props) {
  // Les tâches de fond ne se voient qu'au repos ou à la fin d'un tour : au travail, le robot clignote déjà.
  const tasksOf = (a: AgentView) => (a.activity === 'idle' || a.activity === 'done' ? a.tasks ?? 0 : 0);
  const tip = (a: AgentView) => [
    `${agentWhere(a)}${a.parent ? ` (${t.agentTitle(a.title, a.pr)})` : ''} — ${t.activity[a.activity]}`,
    tasksOf(a) ? t.tasksWatch(tasksOf(a)) : null, a.detail, a.id === shown ? t.pickerClick : null, t.pickerMenu,
  ].filter(Boolean).join('\n');
  return (
    <div className="vc-agents" role="group" aria-label={t.agentsLabel}>
      {agents.map((a) => {
        const here = a.id === shown;
        return (
          <button key={a.id} type="button" className="vc-agent" data-activity={a.activity} data-child={a.parent ? true : undefined}
            data-tasks={tasksOf(a) || undefined}
            aria-pressed={here} aria-label={tip(a)} title={tip(a)} style={{ '--vc-agent': a.color } as CSSProperties}
            onClick={() => (here ? onOpen() : onShow(a.id))} onContextMenu={(e) => { e.preventDefault(); onMenu(a.id); }}>
            <span className="vc-agent-robot" aria-hidden="true"><Robot />{here ? null : <span className="vc-agent-badge" />}</span>
            {here ? <span className="vc-agent-name">{a.repo}</span> : null}
            {here && a.parent ? <span className="vc-agent-title">{t.agentTitle(a.title, a.pr)}</span> : null}
          </button>
        );
      })}
      <button type="button" className="vc-agent-add" aria-label={t.addAgent} title={t.addAgent} onClick={onAdd}>+</button>
    </div>
  );
}
