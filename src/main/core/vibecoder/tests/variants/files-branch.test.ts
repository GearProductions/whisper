// Les formes d'id b<i> d'un fichier de la branche (codeFile) : le rang exact dans
// view.files du dernier relevé, jamais un chemin ; ce que les invariants gardent
// en témoin (dont b0 en Relire) est dans invariants/files-branch.test.ts.
//
// Une fonction pure, appelée sur un relevé écrit à la main.
import { describe, expect, it } from 'vitest';
import type { VibeView } from 'shared/bridge';
import { codeFile } from 'core/vibecoder';

// Un relevé en Créer, sans Forme (aucun module) : la note seule.
const file = (id: string, p: string) => ({ id, path: p });
const base: VibeView = {
  agentId: 'a1', lang: 'fr', flow: 'create', autonomy: 'guide',
  agent: { model: 'opus', effort: 'high', mode: 'default' },
  repo: { branch: 'feat/x', base: 'main', changed: 2 }, error: null, steps: [],
  note: { ...file('n1', 'docs/tickets/feat/x.md'), text: '# x', before: null, filled: true, mustNot: [], mark: null, formeMark: null },
  questions: [], modules: [], invariants: [], variants: [],
  commits: [], outputs: {}, checklist: [], actions: [], skills: [], pr: null, prs: null, draft: [], time: 0,
};
// Le même relevé, avec les deux fichiers que change la branche (ids b0, b1).
const created = {
  ...base,
  files: [
    { ...file('b0', 'src/main/core/x/index.ts'), locked: null },
    { ...file('b1', 'src/main/core/x/old.ts'), deleted: true, locked: null },
  ],
};
// Le même relevé, en Relire.
const reviewed = { ...created, flow: 'review' as const };

describe('codeFile, en Créer : un fichier de la branche par son id b<i> dans le dernier relevé, jamais par un chemin', () => {
  it('b-1 : rien', () => {
    // un rang négatif ne compte pas depuis la fin de la liste
    expect(codeFile(created, 'b-1')).toBeNull();
  });

  it('b01 : rien', () => {
    // un zéro devant ne fait pas de b01 l'id b1
    expect(codeFile(created, 'b01')).toBeNull();
  });
});

describe('codeFile, en Relire : un fichier de la branche par son id b<i> dans le dernier relevé, jamais par un chemin', () => {
  it('b9, hors des fichiers de la branche : rien', () => {
    // la branche ne change pas de dixième fichier
    expect(codeFile(reviewed, 'b9')).toBeNull();
  });

  it('le chemin d’un fichier de la branche : rien', () => {
    // même le chemin d'un fichier du relevé n'est pas un id
    expect(codeFile(reviewed, reviewed.files[0].path)).toBeNull();
  });

  // Un id qui commence par b sans être b<i> exact.
  it('b../../etc/passwd : rien', () => {
    // un id forgé n'est jamais lu comme un chemin relatif
    expect(codeFile(reviewed, 'b../../etc/passwd')).toBeNull();
  });

  it('b/etc/passwd : rien', () => {
    // un id forgé n'est jamais lu comme un chemin absolu
    expect(codeFile(reviewed, 'b/etc/passwd')).toBeNull();
  });

  it('b-1 : rien', () => {
    // un rang négatif ne compte pas depuis la fin de la liste
    expect(codeFile(reviewed, 'b-1')).toBeNull();
  });

  it('b01 : rien', () => {
    // un zéro devant ne fait pas de b01 l'id b1
    expect(codeFile(reviewed, 'b01')).toBeNull();
  });
});
