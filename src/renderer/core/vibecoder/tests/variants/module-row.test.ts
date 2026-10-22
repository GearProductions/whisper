import { describe, expect, it } from 'vitest';
import { fileParts, filesByDir, moduleCommits } from 'core/vibecoder';
import type { VibeCommit, VibeModule } from 'technicals/bridge';

describe('fileParts', () => {
  it('un fichier : son dossier (avec « / ») et son nom', () => {
    expect(fileParts('main/core/vibecoder/journey.ts')).toEqual({ dir: 'main/core/vibecoder/', name: 'journey.ts' });
  });

  it('un dossier : son nom garde le « / »', () => {
    expect(fileParts('main/technicals/git/')).toEqual({ dir: 'main/technicals/', name: 'git/' });
  });

  it('à la racine : pas de dossier ; espaces du bord retirés', () => {
    expect(fileParts(' package.json ')).toEqual({ dir: '', name: 'package.json' });
    expect(fileParts('resources/')).toEqual({ dir: '', name: 'resources/' });
    expect(fileParts('')).toEqual({ dir: '', name: '' });
  });
});

const commit = (hash: string, subject = hash): VibeCommit => ({ hash, subject, fixup: subject.startsWith('fixup!'), files: [] });
const mod = (commits: string[]): VibeModule => ({ path: 'main/core/x.ts', contract: '', file: null, touched: commits.length > 0, commits });
// Le relevé : le plus ancien d'abord.
const branch = [
  commit('99b3089ceb6f0000'), commit('34349c1aaaa00000'), commit('239aa40bbbb00000'), commit('9fc3151cccc00000', 'fixup! x'),
];

describe('moduleCommits', () => {
  it('les commits du relevé qui le touchent, dans l\'ordre du relevé', () => {
    expect(moduleCommits(mod(['9fc3151cccc00000', '34349c1aaaa00000']), branch).map((c) => c.hash)).toEqual(['34349c1aaaa00000', '9fc3151cccc00000']);
  });

  it('le dernier est le plus récent qui le touche (celui dont on relit le diff)', () => {
    expect(moduleCommits(mod(['34349c1aaaa00000', '239aa40bbbb00000']), branch).at(-1)?.hash).toBe('239aa40bbbb00000');
  });

  it('un fixup qui le touche en fait partie', () => {
    expect(moduleCommits(mod(['9fc3151cccc00000']), branch)[0]).toEqual(branch[3]);
  });

  it('jamais touché : aucun ; hash inconnu du relevé : ignoré', () => {
    expect(moduleCommits(mod([]), branch)).toEqual([]);
    expect(moduleCommits(mod(['deadbee']), branch)).toEqual([]);
  });

  it('un début de hash ne désigne pas le commit (hash complets)', () => {
    expect(moduleCommits(mod(['', '34349c1']), branch)).toEqual([]);
  });

  it('branche sans commit : aucun', () => {
    expect(moduleCommits(mod(['34349c1aaaa00000']), [])).toEqual([]);
  });
});

describe('filesByDir', () => {
  const f = (path: string, i: number) => ({ id: `m0/${i}`, path });
  it('par dossier, dans l\'ordre du premier fichier ; un fichier à la racine : le dossier \'\'', () => {
    const files = ['src/a/x.ts', 'src/b/y.ts', 'src/a/z.ts', 'README.md'].map(f);
    expect(filesByDir(files)).toEqual([
      { dir: 'src/a/', files: [files[0], files[2]] },
      { dir: 'src/b/', files: [files[1]] },
      { dir: '', files: [files[3]] },
    ]);
  });

  it('aucun fichier : aucun dossier', () => {
    expect(filesByDir([])).toEqual([]);
  });
});
