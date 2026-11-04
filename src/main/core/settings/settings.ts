/** settings — les réglages de la page et ce qu'elle peut écrire : la liste
 *  des réglages par catégorie (SETTINGS), la page (settingsView) et le
 *  contrôle d'une écriture (settingsPatch : une clé que la page montre, une
 *  valeur que la lecture garde telle quelle, sinon rien).
 *  Ne connaît pas : Electron, le disque, whisper, Pocket TTS (faits passés).
 *  Utilisé par : app/controllers (settings). */
import type { Config } from 'core/config';

// Ce que la page montre et qui ne se lit pas dans la configuration : lu par
// app/controllers, passé ici.
export type SettingsFacts = {
  whisperModel: string | null;
  download: number | null;
  soundCuts: boolean;
  recording: boolean;
  tts: 'installed' | 'installable' | 'missing';
  voices: Record<'fr' | 'en', { id: string; label: string }[]>;
  agentFound: boolean;
  editor: string | null;
  version: string;
  // Les actions dont le skill fixe le modèle.
  actions: { id: string; label: string; model: string; models: string[]; efforts: string[] }[];
};

// Une écriture demandée par la page → ce qu'elle change dans la configuration,
// ou null : rien d'écrit.
export function settingsPatch(_key: unknown, _value: unknown, _cfg: Config, _facts: SettingsFacts): Partial<Config> | null {
  throw new Error('not implemented');
}
