import { describe, expect, it } from 'vitest';
import { checkAudio, destination } from 'core/dictation';
import { withDefaults } from 'core/config';

describe('audio reçu', () => {
  it('PCM 16 bits entre 0,3 s et 5 min', () => {
    expect(checkAudio(new ArrayBuffer(32000)).length).toBe(32000);
    expect(checkAudio(new Int16Array(16000)).length).toBe(32000);
    expect(() => checkAudio(new ArrayBuffer(9000))).toThrow('badAudio');
    expect(() => checkAudio(new ArrayBuffer(32001))).toThrow('badAudio');
    expect(() => checkAudio(new ArrayBuffer(16000 * 2 * 301))).toThrow('badAudio');
    expect(() => checkAudio('du texte')).toThrow('badAudio');
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
