/** speech — la lecture à voix haute côté appli : l'état du bouton (relevé
 *  régulièrement), l'installation de Pocket TTS au premier usage, la lecture.
 *  Comme pour le collage, le texte ne vient jamais de la page : on relit la
 *  sélection (ou le presse-papiers) au moment du clic (à l'icône), ou le résumé
 *  retenu pour la réponse d'agent de ce rang (au panneau, I-3). L'audio suit
 *  par morceaux (`tts:chunk`), puis `tts:end`.
 *  Ne connaît pas : les agents (seulement le résumé retenu).
 *  Utilisé par : app/ipc, app/lifecycle, app/menus. */
import { speakMode, speakVolume, type Config } from 'core/config';
import * as tts from 'technicals/pocket-tts';
import { hasText, peekText, readText } from 'technicals/selection';
import { loadConfig, saveConfig } from 'app/settings';
import { state } from 'app/state';
import { applySize, canReadSelection, sendToIcon, showBubble } from 'app/windows';

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
    applySize();
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

type Send = (channel: string, ...args: unknown[]) => void;

// Lit `read()` à voix haute (Pocket TTS installé au besoin) : l'audio part par
// morceaux vers `send` (`tts:chunk`), puis `tts:end`.
async function play(read: () => string | Promise<string>, cfg: Config, send: Send) {
  if (!tts.isInstalled() && tts.canInstall() && !(await installPocket())) {
    return { ok: false, error: SPEAK_MESSAGES.failed };
  }
  try {
    const id: number = tts.speak(await read(), speakOptions(cfg),
      (pcm, rate) => send('tts:chunk', id, pcm, rate),
      (code) => send('tts:end', id, code ? SPEAK_MESSAGES[code] || SPEAK_MESSAGES.failed : null));
    return { ok: true, id };
  } catch (err) {
    return { ok: false, error: SPEAK_MESSAGES[err instanceof Error ? err.message : ''] || SPEAK_MESSAGES.failed };
  }
}

// La sélection (ou le presse-papiers), relue au moment du clic sur l'icône.
export async function speak() {
  const cfg = loadConfig();
  const mode = currentSpeakMode(cfg);
  if (mode === 'off') return { ok: false, error: SPEAK_MESSAGES.empty };
  return play(() => readText(mode), cfg, sendToIcon);
}

// Écouter la réponse de ce rang dans le fil affiché : le résumé audio retenu
// ici, jamais un texte de la page (I-3). Le son va au panneau.
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
  return play(() => audio, cfg, (ch, ...a) => state.panel?.webContents.send(ch, ...(ch === 'tts:chunk' ? [a[0], scaled(a[1] as Buffer), a[2]] : a)));
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
