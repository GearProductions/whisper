import { describe, expect, it } from 'vitest';
import { plainName } from 'helpers';

describe('plainName', () => {
  it('un nom simple est rendu tel quel', () => {
    expect(plainName('rapport.md', false)).toBe('rapport.md');
    expect(plainName('Mes notes', true)).toBe('Mes notes');
    expect(plainName('.env', false)).toBe('.env');
  });
  it('refuse ce qui n’est pas une chaîne, le vide, . et ..', () => {
    for (const n of [undefined, null, 3, {}, '', '.', '..']) expect(plainName(n, false)).toBeNull();
  });
  it('refuse un séparateur ou un NUL, absolu ou en chemin', () => {
    for (const n of ['a/b', '../x', '/etc/passwd', 'a\\b', 'a\0b', '..\\x'])
      expect(plainName(n, false)).toBeNull();
  });
  it('un dossier ne commence pas par un point (F-95)', () => {
    expect(plainName('.cache', true)).toBeNull();
    expect(plainName('.cache', false)).toBe('.cache');
  });
  it('refuse partout ce que Windows refuse : caractères, fin, noms réservés', () => {
    for (const n of ['a:b', 'a*', 'a?', 'a"b', '<a>', 'a|b', 'a\x01b', 'a\x1f', 'a ', 'a.', 'a. ', 'con', 'NUL', 'Aux.txt', 'prn.tar.gz', 'COM1', 'lpt9.md'])
      expect(plainName(n, false)).toBeNull();
    for (const n of ['a b', 'a.b', 'console', 'com10', 'com0.txt', 'lpt', 'x.con', ' a'])
      expect(plainName(n, false)).toBe(n);
  });
  it('255 octets UTF-8 au plus', () => {
    expect(plainName('a'.repeat(255), false)).not.toBeNull();
    expect(plainName('a'.repeat(256), false)).toBeNull();
    expect(plainName('é'.repeat(127), false)).not.toBeNull();
    expect(plainName('é'.repeat(128), false)).toBeNull();
  });
});
