import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { addedLine, artifactKind, artifactList, artifactOf, artifactType, droppedPaths, failedLine, folderKey, leftEntries, legacyOwner, projectFolder, ARTIFACTS_ROOT } from 'core/vibecoder';
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

// Un disque factice aux chemins POSIX : sous Windows, path.resolve les ferait partir de D:\.
describe.skipIf(process.platform === 'win32')('folderKey', () => {
  // Un disque factice : /var/home existe, /home y mène, les dossiers de worktree sont partis.
  const links: Record<string, string> = { '/home': '/var/home' };
  const exists = new Set(['/', '/var', '/var/home', '/var/home/u', '/var/home/u/out']);
  const realpath = (p: string) => {
    const hit = Object.keys(links).find((l) => p === l || p.startsWith(`${l}/`));
    const r = hit ? links[hit] + p.slice(hit.length) : p;
    if (!exists.has(r)) throw new Error('ENOENT');
    return r;
  };

  it('un dossier qui existe : résolu', () => {
    expect(folderKey('/home/u/out', realpath)).toBe('/var/home/u/out');
  });

  it('un dossier parti : le début existant résolu, plus la suite', () => {
    expect(folderKey('/home/u/out/wt/agent', realpath)).toBe('/var/home/u/out/wt/agent');
  });

  it('deux dossiers différents : deux clés, même un parti et un voisin qui partage un préfixe', () => {
    const keys = ['/home/u/out/wt', '/home/u/out/wt2', '/var/home/u/out/w', '/home/u/out'].map((d) => folderKey(d, realpath));
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('rien n’existe : le chemin tel quel', () => {
    expect(folderKey('/a/b', () => { throw new Error('ENOENT'); })).toBe('/a/b');
  });
});

describe('droppedPaths', () => {
  it('un chemin refusé (relatif, NUL, `..`, la racine, pas un texte) est compté, sans chemin', () => {
    expect(droppedPaths(['/a/b', 'a/b', '/a\0b', '/a/../b', '/', 3, ''])).toEqual({ paths: [path.resolve('/a/b')], noPath: 6 });
  });
});

describe('addedLine', () => {
  const empty = { copied: [], links: [], hidden: [], failed: [], noPath: 0 };

  it('les ajoutés', () => {
    expect(addedLine({ ...empty, copied: ['/r/a'] }, 'fr')).toBe('1 ajouté.');
    expect(addedLine({ ...empty, copied: ['/r/a', '/r/b'] }, 'fr')).toBe('2 ajoutés.');
    expect(addedLine({ ...empty, copied: ['/r/a', '/r/b'] }, 'en')).toBe('2 added.');
  });

  it('les liens, les dossiers cachés, les sans chemin et les échecs, dans cet ordre', () => {
    const r = { copied: ['/r/a'], links: ['/x/lien'], hidden: ['/x/.git'], noPath: 2, failed: [{ path: '/x/f', error: 'EACCES' }] };

    const fr = addedLine(r, 'fr');
    const en = addedLine(r, 'en');

    expect(fr).toBe('1 ajouté. Lien non suivi : lien. Dossier caché passé : .git. 2 fichiers sans chemin sur le disque : déposez-les depuis le gestionnaire de fichiers. 1 échec : f. Première erreur : EACCES');
    expect(en).toBe('1 added. Link not followed: lien. Hidden folder skipped: .git. 2 files without a path on disk: drop them from the file manager. 1 failed: f. First error: EACCES');
  });

  it('au plus quelques noms', () => {
    const links = ['/x/a', '/x/b', '/x/c', '/x/d', '/x/e'];

    expect(addedLine({ ...empty, links }, 'en')).toContain('Links not followed: a, b, c, ….');
  });
});

describe('failedLine', () => {
  it('des artefacts restés sur le disque, au singulier et au pluriel', () => {
    expect(failedLine(1, 'fr')).toBe('1 artefact resté sur le disque.');
    expect(failedLine(3, 'fr')).toBe('3 artefacts restés sur le disque.');
    expect(failedLine(1, 'en')).toBe('1 artifact left on disk.');
    expect(failedLine(3, 'en')).toBe('3 artifacts left on disk.');
  });
});

describe('projectFolder', () => {
  it('16 hexa, stable', () => {
    expect(projectFolder('/a/.git')).toMatch(/^[0-9a-f]{16}$/);
    expect(projectFolder('/a/.git')).toBe(projectFolder('/a/.git'));
  });
  it('la racine', () => expect(ARTIFACTS_ROOT).toBe('vibecoder-artifacts'));
});

describe('legacyOwner', () => {
  const agents = [{ id: 'a1', dir: '/config/a1' }];
  it('la config d\'abord, puis left, sinon null', () => {
    expect(legacyOwner('a1', agents, { a1: '/left/a1' })).toBe('/config/a1');
    expect(legacyOwner('a2', agents, { a2: '/left/a2' })).toBe('/left/a2');
    expect(legacyOwner('a3', agents, { a2: '/left/a2' })).toBeNull();
  });
  it('un id comme `constructor` n\'est pas dans left', () => expect(legacyOwner('constructor', [], {})).toBeNull());
});

describe('leftEntries', () => {
  it('lit les chaînes, écarte le reste, ne lève jamais', () => {
    expect(leftEntries('{"a":"/x","b":3,"c":null}')).toEqual({ a: '/x' });
    for (const bad of [null, '', '{', '[]', '"x"', 'null', '3']) expect(leftEntries(bad)).toEqual({});
  });
});
