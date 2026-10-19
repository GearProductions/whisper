import { describe, expect, it } from 'vitest';
import { lineDiff, type DiffLine } from 'core/vibecoder';

const same = (text: string): DiffLine => ({ kind: 'same', text });
const added = (text: string): DiffLine => ({ kind: 'added', text });
const removed = (text: string): DiffLine => ({ kind: 'removed', text });

describe('lineDiff', () => {
  it('textes égaux : toutes les lignes gardées', () => {
    expect(lineDiff('a\nb', 'a\nb')).toEqual([same('a'), same('b')]);
  });

  it('ligne ajoutée : à sa place, le reste gardé', () => {
    expect(lineDiff('a\nc', 'a\nb\nc')).toEqual([same('a'), added('b'), same('c')]);
  });

  it('ligne retirée : à sa place, le reste gardé', () => {
    expect(lineDiff('a\nb\nc', 'a\nc')).toEqual([same('a'), removed('b'), same('c')]);
  });

  it('ligne changée : l\'ancienne retirée, puis la nouvelle ajoutée', () => {
    expect(lineDiff('a\nb\nc', 'a\nB\nc')).toEqual([same('a'), removed('b'), added('B'), same('c')]);
  });

  it('changements épars : le plus de lignes gardées possible', () => {
    expect(lineDiff('a\nb\nc\nd\ne', 'a\nc\nx\nd\ne\nf')).toEqual([same('a'), removed('b'), same('c'), added('x'), same('d'), same('e'), added('f')]);
  });

  it('avant vide : tout ajouté', () => {
    expect(lineDiff('', 'a\nb')).toEqual([added('a'), added('b')]);
  });

  it('après vide : tout retiré', () => {
    expect(lineDiff('a\nb', '')).toEqual([removed('a'), removed('b')]);
  });

  it('deux textes vides : rien', () => {
    expect(lineDiff('', '')).toEqual([]);
  });

  it('CRLF d\'un côté, LF de l\'autre : les mêmes lignes', () => {
    expect(lineDiff('a\r\nb', 'a\nb')).toEqual([same('a'), same('b')]);
  });

  it('les deux textes se relisent dans le diff', () => {
    let seed = 1; // tirage reproductible
    const pick = () => 'abcd'[(seed = (seed * 48271) % 2147483647) % 4];
    for (let n = 0; n < 200; n++) {
      const before = Array.from({ length: n % 9 }, pick).join('\n'), after = Array.from({ length: (n * 7) % 11 }, pick).join('\n');
      const d = lineDiff(before, after);
      expect(d.filter((l) => l.kind !== 'added').map((l) => l.text).join('\n')).toBe(before);
      expect(d.filter((l) => l.kind !== 'removed').map((l) => l.text).join('\n')).toBe(after);
    }
  });

  it('long texte, une ligne changée : seule elle diffère', () => {
    const before = Array.from({ length: 5000 }, (_, i) => `ligne ${i}`);
    const after = before.map((l, i) => (i === 2500 ? 'changée' : l));
    expect(lineDiff(before.join('\n'), after.join('\n')).filter((l) => l.kind !== 'same')).toEqual([removed('ligne 2500'), added('changée')]);
  });

  it('plus de 2 000 lignes entre le premier et le dernier changement : ce milieu retiré puis ajouté, sans calcul', () => {
    const before = Array.from({ length: 3000 }, (_, i) => `ligne ${i}`);
    const after = before.map((l, i) => (i % 2 ? l : `${l} modifiée`));
    expect(lineDiff(before.join('\n'), after.join('\n'))).toEqual([
      ...before.slice(0, -1).map((l) => removed(l)), ...after.slice(0, -1).map((l) => added(l)), same('ligne 2999'),
    ]);
  });
});
