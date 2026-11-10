import { describe, expect, it } from 'vitest';
import { changedLines, excerpt, foldDiff, lineDiff, mustNotLine, mustNotTags, type DiffLine } from 'core/vibecoder';

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
