import { describe, expect, it } from 'vitest';
import { checkAudio, destination } from 'core/dictation';
import { withDefaults } from 'core/config';

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
});

describe('destination', () => {
  const agent = { id: 'a', dir: '/p', name: 'a', model: '', effort: '', mode: 'default', sessionId: null };
  it('agent et relecture : le champ ; sans relecture : envoyé ; sans agent : collé', () => {
    expect(destination(withDefaults({}), agent)).toBe('review');
    expect(destination(withDefaults({ agentReview: false }), agent)).toBe('send');
    expect(destination(withDefaults({}), null)).toBe('paste');
  });
});
