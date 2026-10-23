/** bridge — le contrat entre les pages et le principal : ce que chaque pont
 *  (src/preload.js, bubble-preload.js, conversation-preload.js) expose, et la
 *  forme des données échangées. Aucun code.
 *  Ne connaît pas : React, Electron. Utilisé par : les pages (src/renderer), les
 *  ponts (src/preload), le principal (src/main). Un canal ajouté ici l'est
 *  aussi dans le pont, dans la table de gestionnaires de sa fenêtre et dans
 *  tests/invariants/bridges.test.ts. */

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
  tasks: number;        // tâches de fond en cours (commande, surveillance, sous-agent…)
  badge: string | null; // la branche du dossier, ou « PR #n » (robot de PR)
  children: AgentView[]; // les robots enfants (worktrees du dépôt) ; vide pour un enfant
  signal?: RunSignal | null; // le signal de ses courses (F-55) ; absent = null
};
// Ce qu'une course de l'agent signale sur son robot, tant que l'utilisateur ne l'a pas vue.
export type RunSignal = 'asking' | 'done' | 'failed';
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

// Une tâche de fond de l'agent, telle que le volet « Tâches » la montre.
export type TaskStatus = 'running' | 'completed' | 'failed' | 'stopped';
export type TaskView = {
  id: string;
  kind: string;                 // « Commande », « Surveillance », « Sous-agent »…
  description: string;          // ce que l'agent en dit, en langage humain
  command: string | null;       // la commande, chemins raccourcis (null : pas une commande)
  status: TaskStatus;
  started: number;
  ended: number | null;
  progress: string | null;      // une ligne d'avancement (sous-agent, surveillance)
  summary: string | null;       // le résumé de fin, tel que Claude Code le notifie
  outputFile: string | null;    // le fichier où Claude Code écrit sa sortie (montré, jamais ouvert)
  output: string | null;        // ses dernières lignes
};

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
  tasks?: TaskView[];   // conversation en cours : ses tâches de fond, les plus récentes en tête
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
  /** VibeCoder : le relevé de l'agent affiché, ou null s'il est en conversation. */
  onVibe(fn: (view: VibeView | null) => void): void;
  /** Une action (son id dans VibeView.actions) → un message à l'agent affiché. */
  vibeRun(action: string, args: VibeArgs): Promise<SendResult>;
  vibeSet(patch: VibePatch): void;
  /** Valider ('ok'), refuser ('ko') ou oublier (null) : 'note', 'forme', 'case:<chemin du fichier>:<titre du cas>', 'check:<pr>:<rang>'. */
  vibeMark(target: string, verdict: 'ok' | 'ko' | null): void;
  /** Relire : ajouter au brouillon de revue de la PR (le texte du champ), ou en retirer une remarque. */
  vibeDraft(op: { add?: { target: string; text: string }; edit?: { id: number; text: string }; remove?: number }): void;
  /** Un fichier du relevé (son id), dans l'éditeur : jamais un chemin. */
  vibeOpen(id: string, line?: number): void;
  vibeRefresh(): void;
  /** Processus : une commande du fichier du projet par son rang dans VibeView.processes (lancer,
   *  arrêter, relancer, ouvrir son journal) ; ou ouvrir le fichier du projet ('edit') — jamais un texte ni un chemin. */
  vibeProcess(op: VibeProcessOp, index?: number): void;
  /** Une course (l'id de son action dans VibeView.runs) : l'arrêter, la garder ou l'annuler (arrêtée),
   *  répondre à sa demande d'autorisation — jamais un chemin ni un texte. */
  vibeRunOp(id: string, op: VibeRunOp): void;
  /** Voir le code : suivre un fichier du relevé — module (`m<rang>/<i>`), note (`n`), test d'invariant (`t<i>`) —
   *  par son id, en Créer seulement pour la note et les tests ; null : ne plus suivre ;
   *  son texte arrive par onVibeCode, à chaque changement sur le disque. */
  vibeFollow(id: string | null): void;
  onVibeCode(fn: (code: VibeCode | null) => void): void;
  /** Enregistrer le fichier suivi (son id : module, note, test) : le principal refuse un autre id, un fichier sorti du relevé ou grisé. */
  vibeSave(id: string, text: string): Promise<SendResult>;
}

/* ---- VibeCoder (dans le panneau) ------------------------------------------------ */

export type VibeLang = 'fr' | 'en';
export type VibeFlow = 'create' | 'review';      // Créer une feature, Relire une PR
export type VibeAutonomy = 'guide' | 'vibe';
// Créer : note → forme → invariants → modules → revue → pr ; Relire : pr → note → invariants → commits → ecran → revue.
export type VibeStepId = 'note' | 'forme' | 'invariants' | 'modules' | 'revue' | 'pr' | 'commits' | 'ecran';
// open : un clic (ou Ctrl+1…6) l'ouvre — Créer en Guide, faite ou en cours ; Relire, toutes ; Créer en Vibe, aucune.
export type VibeStep = { id: VibeStepId; status: 'done' | 'current' | 'todo'; facts: string; open: boolean };

// Une validation : validé, refusé, validé mais changé depuis, rien.
export type VibeMarkState = 'ok' | 'ko' | 'changed' | null;
export type MustNotMark = 'invariant' | 'variant' | 'review' | 'structure' | null;

// Un fichier du relevé, désigné par son id ; le chemin (relatif au dossier) ne sert qu'à l'affichage.
export type VibeFile = { id: string; path: string };

export type VibeNote = VibeFile & {
  text: string;
  before: string | null;       // la note au début du dernier tour, si elle a changé depuis (surlignage)
  filled: boolean;             // « Ce que ça fait » est rédigée
  mustNot: { text: string; mark: MustNotMark }[];
  mark: VibeMarkState;         // la note
  formeMark: VibeMarkState;    // sa rubrique « Forme »
  nothingMark?: VibeMarkState; // ✓ Rien à écrire (Invariants, Créer) ; absent = null
  locked?: string | null;      // pourquoi elle ne s'édite pas (codeLock) ; absent = null : éditable
};

export type VibeModule = {
  path: string;                // tel que dans la Forme
  contract: string;            // expose · ne connaît pas · utilisé par
  file: VibeFile | null;       // son fichier ou dossier, s'il existe
  touched: boolean;            // la branche le touche
  commits: string[];           // hash des commits qui le touchent
  files?: VibeFile[];          // touché : ses fichiers (ids m<rang>/<i>) ; absent = []
  locked?: string | null;      // pourquoi Voir le code est grisé (codeLock) ; absent = null : éditable
};

// Le texte d'un fichier de module, poussé par le principal (Voir le code) ; null : trop gros ou illisible.
export type VibeCode = { id: string; text: string | null; time: number };

// Un cas d'un test d'invariant, lu en pseudo-code.
export type ReadingCase = {
  title: string;               // tel que dans le test
  pseudo: string;              // proche de Vitest : it, expect, étant donné / quand / alors
  edges: string[];             // ses cas limites
  guarantees: string;          // ce qu'il garantit (ligne de la note, I-…)
  warning: string | null;      // il n'observe pas vraiment la propriété (mock, boucle, valeur…)
};

export type VibeTestFile = VibeFile & {
  blob: string;                          // son empreinte git (nomme sa lecture : <sorties>/invariants/<blob>.md)
  cases: string[];                       // titres des cas trouvés dans le fichier
  lines: number[];                       // la ligne (1…) de chaque cas, dans l'ordre de cases : Ouvrir à la ligne
  source: string;                        // le texte du fichier, pour le montrer à côté de sa lecture ; '' au-delà de 200 Ko
  reading: ReadingCase[] | null;         // null : pas encore lu
  stale?: boolean;                       // sa lecture est celle d'une version précédente ; absent = false
  marks: Record<string, VibeMarkState>;  // par titre de cas
  locked?: string | null;                // pourquoi il ne s'édite pas (codeLock) ; absent = null : éditable
};

export type VibeQuestion = { n: number; text: string; options: string[] };
// done null : à vérifier à la main ; manual : une case du § A.3 que l'on coche à la main (`a3:<rang>`, F-102).
export type VibeCheck = { text: string; done: boolean | null; manual?: boolean };
export type VibeCommit = { hash: string; subject: string; fixup: boolean; files: string[] };
// Ce qu'un skill a écrit pour l'écran (Markdown), et quand.
export type VibeOutput = { text: string; time: number };

export type VibeAction = {
  id: string;
  step: VibeStepId | null;     // null : partout (barre de la conversation)
  label: string;
  hint: string;
  who: string;                 // qui travaille : 'haiku', 'sonnet', 'opus · élevé', 'agent'
  models: string[];            // sous-contexte : les modèles qu'on peut lui choisir ('haiku', 'sonnet', 'opus') ; [] : modèle de l'agent
  model: string | null;        // le modèle conseillé (celui du skill) ; null : modèle de l'agent
  kind: 'send' | 'prefill';    // envoyé aussitôt, ou préparé dans le champ
  needs: 'none' | 'text';      // 'text' : il exige le texte du champ
  usesText: boolean;           // son gabarit prend le texte du champ ({{text}}), s'il y en a
  text?: string;               // 'prefill' : le texte à mettre dans le champ ({{quote}} : ce qu'on cite)
  primary: boolean;            // ce que le guide fait faire ensuite (mis en avant dans l'en-tête de l'étape en cours)
  disabled: string | null;     // pourquoi c'est grisé (le principal la refuse), même masquée
  hidden: boolean;             // pas de sens maintenant : pas affichée (l'état de la PR ne fait que masquer)
  // Faite aussi par l'appli, sans agent (F-114 : commit, publish, load-pr, base) : en cours, et son dernier
  // résultat (✓/✗, une ligne, le détail) ; absent : seulement par l'agent.
  direct?: { running: boolean; last: { ok: boolean; line: string; detail: string; time: number } | null };
};

// Une course : une action d'étape qui court à part de la conversation (onglet Actions). stopped : arrêtée,
// à garder (kept) ou annuler (undone) ; running, asking (une autorisation attend) et stopped retiennent les autres.
export type VibeRun = {
  id: string;                  // l'id de son action
  label: string;
  who: string;                 // qui travaille, comme VibeAction.who
  state: 'running' | 'asking' | 'stopped' | 'done' | 'failed' | 'kept' | 'undone';
  since: number;               // lancée à
  end: number | null;          // finie ou arrêtée à
  reply: string;               // sa réponse (Markdown), '' tant qu'elle n'a rien dit
  permission: { tool: string; target: string } | null;   // sa demande d'autorisation en attente
};
export type VibeRunOp = 'stop' | 'keep' | 'undo' | 'allow' | 'always' | 'deny';

export type VibePr = {
  number: number; title: string; url: string; author: string; base: string; head: string; body: string;
  state: 'OPEN' | 'CLOSED' | 'MERGED' | null;   // null : inconnu (fiche d'avant la 0.8.0-rc.2)
};
export type VibePrItem = { number: number; title: string; author: string; url: string };
export type VibeComment = { id: number; target: string; text: string };
// Une commande du projet (onglet Processus) : telle que dans le fichier du projet, son état, la fin de son journal.
export type VibeProcess = {
  name: string;
  run: string;
  status: 'running' | 'stopped' | 'failed';
  since: number | null;        // lancée à (en cours), finie à ; null : jamais lancée
  exit: number | null;         // le code de sa dernière fin (null : tuée par un signal, ou pas finie)
  log: string;                 // la fin de son journal, sans couleurs
};
export type VibeProcessOp = 'start' | 'stop' | 'restart' | 'log' | 'edit';
export type VibeWorktree = { state: 'creating' | 'open' | 'robot'; temp: boolean; dir: string };

export type VibeView = {
  agentId: string;
  lang: VibeLang;
  flow: VibeFlow;
  autonomy: VibeAutonomy;
  agent: { model: string; effort: string; mode: string };
  repo: { branch: string; base: string; changed: number } | null;
  error: string | null;                  // pourquoi le parcours manque (pas un dépôt, git introuvable…)
  steps: VibeStep[];
  note: VibeNote | null;
  questions: VibeQuestion[];             // les questions ouvertes de l'agent
  modules: VibeModule[];
  invariants: VibeTestFile[];
  variants: (VibeFile & { cases: number })[];
  commits: VibeCommit[];
  outputs: Record<string, VibeOutput>;   // par nom connu (main/core/vibecoder : OUTPUTS)
  checklist: VibeCheck[];                // Créer : la liste du § A.3 ; Relire : le plan de test
  actions: VibeAction[];
  skills: string[];                      // skills du projet et de l'utilisateur
  pr: VibePr | null;                     // Créer : la PR ouverte ; Relire : la PR chargée
  prs: VibePrItem[] | null;              // Relire : les PR à relire
  draft: VibeComment[];                  // Relire : le brouillon de revue de la PR
  // Relire : la PR suivie dans un worktree (F-110) — sur l'agent du dépôt, en
  // création, ouvert sans robot, ou son robot temporaire là ; temp : ce robot-ci.
  worktree?: VibeWorktree | null;
  // Processus : les commandes du fichier du projet (toujours remplis par le relevé) ; projectFile : il existe.
  processes?: VibeProcess[];
  projectFile?: boolean;
  runs?: VibeRun[];                      // les courses, la plus récente d'abord (toujours rempli par le relevé)
  time: number;                          // heure du relevé
};

export type VibeArgs = {
  text?: string;               // le texte du champ (ou celui que la vue donne : la remarque d'Appliquer)
  module?: number;             // rang dans VibeView.modules
  commit?: string;             // hash d'un commit de VibeView.commits
  file?: string;               // {{files}} : l'id d'un test de VibeView.invariants (relu même s'il est lu), ou '*' : tous
  pr?: number;
  answers?: string[];          // réponses aux questions, dans leur ordre
  verdict?: 'approve' | 'comment' | 'request-changes';
  model?: string;              // sous-contexte : un autre modèle que le conseillé, parmi VibeAction.models
  direct?: boolean;            // VibeAction.direct : l'appli la fait elle-même, sans agent (F-114)
};

export type VibePatch = {
  flow?: VibeFlow;
  autonomy?: VibeAutonomy;
  lang?: VibeLang;
  pr?: number | null;          // Relire : la PR suivie
  seen?: boolean;              // « Vu » : la note de référence devient l'actuelle
  view?: 'conversation';       // revenir à la conversation
  model?: string;              // le modèle de l'agent, comme son menu
  effort?: string;
  mode?: string;
  interrupt?: boolean;         // arrêter le tour en cours de l'agent (comme Interrompre de son menu)
  worktree?: true;             // le robot de la PR suivie dans son worktree : l'afficher, ou le proposer (question de confiance)
  prs?: true;                  // Relire : Mes PR à relire (gh, sans agent)
  runsSeen?: boolean;          // true : l'onglet Actions de l'agent affiché est ouvert, ses courses vues ; false : fermé
};
