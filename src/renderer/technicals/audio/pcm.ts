/** pcm — calculs sur l'audio enregistré : énergie, conversion pour whisper
 *  (PCM 16 bits mono 16 kHz).
 *  Ne connaît pas : le micro, le pont, React. Utilisé par : recorder, core/dictation. */

export const RATE = 16000;

export function rms(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i] * samples[i];
  return samples.length ? Math.sqrt(sum / samples.length) : 0;
}

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
