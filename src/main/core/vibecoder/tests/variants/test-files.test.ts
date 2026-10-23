import { execFileSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { blobSha, caseLines, caseTitles, isInvariantTest, isTest, readingOf } from 'core/vibecoder';

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

describe('blobSha : l\'empreinte git d\'un contenu', () => {
  it('la même que git hash-object, accents compris', () => {
    const text = 'it(\'détecte l\'été\', () => {});\n';
    expect(blobSha(text)).toBe(execFileSync('git', ['hash-object', '--stdin'], { input: text, encoding: 'utf8' }).trim());
  });

  it('le contenu vide : l\'empreinte bien connue de git', () => {
    expect(blobSha('')).toBe('e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  });
});

describe('readingOf : la lecture d\'un test, à jour ou périmée', () => {
  const test = { path: 'src/x/tests/invariants/a.test.ts', blob: 'b2' };
  const old = { blob: 'b0', text: '# src/x/tests/invariants/a.test.ts\nancienne', time: 1 };
  const prev = { blob: 'b1', text: '# src/x/tests/invariants/a.test.ts\r\nprécédente', time: 2 };
  const other = { blob: 'b9', text: '# src/x/tests/invariants/b.test.ts\nautre', time: 9 };

  it('celle de son empreinte, à jour', () => {
    const own = { blob: 'b2', text: 'actuelle', time: 0 };
    expect(readingOf(test, [old, own, prev])).toEqual({ text: 'actuelle', stale: false });
  });

  it('sinon la plus récente de son fichier, périmée', () => {
    expect(readingOf(test, [prev, other, old])).toEqual({ text: prev.text, stale: true });
  });

  it('pas celle d\'un autre fichier ni d\'un chemin qui le prolonge', () => {
    const longer = { blob: 'b8', text: '# src/x/tests/invariants/a.test.ts.bak\n', time: 5 };
    expect(readingOf(test, [other, longer])).toBeNull();
  });
});
