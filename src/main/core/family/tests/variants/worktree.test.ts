import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { branchOf, childOf, isMain, parseWorktrees, repoOf } from 'core/family';

describe('repoOf', () => {
  it('dossier commun et racine, résolus ; pas un dépôt, chemin introuvable : null', async () => {
    const run = (out: string | null) => async () => out;
    const real = (p: string) => `/real${p}`;
    expect(await repoOf(run('/p/.git\n/p\n'), real)).toEqual({ common: '/real/p/.git', top: '/real/p' });
    expect(await repoOf(run(null), real)).toBeNull();
    expect(await repoOf(run('/p/.git\n'), real)).toBeNull();
    expect(await repoOf(run('/p/.git\n/p\n'), () => { throw new Error('ENOENT'); })).toBeNull();
  });
});

describe('copie principale, enfant (I-41)', () => {
  const main = { common: '/p/.git', top: '/p' };
  const wt = { common: '/p/.git', top: '/w/pr-7' };
  it('isMain : le dossier git est <racine>/.git', () => {
    expect(isMain(main)).toBe(true);
    expect(isMain(wt)).toBe(false);
  });
  it('childOf : la racine d’un worktree du même dépôt, autre que la copie du parent', () => {
    expect(childOf('/w/pr-7', main, wt)).toBe(true);
    expect(childOf('/w/pr-7/src', main, wt)).toBe(false);                            // sous-dossier
    expect(childOf('/p', main, main)).toBe(false);                                   // la copie du parent
    expect(childOf('/w/pr-7', main, { ...wt, common: '/q/.git' })).toBe(false);      // autre dépôt
  });
});

describe('parseWorktrees', () => {
  const z = (...records: string[][]) => records.map((r) => r.map((f) => `${f}\0`).join('') + '\0').join('');
  it('copies et branches ; détachée : null ; nu, caractère de contrôle : écartés', () => {
    const out = z(
      ['worktree /p', 'HEAD abc', 'branch refs/heads/master'],
      ['worktree /w/pr-7', 'HEAD def', 'branch refs/heads/feat/x'],
      ['worktree /w/detache', 'HEAD 123', 'detached'],
      ['worktree /nu', 'bare'],
      ['worktree /w/a\nb', 'HEAD 456', 'branch refs/heads/y'],
      ['worktree /w/vieux', 'HEAD 789', 'branch refs/heads/z', 'prunable gitdir file points to non-existent location'],
    );
    expect(parseWorktrees(out)).toEqual([
      { dir: '/p', branch: 'master' },
      { dir: '/w/pr-7', branch: 'feat/x' },
      { dir: '/w/detache', branch: null },
      { dir: '/w/vieux', branch: 'z' },
    ]);
    expect(parseWorktrees('')).toEqual([]);
  });
});

describe('branchOf', () => {
  const disk = (files: Record<string, string>) => {
    const byPath = new Map(Object.entries(files).map(([k, v]) => [path.resolve(k), v])); // \p\… sous Windows
    return (file: string) => byPath.get(path.resolve(file)) ?? null;
  };
  it('par <dir>/.git (dossier, ou gitdir: d’un worktree) puis HEAD', () => {
    expect(branchOf('/p', disk({ '/p/.git/HEAD': 'ref: refs/heads/master\n' }))).toBe('master');
    expect(branchOf('/w/pr-7', disk({
      '/w/pr-7/.git': 'gitdir: /p/.git/worktrees/pr-7\n',
      '/p/.git/worktrees/pr-7/HEAD': 'ref: refs/heads/feat/x\n',
    }))).toBe('feat/x');
    expect(branchOf('/w/rel', disk({ '/w/rel/.git': 'gitdir: ../../p/.git/worktrees/rel', '/p/.git/worktrees/rel/HEAD': 'ref: refs/heads/r' }))).toBe('r');
  });
  it('détachée, illisible : null', () => {
    expect(branchOf('/p', disk({ '/p/.git/HEAD': '0123456789abcdef\n' }))).toBeNull();
    expect(branchOf('/p', disk({}))).toBeNull();
  });
});
