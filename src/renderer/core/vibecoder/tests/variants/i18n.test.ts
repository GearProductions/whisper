import { describe, expect, it } from 'vitest';
import { duration, fileSize } from 'core/vibecoder';

describe('duration', () => {
  it('secondes, minutes, heures et minutes sur deux chiffres', () => {
    expect(duration(12_400)).toBe('12 s');
    expect(duration(3 * 60_000 + 59_000)).toBe('3 min');
    expect(duration(2 * 3_600_000 + 5 * 60_000)).toBe('2 h 05');
  });

  it('une durée négative (horloge décalée) : 0 s', () => {
    expect(duration(-5000)).toBe('0 s');
  });
});

describe('fileSize', () => {
  it('octets, Ko, Mo en base 1024, dans la langue de l\'écran', () => {
    expect(fileSize(512, 'fr')).toBe('512 o');
    expect(fileSize(1536, 'fr')).toBe('1,5 Ko');
    expect(fileSize(10 * 1024 * 1024, 'en')).toBe('10 MB');
    expect(fileSize(0, 'en')).toBe('0 B');
  });
});
