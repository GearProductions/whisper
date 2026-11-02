import { describe, expect, it } from 'vitest';
import { artifactResult, artifactTree, idsOf, nameProblem, visibleRows } from 'core/vibecoder';

const file = (id: string, name: string) => ({ id, name, kind: 'text' as const, size: 1, time: 0, url: null, truncated: false });
const arts = [file('a0', 'z.md'), file('a1', 'docs/b.md'), file('a2', 'docs/sub/c.md'), file('a3', 'a.md')];
const dirs = [{ id: 'd0', name: 'docs' }, { id: 'd1', name: 'empty' }];
const tree = artifactTree(arts, dirs);

describe('artifactTree', () => {
  it('dossiers d’abord, puis fichiers, par nom, chaque dossier suivi de son contenu', () => {
    expect(tree.map((n) => n.key)).toEqual(['docs', 'docs/sub', 'docs/sub/c.md', 'docs/b.md', 'empty', 'a.md', 'z.md']);
  });

  it('label, profondeur, parent, id, artefact', () => {
    const c = tree.find((n) => n.key === 'docs/sub/c.md')!;
    expect([c.label, c.depth, c.parent, c.id, c.folder, c.artifact?.id]).toEqual(['c.md', 2, 'docs/sub', 'a2', false, 'a2']);
    expect(tree[0]).toMatchObject({ label: 'docs', depth: 0, parent: '', id: 'd0', folder: true });
  });

  it('un dossier impliqué par un chemin, sans d<i> : id vide', () => {
    expect(tree.find((n) => n.key === 'docs/sub')).toMatchObject({ id: '', folder: true });
  });

  it('un dossier vide figure', () => {
    expect(tree.find((n) => n.key === 'empty')).toMatchObject({ id: 'd1', folder: true });
  });

  it('rien : rien', () => expect(artifactTree([], [])).toEqual([]));
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

describe('idsOf', () => {
  it('les présents seulement, dans l’ordre de l’arbre', () => {
    expect(idsOf(tree, ['z.md', 'nope', 'a.md'])).toEqual(['a.md', 'z.md'].map((k) => tree.find((n) => n.key === k)!.id));
  });

  it('sans un enfant d’un dossier déjà pris, même profond', () => {
    expect(idsOf(tree, ['docs/sub/c.md', 'docs', 'docs/b.md'])).toEqual(['d0']);
  });

  it('un dossier sans id ne prend rien, ses enfants restent', () => {
    expect(idsOf(tree, ['docs/sub', 'docs/sub/c.md'])).toEqual(['a2']);
  });
});

describe('nameProblem', () => {
  it('un nom valable : null', () => expect(nameProblem('plan.md', ['a.md'], false)).toBeNull());
  it('vide', () => expect(nameProblem('', [], false)).toBe('empty'));
  it('. et ..', () => expect([nameProblem('.', [], true), nameProblem('..', [], false)]).toEqual(['dots', 'dots']));
  it('séparateur : / \\ NUL', () => {
    expect(['a/b', 'a\\b', 'a\0b'].map((n) => nameProblem(n, [], false))).toEqual(['separator', 'separator', 'separator']);
  });
  it('un dossier caché (F-95) ; un fichier .env passe', () => {
    expect(nameProblem('.git', [], true)).toBe('hidden');
    expect(nameProblem('.env', [], false)).toBeNull();
  });
  it('plus de 255 octets UTF-8 (pas de caractères)', () => {
    expect(nameProblem('a'.repeat(255), [], false)).toBeNull();
    expect(nameProblem('a'.repeat(256), [], false)).toBe('long');
    expect(nameProblem('é'.repeat(128), [], false)).toBe('long');
  });
  it('noms portables : caractères de Windows, contrôle, fin, noms réservés', () => {
    for (const n of ['a:b', 'a*', 'a?', 'a"b', '<a>', 'a|b', 'a\x01', 'a ', 'a.', 'con', 'NUL', 'Aux.txt', 'lpt9.md'])
      expect(nameProblem(n, [], false)).toBe('windows');
    for (const n of ['a b', 'console', 'com10', 'x.con']) expect(nameProblem(n, [], false)).toBeNull();
  });
  it('pris d’après le relevé', () => expect(nameProblem('a.md', ['a.md'], false)).toBe('taken'));
});

describe('artifactResult', () => {
  const res = (ok: boolean, line: string, time: number) => ({ ok, line, detail: '', time });
  const action = (id: string, last: ReturnType<typeof res> | null, running = false) => ({ id, direct: { running, last } });

  it('la plus récente des actions du panneau, dépôt compris ; les autres actions ne comptent pas', () => {
    const r = artifactResult([
      action('rename-artifact', res(false, 'Refused: "b.md" already exists.', 20)),
      action('add-artifact', res(true, 'Added 1.', 10)),
      action('commit', res(true, 'Committed.', 30)),
    ]);
    expect(r).toEqual({ running: false, last: res(false, 'Refused: "b.md" already exists.', 20) });
  });

  it('une qui tourne ; rien encore : pas de ligne', () => {
    expect(artifactResult([action('move-artifacts', null, true), { id: 'trash-artifacts' }])).toEqual({ running: true, last: null });
  });
});
