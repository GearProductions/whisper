/** audio — calculs sur l'enregistrement : énergie, silence, conversion pour
 *  whisper (PCM 16 bits mono 16 kHz).
 *  Ne connaît pas : le micro, le pont, React. Utilisé par : recorder, dictation. */

export const RATE = 16000;
// Énergie (RMS) du morceau le plus fort : en dessous, on n'a capté que du
// silence — et whisper, sur du silence, INVENTE (« Sous-titres réalisés par… »).
export const MIN_PEAK = 0.008;
const MIN_SECONDS = 0.4;

export function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return samples.length ? Math.sqrt(sum / samples.length) : 0;
}

// Trop court ou trop faible : rien à transcrire (SPEC F-4, I-10).
export const isSilent = (length: number, peak: number) => length < RATE * MIN_SECONDS || peak < MIN_PEAK;

// Float32 [-1, 1] → PCM 16 bits little-endian.
export function toPcm(chunks: Float32Array[], length: number): Int16Array {
  const out = new Int16Array(length);
  let o = 0;
  for (const c of chunks) {
    for (let i = 0; i < c.length; i++) {
      const s = Math.max(-1, Math.min(1, c[i]));
      out[o++] = s < 0 ? s * 0x8000 : s * 0x7fff;
    }
  }
  return out;
}
