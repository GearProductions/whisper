import { describe, expect, it } from 'vitest';
import { numberedName } from 'helpers';

describe('numberedName', () => {
  it('n = 1 : le nom tel quel', () => {
    expect(numberedName('rapport.md', 1)).toBe('rapport.md');
    expect(numberedName('.env', 1)).toBe('.env');
  });
  it('n ≥ 2 : le numéro avant l’extension', () => {
    expect(numberedName('rapport.md', 2)).toBe('rapport-2.md');
    expect(numberedName('rapport.md', 10)).toBe('rapport-10.md');
    expect(numberedName('a', 2)).toBe('a-2');
  });
  it('un fichier caché garde tout son nom : .env-2', () => {
    expect(numberedName('.env', 2)).toBe('.env-2');
    expect(numberedName('.env.local', 3)).toBe('.env-3.local');
  });
  it('plusieurs points : la dernière extension seule', () => {
    expect(numberedName('archive.tar.gz', 2)).toBe('archive.tar-2.gz');
  });
});
