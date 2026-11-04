import { describe, expect, it } from 'vitest';
import { checkAudio } from 'core/dictation';

describe('audio reçu', () => {
  const voice = (samples: number, amp = 0.2) => new Int16Array(samples).fill(amp * 0x7fff);
  it('PCM 16 bits entre 0,3 s et 5 min', () => {
    expect(checkAudio(voice(16000).buffer).length).toBe(32000);
    expect(checkAudio(voice(16000)).length).toBe(32000);
    expect(() => checkAudio(voice(4500).buffer)).toThrow('badAudio');
    expect(() => checkAudio(new ArrayBuffer(32001))).toThrow('badAudio');
    expect(() => checkAudio(voice(16000 * 301).buffer)).toThrow('badAudio');
    expect(() => checkAudio('du texte')).toThrow('badAudio');
  });
  it('sous le seuil d\'énergie (0,008 RMS) : du silence, refusé', () => {
    expect(() => checkAudio(new Int16Array(16000).buffer)).toThrow('badAudio');
    expect(() => checkAudio(voice(16000, 0.007))).toThrow('badAudio');
    expect(checkAudio(voice(16000, 0.009)).length).toBe(32000);
  });
  it('parole courte + long silence : jugée sur le bloc le plus fort, comme la page', () => {
    const pcm = new Int16Array(16000 * 10);
    pcm.fill(0.03 * 0x7fff, 0, 8192); // 0,5 s à 0,03 RMS : ≈ 0,0067 sur les 10 s
    expect(checkAudio(pcm).length).toBe(pcm.length * 2);
  });
});
