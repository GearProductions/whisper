import { describe, expect, it } from 'vitest';
import { blockTexts, caseBlock, caseKeys } from 'shared/test-cases';

const lines = (text: string) => text.split('\n');

describe('caseKeys : la clé de chaque cas', () => {
  it('des titres uniques sont pris tels quels', () => {
    expect(caseKeys(['a', 'b', 'c'])).toEqual(['a', 'b', 'c']);
  });

  it('un double : le premier tel quel, puis « titre n° 2 », « titre n° 3 »', () => {
    expect(caseKeys(['t', 'u', 't', 't'])).toEqual(['t', 'u', 't n° 2', 't n° 3']);
  });

  it('chaque titre a son propre compte', () => {
    expect(caseKeys(['a', 'b', 'a', 'b'])).toEqual(['a', 'b', 'a n° 2', 'b n° 2']);
  });

  it('un vrai titre « t n° 2 » ne prend pas la clé d\'un double : jamais deux clés égales', () => {
    expect(caseKeys(['t', 't', 't n° 2'])).toEqual(['t', 't n° 2', 't n° 2 n° 2']);
    expect(caseKeys(['t n° 2', 't', 't'])).toEqual(['t n° 2', 't', 't n° 3']);
  });

  it('aucun titre : aucune clé', () => {
    expect(caseKeys([])).toEqual([]);
  });
});

describe('caseBlock : de la ligne du cas à celle qui le ferme', () => {
  it('it(…) { … }) : fermé par `})`, compris', () => {
    const src = lines([
      "describe('d', () => {",    // 1
      "  it('a', () => {",        // 2
      '    expect(1).toBe(1);',   // 3
      '  });',                    // 4
      '',                         // 5
      "  it('b', () => {",        // 6
      '    expect(2).toBe(2);',   // 7
      '  });',                    // 8
      '});',                      // 9
    ].join('\n'));
    expect(caseBlock(src, 2, 2)).toEqual({ from: 2, to: 4 });
    expect(caseBlock(src, 6, 6)).toEqual({ from: 6, to: 8 });
  });

  it('it( sur plusieurs lignes, titre sur la deuxième : `)` compris', () => {
    const src = lines([
      '  it(',                    // 1
      "    'a',",                 // 2
      '    () => {',              // 3
      '      expect(1).toBe(1);', // 4
      '    },',                   // 5
      '  );',                     // 6
      '});',                      // 7
    ].join('\n'));
    expect(caseBlock(src, 1, 2)).toEqual({ from: 1, to: 6 });
  });

  it('def Python : fermé par la ligne suivante moins indentée, exclue', () => {
    const src = lines([
      'def test_a():',            // 1
      '    assert 1 == 1',        // 2
      '    assert 2 == 2',        // 3
      'def test_b():',            // 4
      '    assert 3 == 3',        // 5
    ].join('\n'));
    expect(caseBlock(src, 1, 1)).toEqual({ from: 1, to: 3 });
    expect(caseBlock(src, 4, 4)).toEqual({ from: 4, to: 5 });
  });

  it('def Python dans une classe : la ligne de même indentation ferme, exclue', () => {
    const src = lines([
      'class T:',                 // 1
      '    def test_a(self):',    // 2
      '        pass',             // 3
      '    def test_b(self):',    // 4
      '        pass',             // 5
    ].join('\n'));
    expect(caseBlock(src, 2, 2)).toEqual({ from: 2, to: 3 });
    expect(caseBlock(src, 4, 4)).toEqual({ from: 4, to: 5 });
  });

  it('fn Rust sous #[test] : de #[test] à `}`, comprise', () => {
    const src = lines([
      'mod tests {',              // 1
      '    #[test]',              // 2
      '    fn a() {',             // 3
      '        assert_eq!(1, 1);',// 4
      '    }',                    // 5
      '',                         // 6
      '    #[test]',              // 7
      '    fn b() {',             // 8
      '        assert_eq!(2, 2);',// 9
      '    }',                    // 10
      '}',                        // 11
    ].join('\n'));
    expect(caseBlock(src, 2, 3)).toEqual({ from: 2, to: 5 });
    expect(caseBlock(src, 7, 8)).toEqual({ from: 7, to: 10 });
  });

  it('signature Rust sur plusieurs lignes : `) {` sautée', () => {
    const src = lines([
      '#[test]',                  // 1
      'fn a(',                    // 2
      '    x: u8,',               // 3
      ') {',                      // 4
      '    assert_eq!(x, 1);',    // 5
      '}',                        // 6
      'fn helper() {}',           // 7
    ].join('\n'));
    expect(caseBlock(src, 1, 2)).toEqual({ from: 1, to: 6 });
  });

  it('signature Python sur plusieurs lignes : `) -> None:` sautée', () => {
    const src = lines([
      'def test_a(',              // 1
      '    x,',                   // 2
      ') -> None:',               // 3
      '    assert x',             // 4
      'def test_b():',            // 5
      '    pass',                 // 6
    ].join('\n'));
    expect(caseBlock(src, 1, 1)).toEqual({ from: 1, to: 4 });
  });

  it('un cas d’une ligne : la ligne seule', () => {
    const src = lines([
      "describe('d', () => {",                // 1
      "  it('a', () => expect(1).toBe(1));",  // 2
      "  it('b', () => expect(2).toBe(2));",  // 3
      '});',                                  // 4
    ].join('\n'));
    expect(caseBlock(src, 2, 2)).toEqual({ from: 2, to: 2 });
    expect(caseBlock(src, 3, 3)).toEqual({ from: 3, to: 3 });
  });

  it('un cas d’une ligne fermé par `});` du describe : moins indentée, exclue', () => {
    const src = lines(["  it('a', () => {});", '});'].join('\n'));
    expect(caseBlock(src, 1, 1)).toEqual({ from: 1, to: 1 });
  });

  it('sans fermeture : jusqu’à la fin du fichier', () => {
    const src = lines(['def test_a():', '    assert 1', '    assert 2'].join('\n'));
    expect(caseBlock(src, 1, 1)).toEqual({ from: 1, to: 3 });
  });

  it('les lignes vides ne ferment pas un bloc', () => {
    const src = lines(["it('a', () => {", '  expect(1);', '', '', '  expect(2);', '});'].join('\n'));
    expect(caseBlock(src, 1, 1)).toEqual({ from: 1, to: 6 });
  });

  it('la ligne qui ferme est cherchée après celle du titre, pas avant', () => {
    // #[test] et fn à la même indentation : fn ne ferme pas le bloc
    const src = lines(['#[test]', 'fn a() {', '}'].join('\n'));
    expect(caseBlock(src, 1, 2)).toEqual({ from: 1, to: 3 });
  });

  it('fichier en \\r\\n : `) {\\r` sautée, `});\\r` comprise', () => {
    const src = lines(["  it('a', () => {", '    x();', '  });', "  it('b', () => {});"].join('\r\n'));
    expect(caseBlock(src, 1, 1)).toEqual({ from: 1, to: 3 });
    expect(caseBlock(lines(['fn a(', ') {', '  x', '}'].join('\r\n')), 1, 1)).toEqual({ from: 1, to: 4 });
  });

  it('indentation à la tabulation', () => {
    const src = lines(["\tit('a', () => {", '\t\tx();', '\t});', "\tit('b', () => {});"].join('\n'));
    expect(caseBlock(src, 1, 1)).toEqual({ from: 1, to: 3 });
  });

  it('un cas à la dernière ligne : un bloc d’une ligne', () => {
    expect(caseBlock(['  it(\'a\', () => {});'], 1, 1)).toEqual({ from: 1, to: 1 });
  });
});

const FILE = [
  "import { describe, expect, it } from 'vitest';",   // 1
  '',                                                  // 2
  "describe('d', () => {",                             // 3
  '  beforeEach(() => {',                              // 4
  '    reset();',                                      // 5
  '  });',                                             // 6
  '',                                                  // 7
  "  it('a', () => {",                                 // 8
  '    expect(1).toBe(1);',                            // 9
  '',                                                  // 10
  '    expect(2).toBe(2);',                            // 11
  '  });',                                             // 12
  '',                                                  // 13
  "  it('b', () => {",                                 // 14
  '    expect(3).toBe(3);',                            // 15
  '  });',                                             // 16
  '});',                                               // 17
  '',                                                  // 18
].join('\n');
const HEADS = [{ from: 8, title: 8 }, { from: 14, title: 14 }];

describe('blockTexts : les blocs et le code commun, sans les lignes vides', () => {
  it('beforeEach, import et fin d’un describe sont dans common ; les blocs sont ceux des cas', () => {
    const { blocks, common } = blockTexts(FILE, HEADS);
    expect(blocks).toEqual([
      ["  it('a', () => {", '    expect(1).toBe(1);', '    expect(2).toBe(2);', '  });'].join('\n'),
      ["  it('b', () => {", '    expect(3).toBe(3);', '  });'].join('\n'),
    ]);
    expect(common).toBe([
      "import { describe, expect, it } from 'vitest';",
      "describe('d', () => {",
      '  beforeEach(() => {',
      '    reset();',
      '  });',
      '});',
    ].join('\n'));
  });

  it('une ligne vide ajoutée ne change ni bloc ni common', () => {
    const withBlanks = lines(FILE);
    withBlanks.splice(10, 0, '');          // dans le bloc de a
    withBlanks.splice(4, 0, '');           // dans le beforeEach
    withBlanks.push('', '');               // à la fin
    const src = withBlanks.join('\n');
    const heads = [{ from: 9, title: 9 }, { from: 16, title: 16 }];
    expect(blockTexts(src, heads)).toEqual(blockTexts(FILE, HEADS));
  });

  it('une retouche d’un bloc ne change que ce bloc', () => {
    const before = blockTexts(FILE, HEADS);
    const after = blockTexts(FILE.replace('toBe(3)', 'toBe(4)'), HEADS);
    expect(after.blocks[0]).toBe(before.blocks[0]);
    expect(after.blocks[1]).not.toBe(before.blocks[1]);
    expect(after.common).toBe(before.common);
  });

  it('une retouche de l’import ne change que common', () => {
    const before = blockTexts(FILE, HEADS);
    const after = blockTexts(FILE.replace("'vitest'", "'vitest/x'"), HEADS);
    expect(after.blocks).toEqual(before.blocks);
    expect(after.common).not.toBe(before.common);
  });

  it('sans cas : tout le texte est du code commun', () => {
    expect(blockTexts('a\n\nb\n', [])).toEqual({ blocks: [], common: 'a\nb' });
  });

  it('texte vide : rien', () => {
    expect(blockTexts('', [])).toEqual({ blocks: [], common: '' });
  });

  it('des cas contigus : chaque ligne dans son seul bloc, common vide', () => {
    const src = ['def test_a():', '    pass', 'def test_b():', '    pass'].join('\n');
    expect(blockTexts(src, [{ from: 1, title: 1 }, { from: 3, title: 3 }])).toEqual({
      blocks: ['def test_a():\n    pass', 'def test_b():\n    pass'],
      common: '',
    });
  });

  it('un cas dans la fin d’un autre : les deux blocs, la ligne partagée une fois hors de common', () => {
    const src = ['def test_a():', '    def test_b():', '        pass', 'x = 1'].join('\n');
    const { blocks, common } = blockTexts(src, [{ from: 1, title: 1 }, { from: 2, title: 2 }]);
    expect(blocks).toEqual(['def test_a():\n    def test_b():\n        pass', '    def test_b():\n        pass']);
    expect(common).toBe('x = 1');
  });

  it('fichier en \\r\\n : mêmes blocs, la ligne vide `\\r` ne compte pas', () => {
    const crlf = blockTexts(FILE.split('\n').join('\r\n'), HEADS);
    const lf = blockTexts(FILE, HEADS);
    expect(crlf.blocks.map((b) => b.replace(/\r/g, ''))).toEqual(lf.blocks);
    expect(crlf.common.replace(/\r/g, '')).toBe(lf.common);
  });

  it('un cas sans fermeture : son bloc va à la fin, common n’a que ce qui précède', () => {
    const src = ['import x', 'def test_a():', '    pass', '', '    more'].join('\n');
    expect(blockTexts(src, [{ from: 2, title: 2 }])).toEqual({ blocks: ['def test_a():\n    pass\n    more'], common: 'import x' });
  });
});
