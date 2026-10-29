// Invariant du fichier d'un commit qu'une page suit (note 0.13.0,
// docs/tickets/feat/0.13.0-ameliorations-interface.md, « Ce que ça ne doit pas
// faire ») : suivre un fichier d'un commit hors de Relire, ou désigné
// autrement que par son id `c<rang>/<i>` du dernier relevé (I-37 étendu au
// fichier d'un commit) — ici commitFile ; sur le vrai principal :
// app/controllers/tests/invariants/commit-file.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Une fonction pure, appelée sur un relevé écrit à la main.
import { describe, expect, it } from 'vitest';
import type { VibeView } from 'shared/bridge';
import { commitFile } from 'core/vibecoder';

// Un relevé en Relire : la note, un test d'invariant, un module touché (son
// fichier m0/0) et deux commits, chacun ses fichiers (ids c<rang>/<i>).
const file = (id: string, p: string) => ({ id, path: p });
const reviewed: VibeView = {
  agentId: 'a1', lang: 'fr', flow: 'review', autonomy: 'guide',
  agent: { model: 'opus', effort: 'high', mode: 'default' },
  repo: { branch: 'feat/x', base: 'main', changed: 0 }, error: null, steps: [],
  note: { ...file('n1', 'docs/tickets/feat/x.md'), text: '# x', before: null, filled: true, mustNot: [], mark: null, formeMark: null },
  questions: [],
  modules: [{ path: 'src/main/core/x', contract: 'expose x', file: file('m1', 'src/main/core/x'), touched: true, commits: ['e83c516'],
    files: [file('m0/0', 'src/main/core/x/index.ts')] }],
  invariants: [{ ...file('t1', 'src/main/core/x/tests/invariants/x.test.ts'), blob: '3b18e512dba79e4c8300dd08aeb37f8e728b8dad', cases: ['cas'], lines: [1], source: '', reading: null, marks: {} }],
  variants: [],
  commits: [
    { hash: 'e83c516', subject: 'x', fixup: false, files: ['src/main/core/x/index.ts', 'src/main/core/x/a.ts'] },
    { hash: '9f2a0d1', subject: 'y', fixup: false, files: ['src/main/core/x/b.ts'] },
  ],
  outputs: {}, checklist: [], actions: [], skills: [], pr: null, prs: null, draft: [], time: 0,
};
// Le même relevé, en Créer.
const created: VibeView = { ...reviewed, flow: 'create' };

describe('commitFile : en Relire seulement, le fichier d’un commit par son id c<rang>/<i> du dernier relevé, jamais par un chemin', () => {
  it('témoin : c0/1, en Relire : le chemin que le relevé donne au deuxième fichier du premier commit', () => {
    // l'id mène au chemin de ce fichier dans le relevé
    expect(commitFile(reviewed, 'c0/1')?.path).toBe(reviewed.commits[0].files[1]);
  });

  it('témoin : c0/1, en Relire : le commit de ce rang', () => {
    // l'id mène au hash du commit qui porte ce fichier
    expect(commitFile(reviewed, 'c0/1')?.hash).toBe(reviewed.commits[0].hash);
  });

  it('c1/0, en Relire : le fichier du commit de ce rang, pas d’un autre', () => {
    // le rang choisit le commit
    expect(commitFile(reviewed, 'c1/0')?.hash).toBe(reviewed.commits[1].hash);
  });

  // Créer : sa propre branche, ses commits ne se suivent pas dans le panneau.
  it('c0/0, en Créer : rien', () => {
    // hors de Relire, aucun fichier d'un commit n'est suivi
    expect(commitFile(created, 'c0/0')).toBeNull();
  });

  it('un rang de commit inconnu (c9/0) : rien', () => {
    // le relevé n'a pas de dixième commit
    expect(commitFile(reviewed, 'c9/0')).toBeNull();
  });

  it('un fichier inconnu d’un commit connu (c0/9) : rien', () => {
    // le premier commit n'a pas de dixième fichier
    expect(commitFile(reviewed, 'c0/9')).toBeNull();
  });

  it('l’id d’un commit seul (c0), sans fichier : rien', () => {
    // un commit n'est pas un de ses fichiers
    expect(commitFile(reviewed, 'c0')).toBeNull();
  });

  it('l’id d’un fichier de module (m0/0), en Relire : rien', () => {
    // un fichier de module n'est pas le fichier d'un commit, même au même chemin
    expect(commitFile(reviewed, 'm0/0')).toBeNull();
  });

  it('l’id de la note, en Relire : rien', () => {
    // la note n'est pas le fichier d'un commit
    expect(commitFile(reviewed, reviewed.note!.id)).toBeNull();
  });

  it('un id égal au chemin d’un fichier d’un commit : rien', () => {
    // même le chemin d'un fichier du commit n'est pas un id
    expect(commitFile(reviewed, reviewed.commits[0].files[0])).toBeNull();
  });

  it('un id en forme de chemin relatif (../../etc/passwd) : rien', () => {
    // l'id n'est jamais lu comme un chemin
    expect(commitFile(reviewed, '../../etc/passwd')).toBeNull();
  });

  it('un id en forme de chemin absolu (/etc/passwd) : rien', () => {
    // l'id n'est jamais lu comme un chemin
    expect(commitFile(reviewed, '/etc/passwd')).toBeNull();
  });

  it('un id qui commence comme celui d’un fichier puis sort (c0/0/../../etc/passwd) : rien', () => {
    // un id valide en tête ne fait pas lire la suite comme un chemin
    expect(commitFile(reviewed, 'c0/0/../../etc/passwd')).toBeNull();
  });

  it('sans relevé : rien', () => {
    // pas de relevé, pas de fichier
    expect(commitFile(null, 'c0/0')).toBeNull();
  });
});
