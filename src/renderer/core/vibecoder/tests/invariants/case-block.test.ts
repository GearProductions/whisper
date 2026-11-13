// Invariant de l'enregistrement du bloc d'un cas (note 0.15.0,
// docs/tickets/feat/0.15.0-ecran-statuts.md, « Ce que ça ne doit pas faire ») :
//   « Modifier, en enregistrant le bloc d'un cas, une autre ligne du fichier de
//   test que celles de ce bloc ».
// La page recoud le fichier qu'elle enregistre : les lignes du bloc d'un cas
// (caseRange, sur le texte du fichier), puis le fichier dont seules ces lignes
// sont remplacées par le bloc modifié (replaceRange). Chaque ligne hors du bloc,
// fin de ligne comprise, reste celle du fichier.
// Le passage par l'éditeur d'un cas : app/panel/vibecoder/tests/invariants/case-draft.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Les fonctions pures, appelées telles quelles.
import { describe, expect, it } from 'vitest';
import { caseRange, replaceRange, type CaseRange } from 'core/vibecoder';
import type { VibeTestFile } from 'technicals/bridge';

// Un fichier de test de trois cas, dans un describe, terminé par un saut de ligne.
const SOURCE = [
  "import { describe, expect, it } from 'vitest';",   // 1
  '',                                                  // 2
  "describe('trois cas', () => {",                     // 3
  "  it('premier cas', () => {",                       // 4
  '    expect(1).toBe(1);',                            // 5
  '  });',                                             // 6
  '',                                                  // 7
  "  it('deuxième cas', () => {",                      // 8
  '    expect(2).toBe(2);',                            // 9
  '  });',                                             // 10
  '',                                                  // 11
  "  it('troisième cas', () => {",                     // 12
  '    expect(3).toBe(3);',                            // 13
  '  });',                                             // 14
  '});',                                               // 15
  '',
].join('\n');

// Le fichier tel que le relevé le donne : ses cas et la ligne de chacun.
const testFile = (source: string): VibeTestFile => ({
  id: 'i0', path: 'src/x/tests/invariants/x.test.ts', blob: '0'.repeat(40),
  cases: ['premier cas', 'deuxième cas', 'troisième cas'], lines: [4, 8, 12],
  source, reading: null, marks: {},
});

// Un bloc modifié plus long que l'original.
const LONGER = ["  it('premier cas', () => {", '    const a = 1;', '    const b = 1;', '    expect(a).toBe(b);', '  });'].join('\n');

// Les lignes du texte, chacune avec ce qui la termine (un \r reste au bout de sa ligne).
const lines = (text: string) => text.split('\n');
// Les lignes avant le bloc.
const linesBefore = (text: string, range: CaseRange) => lines(text).slice(0, range.from - 1);
// Les `n` dernières lignes : celles qui suivaient le bloc, quand n est leur nombre dans l'original.
const lastLines = (text: string, n: number) => lines(text).slice(lines(text).length - n);
// Le nombre de lignes qui suivent le bloc dans l'original.
const afterCount = (text: string, range: CaseRange) => lines(text).length - range.to;

// La plage du cas, que le test ne peut pas commencer sans elle.
function rangeOf(file: VibeTestFile, i: number): CaseRange {
  const range = caseRange(file, i);
  if (!range) throw new Error(`aucune plage pour le cas ${i}`);
  return range;
}
// Le fichier recousu, que le test ne peut pas vérifier sans lui.
function sewn(text: string, range: CaseRange, block: string): string {
  const result = replaceRange(text, range, block);
  if (result === null) throw new Error('replaceRange a refusé une plage du texte');
  return result;
}

describe('enregistrer le bloc d’un cas ne modifie aucune ligne du fichier hors de ce bloc', () => {
  it('le premier cas remplacé par un bloc plus long : les lignes d’avant et d’après sont celles du fichier', () => {
    const file = testFile(SOURCE);
    const range = rangeOf(file, 0);

    const result = sewn(SOURCE, range, LONGER);

    // témoin : le bloc modifié est dans le fichier
    expect(result).toContain(LONGER);
    // les lignes avant le bloc sont celles du fichier
    expect(linesBefore(result, range)).toEqual(linesBefore(SOURCE, range));
    // les lignes après le bloc sont celles du fichier
    expect(lastLines(result, afterCount(SOURCE, range))).toEqual(lastLines(SOURCE, afterCount(SOURCE, range)));
  });

  it('le premier cas remplacé par un bloc plus court : les lignes d’avant et d’après sont celles du fichier', () => {
    const file = testFile(SOURCE);
    const range = rangeOf(file, 0);
    const shorter = "  it('premier cas', () => {});";

    const result = sewn(SOURCE, range, shorter);

    // témoin : le bloc modifié est dans le fichier
    expect(result).toContain(shorter);
    // les lignes avant le bloc sont celles du fichier
    expect(linesBefore(result, range)).toEqual(linesBefore(SOURCE, range));
    // les lignes après le bloc sont celles du fichier
    expect(lastLines(result, afterCount(SOURCE, range))).toEqual(lastLines(SOURCE, afterCount(SOURCE, range)));
  });

  // Le bloc entièrement effacé dans l'éditeur.
  it('le premier cas remplacé par un bloc vide : les lignes d’avant et d’après sont celles du fichier', () => {
    const file = testFile(SOURCE);
    const range = rangeOf(file, 0);

    const result = sewn(SOURCE, range, '');

    // témoin : le code du cas n'est plus dans le fichier
    expect(result).not.toContain('expect(1).toBe(1);');
    // les lignes avant le bloc sont celles du fichier
    expect(linesBefore(result, range)).toEqual(linesBefore(SOURCE, range));
    // les lignes après le bloc sont celles du fichier
    expect(lastLines(result, afterCount(SOURCE, range))).toEqual(lastLines(SOURCE, afterCount(SOURCE, range)));
  });

  it('un cas du milieu remplacé : les cas d’avant et d’après sont ceux du fichier', () => {
    const file = testFile(SOURCE);
    const range = rangeOf(file, 1);
    const block = ["  it('deuxième cas', () => {", '    expect(20).toBe(20);', '  });'].join('\n');

    const result = sewn(SOURCE, range, block);

    // témoin : le bloc modifié est dans le fichier
    expect(result).toContain(block);
    // les lignes avant le bloc sont celles du fichier
    expect(linesBefore(result, range)).toEqual(linesBefore(SOURCE, range));
    // les lignes après le bloc sont celles du fichier
    expect(lastLines(result, afterCount(SOURCE, range))).toEqual(lastLines(SOURCE, afterCount(SOURCE, range)));
  });

  // Le dernier cas va jusqu'à la fin du fichier, sans ses lignes vides : le saut de ligne final reste hors du bloc.
  it('le dernier cas remplacé : les lignes d’avant et la fin du fichier sont celles du fichier', () => {
    const file = testFile(SOURCE);
    const range = rangeOf(file, 2);
    const block = ["  it('troisième cas', () => {", '    expect(30).toBe(30);', '  });', '});'].join('\n');

    const result = sewn(SOURCE, range, block);

    // témoin : le bloc modifié est dans le fichier
    expect(result).toContain(block);
    // les lignes avant le bloc sont celles du fichier
    expect(linesBefore(result, range)).toEqual(linesBefore(SOURCE, range));
    // la fin du fichier, après le bloc, est celle du fichier
    expect(lastLines(result, afterCount(SOURCE, range))).toEqual(lastLines(SOURCE, afterCount(SOURCE, range)));
  });

  // Un fichier écrit sous Windows : chaque ligne hors du bloc garde son \r\n.
  it('un fichier en \\r\\n : les lignes hors du bloc gardent leur fin de ligne', () => {
    const crlf = SOURCE.split('\n').join('\r\n');
    const file = testFile(crlf);
    const range = rangeOf(file, 1);

    const result = sewn(crlf, range, "  it('deuxième cas', () => {});");

    // témoin : le code d'origine du cas n'est plus dans le fichier
    expect(result).not.toContain('expect(2).toBe(2);');
    // les lignes avant le bloc sont celles du fichier, \r compris
    expect(linesBefore(result, range)).toEqual(linesBefore(crlf, range));
    // les lignes après le bloc sont celles du fichier, \r compris
    expect(lastLines(result, afterCount(crlf, range))).toEqual(lastLines(crlf, afterCount(crlf, range)));
  });

  // Une plage qui ne tient pas dans le fichier (le fichier a raccourci) : rien à enregistrer, plutôt qu'un ajout ailleurs.
  it('une plage au-delà de la fin du fichier : rien n’est rendu à enregistrer', () => {
    const beyond = { from: lines(SOURCE).length + 5, to: lines(SOURCE).length + 7 };

    const result = replaceRange(SOURCE, beyond, "  it('premier cas', () => {});");

    // aucun fichier recousu
    expect(result).toBeNull();
  });
});
