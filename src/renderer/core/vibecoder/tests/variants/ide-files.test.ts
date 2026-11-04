import { describe, expect, it } from 'vitest';
import { ideFiles, invariantFiles, moduleState } from 'core/vibecoder';
import type { VibeModule, VibeTestFile } from 'technicals/bridge';

const mod = (path: string, o: Partial<VibeModule> = {}): VibeModule => ({ path, contract: '', file: null, touched: false, commits: [], ...o });
const f = (id: string, path: string, deleted?: true) => ({ id, path, ...(deleted && { deleted }) });

const done = mod('a/', { touched: true, commits: ['h1'], files: [f('m0/0', 'a/x.ts'), f('m0/1', 'a/y.ts', true)] });
const wip = mod('b.ts', { touched: true, files: [f('m1/0', 'b.ts')], locked: 'motif' });
const todo = mod('c.ts');
const modules = [done, wip, todo];

describe('moduleState', () => {
  it('commits : done ; touché : wip ; sinon todo', () => {
    expect(moduleState(done)).toBe('done');
    expect(moduleState(wip)).toBe('wip');
    expect(moduleState(todo)).toBe('todo');
  });
});

describe('ideFiles', () => {
  it('module : un par module, son chemin ; code seulement s’il est touché', () => {
    expect(ideFiles({ modules }, 'module')).toEqual([
      { path: 'a/', rank: 0, state: 'done', mark: 'modified', code: done },   // un de ses fichiers pas commité (supprimé)
      { path: 'b.ts', rank: 1, state: 'wip', mark: null, code: wip },
      { path: 'c.ts', rank: 2, state: 'todo', mark: 'todo', code: null },
    ]);
  });

  it('file : un par fichier changé des modules touchés (le module réduit à lui), le chemin des autres', () => {
    const rows = ideFiles({ modules }, 'file');
    expect(rows.map((r) => [r.path, r.rank, r.state, r.code?.files?.map((x) => x.id)])).toEqual([
      ['a/x.ts', 0, 'done', ['m0/0']],
      ['a/y.ts', 0, 'done', ['m0/1']],
      ['b.ts', 1, 'wip', ['m1/0']],
      ['c.ts', 2, 'todo', undefined],
    ]);
    expect(rows[2].code).toMatchObject({ path: 'b.ts', locked: 'motif' });
    expect(rows[3].code).toBeNull();
  });

  it('mark, comme VS Code : nouveau, modifié, supprimé (pas commités), à générer ; null : commité', () => {
    const g = mod('g/', { touched: true, files: [{ ...f('m0/0', 'g/n.ts'), git: 'new' }, { ...f('m0/1', 'g/m.ts'), git: 'modified' }, f('m0/2', 'g/c.ts'), f('m0/3', 'g/d.ts', true)] });
    expect(ideFiles({ modules: [g, todo] }, 'file').map((r) => [r.path, r.mark])).toEqual([
      ['g/n.ts', 'new'], ['g/m.ts', 'modified'], ['g/c.ts', null], ['g/d.ts', 'deleted'], ['c.ts', 'todo'],
    ]);
    const one = mod('o.ts', { touched: true, files: [{ ...f('m0/0', 'o.ts'), git: 'new' }] });
    expect(ideFiles({ modules: [one] }, 'module')[0].mark).toBe('new');   // un module d'un fichier : sa couleur
    const files = [{ id: 'b0', path: 'x.ts', git: 'new' as const, locked: null }, { id: 'b1', path: 'y.ts', locked: null }];
    expect(ideFiles({ modules: [], files }, 'file').map((r) => r.mark)).toEqual(['new', null]);
  });

  it('file : un module non touché donne le chemin de son fichier (avec src/), pas celui de la Forme', () => {
    const rows = ideFiles({ modules: [mod('main/x.ts', { file: { id: 'm0', path: 'src/main/x.ts' } })] }, 'file');
    expect(rows.map((r) => r.path)).toEqual(['src/main/x.ts']);
    expect(ideFiles({ modules: [mod('main/x.ts', { file: { id: 'm0', path: 'src/main/x.ts' } })] }, 'module').map((r) => r.path)).toEqual(['main/x.ts']);
  });

  it('modules qui se chevauchent : un chemin, une ligne, le premier module le garde', () => {
    const dir = mod('src/main/', { touched: true, files: [f('m0/0', 'src/main/x.ts')] });
    const file = mod('src/main/x.ts', { touched: true, files: [f('m1/0', 'src/main/x.ts')] });
    expect(ideFiles({ modules: [dir, file] }, 'file').map((r) => [r.path, r.rank])).toEqual([['src/main/x.ts', 0]]);
    expect(ideFiles({ modules: [mod('a/'), mod('a/')] }, 'module').map((r) => r.rank)).toEqual([0]);
  });

  it('sans module : les fichiers de la branche, chacun un module d’un seul fichier', () => {
    const files = [{ id: 'b0', path: 'x.ts', locked: null }, { id: 'b1', path: 'y.ts', deleted: true as const, locked: 'motif' }];
    const rows = ideFiles({ modules: [], files }, 'file');
    expect(ideFiles({ modules: [], files }, 'module')).toEqual(rows);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ path: 'x.ts', rank: null, state: null, code: { files: [{ id: 'b0', path: 'x.ts' }], locked: null } });
    expect(rows[1]).toMatchObject({ path: 'y.ts', code: { files: [{ id: 'b1', path: 'y.ts', deleted: true }], locked: 'motif' } });
    expect(ideFiles({ modules: [] }, 'file')).toEqual([]);
  });
});

describe('invariantFiles', () => {
  const test = (path: string, marks: VibeTestFile['marks']) =>
    ({ id: path, path, blob: '', cases: Object.keys(marks), lines: [], source: '', reading: null, marks }) as VibeTestFile;

  it('une ligne par test : son rang, son état (tous ok : done, aucun verdict : todo, sinon wip), pas de code', () => {
    const rows = invariantFiles([test('a.test.ts', { x: 'ok', y: 'ok' }), test('b.test.ts', { x: null, y: null }), test('c.test.ts', { x: 'ok', y: null }), test('d.test.ts', { x: 'ko' })]);
    expect(rows.map((r) => [r.path, r.rank, r.state, r.code])).toEqual([
      ['a.test.ts', 0, 'done', null], ['b.test.ts', 1, 'todo', null], ['c.test.ts', 2, 'wip', null], ['d.test.ts', 3, 'wip', null],
    ]);
  });

  it('mark : son état git, lu dans les fichiers de la branche ; null : commité', () => {
    const files = [{ id: 'b0', path: 'n.test.ts', git: 'new' as const, locked: null }, { id: 'b1', path: 'm.test.ts', git: 'modified' as const, locked: null }];
    expect(invariantFiles([test('n.test.ts', {}), test('m.test.ts', {}), test('c.test.ts', {})], files).map((r) => r.mark))
      .toEqual(['new', 'modified', null]);
  });

  it('aucun test : aucune ligne', () => {
    expect(invariantFiles([])).toEqual([]);
  });
});
