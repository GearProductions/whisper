/** settings — où vivent les données de l'appli (userData) et les réglages :
 *  config.json relu à chaque usage (une retouche à la main prend effet à
 *  l'usage suivant, sans relancer), la consigne des agents, le journal, le
 *  dossier whisper. Les pages construites (out/renderer) et les ponts.
 *  Ne connaît pas : les fenêtres. Utilisé par : app. */
import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';
import { agentList, withDefaults, type Config } from 'core/config';
import { AUDIO_RULES, type AgentConfig } from 'core/agents';
import { readJson, writeJson } from 'technicals/config-file';
import { binDir } from 'technicals/paths';

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

// Les pages (construites par Vite dans out/renderer) et les ponts (out/main).
export const page = (name: string) => path.join(__dirname, '..', 'renderer', name);
export const preload = (name: 'icon' | 'bubble' | 'panel') => path.join(__dirname, `preload-${name}.js`);
