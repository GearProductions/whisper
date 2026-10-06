/** dictation — ce que devient une dictée côté principal : l'audio accepté, le
 *  texte nettoyé (une seule ligne, I-4), sa destination (le champ d'un agent,
 *  l'agent directement, ou le curseur), et le collage avec le presse-papiers
 *  photographié puis rendu (I-5, I-6).
 *  Ne connaît pas : whisper, le presse-papiers ni l'outil de collage (passés).
 *  Utilisé par : app/controllers/dictation. */
import type { AgentConfig } from 'core/agents';
import type { Config } from 'core/config';

const SAMPLE_RATE = 16000;
const MIN_BYTES = SAMPLE_RATE * 2 * 0.3;     // < 0,3 s : un clic, pas une phrase
const MAX_BYTES = SAMPLE_RATE * 2 * 5 * 60;  // 5 min : la page coupe avant
const RESTORE_DELAY_MS = 400;

export const TRANSCRIBE_MESSAGES: Record<string, string> = {
  notInstalled: 'whisper.cpp introuvable : placez whisper-cli et un modèle ggml-*.bin dans le dossier whisper (clic droit → Ouvrir le dossier whisper).',
  badAudio: 'Enregistrement trop court ou trop long.',
  timeout: 'La transcription a pris trop de temps.',
  failed: 'La transcription a échoué.',
};

// L'audio reçu de la page (PCM 16 bits mono 16 kHz) → Buffer ; lance 'badAudio'.
export function checkAudio(pcm: unknown): Buffer {
  const buf = pcm instanceof ArrayBuffer || ArrayBuffer.isView(pcm)
    ? Buffer.from((pcm as ArrayBufferView).buffer || (pcm as ArrayBuffer)) : null;
  if (!buf || buf.length % 2 || buf.length < MIN_BYTES || buf.length > MAX_BYTES) throw new Error('badAudio');
  return buf;
}

// Une seule ligne (un retour à la ligne collé dans un terminal EXÉCUTE la
// commande), sans les marqueurs de non-parole ([BLANK_AUDIO], [Musique]…).
export function cleanTranscript(stdout: unknown) {
  return String(stdout || '')
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/[\r\n\t\v\f\u0085\u2028\u2029]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

// Un agent sélectionné : la dictée lui est destinée, dans le champ de son
// panneau (à relire) ou envoyée aussitôt ; sinon, collée au curseur.
export type Destination = 'review' | 'send' | 'paste';
export function destination(cfg: Config, agent: AgentConfig | null): Destination {
  if (!agent) return 'paste';
  return cfg.agentReview !== false ? 'review' : 'send';
}

export type PasteTools = {
  clipboard: { snapshot(): object; restore(snap: object): void; writeText(text: string): void };
  paste(): Promise<boolean>;
  wait(ms: number): Promise<unknown>;
};

// Résout true si le texte a été collé. Collage automatique désactivé : aucune
// touche n'est simulée — sous KDE Wayland, chaque injection demande une
// autorisation —, le texte reste dans le presse-papiers.
export async function pasteText(text: string, autoPaste: boolean, { clipboard, paste, wait }: PasteTools) {
  if (!autoPaste) {
    clipboard.writeText(text);
    return false;
  }
  const snap = clipboard.snapshot();
  clipboard.writeText(text);
  const ok = await paste();
  // Collage raté (outil absent sous Linux…) : le texte RESTE dans le
  // presse-papiers, l'utilisateur le colle à la main.
  if (!ok) return false;
  // L'application cible lit le presse-papiers APRÈS avoir reçu Ctrl+V, et à
  // son rythme : restaurer tout de suite lui ferait coller l'ancien contenu.
  await wait(RESTORE_DELAY_MS);
  clipboard.restore(snap);
  return true;
}
