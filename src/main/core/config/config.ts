/** config — les réglages (config.json) : défauts, lecture tolérante (une
 *  retouche à la main, d'anciens formats), l'agent affiché (`agentSelected`,
 *  retrouvé au lancement), commandes de l'agent, de l'éditeur et du
 *  terminal, dossiers favoris et leur couleur, confiance (I-23),
 *  lecture à voix haute, VibeCoder (langue, réglages d'un agent, limite
 *  d'affichage d'un artefact en texte, vue des modules : IDE ou liste), la
 *  langue des agents (`agentLang`, le {{lang}} des actions : celle de l'écran,
 *  `vibeLang`, à défaut) et le modèle et l'effort choisis par action
 *  (`actionPicks`, jamais Fable : I-36), le réglage `outsideAgents` (agents
 *  extérieurs au socket, désactivé par défaut).
 *  Ne connaît pas : le fichier (technicals/config-file), Electron, git (le
 *  parent d'un agent, l'enfant qu'on crée : core/family).
 *  Utilisé par : app. */
import type { VibeFlow, VibeLang } from 'shared/bridge';
import type { AgentConfig } from 'core/agents';

export type Folder = { dir: string; color: string | null };
export type Config = {
  lang: string;
  vocabulary: string;
  sound: boolean;
  discordMute: boolean;
  // Agents Claude Code : un par dossier. `agentFolders` : les dossiers déjà
  // choisis ({ dir, color }), proposés par « Nouvel agent… » ; la couleur
  // appartient au DOSSIER, l'agent qu'on y crée la porte. `agentCommand` : la
  // commande qui lance Claude Code ('' : `claude` ; ex. « distrobox enter dev
  // -- mise exec -- claude ») ; `editorCommand` : celle qui ouvre un dossier
  // dans l'éditeur de code ('' : le premier trouvé parmi zed, code, cursor, codium) ;
  // `terminalCommand` : celle qui ouvre un terminal dans le dossier d'un agent,
  // `{dir}` pour le dossier ('' : le premier terminal trouvé du système).
  agentCommand: string;
  editorCommand: string;
  terminalCommand: string;
  agents: AgentConfig[];
  agentFolders: (Folder | string)[];
  agentSelected: string | null;
  muteOthers: boolean;    // couper le son des autres applications pendant la dictée
  outsideAgents: boolean; // « Autoriser les agents extérieurs » : un agent qui n'est pas un robot de l'appli peut parler au socket (jeton dans live.json)
  speakVolume: unknown;
  speakLang: string;      // 'auto' : français ou anglais, détecté sur le texte entier
  speakVoices: Record<string, string>;
  deviceId: string;
  deviceLabel: string;
  vibeLang: VibeLang;     // VibeCoder : la langue de l'écran
  agentLang?: VibeLang;   // ce qu'écrivent les agents ({{lang}} des actions) ; absente : vibeLang
  actionModels: Record<string, string>;  // par id d'action : le modèle choisi, pour tous les agents
  actionEfforts: Record<string, string>; // par id d'action : l'effort choisi
  // VibeCoder : ce qui précède les commandes du projet et gh ('' : la box de
  // agentCommand, `distrobox enter <box> --`, sinon rien ; core/runner).
  vibeCommandPrefix: string;
  vibeSize?: { width: number; height: number };  // la taille de la fenêtre, retenue
  vibeModulesView?: 'ide' | 'list'; // la vue des Modules, retenue d'une ouverture à l'autre (défaut : liste)
  artifactTextMax: number; // octets : un artefact affiché en texte est coupé au-delà (« fichier tronqué »)
  [key: string]: unknown;
};

export const DEFAULTS: Config = {
  lang: 'fr', vocabulary: '', sound: true, discordMute: false,
  agentCommand: '', editorCommand: '', terminalCommand: '', agents: [], agentFolders: [], agentSelected: null,
  muteOthers: false, outsideAgents: false,
  speakVolume: 1,
  speakLang: 'auto',
  speakVoices: { fr: 'estelle', en: 'jane' },
  deviceId: '', deviceLabel: '',
  vibeLang: 'fr', actionModels: {}, actionEfforts: {}, vibeCommandPrefix: '', vibeModulesView: 'list',
  artifactTextMax: 10 * 1024 * 1024,
};

// Langues de la dictée, dans l'ordre du menu.
export const DICTATION_LANGS: Record<string, string> = {
  fr: 'Français', en: 'English', auto: 'Détection auto', es: 'Español', de: 'Deutsch', it: 'Italiano', pt: 'Português', nl: 'Nederlands',
};

// Une limite retouchée à la main qui n'est pas un entier positif prend le défaut.
export function withDefaults(raw: Record<string, unknown>): Config {
  const cfg = { ...DEFAULTS, ...raw } as Config;
  if (!Number.isInteger(cfg.artifactTextMax) || cfg.artifactTextMax <= 0) cfg.artifactTextMax = DEFAULTS.artifactTextMax;
  return cfg;
}

/* ---- Agents et dossiers ------------------------------------------------- */

// Couleur d'un DOSSIER : tirée au sort quand on le choisit pour la première
// fois, modifiable au clic droit sur son agent. Elle aide à s'y retrouver :
// un dossier garde sa couleur, même si son agent est retiré puis recréé.
// [valeur, nom, pastille pour les menus].
export const AGENT_COLORS: [string, string, string][] = [
  ['#8b5cf6', 'Violet', '🟣'], ['#3b82f6', 'Bleu', '🔵'], ['#06b6d4', 'Cyan', '🩵'], ['#22c55e', 'Vert', '🟢'],
  ['#eab308', 'Jaune', '🟡'], ['#f97316', 'Orange', '🟠'], ['#ef4444', 'Rouge', '🔴'], ['#ec4899', 'Rose', '🩷'],
];
export const isColor = (c: unknown) => AGENT_COLORS.some(([v]) => v === c);
export const colorDot = (c: string | null) => (AGENT_COLORS.find(([v]) => v === c) || AGENT_COLORS[0])[2];

// De préférence une couleur qu'aucun dossier ne porte.
export function randomColor(folders: Folder[], random = Math.random) {
  const used = new Set(folders.map((f) => f.color));
  const free = AGENT_COLORS.map(([c]) => c).filter((c) => !used.has(c));
  const pool = free.length ? free : AGENT_COLORS.map(([c]) => c);
  return pool[Math.floor(random() * pool.length)];
}

export const agentList = (cfg: Config): AgentConfig[] => (Array.isArray(cfg.agents) ? cfg.agents.filter((a) => a && a.id && a.dir) : []);

// Dossiers favoris [{ dir, color }] : ceux déjà choisis, qu'ils aient encore un
// agent ou non. Tolère les anciens formats (chemins seuls, couleur sur l'agent).
export function favoriteFolders(cfg: Config): Folder[] {
  const out: Folder[] = [];
  const add = (dir: unknown, color?: unknown) => {
    if (typeof dir !== 'string' || !dir || out.some((f) => f.dir === dir)) return;
    out.push({ dir, color: isColor(color) ? color as string : null });
  };
  for (const f of Array.isArray(cfg.agentFolders) ? cfg.agentFolders : []) {
    if (typeof f === 'string') add(f); else if (f) add(f.dir, f.color);
  }
  for (const a of agentList(cfg)) add(a.dir, (a as { color?: unknown }).color);
  return out;
}

// Une couleur pour chaque dossier qui n'en a pas : elle ne doit pas changer
// d'un lancement à l'autre (`changed` : à enregistrer).
export function folderColors(cfg: Config, random = Math.random) {
  const folders = favoriteFolders(cfg);
  if (folders.every((f) => f.color) && folders.length === (cfg.agentFolders || []).length) return { folders, changed: false };
  for (const f of folders) if (!f.color) f.color = randomColor(folders.filter((o) => o.color), random);
  return { folders, changed: true };
}

// Un agent porte la couleur de son dossier.
export const agentColor = (agent: AgentConfig, cfg: Config) => (
  (favoriteFolders(cfg).find((f) => f.dir === agent.dir) || { color: null }).color || AGENT_COLORS[0][0]);

// Lancé par l'appli, Claude Code ne pose pas sa question « Faire confiance à ce
// dossier ? » : elle est posée par l'appli, une fois, pour un dossier jamais
// choisi. Les réglages d'un projet (.claude/) peuvent lancer des commandes.
export const needsTrust = (cfg: Config, dir: string) => !favoriteFolders(cfg).some((f) => f.dir === dir);

/* ---- VibeCoder ------------------------------------------------------------ */

// config.json se retouche à la main : une valeur inconnue prend le défaut.
export const vibeLang = (cfg: Config): VibeLang => (cfg.vibeLang === 'en' ? 'en' : 'fr');

// Ce qu'écrivent les agents ({{lang}} des actions) : absente ou inconnue, la langue de l'écran.
export const agentLang = (cfg: Config): VibeLang => (cfg.agentLang === 'en' || cfg.agentLang === 'fr' ? cfg.agentLang : vibeLang(cfg));

// Le choix d'une action : une valeur qui n'est pas une chaîne, ou Fable (écrit à la main : I-36), n'est rien.
export function actionPicks(cfg: Config, id: string): { model?: string; effort?: string } {
  const pick = (map: unknown, noFable = false) => {
    const v = map && typeof map === 'object' ? (map as Record<string, unknown>)[id] : undefined;
    return typeof v === 'string' && v && !(noFable && /fable/i.test(v)) ? v : undefined;
  };
  const out: { model?: string; effort?: string } = {};
  const model = pick(cfg.actionModels, true), effort = pick(cfg.actionEfforts);
  if (model) out.model = model;
  if (effort) out.effort = effort;
  return out;
}

export const vibeModulesView = (cfg: Config): 'ide' | 'list' => (cfg.vibeModulesView === 'ide' ? 'ide' : 'list');

// Les réglages VibeCoder d'un agent : le rôle (créateur par défaut, ou relecteur), la PR suivie
// (un entier positif, sinon aucune). Une `autonomy` d'avant la 0.12.0 : ignorée.
export function agentVibe(agent: AgentConfig): { flow: VibeFlow; pr: number | null } {
  const v: Partial<Record<string, unknown>> = agent.vibe && typeof agent.vibe === 'object' ? agent.vibe : {};
  return {
    flow: v.flow === 'review' ? 'review' : 'create',
    pr: Number.isInteger(v.pr) && (v.pr as number) > 0 ? v.pr as number : null,
  };
}

/* ---- Lecture à voix haute ------------------------------------------------- */

// 0 à 1 : au-delà, la voix saturerait.
export function speakVolume(cfg: Config) {
  const v = Number(cfg.speakVolume);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
}
