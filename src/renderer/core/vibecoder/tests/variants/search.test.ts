import { describe, expect, it } from 'vitest';
import { prMatch, reviewAskable, searchMatch } from 'core/vibecoder';

const pr = (number: number, title = 't', author = 'kb') => ({ number, title, author, url: '' });

describe('searchMatch', () => {
  it('une requête vide ou blanche : tout', () => {
    expect([searchMatch('', 'x'), searchMatch('  ', 'x')]).toEqual([true, true]);
  });

  it('chaque mot, sans casse, dans l’un des champs', () => {
    expect(searchMatch('Viewer 3d', 'G2-6791 add 3D viewer')).toBe(true);
    expect(searchMatch('viewer kb', 'G2-6791 add 3D viewer', 'kb')).toBe(true);
    expect(searchMatch('viewer zz', 'G2-6791 add 3D viewer', 'kb')).toBe(false);
  });
});

describe('prMatch', () => {
  it('par numéro (avec ou sans #), titre, auteur', () => {
    const p = pr(51, 'La gestion des branches', 'Reykugo-Gear');
    expect(['#51', '51', 'branches', 'reykugo', '#52'].map((q) => prMatch(q, p))).toEqual([true, true, true, true, false]);
  });
});

describe('reviewAskable', () => {
  it('dans Toutes les PR, ni des miennes ni déjà à relire', () => {
    const prs = { mine: [pr(1)], review: [pr(2)], all: [pr(1), pr(2), pr(3)] };
    expect([1, 2, 3, 4].map((n) => reviewAskable(prs, n))).toEqual([false, false, true, false]);
  });
});
