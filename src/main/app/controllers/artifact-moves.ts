/** artifact-moves — le sort des artefacts d'un agent retiré : transférés à son
 *  parent, ou laissés sur le disque (artifacts-left.json) et rendus à l'agent
 *  rouvert sur ce dossier. Tout à la suite, une chaîne de promesses ; ne rejette
 *  jamais ; un échec : showBubble(failedLine), le fichier reste.
 *  Ne connaît pas : la page, les libellés de l'écran, les menus.
 *  Utilisé par : controllers (agents, worktrees). */
import type { AgentConfig } from 'core/agents';

export async function retireArtifacts(_agent: AgentConfig, _parent: AgentConfig | null): Promise<void> {
  throw new Error('not implemented');
}

export async function returnArtifacts(_agent: AgentConfig): Promise<void> {
  throw new Error('not implemented');
}

export async function eraseOutputs(_agentId: string): Promise<void> {
  throw new Error('not implemented');
}
