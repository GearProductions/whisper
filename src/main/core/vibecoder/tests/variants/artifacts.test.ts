import { describe, expect, it } from 'vitest';
import { artifactKind, artifactList, artifactOf, artifactType } from 'core/vibecoder';
import type { VibeView } from 'shared/bridge';

describe('artifactKind, artifactType', () => {
  it('d’après l’extension, sans casse', () => {
    expect(artifactKind('notes.md')).toBe('markdown');
    expect(artifactKind('maquettes/accueil.HTML')).toBe('page');
    expect(artifactKind('schema.svg')).toBe('page');
    expect(artifactKind('capture.png')).toBe('media');
    expect(artifactKind('doc.pdf')).toBe('media');
    expect(artifactKind('clip.mov')).toBe('media');
  });

  it('tout autre, sans extension, binaire ou nom piège : du texte', () => {
    for (const n of ['data.json', 'Makefile', '.md', 'a.bin', 'x.constructor', 'dossier.md/fichier'])
      expect(artifactKind(n)).toBe('text');
  });

  it('le type MIME d’un page ou media ; octet-stream sinon', () => {
    expect(artifactType('a.html')).toBe('text/html');
    expect(artifactType('a.svg')).toBe('image/svg+xml');
    expect(artifactType('a.JPG')).toBe('image/jpeg');
    expect(artifactType('a.pdf')).toBe('application/pdf');
    expect(artifactType('a.md')).toBe('application/octet-stream');
    expect(artifactType('a.toString')).toBe('application/octet-stream');
  });
});

describe('artifactList', () => {
  const list = artifactList('ag', [
    { name: 'z.md', size: 20, time: 1 },
    { name: 'b/plan.html', size: 99, time: 2 },
    { name: 'a.bin', size: 5, time: 3 },
    { name: 'img.png', size: 99, time: 4 },
  ], 10);

  it('triés par nom, ids a<i> dans cet ordre', () => {
    expect(list.map((a) => [a.id, a.name])).toEqual([['a0', 'a.bin'], ['a1', 'b/plan.html'], ['a2', 'img.png'], ['a3', 'z.md']]);
  });

  it('url pour page et media, null pour le texte ; truncated : du texte au-delà de max', () => {
    expect(list.map((a) => [a.url, a.truncated])).toEqual([
      [null, false],
      ['vibe-artifact://ag/a1?t=2', false],
      ['vibe-artifact://ag/a2?t=4', false],
      [null, true],
    ]);
  });
});

describe('artifactOf', () => {
  const view = { artifacts: artifactList('ag', [{ name: 'notes.md', size: 1, time: 1 }], 10) } as VibeView;

  it('l’artefact de l’id du relevé ; jamais l’id lu comme un chemin', () => {
    expect(artifactOf(view, 'a0')?.name).toBe('notes.md');
    expect(artifactOf(view, 'notes.md')).toBeNull();
    expect(artifactOf(view, '../commit.md')).toBeNull();
    expect(artifactOf(view, 'a1')).toBeNull();
    expect(artifactOf(null, 'a0')).toBeNull();
  });
});
