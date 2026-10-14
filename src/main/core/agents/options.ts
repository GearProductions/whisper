/** options — ce qu'on donne au SDK : un message, et les options
 *  d'un Claude Code lancé dans le dossier de l'agent (ses réglages, CLAUDE.md,
 *  skills), avec la consigne de l'appli dans le prompt système de NOS sessions
 *  seulement (I-24).
 *  Pur. Utilisé par : core/agents. */
import { MODES } from './constants';
import type { AgentConfig, Launch, OutgoingMessage, SdkMessage } from './types';

// Un message pour le SDK : les images ([{ mediaType, data (base64) }]) avant le
// texte. Sans image, le texte seul : c'est sous cette forme que Claude Code
// reconnaît une commande (« /compact », « /context », un skill…). Poussé dans
// l'entrée du processus de l'agent (cf. runtime), ouverte tant qu'il vit.
export function userMessage({ text, images = [] }: OutgoingMessage): SdkMessage {
  const content = !images.length ? text || '' : [
    ...images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mediaType, data: i.data } })),
    ...(text ? [{ type: 'text', text }] : []),
  ];
  return { type: 'user', message: { role: 'user', content }, parent_tool_use_id: null };
}

// Ce qu'un processus vivant ne peut pas changer : il est relancé si ça change
// entre deux tours. Mode et modèle, eux, se changent à chaud (setPermissionMode,
// setModel) ; la session, par close() quand on en reprend une autre.
export const launchKey = (agent: AgentConfig, command: unknown, instructions: string) => (
  JSON.stringify([agent.dir, agent.effort || '', instructions, String(command || '')]));

export function queryOptions(agent: AgentConfig, launch: Launch, instructions: string) {
  return {
    cwd: agent.dir,
    permissionMode: MODES.some(([v]) => v === agent.mode) ? agent.mode : 'default',
    ...(agent.model ? { model: agent.model } : {}),
    ...(agent.effort ? { effort: agent.effort } : {}),
    ...(agent.sessionId ? { resume: agent.sessionId } : {}),
    settingSources: ['user', 'project', 'local'],
    systemPrompt: { type: 'preset', preset: 'claude_code', ...(instructions ? { append: instructions } : {}) },
    pathToClaudeCodeExecutable: launch.executable,
    ...(launch.spawn ? { spawnClaudeCodeProcess: launch.spawn } : {}),
  };
}
