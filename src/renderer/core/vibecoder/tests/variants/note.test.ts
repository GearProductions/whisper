import { describe, expect, it } from 'vitest';
import { changedLines, excerpt, foldDiff, lineDiff, mustNotLine, mustNotTags, parseMarkdown, placeRemoved, removedGroups, type DiffLine } from 'core/vibecoder';

const same = (text: string): DiffLine => ({ kind: 'same', text });
const added = (text: string): DiffLine => ({ kind: 'added', text });
const removed = (text: string): DiffLine => ({ kind: 'removed', text });

describe('changedLines', () => {
  it('ligne ajoutée ou changée : son numéro dans le texte actuel', () => {
    expect([...changedLines(lineDiff('a\nb\nc', 'a\nB\nc\nd'))]).toEqual([1, 3]);
  });

  it('ligne retirée seulement : rien à surligner', () => {
    expect(changedLines(lineDiff('a\nb\nc', 'a\nc')).size).toBe(0);
  });

  it('ligne vide ajoutée : ne compte pas', () => {
    expect([...changedLines(lineDiff('a\nb', 'a\n\nb\nc'))]).toEqual([3]);
  });

  it('avant vide : toutes les lignes non vides', () => {
    expect([...changedLines(lineDiff('', '# T\n\n- x'))]).toEqual([0, 2]);
  });
});

describe('changedLines avec des retraits', () => {
  it('les numéros restent ceux du texte actuel, les lignes retirées ne comptent pas', () => {
    expect([...changedLines(lineDiff('a\nx\ny\nb\nc', 'a\nb\nC\nd'))]).toEqual([2, 3]);
  });
});

describe('removedGroups', () => {
  const cases: [string, string, string, { at: number; lines: string[] }[]][] = [
    ['une ligne changée : l\'ancienne, at sa ligne', 'a\nb\nc', 'a\nB\nc', [{ at: 1, lines: ['b'] }]],
    ['une ligne retirée seule', 'a\nb\nc', 'a\nc', [{ at: 1, lines: ['b'] }]],
    ['deux groupes séparés', 'a\nx\nb\nc\ny\nz\nd', 'a\nb\nc\nd', [{ at: 1, lines: ['x'] }, { at: 3, lines: ['y', 'z'] }]],
    ['un retrait en fin de texte : at = nombre de lignes', 'a\nb\nc', 'a', [{ at: 1, lines: ['b', 'c'] }]],
    ['un retrait au début : at 0', 'x\na', 'a', [{ at: 0, lines: ['x'] }]],
    ['tout retiré : at 0', 'a\nb', '', [{ at: 0, lines: ['a', 'b'] }]],
    ['rien de retiré : rien', 'a\nb', 'a\nb\nc', []],
    ['aucune différence : rien', 'a\nb', 'a\nb', []],
    ['diff vide : rien', '', '', []],
    ['des lignes vides dans un groupe : gardées', 'a\nx\n\ny\nb', 'a\nb', [{ at: 1, lines: ['x', '', 'y'] }]],
    ['une ligne vide au bord d\'un groupe : gardée', 'a\nx\n\nb', 'a\nb', [{ at: 1, lines: ['x', ''] }]],
  ];
  it.each(cases)('%s', (_name, before, after, want) => {
    expect(removedGroups(lineDiff(before, after))).toEqual(want);
  });

  it('un groupe de lignes vides seules : ignoré (le suivant garde son at)', () => {
    expect(removedGroups(lineDiff('a\n\nb\nx\nc', 'a\nb\nc'))).toEqual([{ at: 2, lines: ['x'] }]);
    expect(removedGroups([removed(''), removed('  '), same('a')])).toEqual([]);
  });

  it('un groupe de lignes vides seules en fin de texte : ignoré', () => {
    expect(removedGroups([same('a'), removed('')])).toEqual([]);
  });

  it('ajoutées et retirées mêlées : at ne compte que les lignes du texte actuel', () => {
    expect(removedGroups([added('n1'), added('n2'), removed('old'), added('n3'), same('s'), removed('end')]))
      .toEqual([{ at: 2, lines: ['old'] }, { at: 4, lines: ['end'] }]);
  });
});

describe('placeRemoved', () => {
  const place = (text: string, ...groups: [number, ...string[]][]) => {
    const p = placeRemoved(groups.map(([at, ...lines]) => ({ at, lines })), parseMarkdown(text), text);
    return { before: Object.fromEntries(p.before), end: p.end };
  };
  const cases: [string, string, [number, ...string[]], Record<number, string>, string | null][] = [
    ['au début d\'un paragraphe', '# T\n\npara\nsuite', [2, 'x'], { 2: 'x' }, null],
    ['au milieu d\'un paragraphe : devant lui entier', '# T\n\npara\nsuite\nfin', [3, 'x'], { 2: 'x' }, null],
    ['au milieu d\'un tableau : devant lui entier', 'a\n\n| a | b |\n| - | - |\n| 1 | 2 |\n| 3 | 4 |', [5, 'x'], { 2: 'x' }, null],
    ['au milieu d\'un bloc de code : devant lui entier, entre des clôtures', 'a\n\n```\nl1\nl2\n```\n\nb', [4, 'x'], { 2: '```\nx\n```' }, null],
    ['sur une ligne vide dans un bloc de code : le bloc de code, entre des clôtures', '```\nl1\n\nl2\n```', [2, 'x'], { 0: '```\nx\n```' }, null],
    ['sur la clôture ouvrante d\'un bloc de code : devant lui, sans clôtures', 'a\n\n```\nl1\n```', [2, 'x'], { 2: 'x' }, null],
    ['devant un élément de liste', '- a\n- b\n- c', [1, 'x'], { 1: 'x' }, null],
    ['dans une sous-liste : devant l\'élément le plus profond', '- a\n  - b\n  - c\n- d', [2, 'x'], { 2: 'x' }, null],
    ['au premier élément d\'une sous-liste', '- a\n  - b\n  - c\n- d', [1, 'x'], { 1: 'x' }, null],
    ['à un élément de premier niveau après une sous-liste', '- a\n  - b\n- d', [2, 'x'], { 2: 'x' }, null],
    ['au milieu d\'un élément (ligne de suite) : devant lui', '- a\n  suite\n- b', [1, 'x'], { 0: 'x' }, null],
    ['dans une liste dans une citation', '> - a\n> - b', [1, 'x'], { 1: 'x' }, null],
    ['sur une ligne vide entre deux blocs : le suivant', 'a\n\nb', [1, 'x'], { 2: 'x' }, null],
    ['sur plusieurs lignes vides : le suivant', 'a\n\n\n\nb', [2, 'x'], { 4: 'x' }, null],
    ['avant des lignes vides en tête du texte : le premier bloc', '\n\nabc', [0, 'x'], { 2: 'x' }, null],
    ['sur une ligne vide entre deux éléments de liste : l\'élément suivant', '- a\n\n- b', [1, 'x'], { 2: 'x' }, null],
    ['après le dernier bloc : end', 'a\n\nb', [3, 'x'], {}, 'x'],
    ['sur les lignes vides qui finissent le texte : end', 'a\nb\n\n', [2, 'x'], {}, 'x'],
    ['au milieu du dernier bloc : pas end', 'a\nb', [1, 'x'], { 0: 'x' }, null],
    ['texte vide : end', '', [0, 'x'], {}, 'x'],
    ['fins de ligne CRLF', 'a\r\n\r\nb', [1, 'x'], { 2: 'x' }, null],
  ];
  it.each(cases)('%s', (_name, text, group, before, end) => {
    expect(place(text, group)).toEqual({ before, end });
  });

  it('deux groupes d\'un même bloc : un seul Markdown, dans l\'ordre', () => {
    expect(place('p1\np2\np3', [1, 'x'], [2, 'y', 'z'])).toEqual({ before: { 0: 'x\ny\nz' }, end: null });
  });

  it('deux groupes de places différentes : un Markdown chacun ; au milieu et à la fin', () => {
    expect(place('a\n\nb\n\nc', [1, 'x'], [3, 'y'], [5, 'z'])).toEqual({ before: { 2: 'x', 4: 'y' }, end: 'z' });
    expect(place('a\n\nb', [3, 'x'], [3, 'y'])).toEqual({ before: {}, end: 'x\ny' });
  });

  it('deux groupes d\'un même endroit séparés par une ligne vide dans la note : une ligne vide entre eux', () => {
    expect(place('a\n\nb', [1, 'x'], [2, 'y'])).toEqual({ before: { 2: 'x\n\ny' }, end: null });
    expect(place('a\n\nb\n\n', [3, 'x'], [4, 'y'])).toEqual({ before: {}, end: 'x\n\ny' });
  });

  it('des retraits d\'un bloc de code : une seule paire de clôtures, texte tel quel (retrait, # et - gardés)', () => {
    expect(place('```\nl1\nl2\n```', [1, '  - x', '# t'])).toEqual({ before: { 0: '```\n  - x\n# t\n```' }, end: null });
    expect(place('```\nl1\n\nl2\n```', [1, 'x'], [3, 'y'])).toEqual({ before: { 0: '```\nx\n\ny\n```' }, end: null });
    const [code] = parseMarkdown(place('```\nl1\nl2\n```', [1, '  - x', '# t']).before[0]);
    expect(code).toMatchObject({ kind: 'code', text: '  - x\n# t' });
  });

  it('une puce imbriquée retirée, désindentée : reste une puce (pas un bloc de code)', () => {
    const { before } = place('- a\n  - b', [1, '  - gone']);
    expect(before[1]).toBe('- gone');
    expect(parseMarkdown(before[1])[0].kind).toBe('list');
  });

  it('retrait commun enlevé, retrait relatif gardé, lignes vides ignorées', () => {
    expect(place('- a\n  - b', [1, '    - x', '', '      - y']).before[1]).toBe('- x\n\n  - y');
  });

  it('lignes vides au bord d\'un groupe : coupées', () => {
    expect(place('a\n\nb', [1, 'x', '']).before[2]).toBe('x');
  });

  it('rien de retiré : rien', () => {
    expect(place('a\n\nb')).toEqual({ before: {}, end: null });
  });
});

describe('foldDiff', () => {
  const lines = (n: number, from = 0) => Array.from({ length: n }, (_, i) => same(`l${from + i}`));

  it('longue suite gardée entre deux changements : repliée, 3 lignes de contexte de chaque côté', () => {
    expect(foldDiff([added('a'), ...lines(10), removed('b')])).toEqual([
      added('a'), same('l0'), same('l1'), same('l2'), { kind: 'skip', count: 4 }, same('l7'), same('l8'), same('l9'), removed('b'),
    ]);
  });

  it('au début et à la fin du texte : seul le contexte du côté du changement reste', () => {
    expect(foldDiff([...lines(8), added('a'), ...lines(8, 8)], 2)).toEqual([
      { kind: 'skip', count: 6 }, same('l6'), same('l7'), added('a'), same('l8'), same('l9'), { kind: 'skip', count: 6 },
    ]);
  });

  it('une seule ligne à replier : affichée', () => {
    expect(foldDiff([added('a'), ...lines(7), added('b')])).toEqual([added('a'), ...lines(7), added('b')]);
  });

  it('rien de changé : tout replié', () => {
    expect(foldDiff(lines(5))).toEqual([{ kind: 'skip', count: 5 }]);
  });

  it('vide : vide', () => {
    expect(foldDiff([])).toEqual([]);
  });
});

describe('mustNotTags', () => {
  const md = [
    '# 0.8.0 — Note',                                     // 0
    '## Ce que ça fait',                                   // 1
    '- Lire la note',                                      // 2
    '## Ce que ça ne doit pas faire',                      // 3
    '- Lire un fichier qu\'une page désigne',              // 4
    '  → invariant',                                       // 5
    '- (à compléter)',                                     // 6
    '- [ ] Rendre du HTML → variant suffit, structure',    // 7
    '```',                                                 // 8
    '## pas un titre',                                     // 9
    '```',                                                 // 10
    '- Bloquer le fil (I-29). → review',                   // 11
    '## Forme',                                            // 12
    '- Lire un fichier qu\'une page désigne',              // 13
  ].join('\n');
  const mustNot = [
    { text: 'Lire un fichier qu\'une page désigne → invariant', mark: 'invariant' as const },
    { text: '[ ] Rendre du HTML → variant suffit, structure', mark: 'variant' as const },
    { text: 'Bloquer le fil (I-29). → review', mark: 'review' as const },
  ];

  it('chaque ligne de la rubrique : sa marque, au numéro de sa puce (marque sur une ligne de suite comprise)', () => {
    expect([...mustNotTags(md, mustNot)]).toEqual([[4, 'invariant'], [7, 'variant'], [11, 'review']]);
  });

  it('une puce hors de la rubrique, même de même texte : rien', () => {
    expect(mustNotTags(md, mustNot).has(2) || mustNotTags(md, mustNot).has(13)).toBe(false);
  });

  it('titre anglais, sans accents ni casse : reconnu ; ligne sans marque : null', () => {
    expect([...mustNotTags('## What it must NOT do\n* Leak a path', [{ text: 'Leak a path', mark: null }])]).toEqual([[1, null]]);
  });

  it('une puce absente du relevé (gabarit) : rien, la suivante garde la sienne', () => {
    expect([...mustNotTags('## Ce que ça ne doit pas faire\n- (rien)\n- X → invariant', [{ text: 'X → invariant', mark: 'invariant' }])])
      .toEqual([[2, 'invariant']]);
  });
});

describe('mustNotLine', () => {
  const md = [
    '## Ce que ça fait',                                   // 0
    '- Lire un fichier',                                   // 1
    '```',                                                 // 2
    '- Lire un fichier qu\'une page désigne → invariant',  // 3
    '```',                                                 // 4
    '## Ce que ça ne doit pas faire',                      // 5
    '- Lire un fichier',                                   // 6
    '- Lire un fichier qu\'une page',                      // 7
    '  désigne → invariant',                               // 8
    '',                                                    // 9
    '- Doublon',                                           // 10
    '- Doublon',                                           // 11
    '## Forme',                                            // 12
    '- Hors rubrique',                                     // 13
  ].join('\n');

  it('une puce sur deux lignes : la ligne de sa puce', () => {
    expect(mustNotLine(md, 'Lire un fichier qu\'une page désigne → invariant')).toBe(7);
    expect(mustNotLine(md, 'Lire un fichier')).toBe(6);
  });

  it('une puce de même début, d\'un autre texte : null', () => {
    expect(mustNotLine(md, 'Lire un fichier qu\'une page')).toBeNull();
    expect(mustNotLine(md, 'Lire un fichier qu\'une page désigne')).toBeNull();
  });

  it('la même phrase hors de la rubrique, ou dans un bloc de code : ignorée', () => {
    expect(mustNotLine(md, 'Hors rubrique')).toBeNull();
    expect(mustNotLine(md.replace(/## Ce que ça ne doit pas faire[^]*?## Forme/, '## Forme'), 'Lire un fichier qu\'une page désigne → invariant')).toBeNull();
  });

  it('deux puces identiques : la première', () => {
    expect(mustNotLine(md, 'Doublon')).toBe(10);
  });

  it('fins de ligne CRLF, titre anglais, puce numérotée : lues comme le principal', () => {
    expect(mustNotLine('## What it must not do\r\n1. Leak a\r\n   path\r\n', 'Leak a path')).toBe(1);
  });

  it('rubrique absente, puce retirée, texte vide : null', () => {
    expect(mustNotLine('## Forme\n- X', 'X')).toBeNull();
    expect(mustNotLine('', 'X')).toBeNull();
  });

  it('une rubrique qui suit un autre titre ## : la suite de la dernière puce ne la franchit pas', () => {
    expect(mustNotLine('## Ce que ça ne doit pas faire\n- A\n## Forme\ntexte', 'A texte')).toBeNull();
  });
});

describe('excerpt', () => {
  it('sur une ligne, coupé avec « … »', () => {
    expect(excerpt('  un\n texte   long ', 9)).toBe('un texte…');
    expect(excerpt('court', 9)).toBe('court');
  });
});
