import { describe, expect, it } from 'vitest';
import { artifactTree, treeKey, visibleRows } from 'core/vibecoder';

const file = (id: string, name: string) => ({ id, name, kind: 'text' as const, size: 1, time: 0, url: null, truncated: false });
const nodes = artifactTree([file('a0', 'z.md'), file('a1', 'docs/b.md'), file('a2', 'docs/sub/c.md')], [{ id: 'd0', name: 'docs' }, { id: 'd1', name: 'empty' }]);
// docs, docs/sub, docs/sub/c.md, docs/b.md, empty, z.md
const rowsOf = (open: string[]) => visibleRows(nodes, new Set(open));
const all = new Set(['docs', 'docs/sub']);

describe('treeKey', () => {
  it('↓ ↑ bougent d’une ligne et s’arrêtent aux bords', () => {
    const rows = rowsOf(['docs']);   // docs, docs/sub, docs/b.md, empty, z.md
    expect(treeKey(rows, all, 'docs', 'ArrowDown', false)).toEqual({ focus: 'docs/sub' });
    expect(treeKey(rows, all, 'docs/sub', 'ArrowUp', false)).toEqual({ focus: 'docs' });
    expect(treeKey(rows, all, 'docs', 'ArrowUp', false)).toEqual({ focus: 'docs' });
    expect(treeKey(rows, all, 'z.md', 'ArrowDown', false)).toEqual({ focus: 'z.md' });
  });

  it('sans focus : ↓ la première ligne, ↑ la dernière', () => {
    const rows = rowsOf([]);
    expect(treeKey(rows, new Set(), null, 'ArrowDown', false)).toEqual({ focus: 'docs' });
    expect(treeKey(rows, new Set(), null, 'ArrowUp', false)).toEqual({ focus: 'z.md' });
  });

  it('Début Fin ; Maj étend', () => {
    const rows = rowsOf([]);   // docs, empty, z.md
    expect(treeKey(rows, new Set(), 'empty', 'Home', false)).toEqual({ focus: 'docs' });
    expect(treeKey(rows, new Set(), 'empty', 'End', true)).toEqual({ focus: 'z.md', extend: true });
    expect(treeKey(rows, new Set(), 'empty', 'ArrowDown', true)).toEqual({ focus: 'z.md', extend: true });
  });

  it('← plie un dossier ouvert, sans toucher l’ensemble reçu', () => {
    const rows = rowsOf(['docs']);
    const open = new Set(['docs']);
    expect(treeKey(rows, open, 'docs', 'ArrowLeft', false)).toEqual({ open: new Set() });
    expect(open.has('docs')).toBe(true);
  });

  it('← sur un fichier ou un dossier plié remonte au parent ; à la racine : null', () => {
    const rows = rowsOf(['docs']);
    expect(treeKey(rows, new Set(['docs']), 'docs/b.md', 'ArrowLeft', false)).toEqual({ focus: 'docs' });
    expect(treeKey(rows, new Set(['docs']), 'docs/sub', 'ArrowLeft', false)).toEqual({ focus: 'docs' });
    expect(treeKey(rows, new Set(['docs']), 'z.md', 'ArrowLeft', false)).toBeNull();
    expect(treeKey(rows, new Set(), 'empty', 'ArrowLeft', false)).toBeNull();
  });

  it('→ déplie un dossier plié, descend au premier enfant d’un ouvert, rien sur un fichier', () => {
    expect(treeKey(rowsOf([]), new Set(), 'docs', 'ArrowRight', false)).toEqual({ open: new Set(['docs']) });
    expect(treeKey(rowsOf(['docs']), new Set(['docs']), 'docs', 'ArrowRight', false)).toEqual({ focus: 'docs/sub' });
    expect(treeKey(rowsOf(['docs']), new Set(['docs']), 'z.md', 'ArrowRight', false)).toBeNull();
  });

  it('→ sur un dossier ouvert et vide : null', () => {
    expect(treeKey(rowsOf(['empty']), new Set(['empty']), 'empty', 'ArrowRight', false)).toBeNull();
  });

  it('F2 renomme, Suppr supprime, s’il y a une ligne active', () => {
    const rows = rowsOf([]);
    expect(treeKey(rows, new Set(), 'z.md', 'F2', false)).toEqual({ command: 'rename' });
    expect(treeKey(rows, new Set(), 'z.md', 'Delete', false)).toEqual({ command: 'trash' });
    expect(treeKey(rows, new Set(), null, 'F2', false)).toBeNull();
    expect(treeKey(rows, new Set(), 'absent', 'Delete', false)).toBeNull();
  });

  it('une autre touche : null', () => {
    expect(treeKey(rowsOf([]), new Set(), 'z.md', 'a', false)).toBeNull();
    expect(treeKey(rowsOf([]), new Set(), 'z.md', 'Enter', false)).toBeNull();
  });
});
