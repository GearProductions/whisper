/** speech — la lecture à voix haute côté appli : l'installation de Pocket TTS
 *  au premier usage, la lecture du résumé retenu pour la réponse d'agent de ce
 *  rang (au panneau) : le texte ne vient jamais de la page (I-3). L'audio suit
 *  par morceaux (`tts:chunk`), puis `tts:end`.
 *  Ne connaît pas : les agents (seulement le résumé retenu).
 *  Utilisé par : app/ipc, app/menus. */
import { speakVolume, type Config } from 'core/config';
import * as tts from 'technicals/pocket-tts';
import { loadConfig, saveConfig } from 'app/settings';
import { state } from 'app/state';
import { conversationNotice } from 'app/windows';

const speakOptions = (cfg: Config) => ({ lang: cfg.speakLang, voices: cfg.speakVoices });

// Installe Pocket TTS (premier usage) en le signalant (en tête du panneau).
export async function installPocket() {
  conversationNotice('Installation de la lecture à voix haute (~400 Mo à télécharger, une seule fois)… La lecture suivra.', 'status');
  const ok = await tts.install();
  conversationNotice(ok ? 'Lecture à voix haute installée.'
    : 'Installation de la lecture à voix haute impossible (réseau ?) : elle sera retentée au prochain clic.', 'status');
  return ok;
}

const SPEAK_MESSAGES: Record<string, string> = {
  notInstalled: 'Pocket TTS introuvable et impossible à installer (uv absent) : voir le README.',
  empty: 'Rien à lire.',
  failed: 'La synthèse vocale a échoué.',
};

// Écouter la réponse de ce rang dans le fil affiché : le résumé audio retenu
// ici, jamais un texte de la page (I-3). Pocket TTS est installé au besoin ;
// l'audio part par morceaux vers le panneau (`tts:chunk`), puis `tts:end`.
export async function speakReply(index: unknown) {
  const entry = Number.isInteger(index) ? state.convThread[index as number] : undefined;
  const audio = entry && 'audio' in entry ? entry.audio : '';
  if (!audio || !state.panel) return { ok: false, error: SPEAK_MESSAGES.empty };
  const cfg = loadConfig();
  const volume = speakVolume(cfg);
  // Le lecteur du panneau joue à plein gain : le volume réglé s'applique ici, au PCM 16 bits.
  const scaled = (pcm: Buffer) => {
    if (volume === 1) return pcm;
    const out = Buffer.from(pcm);
    for (let i = 0; i + 1 < out.length; i += 2) out.writeInt16LE(Math.round(out.readInt16LE(i) * volume), i);
    return out;
  };
  if (!tts.isInstalled() && tts.canInstall() && !(await installPocket())) {
    return { ok: false, error: SPEAK_MESSAGES.failed };
  }
  try {
    const id: number = tts.speak(audio, speakOptions(cfg),
      (pcm, rate) => state.panel?.webContents.send('tts:chunk', id, scaled(pcm), rate),
      (code) => state.panel?.webContents.send('tts:end', id, code ? SPEAK_MESSAGES[code] || SPEAK_MESSAGES.failed : null));
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: SPEAK_MESSAGES[err instanceof Error ? err.message : ''] || SPEAK_MESSAGES.failed };
  }
}

export const cancelSpeak = (id: unknown) => tts.cancel(id);

// Volume (⚙ Réglages) : retenu, appliqué à la prochaine lecture.
export function setVolume(value: unknown) {
  const v = Number(value);
  if (!Number.isFinite(v)) return;
  saveConfig({ speakVolume: Math.max(0, Math.min(1, v)) });
}
