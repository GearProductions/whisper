import { describe, expect, it } from 'vitest';
import { prNumber, remark } from 'core/vibecoder';

describe('prNumber', () => {
  it('un numéro, avec ou sans #, espaces du bord ignorés', () => {
    expect(prNumber('27')).toBe(27);
    expect(prNumber(' #27 ')).toBe(27);
  });

  it('l\'adresse d\'une PR, avec un onglet ou une ancre', () => {
    expect(prNumber('https://github.com/GearProductions/whisper/pull/27')).toBe(27);
    expect(prNumber('https://github.com/o/r/pull/27/files?w=1')).toBe(27);
    expect(prNumber('http://ghe.local/o/r/pull/3#discussion_r1')).toBe(3);
  });

  it('zéro, négatif, décimal, trop grand : null', () => {
    for (const s of ['0', '-3', '2.5', '1e3', '99999999999999999999']) expect(prNumber(s)).toBeNull();
  });

  it('autre chose : null', () => {
    for (const s of ['', '  ', '#', 'abc', '27 28', 'https://github.com/o/r/issues/27', 'pull/27', 'ftp://x/pull/27']) expect(prNumber(s)).toBeNull();
  });
});

describe('remark', () => {
  it('la cible et le texte, tels quels', () => {
    expect(remark('34349c1 la note', '- a.ts:3 — dupliqué')).toEqual({ target: '34349c1 la note', text: '- a.ts:3 — dupliqué' });
  });

  it('texte vide ou blanc : la cible', () => {
    expect(remark('Commit 34349c1', ' \n ')).toEqual({ target: 'Commit 34349c1', text: 'Commit 34349c1' });
  });

  it('cible sur une seule ligne, espaces resserrés', () => {
    expect(remark(' a\n b\t c ', 'x').target).toBe('a b c');
  });

  it('cible de plus de 300 caractères : coupée à 300 ; texte de plus de 5 000 : à 5 000', () => {
    const r = remark('c'.repeat(400), 't'.repeat(6000));
    expect(r.target.length).toBe(300);
    expect(r.target.endsWith('…')).toBe(true);
    expect(r.text.length).toBe(5000);
    expect(remark('c'.repeat(300), 't'.repeat(5000))).toEqual({ target: 'c'.repeat(300), text: 't'.repeat(5000) });
  });
});
