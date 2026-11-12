/** options — ce qu'on donne au SDK : un message, et les options
 *  d'un Claude Code lancé dans le dossier de l'agent (ses réglages, CLAUDE.md,
 *  skills), avec la consigne de l'appli dans le prompt système de NOS sessions
 *  seulement (I-24) ; et ce que l'appli y ajoute (plugins locaux, dossiers de
 *  travail : le plugin de VibeCoder, les sorties de l'agent ; le suivi des
 *  fichiers écrits, pour une action qui court à part : checkpoint ; l'environnement
 *  du processus : env, donné par l'appelant, absent : le processus hérite du
 *  sien ; les droits d'une course : rights, rendus au SDK par rightsOptions —
 *  le mode qui ne demande jamais, dontAsk, quel que soit celui de l'agent, sa
 *  liste en allowedTools, son contrôle en crochet PreToolUse qui refuse avec sa
 *  raison). launchKey retient la présence d'un env, jamais ses valeurs (secrets),
 *  et la liste d'une course.
 *  Pur. Ne connaît pas : process.env (l'appelant le fournit), ce que contient la
 *  liste ni ce que juge le contrôle (core/vibecoder).
 *  Utilisé par : core/agents. */
import { MODES } from './constants';
import type { AgentConfig, Launch, OutgoingMessage, RunRights, SdkMessage, TurnHooks } from './types';

// Ce que l'appli ajoute à Claude Code : des plugins locaux, des dossiers de
// travail, le suivi des fichiers écrits (checkpoint : rewindFiles possible),
// l'environnement du processus (env), les droits d'une course (rights).
type Extras = Pick<TurnHooks, 'plugins' | 'dirs' | 'checkpoint' | 'env' | 'rights'>;

// Les options du SDK pour les droits d'une course : permissionMode 'dontAsk', allowedTools
// (rights.allow), hooks.PreToolUse : un crochet sans filtre qui rend, pour un refus de
// rights.check, { hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision:
// 'deny', permissionDecisionReason } }, et {} sinon (le mode et la liste jugent ensuite).
// Un contrôle qui plante refuse (jamais un passage).
export function rightsOptions(rights: RunRights) {
  const deny = (reason: string) => ({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } });
  const hook = async (input: SdkMessage, _toolUseId?: string, _o?: { signal: AbortSignal }) => {
    try {
      const v = rights.check(input.tool_name, input.tool_input);
      return v.allow ? {} : deny(v.reason);
    } catch (e) {
      return deny(`contrôle des fichiers en échec : ${e instanceof Error ? e.message : String(e)}`);
    }
  };
  const group: { matcher?: string; hooks: (typeof hook)[] } = { hooks: [hook] };   // sans filtre : tout outil
  return { permissionMode: 'dontAsk' as const, allowedTools: rights.allow, hooks: { PreToolUse: [group] } };
}

// Un message pour le SDK : les images ([{ mediaType, data (base64) }]) avant le
// texte. Sans image, le texte seul : c'est sous cette forme que Claude Code
// reconnaît une commande (« /compact », « /context », un skill…). Poussé dans
// l'entrée du processus de l'agent (cf. runtime), ouverte tant qu'il vit.
// `uuid` : son identifiant, celui auquel rewindFiles ramène les fichiers.
export function userMessage({ text, images = [] }: OutgoingMessage, uuid?: string): SdkMessage {
  const content = !images.length ? text || '' : [
    ...images.map((i) => ({ type: 'image', source: { type: 'base64', media_type: i.mediaType, data: i.data } })),
    ...(text ? [{ type: 'text', text }] : []),
  ];
  return { type: 'user', message: { role: 'user', content }, parent_tool_use_id: null, ...(uuid ? { uuid } : {}) };
}

// Ce qu'un processus vivant ne peut pas changer : il est relancé si ça change
// entre deux tours. Mode et modèle, eux, se changent à chaud (setPermissionMode,
// setModel) ; la session, par close() quand on en reprend une autre.
export const launchKey = (agent: AgentConfig, command: unknown, instructions: string, { plugins = [], dirs = [], checkpoint = false, env, rights }: Extras = {}) => (
  JSON.stringify([agent.dir, agent.effort || '', instructions, String(command || ''), plugins, dirs, checkpoint, !!env, rights?.allow ?? null]));

export function queryOptions(agent: AgentConfig, launch: Launch, instructions: string, { plugins = [], dirs = [], checkpoint = false, env, rights }: Extras = {}) {
  return {
    ...(env ? { env } : {}),
    ...(checkpoint ? { enableFileCheckpointing: true } : {}),
    ...(plugins.length ? { plugins: plugins.map((p) => ({ type: 'local' as const, path: p })) } : {}),
    ...(dirs.length ? { additionalDirectories: dirs } : {}),
    cwd: agent.dir,
    permissionMode: MODES.some(([v]) => v === agent.mode) ? agent.mode : 'default',
    ...(rights ? rightsOptions(rights) : {}),   // par-dessus le mode de l'agent
    ...(agent.model ? { model: agent.model } : {}),
    ...(agent.effort ? { effort: agent.effort } : {}),
    ...(agent.sessionId ? { resume: agent.sessionId } : {}),
    settingSources: ['user', 'project', 'local'],
    systemPrompt: { type: 'preset', preset: 'claude_code', ...(instructions ? { append: instructions } : {}) },
    pathToClaudeCodeExecutable: launch.executable,
    ...(launch.spawn ? { spawnClaudeCodeProcess: launch.spawn } : {}),
  };
}
