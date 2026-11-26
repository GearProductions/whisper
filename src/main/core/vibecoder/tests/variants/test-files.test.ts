import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { blobSha, caseBlocks, caseHeads, caseLines, caseReading, caseTitles, isInvariantTest, isTest } from 'core/vibecoder';

describe('isTest : un fichier de test, quel que soit son langage', () => {
  it('Vitest : *.test.ts', () => {
    expect(isTest('src/main/core/x/tests/variants/x.test.ts')).toBe(true);
  });

  it('Jest : *.spec.tsx', () => {
    expect(isTest('src/app/x.spec.tsx')).toBe(true);
  });

  it('module ES : *.test.mjs', () => {
    expect(isTest('tests/x.test.mjs')).toBe(true);
  });

  it('pytest : test_*.py', () => {
    expect(isTest('tests/test_upload.py')).toBe(true);
  });

  it('pytest : *_test.py', () => {
    expect(isTest('app/upload_test.py')).toBe(true);
  });

  it('Go : *_test.go', () => {
    expect(isTest('pkg/x/x_test.go')).toBe(true);
  });

  it('Rust : un .rs sous tests/', () => {
    expect(isTest('backend/api-tests/tests/invariants/paths.rs')).toBe(true);
  });

  it('Rust : un .rs hors de tests/ n\'en est pas un', () => {
    expect(isTest('backend/src/lib.rs')).toBe(false);
  });

  it('un script sous tests/ qui n\'est pas un test', () => {
    expect(isTest('tests/main-diff/run.mjs')).toBe(false);
  });

  it('un module ordinaire', () => {
    expect(isTest('src/main/core/vibecoder/note.ts')).toBe(false);
  });
});

describe('isInvariantTest : un test rangé sous tests/invariants/', () => {
  it('dans le dossier d\'un module', () => {
    expect(isInvariantTest('src/main/core/x/tests/invariants/x.test.ts')).toBe(true);
  });

  it('à la racine (invariants produit)', () => {
    expect(isInvariantTest('tests/invariants/tenant.test.ts')).toBe(true);
  });

  it('un variant n\'en est pas un', () => {
    expect(isInvariantTest('src/main/core/x/tests/variants/x.test.ts')).toBe(false);
  });

  it('un fichier d\'aide sous tests/invariants/ n\'en est pas un', () => {
    expect(isInvariantTest('src/main/core/x/tests/invariants/helpers.ts')).toBe(false);
  });
});

describe('caseTitles : TypeScript', () => {
  it('it et test, guillemets simples, doubles et accents graves', () => {
    expect(caseTitles('it(\'a\', () => {});\ntest("b", () => {});\nit(`c`, () => {});')).toEqual(['a', 'b', 'c']);
  });

  it('it.only, it.skip, test.concurrent', () => {
    expect(caseTitles('it.only(\'a\', f);\nit.skip(\'b\', f);\ntest.concurrent(\'c\', f);')).toEqual(['a', 'b', 'c']);
  });

  it('it.each(tableau)(titre) : le titre, pas le tableau', () => {
    expect(caseTitles('it.each([\n  [\'x\', 1],\n  [\'y\', 2],\n])(\'%s → %d\', (a, b) => {});')).toEqual(['%s → %d']);
  });

  it('test.each aussi', () => {
    expect(caseTitles('test.each(CASES)(\'cas %s\', (c) => {});')).toEqual(['cas %s']);
  });

  it('un titre avec un guillemet échappé : tel qu\'il se lit', () => {
    expect(caseTitles('it(\'l\\\'agent travaille\', f);')).toEqual(['l\'agent travaille']);
  });

  it('describe n\'est pas un cas', () => {
    expect(caseTitles('describe(\'groupe\', () => { it(\'cas\', f); });')).toEqual(['cas']);
  });

  it('la méthode .test( d\'une expression régulière n\'est pas un cas', () => {
    expect(caseTitles('expect(/x/.test(\'x\')).toBe(true);')).toEqual([]);
  });
});

describe('caseTitles : Rust', () => {
  it('#[test] fn nom', () => {
    expect(caseTitles('#[test]\nfn reads_nothing_outside() {}')).toEqual(['reads_nothing_outside']);
  });

  it('#[tokio::test(…)] async fn nom', () => {
    expect(caseTitles('#[tokio::test(flavor = "multi_thread")]\nasync fn serves_nothing() {}')).toEqual(['serves_nothing']);
  });

  it('un autre attribut entre #[test] et fn', () => {
    expect(caseTitles('#[test]\n#[should_panic(expected = "x")]\npub fn panics() {}')).toEqual(['panics']);
  });

  it('#[cfg(test)] n\'est pas un cas', () => {
    expect(caseTitles('#[cfg(test)]\nmod tests {\n    #[test]\n    fn one() {}\n}')).toEqual(['one']);
  });
});

describe('caseTitles : Python', () => {
  it('def test_… et async def test_…, dans une classe aussi', () => {
    expect(caseTitles('def test_a():\n    pass\n\nclass T:\n    async def test_b(self):\n        pass\n')).toEqual(['test_a', 'test_b']);
  });

  it('une autre fonction n\'est pas un cas', () => {
    expect(caseTitles('def helper():\n    pass\n')).toEqual([]);
  });
});

describe('caseTitles : l\'ordre du fichier', () => {
  it('dans l\'ordre où ils sont écrits', () => {
    expect(caseTitles('it(\'premier\', f);\ntest.each(T)(\'deuxième\', f);\nit(\'troisième\', f);')).toEqual(['premier', 'deuxième', 'troisième']);
  });
});

describe('caseLines : la ligne de chaque cas, d\'après le texte du test', () => {
  it('TypeScript : la ligne de son it / test, dans l\'ordre de caseTitles', () => {
    const src = 'import x;\n\ndescribe(\'g\', () => {\n  it(\'a\', f);\n\n  test.each(T)(\'b\', f);\n});\n';
    expect([caseTitles(src), caseLines(src)]).toEqual([['a', 'b'], [4, 6]]);
  });

  it('Rust : la ligne de son #[test] ; Python : celle de son def', () => {
    expect(caseLines('use x;\n\n#[test]\nfn a() {}\n#[tokio::test]\nasync fn b() {}\n')).toEqual([3, 5]);
    expect(caseLines('import x\n\ndef test_a():\n    pass\n')).toEqual([3]);
  });

  it('CRLF : les lignes comptées pareil', () => {
    expect(caseLines('// x\r\n\r\nit(\'a\', f);\r\n')).toEqual([3]);
  });
});

describe('caseHeads : la ligne de chaque cas et celle de son titre', () => {
  it('it( dont le titre est sur la ligne suivante', () => {
    const src = 'describe(\'g\', () => {\n  it(\n    \'long titre\',\n    () => {},\n  );\n  it(\'b\', f);\n});\n';
    expect(caseHeads(src)).toEqual([{ from: 2, title: 3 }, { from: 6, title: 6 }]);
  });

  it('it.each([…])(titre) : le titre est à la fin du tableau', () => {
    expect(caseHeads('it.each([\n  [1],\n])(\'%d\', f);')).toEqual([{ from: 1, title: 3 }]);
  });

  it('Rust : #[test] puis fn', () => {
    expect(caseHeads('use x;\n\n#[test]\nfn a() {}\n#[tokio::test]\n#[ignore]\nasync fn b() {}\n')).toEqual([
      { from: 3, title: 4 },
      { from: 5, title: 7 },
    ]);
  });

  it('Python : le def', () => {
    expect(caseHeads('import x\n\ndef test_a():\n    pass\n')).toEqual([{ from: 3, title: 3 }]);
  });

  it('même ordre et mêmes lignes que caseTitles et caseLines ; CRLF compris', () => {
    const src = '// x\r\n\r\nit(\'a\', f);\r\nit(\r\n  \'b\',\r\n  f);\r\n';
    expect(caseHeads(src).map((h) => h.from)).toEqual(caseLines(src));
    expect(caseHeads(src)).toEqual([{ from: 3, title: 3 }, { from: 4, title: 5 }]);
  });

  it('un fichier vide, ou sans cas : aucun', () => {
    expect(caseHeads('')).toEqual([]);
    expect(caseHeads('const x = 1;\n')).toEqual([]);
  });
});

describe('caseBlocks : l\'empreinte de chaque bloc et du code commun', () => {
  const src = (a: string, imp = 'import x from \'x\';') =>
    `${imp}\n\ndescribe('g', () => {\n  it('a', () => {\n    ${a};\n  });\n\n  it('b', () => {\n    two();\n  });\n});\n`;

  it('les clés dans l\'ordre, une empreinte par bloc', () => {
    const r = caseBlocks(src('one()'));
    expect(r.keys).toEqual(['a', 'b']);
    expect(r.blocks).toHaveLength(2);
    expect(r.blocks[0]).not.toBe(r.blocks[1]);
  });

  it('un cas retouché change son bloc seul', () => {
    const before = caseBlocks(src('one()'));
    const after = caseBlocks(src('other()'));
    expect(after.blocks[0]).not.toBe(before.blocks[0]);
    expect(after.blocks[1]).toBe(before.blocks[1]);
    expect(after.common).toBe(before.common);
  });

  it('un import change le code commun seul', () => {
    const before = caseBlocks(src('one()'));
    const after = caseBlocks(src('one()', 'import y from \'y\';'));
    expect(after.common).not.toBe(before.common);
    expect(after.blocks).toEqual(before.blocks);
  });

  it('un titre en double : deux clés, deux blocs', () => {
    const r = caseBlocks('it(\'a\', () => {\n  x();\n});\nit(\'a\', () => {\n  y();\n});\n');
    expect(r.keys).toEqual(['a', 'a n° 2']);
    expect(r.blocks[0]).not.toBe(r.blocks[1]);
  });

  it('des lignes vides ajoutées ne changent rien', () => {
    expect(caseBlocks(src('one()').replace('\n    one', '\n\n    one'))).toEqual(caseBlocks(src('one()')));
  });

  it('un fichier vide : ni clé ni bloc, le code commun du vide', () => {
    expect(caseBlocks('')).toEqual({ keys: [], blocks: [], common: blobSha('') });
  });
});

describe('caseReading : la lecture d\'un test, cas par cas', () => {
  const path = 'src/x/tests/invariants/a.test.ts';
  const text = (a: string, b = 'two()') => `it('a', () => {\n  ${a};\n});\nit('b', () => {\n  ${b};\n});\n`;
  const blocksOf = (t: string) => Object.fromEntries(caseBlocks(t).keys.map((k, i) => [k, caseBlocks(t).blocks[i]]));
  const reading = (blob: string, t: string, time: number, withBlocks = true) =>
    ({ blob, text: `# ${path}\nlecture ${blob}`, time, ...(withBlocks ? { blocks: blocksOf(t), common: caseBlocks(t).common } : {}) });
  const test = { path, blob: 'now', text: text('one()') };

  it('sa propre empreinte : stale vide', () => {
    const own = reading('now', text('autre()'), 1);
    expect(caseReading(test, [reading('old', text('one()'), 9), own])).toEqual({ text: own.text, stale: [] });
  });

  it('une autre version, un seul bloc changé : sa clé seule', () => {
    const old = reading('old', text('one()', 'changed()'), 1);
    expect(caseReading(test, [old])).toEqual({ text: old.text, stale: ['b'] });
  });

  it('une autre version dont aucun bloc n\'a changé : stale vide', () => {
    expect(caseReading(test, [reading('old', text('one()'), 1)])?.stale).toEqual([]);
  });

  it('sans blocks : toutes les clés', () => {
    const old = reading('old', text('one()'), 1, false);
    expect(caseReading(test, [old])).toEqual({ text: old.text, stale: ['a', 'b'] });
  });

  it('aucune lecture : null ; celle d\'un autre fichier ou d\'un chemin qui le prolonge : ignorée', () => {
    expect(caseReading(test, [])).toBeNull();
    const other = { ...reading('o', text('one()'), 9), text: '# src/x/tests/invariants/b.test.ts\nautre' };
    const longer = { ...reading('l', text('one()'), 9), text: `# ${path}.bak\nautre` };
    expect(caseReading(test, [other, longer])).toBeNull();
  });

  it('la plus récente du fichier est prise, quel que soit l\'ordre', () => {
    const older = reading('o', text('one()', 'x()'), 1);
    const newer = reading('n', text('y()'), 5);
    expect(caseReading(test, [newer, older])?.text).toBe(newer.text);
    expect(caseReading(test, [older, newer])?.text).toBe(newer.text);
  });

  it('un cas ajouté depuis la lecture : sa clé est périmée ; un cas retiré : ignoré', () => {
    const added = { ...reading('old', text('one()'), 1), blocks: { a: blocksOf(text('one()')).a } };
    expect(caseReading(test, [added])?.stale).toEqual(['b']);
    const removed = { ...reading('old', text('one()'), 1), blocks: { ...blocksOf(text('one()')), gone: 'x' } };
    expect(caseReading(test, [removed])?.stale).toEqual([]);
  });

  it('le code commun seul changé (setup, helpers, en-tête) : toutes les clés, la lecture est à refaire', () => {
    const old = reading('old', `import z;\n${text('one()')}`, 1);
    expect(caseReading(test, [old])?.stale).toEqual(['a', 'b']);
  });

  it('une lecture retenue sans common (l\'ancien format) : toutes les clés', () => {
    const { common: _, ...old } = reading('old', text('one()'), 1);
    expect(caseReading(test, [old])?.stale).toEqual(['a', 'b']);
  });
});

describe('blobSha : l\'empreinte git d\'un contenu', () => {
  it('la même que git hash-object, accents compris', () => {
    const text = 'it(\'détecte l\'été\', () => {});\n';
    expect(blobSha(text)).toBe(execFileSync('git', ['hash-object', '--stdin'], { input: text, encoding: 'utf8' }).trim());
  });

  it('le contenu vide : l\'empreinte bien connue de git', () => {
    expect(blobSha('')).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  });
});
