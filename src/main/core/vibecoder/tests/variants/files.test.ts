// Ouvrir un commit du relevé, ou l'un de ses fichiers : par un id, jamais un chemin.
import { describe, expect, it } from 'vitest';
import type { VibeView } from 'shared/bridge';
import { codeFile, itemCommit, itemPath } from 'core/vibecoder';

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

describe('itemPath : c<rang>/<i>, le i-ème fichier d\'un commit', () => {
  it('c0/1 : son chemin', () => {
    expect(itemPath(view, 'c0/1')).toBe('src/b.ts');
  });

  it('un fichier absent : rien', () => {
    expect([itemPath(view, 'c0/2'), itemPath(view, 'c1/0')]).toEqual([null, null]);
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

describe('codeFile : n, t<i> en Créer', () => {
  it('sans note dans le relevé : n ne mène à rien', () => {
    expect(codeFile({ ...view, flow: 'create' } as VibeView, 'n')).toBeNull();
  });
});
