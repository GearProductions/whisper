/** config — les réglages (config.json) : défauts, lecture tolérante (une
 *  retouche à la main, d'anciens formats), état au lancement (aucun agent
 *  sélectionné, I-8), dossiers favoris et leur couleur, confiance (I-23),
 *  lecture à voix haute.
 *  Ne connaît pas : le fichier (technicals/config-file), Electron.
 *  Utilisé par : app. */
import type { AgentConfig } from 'core/agents';

export type Folder = { dir: string; color: string | null };
export type Config = {
  lang: string;
  vocabulary: string;
  sound: boolean;
  showText: boolean;
  discordMute: boolean;
  // Agents Claude Code : un par dossier. `agentFolders` : les dossiers déjà
  // choisis ({ dir, color }), proposés par le bouton « + » ; la couleur
  // appartient au DOSSIER, l'agent qu'on y crée la porte. `agentCommand` : la
  // commande qui lance Claude Code ('' : `claude` ; ex. « distrobox enter dev
  // -- mise exec -- claude »).
  agentsEnabled: boolean;
  agentCommand: string;
  agents: AgentConfig[];
  agentFolders: (Folder | string)[];
  agentSelected: string | null;
  agentReview: boolean;   // dictée vers un agent : dans le champ du panneau, à relire ; false : envoyée aussitôt
  onTop: boolean;         // icône, bulles et panneau au-dessus de toutes les fenêtres
  muteOthers: boolean;    // couper le son des autres applications pendant la dictée
  autoPaste: boolean;     // coller là où est le curseur ; sinon le texte reste dans le presse-papiers
  speak: string;
  speakVolume: unknown;
  speakLang: string;      // 'auto' : français ou anglais, détecté sur le texte entier
  speakVoices: Record<string, string>;
  deviceId: string;
  deviceLabel: string;
  size: number;
  pos: { x: number; y: number } | null;
  convSize?: { width: number; height: number };
  [key: string]: unknown;
};

export const DEFAULTS: Config = {
  lang: 'fr', vocabulary: '', sound: true, showText: true, discordMute: false,
  agentsEnabled: false, agentCommand: '', agents: [], agentFolders: [], agentSelected: null,
  agentReview: true,
  onTop: true,
  muteOthers: false,
  autoPaste: true,
  speak: 'selection', speakVolume: 1,
  speakLang: 'auto',
  speakVoices: { fr: 'estelle', en: 'jane' },
  deviceId: '', deviceLabel: '', size: 64, pos: null,
};

// Langues de la dictée, dans l'ordre du menu.
export const DICTATION_LANGS: Record<string, string> = {
  fr: 'Français', en: 'English', auto: 'Détection auto', es: 'Español', de: 'Deutsch', it: 'Italiano', pt: 'Português', nl: 'Nederlands',
};

export const withDefaults = (raw: Record<string, unknown>): Config => ({ ...DEFAULTS, ...raw } as Config);

// Au lancement, la dictée va au curseur : un agent sélectionné la veille ne
// doit pas recevoir (et envoyer à Claude) ce qu'on croit dicter pour soi.
// Le changement à enregistrer, ou null.
export const startupPatch = (cfg: Config): Partial<Config> | null => (cfg.agentSelected ? { agentSelected: null } : null);

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

// Un petit bouton par agent, plus le « + ».
export const agentSlotCount = (cfg: Config) => (cfg.agentsEnabled === true ? agentList(cfg).length + 1 : 0);

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

export function selectedAgent(cfg: Config) {
  if (cfg.agentsEnabled !== true || !cfg.agentSelected) return null;
  return agentList(cfg).find((a) => a.id === cfg.agentSelected) || null;
}

// Lancé par l'appli, Claude Code ne pose pas sa question « Faire confiance à ce
// dossier ? » : elle est posée par l'appli, une fois, pour un dossier jamais
// choisi. Les réglages d'un projet (.claude/) peuvent lancer des commandes.
export const needsTrust = (cfg: Config, dir: string) => !favoriteFolders(cfg).some((f) => f.dir === dir);

/* ---- Lecture à voix haute ------------------------------------------------- */

export type SpeakMode = 'off' | 'selection' | 'clipboard';

// Ce que lit le bouton. La sélection se lit sous Linux et Windows ; ailleurs,
// le presse-papiers.
export function speakMode(cfg: Config, canReadSelection: boolean): SpeakMode {
  if (cfg.speak === 'off') return 'off';
  return cfg.speak === 'clipboard' || !canReadSelection ? 'clipboard' : 'selection';
}

// 0 à 1 : au-delà, la voix saturerait.
export function speakVolume(cfg: Config) {
  const v = Number(cfg.speakVolume);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 1;
}
