import { describe, expect, it } from 'vitest';
import { nextVibeMode } from 'core/vibecoder';

const rest = { busy: false, live: 0, waiting: 0, questions: 0 };

describe('nextVibeMode : le mode Vibe d\'un agent', () => {
  it('stop : on → halted ; halted et off ne bougent pas', () => {
    expect(nextVibeMode('on', 'stop')).toBe('halted');
    expect(nextVibeMode('halted', 'stop')).toBe('halted');
    expect(nextVibeMode('off', 'stop')).toBe('off');
  });

  it('au repos : halted → off, on → off sans question ouverte', () => {
    expect(nextVibeMode('halted', rest)).toBe('off');
    expect(nextVibeMode('halted', { ...rest, questions: 2 })).toBe('off');
    expect(nextVibeMode('on', rest)).toBe('off');
  });

  it('une question qui bloque garde Vibe en cours', () => {
    expect(nextVibeMode('on', { ...rest, questions: 1 })).toBe('on');
  });

  it('pas au repos (un tour, une course vivante, une demande retenue) : inchangé', () => {
    for (const r of [{ busy: true }, { live: 1 }, { waiting: 1 }]) {
      expect(nextVibeMode('on', { ...rest, ...r })).toBe('on');
      expect(nextVibeMode('halted', { ...rest, ...r })).toBe('halted');
    }
  });
});

