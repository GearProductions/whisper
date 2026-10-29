import { describe, expect, it } from 'vitest';
import { duration, fileSize, t } from 'core/vibecoder';

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

describe('pluriels du fil d\'Ariane et de la barre d\'état', () => {
  it('commitsOf : aucun, 1, N', () => {
    expect([0, 1, 3].map(t('fr').commitsOf)).toEqual(['aucun commit', '1 commit', '3 commits']);
    expect([0, 1, 3].map(t('en').commitsOf)).toEqual(['no commit', '1 commit', '3 commits']);
  });

  it('runsRunning : 1, N', () => {
    expect([1, 2].map(t('fr').runsRunning)).toEqual(['1 action en cours', '2 actions en cours']);
    expect([1, 2].map(t('en').runsRunning)).toEqual(['1 action running', '2 actions running']);
  });
});
