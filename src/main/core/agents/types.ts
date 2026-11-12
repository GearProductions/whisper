/** types — un agent tel qu'enregistré, ce que le runtime attend du SDK et du
 *  lancement de Claude Code (injectés : le métier ne les connaît pas), et les
 *  réglages d'un tour (TurnHooks, dont l'environnement du processus : `env`, et
 *  les droits d'une course : `rights`, sa liste et le contrôle de ses fichiers).
 *  Ne connaît pas : le SDK, le lancement (injectés), process.env.
 *  Utilisé par : core/agents, core/config, core/conversation, app. */
import type { VibeFlow } from 'shared/bridge';

// Un agent = un dossier : { id, dir, name, model, effort, mode, sessionId, contextWindow }.
// `vibe` : ses réglages VibeCoder (lus par core/config : agentVibe ; `autonomy`,
// d'avant la 0.12.0, ignorée) ;
// `parent` : un robot enfant, l'agent `id` du même dépôt (sa copie principale),
// durable ; avec `pr` : le robot de cette PR (F-110) ;
// `temp` : l'ancien format de `parent` ({ parent, pr }), lu, plus écrit.
export type AgentConfig = {
  id: string;
  dir: string;
  name: string;
  model: string;
  effort: string;
  mode: string;
  sessionId: string | null;
  contextWindow?: number | null;
  // Plus lu (tout agent est en VibeCoder) ; encore écrit sur l'agent d'une PR
  // parce que l'invariant protégé worktree.test.ts l'attend (core/family).
  view?: 'vibecoder';
  vibe?: { flow: VibeFlow; pr: number | null; autonomy?: 'guide' | 'vibe' };
  parent?: { id: string; pr?: number };
  temp?: { parent: string; pr: number };
};

// Ce que le SDK renvoie et reçoit : des objets non typés ici (le SDK évolue).
export type SdkMessage = Record<string, any>;

export type SdkQuery = AsyncIterable<SdkMessage> & {
  interrupt(): Promise<unknown>;
  setPermissionMode(mode: string): Promise<unknown>;
  setModel(model?: string): Promise<unknown>;
  supportedCommands?(): Promise<unknown>;
  getContextUsage?(o: { detail: string }): Promise<SdkMessage | null>;
  rewindFiles?(userMessageId: string, o?: { dryRun?: boolean }): Promise<SdkMessage>;   // enableFileCheckpointing (rewind)
};

export type Sdk = {
  query(args: { prompt: AsyncIterable<SdkMessage>; options: SdkMessage }): SdkQuery;
  getSessionInfo?(sessionId: string, o: { dir: string }): Promise<SdkMessage | null>;
  listSessions?(o: { dir: string; includeWorktrees: boolean; limit: number }): Promise<SdkMessage[]>;
  getSessionMessages?(sessionId: string, o: { dir: string }): Promise<SdkMessage[]>;
};

// Comment lancer Claude Code (cf. technicals/claude).
export type Launch = { executable: string; spawn?: unknown };

export type JournalFn = (agent: { id: string; name?: string }, event: string, detail?: string) => void;

export type Image = { mediaType: string; data: string };
export type OutgoingMessage = { text?: string; images?: Image[] };

export type TurnHooks = {
  command?: unknown;
  instructions?: string;
  plugins?: string[];   // dossiers de plugins locaux (celui de VibeCoder)
  dirs?: string[];      // dossiers de travail en plus du sien (ses sorties VibeCoder)
  env?: Record<string, string | undefined>;   // l'environnement du processus Claude Code : il REMPLACE celui du processus (le SDK ne fusionne pas), l'appelant y recopie process.env
  onChange(): void;
  onSession(sessionId: string): void;
  onPermission(p: { tool: string; input: unknown }): void;
  autoAllow?(tool: string, input: unknown): boolean;   // un appel accordé sans demande (lu à chaque appel : l'appelant en change la réponse quand son mode change) ; absent : toutes les demandes sont posées
  onProgress?(): void;
  checkpoint?: boolean; // une action qui court à part : ses fichiers suivis, pour l'annuler (rewind)
  rights?: RunRights;   // une course : le mode qui ne demande jamais, sa liste, le contrôle de ses fichiers ; absent : le mode de l'agent
};

// Les droits d'une course : `allow` sa liste (allowedTools), `check` le contrôle de ses
// fichiers et de ceux de ses sous-agents (PreToolUse), qui refuse avec une raison.
export type RunRights = {
  allow: string[];
  check(tool: string, input: unknown): { allow: true } | { allow: false; reason: string };
};
