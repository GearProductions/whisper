// Ouvrir un commit du relevé, ou l'un de ses fichiers : par un id, jamais un chemin.
// Les cas d'itemPath, d'isOutputName et de codeFile venus de invariants/files.test.ts
// (leur relevé à eux, dans le bloc du bas) : la forme des numéros, par rôle.
import { describe, expect, it } from 'vitest';
import type { VibeView } from 'shared/bridge';
import type { Stats } from 'node:fs';
import path from 'node:path';
import { codeFile, commitFile, isOutputName, itemCommit, itemPath, noLinkPath } from 'core/vibecoder';

const C0 = '9fceb02d0ae598e95dc970b74767f19372d61af8';
const C1 = 'e83c5163316f89bfbde7d9ab23ca2e25604af290';
const view = {
  note: null, invariants: [], variants: [], modules: [],
  commits: [{ hash: C0, subject: 'a', fixup: false, files: ['src/a.ts', 'src/b.ts'] }, { hash: C1, subject: 'b', fixup: false, files: [] }],
} as unknown as VibeView;

describe('itemCommit : c<rang>, gh:c<rang>', () => {
  it('c1 : le diff du commit de ce rang', () => {
    expect(itemCommit(view, 'c1')).toEqual({ hash: C1, web: false });
  });

  it('gh:c0 : sa page GitHub', () => {
    expect(itemCommit(view, 'gh:c0')).toEqual({ hash: C0, web: true });
  });

  it('un rang absent, un hash, un autre id : rien', () => {
    expect([itemCommit(view, 'c2'), itemCommit(view, C0), itemCommit(view, 'n'), itemCommit(view, 'gh:https://x'), itemCommit(null, 'c0')])
      .toEqual([null, null, null, null, null]);
  });
});

describe('codeFile : m<rang>/<i>, un fichier d\'un module touché', () => {
  const coded = {
    ...view,
    modules: [
      { path: 'a', touched: true },
      { path: 'b', touched: true, files: [{ id: 'm1/0', path: 'b/index.ts' }] },
    ],
  } as unknown as VibeView;

  it('un module touché sans files (absent = []) : rien, et le suivant est lu', () => {
    expect([codeFile(coded, 'm0/0'), codeFile(coded, 'm1/0')?.path]).toEqual([null, 'b/index.ts']);
  });
});

describe('codeFile : b<i>, un fichier de la branche', () => {
  it('module null et branch, quel que soit le rôle', () => {
    const v = { ...view, files: [{ id: 'b0', path: 'x/a.ts', locked: null }] };
    expect([codeFile({ ...v, flow: 'create' } as VibeView, 'b0'), codeFile({ ...v, flow: 'review' } as VibeView, 'b0')])
      .toEqual(Array(2).fill({ path: 'x/a.ts', module: null, branch: true }));
  });
});

describe('codeFile : n, t<i> en Créer', () => {
  it('sans note dans le relevé : n ne mène à rien', () => {
    expect(codeFile({ ...view, flow: 'create' } as VibeView, 'n')).toBeNull();
  });
});

describe('commitFile : c<rang>/<i> en Relire', () => {
  it('c0/0 : le chemin et le hash ; sans parcours ou un commit sans fichiers : rien', () => {
    expect([commitFile({ ...view, flow: 'review' } as VibeView, 'c0/0'), commitFile(view, 'c0/0'), commitFile({ ...view, flow: 'review' } as VibeView, 'c1/0')])
      .toEqual([{ path: 'src/a.ts', hash: C0 }, null, null]);
  });

  it('codeFile inchangé : un id c… ne mène à rien, en Relire comme en Créer', () => {
    expect([codeFile({ ...view, flow: 'review' } as VibeView, 'c0/0'), codeFile({ ...view, flow: 'create' } as VibeView, 'c0/0')]).toEqual([null, null]);
  });
});

describe('noLinkPath : un chemin sans aucun lien', () => {
  const dir = { isDirectory: () => true, isSymbolicLink: () => false } as Stats;
  const file = { isDirectory: () => false, isSymbolicLink: () => false } as Stats;
  const link = { isDirectory: () => false, isSymbolicLink: () => true } as Stats;
  const disk: Record<string, Stats> = { '/r': dir, '/r/a': dir, '/r/a/f.md': file, '/r/l': link, '/r/a/d': link, '/r/a/f.md/x': file };
  const lstat = (p: string) => disk[p.replace(/\\/g, '/')];   // Windows : path.join écrit des \

  it('rel vide : root ; un fichier ou un dossier présent : son chemin', () => {
    expect([noLinkPath('/r', '', lstat), noLinkPath('/r', 'a', lstat), noLinkPath('/r', 'a/f.md', lstat)]).toEqual(['/r', path.join('/r', 'a'), path.join('/r', 'a', 'f.md')]);
  });

  it('absent, lien (dernier ou au milieu), fichier pris pour un dossier : null', () => {
    expect(['nope', 'l', 'l/x', 'a/d', 'a/f.md/x'].map((r) => noLinkPath('/r', r, lstat))).toEqual([null, null, null, null, null]);
  });

  it('.., absolu, NUL : null', () => {
    expect(['..', 'a/../a', '/etc', 'a\0'].map((r) => noLinkPath('/r', r, lstat))).toEqual([null, null, null, null]);
  });

  it('root absent, pas un dossier ou un lien : null', () => {
    expect([noLinkPath('/x', '', lstat), noLinkPath('/r/a/f.md', '', lstat), noLinkPath('/r/l', '', lstat)]).toEqual([null, null, null]);
  });
});

// Le relevé de invariants/files.test.ts : la note, un test d'invariant, un
// variant, un module, chacun son id ; `view` y est le sien, pas celui du haut.
{
  const file = (id: string, p: string) => ({ id, path: p });
  const view: VibeView = {
    agentId: 'a1', lang: 'fr', flow: 'create', autonomy: 'guide',
    agent: { model: 'opus', effort: 'high', mode: 'default' },
    repo: { branch: 'feat/x', base: 'main', changed: 0 }, error: null, steps: [],
    note: { ...file('n1', 'docs/tickets/feat/x.md'), text: '# x', before: null, filled: true, mustNot: [], mark: null, formeMark: null },
    questions: [],
    modules: [{ path: 'src/main/core/x', paths: ['src/main/core/x'], contract: 'expose x', file: file('m1', 'src/main/core/x'), touched: false, commits: [] }],
    invariants: [{ ...file('t1', 'src/main/core/x/tests/invariants/x.test.ts'), blob: '3b18e512dba79e4c8300dd08aeb37f8e728b8dad', cases: ['cas'], lines: [1], source: '', reading: null, marks: {} }],
    variants: [{ ...file('v1', 'src/main/core/x/tests/variants/x.test.ts'), cases: 2 }],
    commits: [], outputs: {}, checklist: [], actions: [], skills: [], pr: null, prs: null, draft: [], time: 0,
  };

  describe('itemPath : un id du dernier relevé, jamais un chemin', () => {
    it('un test d’invariant : son chemin dans le relevé', () => {
      // l'id du test mène à son chemin
      expect(itemPath(view, 't1')).toBe(view.invariants[0].path);
    });

    it('un variant : son chemin dans le relevé', () => {
      // l'id du variant mène à son chemin
      expect(itemPath(view, 'v1')).toBe(view.variants[0].path);
    });

    it('un module : le chemin de son fichier dans le relevé', () => {
      // l'id du fichier du module mène à son chemin
      expect(itemPath(view, 'm1')).toBe(view.modules[0].file!.path);
    });
  });

  describe('isOutputName : les noms connus des sorties, rien d’autre', () => {
    it('ponytail.md : lu', () => {
      // un nom fixe
      expect(isOutputName('ponytail.md')).toBe(true);
    });

    it('pr-12-note.md : lu', () => {
      // une sortie d'une PR
      expect(isOutputName('pr-12-note.md')).toBe(true);
    });

    it('invariants/<empreinte de 40 caractères hexadécimaux>.md : lu', () => {
      // une lecture d'un test, nommée par son empreinte
      expect(isOutputName('invariants/3b18e512dba79e4c8300dd08aeb37f8e728b8dad.md')).toBe(true);
    });
  });

  // Le même relevé, où la branche touche le premier module (deux fichiers, ids
  // m0/<i>) et pas le second ; celui-ci porte quand même un fichier, pour voir
  // qu'il n'est pas lu ; et un commit, avec son fichier c0/0.
  const coded = {
    ...view,
    modules: [
      { ...view.modules[0], touched: true, files: [file('m0/0', 'src/main/core/x/index.ts'), file('m0/1', 'src/main/core/x/tests/x.test.ts')], locked: null },
      { path: 'src/main/core/y', paths: ['src/main/core/y'], contract: 'expose y', file: file('m1', 'src/main/core/y'), touched: false, commits: [], files: [file('m1/0', 'src/main/core/y/index.ts')], locked: null },
    ],
    commits: [{ hash: 'e83c516', subject: 'x', fixup: false, files: ['src/main/core/x/index.ts'] }],
  };
  // Le même relevé, en Relire.
  const reviewed = { ...coded, flow: 'review' as const };

  describe('codeFile : le fichier d’un module touché, ou en Créer la note et un test, par son id dans le dernier relevé, jamais par un chemin', () => {
    it('m0/0, d’un module touché : son module dans le relevé', () => {
      // l'id mène au module qui porte ce fichier
      expect(codeFile(coded, 'm0/0')?.module?.path).toBe(coded.modules[0].path);
    });

    it('le fichier d’un module que la branche ne touche pas : rien', () => {
      // même porté par le relevé, un module pas touché ne donne aucun fichier
      expect(codeFile(coded, 'm1/0')).toBeNull();
    });

    it('l’id du dossier d’un module (son fichier dans le relevé) : rien', () => {
      // un module n'est pas un de ses fichiers
      expect(codeFile(coded, 'm1')).toBeNull();
    });

    it('l’id de la note, en Créer : son chemin dans le relevé', () => {
      // l'id de la note mène au chemin que le relevé lui donne
      expect(codeFile(coded, coded.note!.id)?.path).toBe(coded.note!.path);
    });

    it('l’id d’un test d’invariant, en Créer : son chemin dans le relevé', () => {
      // l'id du test mène au chemin que le relevé lui donne
      expect(codeFile(coded, coded.invariants[0].id)?.path).toBe(coded.invariants[0].path);
    });

    // Relire : la PR d'un autre, ni sa note ni ses tests ne se lisent pour être modifiés.
    it('l’id de la note, en Relire : rien', () => {
      // la note d'une PR relue n'est pas un fichier à suivre
      expect(codeFile(reviewed, reviewed.note!.id)).toBeNull();
    });

    it('l’id d’un test d’invariant, en Relire : rien', () => {
      // un test d'une PR relue n'est pas un fichier à suivre
      expect(codeFile(reviewed, reviewed.invariants[0].id)).toBeNull();
    });

    it('l’id du fichier d’un commit (c0/0) : rien', () => {
      // le fichier d'un commit n'est pas un fichier de module, même s'il en a le chemin
      expect(codeFile(coded, 'c0/0')).toBeNull();
    });

    it('un id inconnu (m0/9) : rien', () => {
      // le module n'a pas de dixième fichier
      expect(codeFile(coded, 'm0/9')).toBeNull();
    });
  });
}
