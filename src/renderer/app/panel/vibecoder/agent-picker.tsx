/** agent-picker — le sélecteur d'agent de l'en-tête de VibeCoder : la pastille (initiales,
 *  couleur de l'agent), le dépôt, le titre (dossier principal, worktree, PR #n) et la branche.
 *  Clic : onOpen (le parent ouvre la palette, portée Agents) ; clic droit : onMenu (le menu de
 *  l'agent). Les libellés viennent de `t`, passé par le parent.
 *  Ne connaît pas : le pont (rappels), la palette.
 *  Utilisé par : vibe-coder. */
import type { CSSProperties } from 'react';
import { initials } from 'core/switcher';
import type { AgentView } from 'technicals/bridge';
import type { Strings } from 'core/vibecoder';
import './agent-picker.css';

type Props = { agent: AgentView; t: Strings; onOpen(): void; onMenu(): void };

export function AgentPicker({ agent, t, onOpen, onMenu }: Props) {
  return (
    <button type="button" className="vc-picker" title={`${t.pickerClick}\n${t.pickerMenu}`} aria-label={t.pickerClick}
      aria-haspopup="dialog" data-activity={agent.activity} style={{ '--vc-agent': agent.color } as CSSProperties}
      onClick={onOpen} onContextMenu={(e) => { e.preventDefault(); onMenu(); }}>
      <span className="vc-picker-dot" aria-hidden="true">{initials(agent.name)}</span>
      <span className="vc-picker-repo">{agent.repo}</span>
      <span className="vc-picker-title">{t.agentTitle(agent.title, agent.pr)}</span>
      {agent.branch ? <span className="vc-picker-branch">{`⎇ ${agent.branch}`}</span> : null}
    </button>
  );
}
