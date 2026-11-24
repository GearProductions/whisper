import { describe, expect, it } from 'vitest';
import { holdsPause, nextVibeMode } from 'core/vibecoder';

const rest = { busy: false, live: 0, waiting: 0, questions: 0 };

describe('holdsPause : la pause où se tient le parcours est-elle tenue', () => {
  const o = { at: null, express: false, released: null } as const;

  it('aucune pause : pas tenue', () => {
    expect(holdsPause(o)).toBe(false);
    expect(holdsPause({ ...o, express: true })).toBe(false);
  });

  it('après les invariants ou les modules, rythme par défaut : tenue', () => {
    expect(holdsPause({ ...o, at: 'invariants' })).toBe(true);
    expect(holdsPause({ ...o, at: 'modules' })).toBe(true);
  });

  it('après les invariants ou les modules, en express : pas tenue', () => {
    expect(holdsPause({ ...o, at: 'invariants', express: true })).toBe(false);
    expect(holdsPause({ ...o, at: 'modules', express: true })).toBe(false);
  });

  it('la pause d\'où l\'utilisateur vient de relancer : pas tenue', () => {
    expect(holdsPause({ ...o, at: 'invariants', released: 'invariants' })).toBe(false);
    expect(holdsPause({ ...o, at: 'modules', released: 'modules' })).toBe(false);
  });

  it('relancé après les invariants, arrivé après les modules : tenue', () => {
    expect(holdsPause({ ...o, at: 'modules', released: 'invariants' })).toBe(true);
  });

  it('la note sans son ✓ : tenue, en express aussi', () => {
    expect(holdsPause({ ...o, at: 'note' })).toBe(true);
    expect(holdsPause({ ...o, at: 'note', express: true })).toBe(true);
    expect(holdsPause({ ...o, at: 'note', released: 'note' })).toBe(true);
    expect(holdsPause({ ...o, at: 'note', released: 'invariants' })).toBe(true);
    expect(holdsPause({ ...o, at: 'note', express: true, released: 'modules' })).toBe(true);
  });

  it('un ✓ d\'étape retiré à la main (la Forme, les invariants, les modules) : tenue, en express aussi, relancée ou pas', () => {
    for (const at of ['withdrawn:forme', 'withdrawn:invariants', 'withdrawn:modules'] as const) {
      expect(holdsPause({ ...o, at })).toBe(true);
      expect(holdsPause({ ...o, at, express: true })).toBe(true);
      expect(holdsPause({ ...o, at, released: at })).toBe(true);
      expect(holdsPause({ ...o, at, express: true, released: 'invariants' })).toBe(true);
    }
  });
});

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

