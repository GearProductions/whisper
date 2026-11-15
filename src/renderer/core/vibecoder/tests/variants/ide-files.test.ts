import { describe, expect, it } from 'vitest';
import { checkMark, crumbCheck, waitingFor, diffRefs, diffTree, formeText, inForme, goneModule, ideFiles, invariantTree, moduleState } from 'core/vibecoder';
import type { IdeFile } from 'core/vibecoder';
import type { VibeDiffs, VibeModule, VibeStep, VibeStepCheck, VibeTestFile } from 'technicals/bridge';

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

describe('diffRefs', () => {
  const step = (check?: VibeStepCheck) => ({ steps: [{ id: 'forme', status: 'done', facts: '', ...(check && { check }) }] as VibeStep[] });

  it('sans validation : base et head', () => {
    expect(diffRefs(step(), 'forme')).toEqual(['base', 'head']);
    expect(diffRefs(step({ state: null, now: 'x' }), 'forme')).toEqual(['base', 'head']);
  });

  it('avec une validation (ok, changed, cascade) : les trois', () => {
    for (const state of ['ok', 'changed', 'cascade'] as const) expect(diffRefs(step({ state, now: null }), 'forme')).toEqual(['base', 'head', 'validated']);
  });

  it('étape absente de view.steps : base et head', () => {
    expect(diffRefs(step({ state: 'ok', now: null }), 'modules')).toEqual(['base', 'head']);
  });
});

describe('diffTree', () => {
  const file = (path: string): IdeFile => ({ path, rank: null, state: null, mark: null, code: null });
  const files = [file('a.ts'), file('b.ts'), file('c.ts')];
  const diffs: VibeDiffs = {
    head: [{ path: 'b.ts' }, { path: 'gone.ts', id: 'r0', deleted: true }],
    validated: { forme: [{ path: 'a.ts' }, { path: 'c.ts', added: true }] },
  };

  it.each([
    ['base : tous', 'forme', 'base', ['a.ts', 'b.ts', 'c.ts']],
    ['head : les seuls modifiés, un supprimé ajouté', 'forme', 'head', ['b.ts', 'gone.ts']],
    ['validated : ceux de l’étape', 'forme', 'validated', ['a.ts', 'c.ts']],
    ['validated : étape absente de diffs.validated', 'modules', 'validated', []],
  ] as const)('%s', (_, step, ref, paths) => {
    expect(diffTree(files, { diffs }, step, ref).map((r) => r.path)).toEqual(paths);
  });

  it('un supprimé absent de files : ajouté en « supprimé », son id dans gone, en retrait (pas de l’étape)', () => {
    expect(diffTree(files, { diffs }, 'forme', 'head')[1]).toEqual({ path: 'gone.ts', rank: null, state: null, mark: 'deleted', code: null, gone: 'r0', dim: true, hint: 'Modifié, mais non déclaré dans la Forme' });
  });

  it('base sans fichier de la branche : files tels quels', () => {
    expect(diffTree(files, { diffs }, 'forme', 'base')).toBe(files);
  });

  // view.files : ce que git dit changé depuis la base (diff et status), supprimés compris, ids b<i>.
  const branchFiles = [
    { id: 'b0', path: 'a.ts', git: 'modified' as const, locked: null }, { id: 'b1', path: 'd/gone.ts', deleted: true as const, locked: null },
    { id: 'b2', path: 'mod/in.ts', locked: null }, { id: 'b3', path: 'other.ts', git: 'modified' as const, locked: null },
  ];
  const withMod = [...files, { ...file('mod/'), rank: 0 }];

  it('base : files, puis ce que la branche change hors de files (supprimés compris), par chemin ; un chemin sous un dossier de files : couvert', () => {
    const out = diffTree(withMod, { diffs, files: branchFiles }, 'forme', 'base');
    expect(out.map((r) => [r.path, r.mark, !!r.dim])).toEqual([['a.ts', null, false], ['b.ts', null, false], ['c.ts', null, false], ['mod/', null, false], ['d/gone.ts', 'deleted', true], ['other.ts', 'modified', true]]);
    expect(out[4].code?.files?.[0]).toMatchObject({ id: 'b1', deleted: true });
  });

  it('un ajouté que la Forme nomme quelque part (un variant, sans son src/) : en clair ; sinon, en retrait avec son infobulle', () => {
    const note = { text: '# T\n\n## Forme\n\nmod/x.ts  le module\n    variants : other.ts\n\n## Après\n\nd/gone.ts hors de la Forme\n' };
    const out = diffTree(withMod, { diffs, files: branchFiles, note }, 'forme', 'base');
    expect(out.slice(4).map((r) => [r.path, !!r.dim, r.hint])).toEqual([['d/gone.ts', true, 'Modifié, mais non déclaré dans la Forme'], ['other.ts', false, undefined]]);
    expect(diffTree(withMod, { diffs, files: branchFiles, note, lang: 'en' }, 'forme', 'base')[4].hint).toBe('Changed, but not declared in the forme');
    expect(formeText('pas de forme')).toBe('');
    expect(inForme('src : main/core/x.ts', 'src/main/core/x.ts')).toBe(true);
  });

  it('formeText : « Shape » et « Form » comme « Forme » ; un « ## » dans un bloc de code ne coupe pas la section', () => {
    expect(formeText('# T\n\n## Shape\n\na.ts\n\n## After\n\nb.ts\n')).toContain('a.ts');
    expect(formeText('# T\n\n## Shape\n\na.ts\n\n## After\n\nb.ts\n')).not.toContain('b.ts');
    expect(formeText('## Form\n\nx.ts\n')).toContain('x.ts');
    expect(formeText('## Forme\n\n```\n## pas un titre\nc.ts\n```\n\nd.ts\n\n## Suite\n\ne.ts\n')).toMatch(/c\.ts[\s\S]*d\.ts/);
    expect(formeText('## Forme\n\n```\n## pas un titre\nc.ts\n```\n\nd.ts\n\n## Suite\n\ne.ts\n')).not.toContain('e.ts');
  });

  it('head et validated : une ligne de dossier couvre les fichiers dessous (elle reste, ils ne sortent pas en grisé)', () => {
    const d: VibeDiffs = { head: [{ path: 'mod/in.ts' }], validated: { forme: [{ path: 'mod/in.ts' }] } };
    for (const ref of ['head', 'validated'] as const) {
      const out = diffTree(withMod, { diffs: d, files: branchFiles }, 'forme', ref);
      expect(out.map((r) => [r.path, !!r.dim])).toEqual([['mod/', false]]);
    }
  });

  it('validated : la note, retenue par la Forme, sort en clair (jamais « non déclaré dans la Forme »), un autre fichier hors de la Forme en retrait', () => {
    const note = { path: 'docs/n.md', text: '# T\n\n## Forme\n\na.ts\n' };
    const d: VibeDiffs = { head: [], validated: { forme: [{ path: 'docs/n.md' }, { path: 'other.ts' }] } };
    const all = [{ id: 'b0', path: 'docs/n.md', git: 'modified' as const, locked: null }, ...branchFiles];
    const out = diffTree(files, { diffs: d, files: all, note }, 'forme', 'validated');
    expect(out.map((r) => [r.path, !!r.dim])).toEqual([['docs/n.md', false], ['other.ts', true]]);
  });

  it('head : un modifié hors de files listé comme fichier de la branche (git status, sans autre règle)', () => {
    const d: VibeDiffs = { head: [{ path: 'b.ts' }, { path: 'other.ts' }, { path: 'd/gone.ts', deleted: true }], validated: {} };
    const out = diffTree(files, { diffs: d, files: branchFiles }, 'forme', 'head');
    expect(out.map((r) => [r.path, r.mark, r.code?.files?.[0].id])).toEqual([['b.ts', null, undefined], ['d/gone.ts', 'deleted', 'b1'], ['other.ts', 'modified', 'b3']]);
  });

  it('un supprimé déjà dans files : la ligne de files, sans gone, une seule fois', () => {
    const row = { ...file('b.ts'), mark: 'deleted' as const };
    const out = diffTree([file('a.ts'), row], { diffs: { head: [{ path: 'b.ts', id: 'r1', deleted: true }], validated: {} } }, 'forme', 'head');
    expect(out).toEqual([row]);
  });

  it('les ajoutés suivent files, rangés par chemin', () => {
    const d: VibeDiffs = { head: [{ path: 'z.ts', id: 'r0', deleted: true }, { path: 'a.ts' }, { path: 'm.ts', id: 'r1', deleted: true }], validated: {} };
    expect(diffTree(files, { diffs: d }, 'forme', 'head').map((r) => r.path)).toEqual(['a.ts', 'm.ts', 'z.ts']);
  });

  it('un fichier de files à l’identique de sa référence : absent ; view.diffs absent : rien', () => {
    expect(diffTree(files, {}, 'forme', 'head')).toEqual([]);
    expect(diffTree(files, {}, 'forme', 'validated')).toEqual([]);
    expect(diffTree(files, {}, 'forme', 'base')).toEqual(files);
  });
});

describe('checkMark et goneModule : la validation d\'une étape pour MarkControl, un supprimé en module', () => {
  it.each([
    ['cochée', { state: 'ok', now: 'h' }, 'ok'],
    ['modifiée depuis la validation', { state: 'changed', now: 'h' }, 'changed'],
    ['en cascade', { state: 'cascade', cause: 'note', now: null }, 'changed'],
    ['jamais validée', { state: null, now: 'h' }, null],
    ['sans check', undefined, null],
  ] as [string, VibeStepCheck | undefined, string | null][])('%s', (_, check, mark) => {
    expect(checkMark(check)).toBe(mark);
  });

  it('un supprimé : un module d\'un seul fichier, supprimé, suivi par son id r<i>', () => {
    expect(goneModule({ path: 'src/x.ts', gone: 'r0' })).toMatchObject({ path: 'src/x.ts', files: [{ id: 'r0', path: 'src/x.ts', deleted: true }] });
  });
});

describe('crumbCheck', () => {
  it('validée : ok ; modifiée ou en cascade : warn ; jamais validée : none ; sans validation (Revue, PR) : null', () => {
    const c = (state: VibeStepCheck['state']) => ({ check: { state, now: null } });
    expect([crumbCheck(c('ok')), crumbCheck(c('changed')), crumbCheck(c('cascade')), crumbCheck(c(null)), crumbCheck({})]).toEqual(['ok', 'warn', 'warn', 'none', null]);
  });
});

describe('waitingFor', () => {
  const st = (id: string, state: VibeStepCheck['state'] | 'none') => ({ id, ...(state !== 'none' && { check: { state, now: null } }) }) as Pick<VibeStep, 'id' | 'check'>;
  it('l\'étape d\'avant pas validée : elle ; validée, la note, ou une étape sans validation : null', () => {
    const steps = [st('note', 'changed'), st('forme', 'ok'), st('invariants', null), st('modules', null), st('revue', 'none')];
    expect(['note', 'forme', 'invariants', 'modules', 'revue'].map((id) => waitingFor(steps, id as VibeStep['id']))).toEqual([null, 'note', null, 'invariants', null]);
  });
});

describe('les squelettes à générer', () => {
  it('un module dont tous les fichiers sont squelette : todo ; by file, le fichier squelette : todo, en retrait, son infobulle', () => {
    const skel = mod('s.ts', { touched: true, skeleton: true, files: [{ id: 'm0/0', path: 's.ts', skeleton: true }] });
    const gen = mod('g.ts', { touched: true, files: [{ id: 'm1/0', path: 'g.ts', git: 'new' }] });
    expect([moduleState(skel), moduleState(gen)]).toEqual(['todo', 'wip']);
    const rows = ideFiles({ modules: [skel, gen] }, 'file', 'à générer');
    expect(rows.map((r) => [r.path, r.mark, !!r.dim, r.hint])).toEqual([['s.ts', 'todo', true, 'à générer'], ['g.ts', 'new', false, undefined]]);
  });
});
