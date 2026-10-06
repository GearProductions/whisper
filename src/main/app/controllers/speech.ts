/** speech — la lecture à voix haute côté appli : l'état du bouton (relevé
 *  régulièrement), l'installation de Pocket TTS au premier usage, la lecture.
 *  Comme pour le collage, le texte ne vient jamais de la page : on relit la
 *  sélection (ou le presse-papiers) au moment du clic, ou le résumé retenu
 *  pour une réponse d'agent (I-3). L'audio suit par morceaux (`tts:chunk`),
 *  puis `tts:end`.
 *  Ne connaît pas : les agents (seulement le résumé retenu).
 *  Utilisé par : app/ipc, app/lifecycle, app/menus. */
import { speakMode, speakVolume, type Config } from 'core/config';
import * as tts from 'technicals/pocket-tts';
import { hasText, peekText, readText } from 'technicals/selection';
import { loadConfig, saveConfig } from 'app/settings';
import { state } from 'app/state';
import { applyWidth, canReadSelection, sendToIcon, showBubble } from 'app/windows';

// Aucun évènement ne signale un changement de sélection ou de presse-papiers :
// on les relit régulièrement, et la page n'est prévenue que d'un changement
// (bouton actif, grisé, masqué).
export const SPEAK_POLL_MS = 500;

export const currentSpeakMode = (cfg: Config = loadConfig()) => speakMode(cfg, canReadSelection);

export async function pollSpeak() {
  if (!state.icon || state.speakPolling) return;
  state.speakPolling = true;
  try { await updateSpeakState(); } finally { state.speakPolling = false; }
}

// La page vient d'être (re)chargée : elle n'a pas encore l'état du bouton.
export function resetSpeakState() { state.speakKey = ''; pollSpeak(); }

async function updateSpeakState() {
  const cfg = loadConfig();
  const mode = currentSpeakMode(cfg);
  // Réglage changé (menu ou config.json retouché) : bouton montré ou masqué.
  if ((mode !== 'off') !== state.speakShown) {
    state.speakShown = mode !== 'off';
    applyWidth();
  }
  let s: Record<string, unknown> = { mode };
  if (mode !== 'off') {
    // Pocket TTS absent : prêt s'il peut s'installer au premier clic.
    const ready = tts.isInstalled() || tts.canInstall();
    s = { mode, volume: speakVolume(cfg), ready, hasText: await hasText(mode) };
  }
  const key = JSON.stringify(s);
  if (key === state.speakKey || !state.icon) return;
  state.speakKey = key;
  sendToIcon('tts:state', s);
}

const speakOptions = (cfg: Config) => ({ lang: cfg.speakLang, voices: cfg.speakVoices });

// Installe Pocket TTS (premier usage) en le signalant (bulle ou panneau).
export async function installPocket() {
  showBubble('Installation de la lecture à voix haute (~400 Mo à télécharger, une seule fois)… La lecture suivra.', 'status');
  const ok = await tts.install();
  showBubble(ok ? 'Lecture à voix haute installée.'
    : 'Installation de la lecture à voix haute impossible (réseau ?) : elle sera retentée au prochain clic.', 'status');
  pollSpeak();
  return ok;
}

const SPEAK_MESSAGES: Record<string, string> = {
  notInstalled: 'Pocket TTS introuvable et impossible à installer (uv absent) : voir le README.',
  empty: 'Rien à lire.',
  failed: 'La synthèse vocale a échoué.',
};

// `source` : rien, ou 'reply' pour le résumé audio de la réponse choisie dans
// le panneau des conversations (retenu ici à ce moment-là).
export async function speak(source: unknown) {
  const cfg = loadConfig();
  const mode = currentSpeakMode(cfg);
  const reply = source === 'reply';
  if (!reply && mode === 'off') return { ok: false, error: SPEAK_MESSAGES.empty };
  if (!tts.isInstalled() && tts.canInstall() && !(await installPocket())) {
    return { ok: false, error: SPEAK_MESSAGES.failed };
  }
  try {
    const text = reply ? state.convSpeech : await readText(mode as 'selection' | 'clipboard');
    const id: number = tts.speak(text, speakOptions(cfg),
      (pcm, rate) => sendToIcon('tts:chunk', id, pcm, rate),
      (code) => sendToIcon('tts:end', id, code ? SPEAK_MESSAGES[code] || SPEAK_MESSAGES.failed : null));
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: SPEAK_MESSAGES[err instanceof Error ? err.message : ''] || SPEAK_MESSAGES.failed };
  }
}

export const cancelSpeak = (id: unknown) => tts.cancel(id);

// Survol du bouton : le clic va suivre, on charge le modèle d'avance.
export async function warmUpSpeak() {
  const cfg = loadConfig();
  const mode = currentSpeakMode(cfg);
  if (mode !== 'off' && tts.isInstalled()) tts.warmUp(await peekText(mode), speakOptions(cfg));
}

// Curseur du volume : appliqué aussitôt, y compris à une lecture en cours.
export function setVolume(value: unknown) {
  const v = Number(value);
  if (!Number.isFinite(v)) return;
  saveConfig({ speakVolume: Math.max(0, Math.min(1, v)) });
  pollSpeak();
}
