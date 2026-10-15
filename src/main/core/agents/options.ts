/** options — ce qu'on donne au SDK : un message, et les options
 *  d'un Claude Code lancé dans le dossier de l'agent (ses réglages, CLAUDE.md,
 *  skills), avec la consigne de l'appli dans le prompt système de NOS sessions
 *  seulement (I-24) ; et ce que l'appli y ajoute (plugins locaux, dossiers de
 *  travail : le plugin de VibeCoder, les sorties de l'agent).
 *  Pur. Utilisé par : core/agents. */
import { MODES } from './constants';
import type { AgentConfig, Launch, OutgoingMessage, SdkMessage, TurnHooks } from './types';

// Ce que l'appli ajoute à Claude Code : des plugins locaux, des dossiers de travail.
type Extras = Pick<TurnHooks, 'plugins' | 'dirs'>;

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
export const launchKey = (agent: AgentConfig, command: unknown, instructions: string, { plugins = [], dirs = [] }: Extras = {}) => (
  JSON.stringify([agent.dir, agent.effort || '', instructions, String(command || ''), plugins, dirs]));

export function queryOptions(agent: AgentConfig, launch: Launch, instructions: string, { plugins = [], dirs = [] }: Extras = {}) {
  return {
    ...(plugins.length ? { plugins: plugins.map((p) => ({ type: 'local' as const, path: p })) } : {}),
    ...(dirs.length ? { additionalDirectories: dirs } : {}),
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
