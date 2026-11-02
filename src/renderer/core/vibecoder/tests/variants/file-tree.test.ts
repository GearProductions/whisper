import { describe, expect, it } from 'vitest';
import { fileTree, visibleRows } from 'core/vibecoder';

const tree = fileTree(['z.md', 'docs/b.md', 'docs/sub/c.md', 'a.md'], ['docs', 'empty']);

describe('fileTree', () => {
  it('dossiers d’abord, puis fichiers, par nom, chaque dossier suivi de son contenu', () => {
    expect(tree.map((n) => n.key)).toEqual(['docs', 'docs/sub', 'docs/sub/c.md', 'docs/b.md', 'empty', 'a.md', 'z.md']);
  });

  it('les dossiers sont impliqués par les chemins ; dirs ajoute les vides', () => {
    expect(fileTree(['a/b/c.md']).map((n) => [n.key, n.folder])).toEqual([['a', true], ['a/b', true], ['a/b/c.md', false]]);
    expect(tree.find((n) => n.key === 'empty')).toMatchObject({ folder: true });
  });

  it('label, profondeur, parent', () => {
    expect(tree.find((n) => n.key === 'docs/sub/c.md')).toEqual({ key: 'docs/sub/c.md', label: 'c.md', folder: false, depth: 2, parent: 'docs/sub' });
    expect(tree[0]).toEqual({ key: 'docs', label: 'docs', folder: true, depth: 0, parent: '' });
  });

  it('un chemin fini par / : une feuille, son label garde le /', () => {
    const t = fileTree(['src/lib/', 'src/a.ts']);
    expect(t.map((n) => n.key)).toEqual(['src', 'src/a.ts', 'src/lib/']);
    expect(t[2]).toEqual({ key: 'src/lib/', label: 'lib/', folder: false, depth: 1, parent: 'src' });
  });

  it('doublons : un seul nœud ; rien : rien', () => {
    expect(fileTree(['a.md', 'a.md'], []).length).toBe(1);
    expect(fileTree([])).toEqual([]);
  });
});

describe('visibleRows', () => {
  it('tout plié : la racine seule', () => {
    expect(visibleRows(tree, new Set()).map((n) => n.key)).toEqual(['docs', 'empty', 'a.md', 'z.md']);
  });

  it('un dossier déplié montre ses enfants, pas ceux d’un sous-dossier plié', () => {
    expect(visibleRows(tree, new Set(['docs'])).map((n) => n.key)).toEqual(['docs', 'docs/sub', 'docs/b.md', 'empty', 'a.md', 'z.md']);
  });

  it('sous-dossier déplié sous un parent plié : caché', () => {
    expect(visibleRows(tree, new Set(['docs/sub'])).map((n) => n.key)).toEqual(['docs', 'empty', 'a.md', 'z.md']);
  });

  it('tout déplié : tout', () => {
    expect(visibleRows(tree, new Set(['docs', 'docs/sub']))).toEqual(tree);
  });
});
