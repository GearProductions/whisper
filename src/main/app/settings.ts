/** settings — où vivent les données de l'appli (userData) et les réglages :
 *  config.json relu à chaque usage (une retouche à la main prend effet à
 *  l'usage suivant, sans relancer), la consigne des agents, le journal, le
 *  dossier whisper, les fichiers de VibeCoder (actions, skills, sorties des
 *  agents, validations). Les pages construites (out/renderer) et les ponts.
 *  Ne connaît pas : les fenêtres. Utilisé par : app. */
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import type { VibeLang } from 'shared/bridge';
import { agentList, withDefaults, type Config } from 'core/config';
import { AUDIO_RULES, type AgentConfig } from 'core/agents';
import { parseActions, skillVariants, syncDefaults, type ActionDef, type Drafts, type Marks } from 'core/vibecoder';
import { readJson, writeJson } from 'technicals/config-file';
import { binDir, resourcePath } from 'technicals/paths';

export const configFile = () => path.join(app.getPath('userData'), 'config.json');
export const loadConfig = (): Config => withDefaults(readJson(configFile()));
export function saveConfig(patch: Partial<Config>) {
  const cfg = { ...loadConfig(), ...patch };
  writeJson(configFile(), cfg);
  return cfg;
}

export function updateAgent(id: string, patch: Partial<AgentConfig>) {
  saveConfig({ agents: agentList(loadConfig()).map((a) => (a.id === id ? { ...a, ...patch } : a)) });
}

// Le nôtre d'abord ; puis le binaire du paquet ; puis l'installation de
// Cockpit, pour réutiliser son modèle.
export const ownWhisperDir = () => path.join(app.getPath('userData'), 'whisper');
export const whisperDirs = () => [ownWhisperDir(), binDir(), path.join(app.getPath('appData'), 'cockpit', 'whisper')];

// La consigne ajoutée au prompt système des agents (le résumé <audio>…</audio>) :
// un fichier à retoucher dans son éditeur, relu à chaque message. Absent, il est
// recréé avec la consigne par défaut ; vide, aucune consigne (plus de résumé :
// ▶ lit alors la réponse entière, sans formatage).
export const instructionsFile = () => path.join(app.getPath('userData'), 'consigne-agents.md');
export function agentInstructions() {
  const file = instructionsFile();
  try { return fs.readFileSync(file, 'utf8').trim(); } catch { /* pas encore créé */ }
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${AUDIO_RULES}\n`);
  return AUDIO_RULES;
}

// Journal des agents : pour comprendre après coup un agent resté bloqué ou une
// action qui n'a pas pu être autorisée.
export const journalFile = () => path.join(app.getPath('userData'), 'agents.log');

/* ---- VibeCoder ------------------------------------------------------------ */

// Ce qu'il fait dire, à retoucher (actions.<langue>.json, plugin/skills/…,
// README.md) ; le plugin que Claude Code reçoit.
export const vibeDir = () => path.join(app.getPath('userData'), 'vibecoder');
export const vibePluginDir = () => path.join(vibeDir(), 'plugin');

// Le dossier de sorties d'un agent (ce que ses skills écrivent pour l'écran),
// créé au besoin : Claude Code le reçoit en dossier de travail. Un échec ne
// bloque pas l'agent (I-29).
export function vibeOutDir(agentId: string) {
  const dir = path.join(app.getPath('userData'), 'vibecoder-out', agentId);
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* l'agent part sans */ }
  return dir;
}

// null si le fichier manque ; illisible (EACCES…) : l'erreur, que syncDefaults ne prend pas pour une absence.
const read = (file: string) => {
  try { return fs.readFileSync(file, 'utf8'); } catch (err) { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null; throw err; }
};

// Les fichiers livrés (resources/vibecoder) écrits dans vibeDir sans jamais
// écraser une retouche (core/vibecoder : syncDefaults), puis les variantes des
// skills (skillVariants). Au démarrage et avant
// d'ouvrir le dossier ; un échec ne bloque rien (I-29).
export function ensureVibeFiles() {
  try {
    const root = resourcePath('vibecoder');
    const files = (fs.readdirSync(root, { recursive: true }) as string[])
      .filter((rel) => fs.statSync(path.join(root, rel)).isFile())
      .map((rel) => ({ path: rel.split(path.sep).join('/'), content: fs.readFileSync(path.join(root, rel), 'utf8') }));
    const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
    syncDefaults(vibeDir(), files, { read, write });
    // Les variantes des skills qui fixent leur modèle (un autre, choisi à
    // l'écran) : générées d'après les skills de l'utilisateur, hors manifeste,
    // réécrites à chaque fois.
    const skills = path.join(vibePluginDir(), 'skills');
    for (const name of fs.readdirSync(skills)) {
      let md: string | null = null;
      try { md = fs.readFileSync(path.join(skills, name, 'SKILL.md'), 'utf8'); } catch { /* pas un skill */ }
      for (const v of md ? skillVariants(name, md) : []) write(path.join(vibeDir(), v.path), v.content);
    }
  } catch (err) {
    console.error(`VibeCoder : fichiers par défaut non écrits (${err instanceof Error ? err.message : err})`);
  }
}

// Les boutons : actions.<langue>.json de l'utilisateur ; illisible (ou pas un
// tableau JSON), celui livré. Un tableau vide : aucun bouton.
export function vibeActions(lang: VibeLang): ActionDef[] {
  const parse = (dir: string) => {
    try {
      const list: unknown = JSON.parse(read(path.join(dir, `actions.${lang}.json`)) ?? '');
      return Array.isArray(list) ? parseActions(list) : null;
    } catch { return null; }
  };
  return parse(vibeDir()) || parse(resourcePath('vibecoder')) || [];
}

// Validations et brouillons de revue, par agent (vibecoder-state.json).
export type VibeStore = { marks: Record<string, Marks>; drafts: Record<string, Drafts> };
const vibeStoreFile = () => path.join(app.getPath('userData'), 'vibecoder-state.json');
const record = (v: unknown) => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
export function vibeStore(): VibeStore {
  const s = readJson(vibeStoreFile());
  return { marks: record(s.marks), drafts: record(s.drafts) } as VibeStore;
}
export const saveVibeStore = (s: VibeStore) => writeJson(vibeStoreFile(), s);

// Les pages (construites par Vite dans out/renderer) et les ponts (out/main).
export const page = (name: string) => path.join(__dirname, '..', 'renderer', name);
export const preload = (name: 'icon' | 'bubble' | 'panel') => path.join(__dirname, `preload-${name}.js`);
