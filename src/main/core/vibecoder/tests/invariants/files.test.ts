// Invariant des fichiers que VibeCoder lit ou ouvre. Protégé : si un test
// échoue, corriger le code.
//   Note 0.8.0, « Ce que ça ne doit pas faire » : lire un fichier qu'une page
//   désigne — le principal ne lit pour VibeCoder que la note et les tests que
//   git lui donne dans le dossier de l'agent, et les sorties de cet agent sous
//   leurs noms connus ; une page désigne un fichier par son identifiant dans
//   le dernier relevé, jamais par un chemin (I-34).
//   Note 0.11.0 (docs/tickets/feat/0.11.0-code-des-modules.md), « Ce que ça ne
//   doit pas faire » : la page ne désigne un fichier du module que par son id
//   dans le dernier relevé, jamais par un chemin ; le principal ne lit que le
//   fichier ouvert, d'un module touché par la branche, rien hors du dossier de
//   l'agent (I-37, élargi aux fichiers des modules) — ici codeFile ; sur le
//   vrai principal : app/controllers/tests/invariants/module-code.test.ts.
// Sur du réel : un dossier temporaire, un lien qui en sort, fs.realpathSync.native.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import type { VibeView } from 'shared/bridge';
import { codeFile, isOutputName, itemPath, safePath } from 'core/vibecoder';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecoder-fichiers-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

// Le dossier de l'agent, avec sa note ; à côté, hors de lui, des secrets ; et
// dans le dossier, un lien vers un dossier du dehors ('junction' : un lien
// de dossier que Windows crée sans droits particuliers).
const dir = path.join(tmp, 'agent');
fs.mkdirSync(path.join(dir, 'a'), { recursive: true });
fs.writeFileSync(path.join(dir, 'note.md'), '# note');
fs.writeFileSync(path.join(tmp, 'secret'), 'clé');
fs.mkdirSync(path.join(tmp, 'dehors'));
fs.writeFileSync(path.join(tmp, 'dehors', 'secret'), 'clé');
fs.symlinkSync(path.join(tmp, 'dehors'), path.join(dir, 'lien'), 'junction');
const realpath = fs.realpathSync.native;

describe('safePath : dans le dossier de l’agent, ou rien', () => {
  it('un chemin simple dans le dossier : accepté', () => {
    const p = safePath(dir, 'note.md', realpath);
    // il désigne ce fichier du dossier
    expect(p && realpath(p)).toBe(realpath(path.join(dir, 'note.md')));
  });

  it('../secret : refusé', () => {
    // le fichier existe, mais hors du dossier
    expect(safePath(dir, '../secret', realpath)).toBeNull();
  });

  it('a/../../secret : refusé', () => {
    // un détour par un sous-dossier ne fait pas sortir pour autant
    expect(safePath(dir, 'a/../../secret', realpath)).toBeNull();
  });

  it('un chemin absolu : refusé', () => {
    // seul un chemin relatif au dossier est accepté
    expect(safePath(dir, path.join(tmp, 'secret'), realpath)).toBeNull();
  });

  it('un octet NUL : refusé', () => {
    // un NUL ne coupe pas le chemin vers un autre fichier
    expect(safePath(dir, 'note.md\0../../secret', realpath)).toBeNull();
  });

  it('un lien du dossier qui mène dehors : refusé', () => {
    // le lien résolu, la cible est hors du dossier
    expect(safePath(dir, 'lien/secret', realpath)).toBeNull();
  });
});

// Un relevé : la note, un test d'invariant, un variant, un module, chacun son id.
const file = (id: string, p: string) => ({ id, path: p });
const view: VibeView = {
  agentId: 'a1', lang: 'fr', flow: 'create', autonomy: 'guide',
  agent: { model: 'opus', effort: 'high', mode: 'default' },
  repo: { branch: 'feat/x', base: 'main', changed: 0 }, error: null, steps: [],
  note: { ...file('n1', 'docs/tickets/feat/x.md'), text: '# x', before: null, filled: true, mustNot: [], mark: null, formeMark: null },
  questions: [],
  modules: [{ path: 'src/main/core/x', contract: 'expose x', file: file('m1', 'src/main/core/x'), touched: false, commits: [] }],
  invariants: [{ ...file('t1', 'src/main/core/x/tests/invariants/x.test.ts'), blob: '3b18e512dba79e4c8300dd08aeb37f8e728b8dad', cases: ['cas'], lines: [1], source: '', reading: null, marks: {} }],
  variants: [{ ...file('v1', 'src/main/core/x/tests/variants/x.test.ts'), cases: 2 }],
  commits: [], outputs: {}, checklist: [], actions: [], skills: [], pr: null, prs: null, draft: [], time: 0,
};

describe('itemPath : un id du dernier relevé, jamais un chemin', () => {
  it('la note : son chemin dans le relevé', () => {
    // l'id de la note mène à son chemin
    expect(itemPath(view, 'n1')).toBe(view.note!.path);
  });

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

  it('un id inconnu : rien', () => {
    // aucun fichier du relevé ne porte cet id
    expect(itemPath(view, 'x9')).toBeNull();
  });

  it('un id en forme de chemin relatif (../../etc/passwd) : rien', () => {
    // l'id n'est jamais lu comme un chemin
    expect(itemPath(view, '../../etc/passwd')).toBeNull();
  });

  it('un id en forme de chemin absolu (/etc/passwd) : rien', () => {
    // l'id n'est jamais lu comme un chemin
    expect(itemPath(view, '/etc/passwd')).toBeNull();
  });

  it('un id égal au chemin d’un fichier du relevé : rien', () => {
    // même le chemin de la note n'est pas un id
    expect(itemPath(view, view.note!.path)).toBeNull();
  });

  it('sans relevé : rien', () => {
    // pas de relevé, pas de fichier
    expect(itemPath(null, 'n1')).toBeNull();
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

  it('../x : refusé', () => {
    // rien hors du dossier de sorties
    expect(isOutputName('../x')).toBe(false);
  });

  it('invariants/../x : refusé', () => {
    // le dossier des lectures ne sert pas de détour
    expect(isOutputName('invariants/../x')).toBe(false);
  });

  it('a/b.md : refusé', () => {
    // pas d'autre dossier qu'invariants/
    expect(isOutputName('a/b.md')).toBe(false);
  });

  it('x.json, hors de la liste : refusé', () => {
    // un nom inconnu
    expect(isOutputName('x.json')).toBe(false);
  });
});

// Le même relevé, où la branche touche le premier module (deux fichiers, ids
// m0/<i>) et pas le second ; celui-ci porte quand même un fichier, pour voir
// qu'il n'est pas lu ; et un commit, avec son fichier c0/0.
const coded = {
  ...view,
  modules: [
    { ...view.modules[0], touched: true, files: [file('m0/0', 'src/main/core/x/index.ts'), file('m0/1', 'src/main/core/x/tests/x.test.ts')], locked: null },
    { path: 'src/main/core/y', contract: 'expose y', file: file('m1', 'src/main/core/y'), touched: false, commits: [], files: [file('m1/0', 'src/main/core/y/index.ts')], locked: null },
  ],
  commits: [{ hash: 'e83c516', subject: 'x', fixup: false, files: ['src/main/core/x/index.ts'] }],
};

describe('codeFile : le fichier d’un module touché, par son id dans le dernier relevé, jamais par un chemin', () => {
  it('m0/0, d’un module touché : son chemin dans le relevé', () => {
    // l'id mène au chemin que le relevé donne à ce fichier
    expect(codeFile(coded, 'm0/0')?.path).toBe(coded.modules[0].files[0].path);
  });

  it('m0/0, d’un module touché : son module dans le relevé', () => {
    // l'id mène au module qui porte ce fichier
    expect(codeFile(coded, 'm0/0')?.module.path).toBe(coded.modules[0].path);
  });

  it('le fichier d’un module que la branche ne touche pas : rien', () => {
    // même porté par le relevé, un module pas touché ne donne aucun fichier
    expect(codeFile(coded, 'm1/0')).toBeNull();
  });

  it('l’id du dossier d’un module (son fichier dans le relevé) : rien', () => {
    // un module n'est pas un de ses fichiers
    expect(codeFile(coded, 'm1')).toBeNull();
  });

  it('l’id de la note : rien', () => {
    // la note n'est pas un fichier de module
    expect(codeFile(coded, 'n1')).toBeNull();
  });

  it('l’id d’un test d’invariant : rien', () => {
    // un test du relevé n'est pas un fichier de module
    expect(codeFile(coded, 't1')).toBeNull();
  });

  it('l’id du fichier d’un commit (c0/0) : rien', () => {
    // le fichier d'un commit n'est pas un fichier de module, même s'il en a le chemin
    expect(codeFile(coded, 'c0/0')).toBeNull();
  });

  it('un id inconnu (m0/9) : rien', () => {
    // le module n'a pas de dixième fichier
    expect(codeFile(coded, 'm0/9')).toBeNull();
  });

  it('un id en forme de chemin relatif (../../etc/passwd) : rien', () => {
    // l'id n'est jamais lu comme un chemin
    expect(codeFile(coded, '../../etc/passwd')).toBeNull();
  });

  it('un id en forme de chemin absolu (/etc/passwd) : rien', () => {
    // l'id n'est jamais lu comme un chemin
    expect(codeFile(coded, '/etc/passwd')).toBeNull();
  });

  it('un id égal au chemin d’un fichier du module : rien', () => {
    // même le chemin d'un fichier du module n'est pas un id
    expect(codeFile(coded, coded.modules[0].files[0].path)).toBeNull();
  });

  it('sans relevé : rien', () => {
    // pas de relevé, pas de fichier
    expect(codeFile(null, 'm0/0')).toBeNull();
  });
});
