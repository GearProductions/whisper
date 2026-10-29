import { describe, expect, it } from 'vitest';
import { buildState } from 'helpers';

const b = (main: string | null, pages: string | null) => ({ main, pages });

describe('buildState', () => {
  it('rien de reconstruit, ou reconstruit à l’identique : rien', () => {
    expect([buildState(b('m', 'p'), b('m', 'p')), buildState(b(null, null), b('m', 'p'))]).toEqual([null, null]);
  });

  it('les pages seules changées : recharger', () => {
    expect(buildState(b('m', 'p'), b('m', 'p2'))).toBe('reload');
  });

  it('le principal changé : redémarrer, même si les pages ont changé aussi', () => {
    expect([buildState(b('m', 'p'), b('m2', 'p')), buildState(b('m', 'p'), b('m2', 'p2'))]).toEqual(['restart', 'restart']);
  });

  it('un fichier construit absent (une construction en cours) : rien', () => {
    expect([buildState(b('m', 'p'), b(null, 'p')), buildState(b('m', 'p'), b('m', null))]).toEqual([null, null]);
  });
});
