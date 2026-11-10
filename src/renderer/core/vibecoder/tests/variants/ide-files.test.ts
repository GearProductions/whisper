import { describe, expect, it } from 'vitest';
import { ideFiles, invariantTree, moduleState } from 'core/vibecoder';
import type { VibeModule, VibeTestFile } from 'technicals/bridge';

const mod = (path: string, o: Partial<VibeModule> = {}): VibeModule => ({ path, paths: [path], contract: '', file: null, touched: false, commits: [], ...o });
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

describe('ideFiles : une entrée de la Forme à plusieurs chemins (« a + b »)', () => {
  const paths = ['docs/icone.png', 'docs/dictee.png'];
  const multi = mod(paths.join(' + '), { paths });

  it('by module (Forme) : une ligne par chemin, au rang de l’entrée, jamais un chemin qui contient « + »', () => {
    expect(ideFiles({ modules: [multi, todo] }, 'module').map((r) => [r.path, r.rank])).toEqual([
      ['docs/icone.png', 0], ['docs/dictee.png', 0], ['c.ts', 1],
    ]);
  });

  it('by file (Modules), pas encore touchée : une ligne par chemin aussi', () => {
    expect(ideFiles({ modules: [multi] }, 'file').map((r) => r.path)).toEqual(['docs/icone.png', 'docs/dictee.png']);
  });

  it('by file, pas encore touchée mais un de ses chemins existe déjà (file : le premier trouvé) : tous ses chemins, pas ce seul fichier', () => {
    const real = mod(paths.join(' + '), { paths, file: { id: 'm0', path: 'docs/icone.png' } });
    expect(ideFiles({ modules: [real] }, 'file').map((r) => [r.path, r.rank])).toEqual([['docs/icone.png', 0], ['docs/dictee.png', 0]]);
  });
});

describe('ideFiles : les variants de la branche (Modules)', () => {
  const branch = [
    { id: 'b0', path: 'b.ts', locked: null },
    { id: 'b1', path: 'tests/variants/b.test.ts', git: 'new' as const, locked: 'motif' },
    { id: 'b2', path: 'README.md', git: 'modified' as const, locked: null },
  ];
  const variants = [{ id: 'v0', path: 'tests/variants/b.test.ts', cases: 3 }];

  it('un variant de la branche s’ajoute après les fichiers des modules, rank null, sa couleur git', () => {
    const rows = ideFiles({ modules, files: branch, variants }, 'file');
    expect(rows.map((r) => [r.path, r.rank, r.mark])).toEqual([
      ['a/x.ts', 0, null], ['a/y.ts', 0, 'deleted'], ['b.ts', 1, null], ['c.ts', 2, 'todo'], ['tests/variants/b.test.ts', null, 'new'],
    ]);
    expect(rows[4]).toMatchObject({ state: null, code: { files: [{ id: 'b1', path: 'tests/variants/b.test.ts' }], locked: 'motif' } });
  });

  it('un variant déjà fichier d’un module n’a qu’une ligne', () => {
    const t = mod('tests/', { touched: true, files: [f('m0/0', 'tests/variants/b.test.ts')] });
    expect(ideFiles({ modules: [t], files: branch, variants }, 'file').map((r) => [r.path, r.rank])).toEqual([['tests/variants/b.test.ts', 0]]);
  });

  it('un fichier de la branche qui n’est pas un variant ne s’ajoute pas', () => {
    expect(ideFiles({ modules, files: branch, variants }, 'file').map((r) => r.path)).not.toContain('README.md');
  });

  it('by module (Forme) : aucun variant ajouté', () => {
    expect(ideFiles({ modules, files: branch, variants }, 'module').map((r) => r.path)).toEqual(['a/', 'b.ts', 'c.ts']);
  });
});

describe('invariantTree', () => {
  const test = (path: string, o: Partial<VibeTestFile> = {}) =>
    ({ id: path, path, blob: '', cases: ['x'], lines: [], source: 'v2', base: 'v1', reading: null, marks: { x: null }, ...o }) as VibeTestFile;
  const file = (path: string) => ({ id: path, path, git: 'new' as const, locked: null });

  it('sans module, des fichiers changés par la branche : les tests seuls', () => {
    const rows = invariantTree({ modules: [], files: [file('src/a.ts'), file('a.test.ts')], invariants: [test('a.test.ts')] });
    expect(rows.map((r) => r.path)).toEqual(['a.test.ts']);
  });

  it('sans module ni test : aucune ligne', () => {
    expect(invariantTree({ modules: [], files: [file('a.ts')], invariants: [] })).toEqual([]);
  });

  it('avec Forme : ses fichiers dim, rank et code comme à l’étape Forme (pas touché : code null)', () => {
    const view = { modules, files: [], invariants: [] };
    expect(invariantTree(view)).toEqual(ideFiles(view, 'module').map((r) => ({ ...r, dim: true })));
    expect(invariantTree(view).map((r) => [r.rank, r.code === null])).toEqual([[0, false], [1, false], [2, true]]);
  });

  it('les tests : sans rank, leur test (rang dans view.invariants), pas dim, code null, état comme avant', () => {
    const rows = invariantTree({ modules: [todo], files: [], invariants: [test('a.test.ts', { marks: { x: 'ok' }, base: 'v2' }), test('b.test.ts', { base: 'v2' })] });
    expect(rows.slice(1)).toEqual([
      { path: 'a.test.ts', rank: null, state: 'done', mark: null, code: null, test: 0 },
      { path: 'b.test.ts', rank: null, state: 'todo', mark: null, code: null, test: 1 },
    ]);
    expect(rows[0]).toMatchObject({ path: 'c.ts', dim: true });
    expect(rows.slice(1).every((r) => !r.dim)).toBe(true);
  });

  it('base absente : new ; base différente : modified ; égale : null, commité ou non ; base inconnue : aucune couleur', () => {
    const rows = invariantTree({
      modules: [],
      files: [file('same.test.ts')],   // non commité, mais texte inchangé
      invariants: [test('none.test.ts', { base: null }), test('unknown.test.ts', { base: undefined }), test('diff.test.ts'), test('same.test.ts', { base: 'v2' })],
    });
    expect(rows.map((r) => [r.path, r.mark])).toEqual([['none.test.ts', 'new'], ['unknown.test.ts', null], ['diff.test.ts', 'modified'], ['same.test.ts', null]]);
  });

  it('une base vide (fichier vide à la base) n’est pas une base absente', () => {
    expect(invariantTree({ modules: [], files: [], invariants: [test('e.test.ts', { base: '' })] })[0].mark).toBe('modified');
  });

  it('un test qui est aussi un chemin de la Forme : une seule ligne, le test', () => {
    const rows = invariantTree({ modules: [mod('a.test.ts'), mod('b.ts')], files: [], invariants: [test('a.test.ts')] });
    expect(rows.map((r) => [r.path, r.test, r.dim, r.rank])).toEqual([['b.ts', undefined, true, 1], ['a.test.ts', 0, undefined, null]]);
  });
});
