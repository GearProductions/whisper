// Invariants de la note et des tests d'invariants modifiables (note 0.11.0,
// docs/tickets/feat/0.11.0-editer-invariants-et-note.md, « Ce que ça ne doit
// pas faire ») :
//   - Enregistrer n'écrit que le fichier affiché — la note de la branche, ou
//     un test d'invariant de la branche —, désigné par son id dans le dernier
//     relevé, jamais par un chemin (I-37, I-39 élargis) — ici codeFile ;
//   - pas d'enregistrement pendant une course de l'agent ni pendant un tour de
//     la conversation — ici codeLock sans module.
// Sur le vrai principal : app/controllers/tests/invariants/note-and-tests-save.test.ts.
// Protégé : si un test échoue, corriger le code.
import { describe, expect, it } from 'vitest';
import type { VibeView } from 'shared/bridge';
import { codeFile, codeLock } from 'core/vibecoder';

// Un relevé de Créer : la note, un test d'invariant, un variant, un module touché, chacun son id.
const file = (id: string, p: string) => ({ id, path: p });
const create: VibeView = {
  agentId: 'a1', lang: 'fr', flow: 'create', autonomy: 'guide',
  agent: { model: 'opus', effort: 'high', mode: 'default' },
  repo: { branch: 'feat/x', base: 'main', changed: 0 }, error: null, steps: [],
  note: { ...file('n', 'docs/tickets/feat/x.md'), text: '# x', before: null, filled: true, mustNot: [], mark: null, formeMark: null },
  questions: [],
  modules: [{ path: 'src/main/core/x', contract: 'expose x', file: file('m0', 'src/main/core/x'), touched: true, commits: [],
    files: [file('m0/0', 'src/main/core/x/index.ts')], locked: null }],
  invariants: [{ ...file('t0', 'src/main/core/x/tests/invariants/x.test.ts'), blob: '3b18e512dba79e4c8300dd08aeb37f8e728b8dad', cases: ['cas'], lines: [1], source: '', reading: null, marks: {} }],
  variants: [{ ...file('v0', 'src/main/core/x/tests/variants/x.test.ts'), cases: 2 }],
  commits: [], outputs: {}, checklist: [], actions: [], skills: [], pr: null, prs: null, draft: [], time: 0,
};

describe('codeFile : la note et les tests d’invariants, par leur id dans le dernier relevé', () => {
  it('témoin : l’id de la note, en Créer, mène au chemin que le relevé lui donne', () => {
    // l'id mène au chemin de la note
    expect(codeFile(create, 'n')?.path).toBe(create.note!.path);
  });

  it('l’id de la note, en Créer : aucun module', () => {
    // la note n'appartient à aucun module
    expect(codeFile(create, 'n')?.module).toBeNull();
  });

  it('témoin : l’id d’un test d’invariant, en Créer, mène au chemin que le relevé lui donne', () => {
    // l'id mène au chemin du test
    expect(codeFile(create, 't0')?.path).toBe(create.invariants[0].path);
  });

  it('l’id d’un test d’invariant, en Créer : aucun module', () => {
    // un test d'invariant n'appartient à aucun module
    expect(codeFile(create, 't0')?.module).toBeNull();
  });

  it('l’id d’un variant : rien', () => {
    // seuls la note et les tests d'invariants s'ajoutent aux fichiers des modules
    expect(codeFile(create, 'v0')).toBeNull();
  });

  it('le chemin de la note à la place de son id : rien', () => {
    // un chemin n'est jamais un id
    expect(codeFile(create, create.note!.path)).toBeNull();
  });

  it('le chemin d’un test d’invariant à la place de son id : rien', () => {
    // un chemin n'est jamais un id
    expect(codeFile(create, create.invariants[0].path)).toBeNull();
  });
});

describe('codeLock sans module (la note, un test) : grisé pendant un tour ou n’importe quelle course qui retient', () => {
  it('témoin : ni tour ni course, rien ne grise', () => {
    // la note et les tests s'enregistrent
    expect(codeLock(null, false, [], 'fr')).toBeNull();
  });

  it('un tour de la conversation en cours : grisé', () => {
    // un motif est donné
    expect(codeLock(null, true, [], 'fr')).not.toBeNull();
  });

  // Une course sans module : Écrire la forme, les invariants, Ponytail review…
  it('une course qui ne génère aucun module : grisé', () => {
    // un motif est donné
    expect(codeLock(null, false, [{ module: null }], 'fr')).not.toBeNull();
  });

  it('une course qui génère un module : grisé', () => {
    // un motif est donné
    expect(codeLock(null, false, [{ module: 'src/main/core/x' }], 'fr')).not.toBeNull();
  });

  it('une course qui génère tous les modules : grisé', () => {
    // un motif est donné
    expect(codeLock(null, false, [{ module: '*' }], 'fr')).not.toBeNull();
  });
});
