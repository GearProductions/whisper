import { describe, expect, it } from 'vitest';
import { artifactTree, duplicateArgs, menuEntries, moveArgs, pasteArgs } from 'core/vibecoder';

const file = (id: string, name: string) => ({ id, name, kind: 'text' as const, size: 1, time: 0, url: null, truncated: false });
const nodes = artifactTree(
  [file('a0', 'z.md'), file('a1', 'docs/b.md'), file('a2', 'docs/sub/c.md')],
  [{ id: 'd0', name: 'docs' }, { id: 'd1', name: 'empty' }],
);   // docs/sub : dossier impliqué, sans d<i>

describe('pasteArgs', () => {
  it('copier vers un dossier : copy-artifacts, ids, dossier', () => {
    expect(pasteArgs({ mode: 'copy', keys: ['z.md', 'docs/b.md'] }, nodes, 'empty'))
      .toEqual({ action: 'copy-artifacts', args: { direct: true, artifacts: ['a1', 'a0'], folder: 'd1' } });
  });

  it('couper vers la racine : move-artifacts, sans dossier', () => {
    expect(pasteArgs({ mode: 'cut', keys: ['docs/b.md'] }, nodes, ''))
      .toEqual({ action: 'move-artifacts', args: { direct: true, artifacts: ['a1'] } });
  });

  it('un dossier pris : ses descendants ne partent pas à part', () => {
    expect(pasteArgs({ mode: 'copy', keys: ['docs', 'docs/b.md'] }, nodes, 'empty')?.args.artifacts).toEqual(['d0']);
  });

  it('les clés disparues sont ignorées ; plus rien : null', () => {
    expect(pasteArgs({ mode: 'cut', keys: ['gone.md', 'z.md'] }, nodes, 'empty')?.args.artifacts).toEqual(['a0']);
    expect(pasteArgs({ mode: 'cut', keys: ['gone.md'] }, nodes, 'empty')).toBeNull();
  });

  it('rien dans le presse-papiers : null', () => expect(pasteArgs(null, nodes, '')).toBeNull());

  it('couper un dossier dans lui-même ou sous lui : null (copier : permis)', () => {
    expect(pasteArgs({ mode: 'cut', keys: ['docs'] }, nodes, 'docs')).toBeNull();
    expect(pasteArgs({ mode: 'cut', keys: ['docs'] }, nodes, 'docs/sub')).toBeNull();
    expect(pasteArgs({ mode: 'copy', keys: ['docs'] }, nodes, 'docs')).not.toBeNull();
  });

  it('un nom qui commence pareil n’est pas dedans', () => {
    const t = artifactTree([], [{ id: 'd0', name: 'doc' }, { id: 'd1', name: 'doc2' }]);
    expect(pasteArgs({ mode: 'cut', keys: ['doc'] }, t, 'doc2')).not.toBeNull();
  });

  it('dossier cible inconnu, fichier ou sans d<i> : null, jamais la racine', () => {
    for (const f of ['nope', 'z.md', 'docs/sub']) expect(pasteArgs({ mode: 'copy', keys: ['z.md'] }, nodes, f)).toBeNull();
  });
});

describe('moveArgs', () => {
  it('le glisser-déposer : comme couper-coller', () => {
    expect(moveArgs(nodes, new Set(['z.md']), 'empty'))
      .toEqual({ action: 'move-artifacts', args: { direct: true, artifacts: ['a0'], folder: 'd1' } });
    expect(moveArgs(nodes, ['docs'], 'docs/sub')).toBeNull();
  });
});

describe('duplicateArgs', () => {
  it('duplicate-artifacts, sans dossier', () => {
    expect(duplicateArgs(nodes, ['z.md', 'docs'])).toEqual({ action: 'duplicate-artifacts', args: { direct: true, artifacts: ['d0', 'a0'] } });
  });
  it('rien de présent : null', () => expect(duplicateArgs(nodes, ['gone'])).toBeNull());
});

describe('menuEntries', () => {
  it('un artefact seul', () => {
    expect(menuEntries('item', 1, null)).toEqual(['rename', 'trash', 'copy', 'cut', 'duplicate']);
  });
  it('un dossier seul, avec un presse-papiers', () => {
    expect(menuEntries('folder', 1, { mode: 'copy', keys: ['z.md'] }))
      .toEqual(['rename', 'trash', 'copy', 'cut', 'paste', 'duplicate', 'newFile', 'newFolder']);
  });
  it('une sélection : ni renommer ni dupliquer', () => {
    expect(menuEntries('item', 3, null)).toEqual(['trash', 'copy', 'cut']);
  });
  it('le vide : nouveau, et coller s’il y a de quoi', () => {
    expect(menuEntries('blank', 0, null)).toEqual(['newFile', 'newFolder']);
    expect(menuEntries('blank', 0, { mode: 'cut', keys: ['a'] })).toEqual(['paste', 'newFile', 'newFolder']);
  });
});
