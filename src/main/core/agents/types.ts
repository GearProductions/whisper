/** types — un agent tel qu'enregistré, ce que le runtime attend du SDK et du
 *  lancement de Claude Code (injectés : le métier ne les connaît pas).
 *  Utilisé par : core/agents, core/config, core/conversation, app. */
import type { VibeAutonomy, VibeFlow } from 'shared/bridge';

// Un agent = un dossier : { id, dir, name, model, effort, mode, sessionId, contextWindow }.
// `view` : VibeCoder à la place de sa conversation (absent : la conversation) ;
// `vibe` : ses réglages VibeCoder (lus par core/config : agentVibe) ;
// `temp` : un robot temporaire, la PR `pr` de l'agent `parent` ouverte dans un
// worktree (lu par core/config : agentTemp).
export type AgentConfig = {
  id: string;
  dir: string;
  name: string;
  model: string;
  effort: string;
  mode: string;
  sessionId: string | null;
  contextWindow?: number | null;
  view?: 'vibecoder';
  vibe?: { flow: VibeFlow; autonomy: VibeAutonomy; pr: number | null };
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
  onChange(): void;
  onSession(sessionId: string): void;
  onPermission(p: { tool: string; input: unknown }): void;
  onProgress?(): void;
};
