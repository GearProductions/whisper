// Invariant des fichiers de la branche qu'une page suit (note 0.13.0,
// docs/tickets/feat/0.13.0-forme-modules-ide.md, Forme : « codeFile traduit
// b<i> comme m<rang>/<i> — jamais un chemin venu de la page (I-37). Lus dans
// les deux rôles ») : un fichier que change la branche ne se désigne que par
// son id `b<i>` dans `view.files` du dernier relevé ; un id hors de
// `view.files`, un chemin ou un `b<i>` forgé ne donne aucun fichier, en Créer
// comme en Relire (I-37 étendu aux fichiers de la branche) — ici codeFile.
// Protégé : si un test échoue, corriger le code. Ici les témoins (Créer et
// Relire) ; les formes d'id forgées (b-1, b01) et le reste du rôle Relire :
// tests/variants/files-branch.test.ts.
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
  it('b0, un fichier de la branche : son chemin dans le relevé', () => {
    // l'id mène au chemin que le relevé donne à ce fichier
    expect(codeFile(created, 'b0')?.path).toBe(created.files[0].path);
  });

  it('b9, hors des fichiers de la branche : rien', () => {
    // la branche ne change pas de dixième fichier
    expect(codeFile(created, 'b9')).toBeNull();
  });

  it('le chemin d’un fichier de la branche : rien', () => {
    // même le chemin d'un fichier du relevé n'est pas un id
    expect(codeFile(created, created.files[0].path)).toBeNull();
  });

  // Un id qui commence par b sans être b<i> exact.
  it('b../../etc/passwd : rien', () => {
    // un id forgé n'est jamais lu comme un chemin relatif
    expect(codeFile(created, 'b../../etc/passwd')).toBeNull();
  });

  it('b/etc/passwd : rien', () => {
    // un id forgé n'est jamais lu comme un chemin absolu
    expect(codeFile(created, 'b/etc/passwd')).toBeNull();
  });
});

describe('codeFile, en Relire : un fichier de la branche par son id b<i> dans le dernier relevé, jamais par un chemin', () => {
  it('b0, un fichier de la branche : son chemin dans le relevé', () => {
    // l'id mène au chemin que le relevé donne à ce fichier, en Relire aussi
    expect(codeFile(reviewed, 'b0')?.path).toBe(reviewed.files[0].path);
  });
});
