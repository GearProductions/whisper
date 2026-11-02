// Ouvrir un commit du relevé, ou l'un de ses fichiers : par un id, jamais un chemin.
import { describe, expect, it } from 'vitest';
import type { VibeView } from 'shared/bridge';
import type { Stats } from 'node:fs';
import path from 'node:path';
import { codeFile, commitFile, itemCommit, noLinkPath } from 'core/vibecoder';

const C0 = '9fceb02d0ae598e95dc970b74767f19372d61af8';
const C1 = 'e83c5163316f89bfbde7d9ab23ca2e25604af290';
const view = {
  note: null, invariants: [], variants: [], modules: [],
  commits: [{ hash: C0, subject: 'a', fixup: false, files: ['src/a.ts', 'src/b.ts'] }, { hash: C1, subject: 'b', fixup: false, files: [] }],
} as unknown as VibeView;

describe('itemCommit : c<rang>, gh:c<rang>', () => {
  it('c1 : le diff du commit de ce rang', () => {
    expect(itemCommit(view, 'c1')).toEqual({ hash: C1, web: false });
  });

  it('gh:c0 : sa page GitHub', () => {
    expect(itemCommit(view, 'gh:c0')).toEqual({ hash: C0, web: true });
  });

  it('un rang absent, un hash, un autre id : rien', () => {
    expect([itemCommit(view, 'c2'), itemCommit(view, C0), itemCommit(view, 'n'), itemCommit(view, 'gh:https://x'), itemCommit(null, 'c0')])
      .toEqual([null, null, null, null, null]);
  });
});

describe('codeFile : m<rang>/<i>, un fichier d\'un module touché', () => {
  const coded = {
    ...view,
    modules: [
      { path: 'a', touched: true },
      { path: 'b', touched: true, files: [{ id: 'm1/0', path: 'b/index.ts' }] },
    ],
  } as unknown as VibeView;

  it('un module touché sans files (absent = []) : rien, et le suivant est lu', () => {
    expect([codeFile(coded, 'm0/0'), codeFile(coded, 'm1/0')?.path]).toEqual([null, 'b/index.ts']);
  });
});

describe('codeFile : b<i>, un fichier de la branche', () => {
  it('module null et branch, quel que soit le rôle', () => {
    const v = { ...view, files: [{ id: 'b0', path: 'x/a.ts', locked: null }] };
    expect([codeFile({ ...v, flow: 'create' } as VibeView, 'b0'), codeFile({ ...v, flow: 'review' } as VibeView, 'b0')])
      .toEqual(Array(2).fill({ path: 'x/a.ts', module: null, branch: true }));
  });
});

describe('codeFile : n, t<i> en Créer', () => {
  it('sans note dans le relevé : n ne mène à rien', () => {
    expect(codeFile({ ...view, flow: 'create' } as VibeView, 'n')).toBeNull();
  });
});

describe('commitFile : c<rang>/<i> en Relire', () => {
  it('c0/0 : le chemin et le hash ; sans parcours ou un commit sans fichiers : rien', () => {
    expect([commitFile({ ...view, flow: 'review' } as VibeView, 'c0/0'), commitFile(view, 'c0/0'), commitFile({ ...view, flow: 'review' } as VibeView, 'c1/0')])
      .toEqual([{ path: 'src/a.ts', hash: C0 }, null, null]);
  });

  it('codeFile inchangé : un id c… ne mène à rien, en Relire comme en Créer', () => {
    expect([codeFile({ ...view, flow: 'review' } as VibeView, 'c0/0'), codeFile({ ...view, flow: 'create' } as VibeView, 'c0/0')]).toEqual([null, null]);
  });
});

describe('noLinkPath : un chemin sans aucun lien', () => {
  const dir = { isDirectory: () => true, isSymbolicLink: () => false } as Stats;
  const file = { isDirectory: () => false, isSymbolicLink: () => false } as Stats;
  const link = { isDirectory: () => false, isSymbolicLink: () => true } as Stats;
  const disk: Record<string, Stats> = { '/r': dir, '/r/a': dir, '/r/a/f.md': file, '/r/l': link, '/r/a/d': link, '/r/a/f.md/x': file };
  const lstat = (p: string) => disk[p.replace(/\\/g, '/')];   // Windows : path.join écrit des \

  it('rel vide : root ; un fichier ou un dossier présent : son chemin', () => {
    expect([noLinkPath('/r', '', lstat), noLinkPath('/r', 'a', lstat), noLinkPath('/r', 'a/f.md', lstat)]).toEqual(['/r', path.join('/r', 'a'), path.join('/r', 'a', 'f.md')]);
  });

  it('absent, lien (dernier ou au milieu), fichier pris pour un dossier : null', () => {
    expect(['nope', 'l', 'l/x', 'a/d', 'a/f.md/x'].map((r) => noLinkPath('/r', r, lstat))).toEqual([null, null, null, null, null]);
  });

  it('.., absolu, NUL : null', () => {
    expect(['..', 'a/../a', '/etc', 'a\0'].map((r) => noLinkPath('/r', r, lstat))).toEqual([null, null, null, null]);
  });

  it('root absent, pas un dossier ou un lien : null', () => {
    expect([noLinkPath('/x', '', lstat), noLinkPath('/r/a/f.md', '', lstat), noLinkPath('/r/l', '', lstat)]).toEqual([null, null, null]);
  });
});
