/** avatar — la pastille d'un agent (vue C) : ses initiales (initials) sur sa couleur, en rond ; size : 'm'
 *  30 px (un dossier principal), 's' 24 (un worktree, une PR), 'xs' 20 (au bout d'une branche, d'une PR). Avec un title, elle est lue ; sans, elle est décorative.
 *  Ne connaît pas : le pont, le métier. Utilisé par : palette. */
import type { CSSProperties } from 'react';
import { initials } from 'core/switcher';
import type { AgentView } from 'technicals/bridge';
import './avatar.css';

export function Avatar({ agent, size = 'm', title }: { agent: AgentView; size?: 'm' | 's' | 'xs'; title?: string }) {
  return (
    <span className="vc-avatar" data-size={size} title={title} aria-hidden={title ? undefined : true}
      style={{ '--vc-agent': agent.color } as CSSProperties}>{initials(agent.name)}</span>
  );
}
