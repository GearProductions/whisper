/** dictation — ce que devient une dictée côté principal : l'audio accepté (ni
 *  trop court ni muet, I-10 : le bloc le plus fort, comme la page) et le texte
 *  nettoyé (une seule ligne). Rien n'est collé ni copié ici : le texte est
 *  rendu à la page.
 *  Ne connaît pas : whisper, le presse-papiers, les agents.
 *  Utilisé par : app/controllers/dictation. */

const SAMPLE_RATE = 16000;
const MIN_BYTES = SAMPLE_RATE * 2 * 0.3;     // < 0,3 s : un clic, pas une phrase
const MAX_BYTES = SAMPLE_RATE * 2 * 5 * 60;  // 5 min : la page coupe avant
const MIN_RMS = 0.008;                       // F-4 : en dessous, du silence (même seuil que la page, qui ne se fie pas)
const BLOCK = 4096;                          // échantillons par bloc : ceux du recorder de la page

export const TRANSCRIBE_MESSAGES: Record<string, string> = {
  notInstalled: 'whisper.cpp introuvable : placez whisper-cli et un modèle ggml-*.bin dans le dossier whisper (⚙ Réglages → Général → Ouvrir le dossier whisper).',
  badAudio: 'Enregistrement trop court, trop long ou muet.',
  timeout: 'La transcription a pris trop de temps.',
  failed: 'La transcription a échoué.',
};

// Le RMS du bloc le plus fort, comme `rec.peak` de la page : une phrase dite
// doucement dans un long silence n'est pas du silence.
function loudestBlockRms(buf: Buffer) {
  const n = buf.length / 2;
  let loudest = 0;
  for (let start = 0; start < n; start += BLOCK) {
    const end = Math.min(start + BLOCK, n);
    let sum = 0;
    for (let i = start; i < end; i++) sum += (buf.readInt16LE(i * 2) / 0x8000) ** 2;
    loudest = Math.max(loudest, Math.sqrt(sum / (end - start)));
  }
  return loudest;
}

// L'audio reçu de la page (PCM 16 bits mono 16 kHz) → Buffer ; lance 'badAudio'.
export function checkAudio(pcm: unknown): Buffer {
  const buf = pcm instanceof ArrayBuffer || ArrayBuffer.isView(pcm)
    ? Buffer.from((pcm as ArrayBufferView).buffer || (pcm as ArrayBuffer)) : null;
  if (!buf || buf.length % 2 || buf.length < MIN_BYTES || buf.length > MAX_BYTES) throw new Error('badAudio');
  if (loudestBlockRms(buf) < MIN_RMS) throw new Error('badAudio');
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
