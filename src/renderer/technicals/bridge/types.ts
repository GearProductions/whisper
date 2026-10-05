/** bridge — le contrat entre les pages et le principal : ce que chaque pont
 *  (src/preload.js, bubble-preload.js, conversation-preload.js) expose, et la
 *  forme des données échangées. Aucun code.
 *  Ne connaît pas : React. Utilisé par : les trois pages (app/) et les modules
 *  qu'elles alimentent. Un canal ajouté ici l'est aussi dans le pont et
 *  dans tests/invariants/bridges.test.ts. */

/* ---- Icône (window.api) ---------------------------------------------------- */

export type Bounds = { x: number; y: number; width: number; height: number };

export type DictationConfig = {
  lang: string;
  vocabulary: string;
  sound: boolean;
  deviceId: string;
  deviceLabel: string;
};

export type TranscribeResult = {
  ok: boolean;
  text?: string;
  error?: string;
  code?: string;
  agent?: string;    // envoyé (ou ajouté au champ) de cet agent
  panel?: boolean;   // dans le champ du panneau, à relire
  pasted?: boolean;
  autoPaste?: boolean;
};

export type MicDevice = { deviceId: string; label: string };

export type SpeakMode = 'off' | 'selection' | 'clipboard';
export type SpeakState = { mode: SpeakMode; volume?: number; ready?: boolean; hasText?: boolean };
export type SpeakStart = { ok: true; id: number } | { ok: false; error?: string };

export type AgentStatus = 'idle' | 'working' | 'asking' | 'error';
export type AgentView = {
  id: string;
  name: string;
  color: string;
  selected: boolean;
  status: AgentStatus;
  unread: boolean;
};
export type AgentsState = { enabled: boolean; agents?: AgentView[] };

export interface IconApi {
  getBounds(): Promise<Bounds | null>;
  setPosition(x: number, y: number): void;
  savePosition(x: number, y: number): void;
  getConfig(): Promise<DictationConfig>;
  setDevice(id: string, label: string): void;
  warmUp(): Promise<boolean>;
  setRecording(on: boolean): void;
  transcribe(pcm: ArrayBuffer): Promise<TranscribeResult>;
  openMenu(devices: MicDevice[]): void;
  /** Rien : la sélection (ou le presse-papiers). 'reply' : le résumé retenu par le principal. */
  speak(source?: 'reply'): Promise<SpeakStart>;
  cancelSpeak(id: number): void;
  warmUpSpeak(): void;
  onSpeakState(cb: (state: SpeakState | null) => void): void;
  onSpeakChunk(cb: (id: number, pcm: Uint8Array, rate: number) => void): void;
  onSpeakEnd(cb: (id: number, error: string | null) => void): void;
  onSpeakReply(cb: () => void): void;
  onAgents(cb: (state: AgentsState) => void): void;
  agentClick(id: string): void;
  agentMenu(id: string): void;
  agentAdd(): void;
}

/* ---- Bulle (window.bubble) ---------------------------------------------------- */

export type BubbleKind = 'notice' | 'status' | 'volume';
export type BubbleSize = { width: number; maxHeight: number };

export interface BubbleApi {
  /** `value` : le texte, ou le volume (0 à 1) pour 'volume'. */
  onShow(fn: (value: string | number, kind: BubbleKind, size: BubbleSize) => void): void;
  ready(height: number): void;
  hover(inside: boolean): void;
  close(): void;
  setVolume(value: number): void;
}

/* ---- Panneau (window.conv) ---------------------------------------------------- */

export type ConvMode = 'compact' | 'full';

export type Permission = { key: number; title: string; text: string; always: string[] };

export type Message = {
  role: 'user' | 'assistant' | 'system';
  kind?: 'compact' | 'output' | null;
  text: string;
  context?: string;     // texte sélectionné joint
  files?: string[];
  images?: string[];    // data URL
  time?: number | null;
  tools?: string[];
  audio?: boolean;
};

export type ContextUse = { used: number | null; max: number };

export type Thread = {
  dictation?: boolean;  // contexte « Dictée »
  mode: ConvMode;
  key: string;          // la conversation : un brouillon par clé
  live: boolean;        // session en cours (false : ancienne, ou la dictée)
  name: string;
  color: string;
  dir?: string;
  title: string;
  status: AgentStatus;
  since?: number | null;
  context?: ContextUse;
  permission?: Permission | null;
  messages: Message[];
};

export type Notice = { kind: BubbleKind; text: string };

export type Session = { sessionId: string; title?: string; lastModified: number; current: boolean };

export type Command = { name: string; description: string; argumentHint?: string };

export type ContextDetail = {
  total: number;
  max: number;
  percentage: number;
  model: string;
  categories: { name: string; tokens: number; kind: string; color?: string }[];
  memoryFiles: { path: string; tokens: number }[];
};

export type ProbeResult = { context?: ContextDetail | null; commands?: Command[]; error?: string };

export type DraftImage = { name: string; type: string; data: ArrayBuffer };
export type OutgoingDraft = { text: string; images: DraftImage[]; files: string[]; selection: string };
export type SendResult = { ok: boolean; error?: string };

export type Attached = { files?: string[]; selection?: { text: string; cut: boolean } };

export type Decision = 'allow' | 'always' | 'deny';

export interface ConvApi {
  onThread(fn: (data: Thread) => void): void;
  ready(): void;
  speak(index: number): void;
  history(): Promise<Session[]>;
  probe(): Promise<ProbeResult>;
  open(sessionId: string): void;
  resume(): void;
  current(): void;
  setMode(mode: ConvMode): void;
  height(h: number): void;
  onNotice(fn: (notice: Notice | null) => void): void;
  /** Copie le dernier texte dicté, connu du principal (aucun texte ne part d'ici). */
  copy(): Promise<boolean>;
  send(draft: OutgoingDraft): Promise<SendResult>;
  attach(): void;
  onAttached(fn: (what: Attached) => void): void;
  onDictation(fn: (text: string) => void): void;
  onFocusInput(fn: () => void): void;
  hide(): void;
  pathFor(file: File): string;
  answer(decision: Decision, key: number): void;
  openLink(url: string): void;
  showFile(file: string): void;
}

declare global {
  interface Window {
    api: IconApi;
    bubble: BubbleApi;
    conv: ConvApi;
  }
}
