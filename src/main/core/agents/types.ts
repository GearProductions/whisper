/** types — un agent tel qu'enregistré, ce que le runtime attend du SDK et du
 *  lancement de Claude Code (injectés : le métier ne les connaît pas).
 *  Utilisé par : core/agents, core/config, core/conversation, app. */
import type { VibeFlow } from 'shared/bridge';

// Un agent = un dossier : { id, dir, name, model, effort, mode, sessionId, contextWindow }.
// `view` : VibeCoder à la place de sa conversation (absent : la conversation) ;
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
  onChange(): void;
  onSession(sessionId: string): void;
  onPermission(p: { tool: string; input: unknown }): void;
  onProgress?(): void;
  checkpoint?: boolean; // une action qui court à part : ses fichiers suivis, pour l'annuler (rewind)
};
