import { describe, expect, it } from 'vitest';
import { parseInline, parseMarkdown, tagCover, tagOf, tagSplit, untag, type Inline } from 'core/vibecoder';

const t = (text: string): Inline => ({ kind: 'text', text });
const code = (text: string): Inline => ({ kind: 'code', text });
const cover = (md: string) => tagCover(parseMarkdown(md));

describe('tagOf', () => {
  it('lit l\'étiquette en tête, blancs permis, et la retire', () => {
    expect(tagOf('[toi] a')).toEqual({ tag: 'toi', text: 'a' });
    expect(tagOf('  [agent] a')).toEqual({ tag: 'agent', text: 'a' });
    expect(tagOf('[toi]')).toEqual({ tag: 'toi', text: '' });
  });

  it('ailleurs, ou une autre étiquette : null, le texte tel quel', () => {
    expect(tagOf('a [toi]')).toEqual({ tag: null, text: 'a [toi]' });
    expect(tagOf('[x] a')).toEqual({ tag: null, text: '[x] a' });
    expect(tagOf('[toi]a')).toEqual({ tag: null, text: '[toi]a' });
    expect(tagOf('[Toi] a')).toEqual({ tag: null, text: '[Toi] a' });
    expect(tagOf('')).toEqual({ tag: null, text: '' });
  });
});

describe('untag', () => {
  it('un point : l\'étiquette en tête, head vide', () => {
    expect(untag(parseInline('[agent] — b'))).toEqual({ tag: 'agent', head: [], rest: [t('— b')] });
  });

  it('une remarque : l\'adresse reste en head, intacte', () => {
    expect(untag(parseInline('`a.ts:L12` [agent] — b'))).toEqual({ tag: 'agent', head: [code('a.ts:L12')], rest: [t('— b')] });
    expect(untag(parseInline('`src/a.ts:L12-38` [toi] b'))).toEqual({ tag: 'toi', head: [code('src/a.ts:L12-38')], rest: [t('b')] });
  });

  it('une remarque comme ponytail.md l\'écrit, l\'adresse sans backticks : en head, intacte', () => {
    expect(untag(parseInline('src/a.ts:L12 [agent] — b'))).toEqual({ tag: 'agent', head: [t('src/a.ts:L12')], rest: [t('— b')] });
    expect(untag(parseInline('a.ts:L12-38 [toi] **b**'))).toEqual({ tag: 'toi', head: [t('a.ts:L12-38')], rest: [{ kind: 'strong', text: 'b' }] });
    const plain = parseInline('a.ts:L12 — b [agent]');
    expect(untag(plain)).toEqual({ tag: null, head: [], rest: plain });
  });

  it('sans étiquette : tag null, head vide, rest = inline', () => {
    for (const md of ['a [toi] b', '`a.ts:L12` — b', '`x` [agent] b', '**[agent]** b', '[x] a', '']) {
      const inline = parseInline(md);
      expect(untag(inline)).toEqual({ tag: null, head: [], rest: inline });
    }
  });

  it('ce qui suit l\'étiquette garde sa mise en forme', () => {
    expect(untag(parseInline('[toi] **a** `b`'))).toEqual({ tag: 'toi', head: [], rest: [{ kind: 'strong', text: 'a' }, t(' '), code('b')] });
    expect(untag(parseInline('`a.ts:L3` [agent] **b**'))).toEqual({ tag: 'agent', head: [code('a.ts:L3')], rest: [{ kind: 'strong', text: 'b' }] });
  });

  it('une étiquette seule : rest vide', () => {
    expect(untag(parseInline('[agent]'))).toEqual({ tag: 'agent', head: [], rest: [] });
  });
});

describe('tagCover', () => {
  it('un align.md : la rubrique sous un titre étiqueté, jusqu\'au titre suivant', () => {
    expect(cover('intro\n\n## [toi] A\n\ntexte\n\n- un\n- deux\n\n## [agent] B')).toEqual([null, 'toi', 'toi', 'toi', 'agent']);
    expect(cover('## [toi] A\n\ntexte\n\n- un\n\n## [agent] B')).toEqual(['toi', 'toi', 'toi', 'agent']);
  });

  it('un sous-titre sans étiquette hérite, un sous-titre étiqueté garde la sienne', () => {
    expect(cover('## [agent] A\n\n### B\n\nx\n\n### [toi] C\n\ny\n\n### D\n\nz')).toEqual(['agent', 'agent', 'agent', 'toi', 'toi', 'agent', 'agent']);
    expect(cover('## [toi] A\n\n### [agent] B\n\n#### C\n\nx')).toEqual(['toi', 'agent', 'agent', 'agent']);
  });

  it('un titre de même niveau ou plus haut, sans étiquette : null', () => {
    expect(cover('## [toi] A\n\nx\n\n## B\n\ny')).toEqual(['toi', 'toi', null, null]);
    expect(cover('### [toi] A\n\n# B\n\ny')).toEqual(['toi', null, null]);
    expect(cover('## [agent] A\n\n### [toi] B\n\n## C\n\nx')).toEqual(['agent', 'toi', null, null]);
  });

  it('sans titre, ou sans étiquette : null ; aucun bloc : rien', () => {
    expect(cover('a\n\n- b')).toEqual([null, null]);
    expect(cover('## A\n\nb')).toEqual([null, null]);
    expect(cover('')).toEqual([]);
  });

  it('une étiquette qui n\'est pas en tête d\'un titre ne couvre rien', () => {
    expect(cover('## A [toi]\n\n[agent] b')).toEqual([null, null]);
  });
});

describe('tagSplit', () => {
  const lost = (md: string) => {
    const s = tagSplit(md);
    const got = [s.toi, s.agent, s.rest].join('\n').split('\n').filter((l) => l.trim()).sort();
    expect(got).toEqual(md.split(/\r?\n/).filter((l) => l.trim()).sort());
  };

  it('deux rubriques [toi] et une [agent] : chacune de son côté, un pour l\'agent', () => {
    const md = '## [toi] A\n\nun\n\n## [agent] B\n\ndeux\n\n## [toi] C\n\ntrois';
    expect(tagSplit(md)).toEqual({ toi: '## [toi] A\n\nun\n\n## [toi] C\n\ntrois', agent: '## [agent] B\n\ndeux', agents: 1, rest: '' });
    lost(md);
  });

  it('une rubrique [toi] et son sous-titre sans étiquette : ensemble', () => {
    const md = 'intro\n\n## [toi] A\n\nx\n\n### B\n\ny\n\n## [agent] C\n\nz';
    expect(tagSplit(md)).toEqual({ toi: '## [toi] A\n\nx\n\n### B\n\ny', agent: '## [agent] C\n\nz', agents: 1, rest: 'intro' });
    lost(md);
  });

  it('une liste de remarques, l\'étiquette après l\'adresse : chaque remarque de son côté, avec ses sous-points', () => {
    const md = '- `a.ts:L1` [toi] une\n  - détail un\n- `b.ts:L2` [agent] deux\n  - détail deux\n- sans étiquette';
    expect(tagSplit(md)).toEqual({
      toi: '- `a.ts:L1` [toi] une\n  - détail un',
      agent: '- `b.ts:L2` [agent] deux\n  - détail deux',
      agents: 1,
      rest: '- sans étiquette',
    });
    lost(md);
  });

  it('trois remarques [agent] : trois', () => {
    const md = '- [agent] a\n- [agent] b\n- [agent] c';
    expect(tagSplit(md)).toEqual({ toi: '', agent: md, agents: 3, rest: '' });
  });

  it('un fichier d\'une ligne sans étiquette : tout dans le reste', () => {
    expect(tagSplit('Aligné.')).toEqual({ toi: '', agent: '', agents: 0, rest: 'Aligné.' });
  });

  it('une étiquette dans un bloc de code : pas lue', () => {
    const md = '```\n## [agent] A\n- [toi] b\n```\n\n```md\n[toi] x\n```';
    expect(tagSplit(md)).toEqual({ toi: '', agent: '', agents: 0, rest: md });
  });

  it('une rubrique [agent] : une, ses puces non comptées ; une puce [agent] sans rubrique : comptée', () => {
    expect(tagSplit('## [agent] A\n\n- [agent] a\n- b').agents).toBe(1);
    expect(tagSplit('## [toi] A\n\n- [agent] a\n- b')).toEqual({ toi: '## [toi] A\n\n- b', agent: '- [agent] a', agents: 1, rest: '' });
  });

  it('rien, ou des blancs : tout vide', () => {
    expect(tagSplit('')).toEqual({ toi: '', agent: '', agents: 0, rest: '' });
    expect(tagSplit('\n\n')).toEqual({ toi: '', agent: '', agents: 0, rest: '' });
  });

  it('un titre de même niveau sans étiquette ferme la rubrique ; un plus bas hérite', () => {
    const md = '## [toi] A\n\n#### B\n\nx\n\n## C\n\ny';
    expect(tagSplit(md)).toEqual({ toi: '## [toi] A\n\n#### B\n\nx', agent: '', agents: 0, rest: '## C\n\ny' });
  });

  it('un texte avant le premier titre, une liste imbriquée, un retour CRLF : rien de perdu', () => {
    lost('avant\r\n\r\n## [toi] A\r\n\r\n- a\r\n  - b\r\n    - [agent] c\r\n\r\n## [agent] D\r\n\r\n1. x\r\n2. y');
    lost('# T\n\n> [toi] cité\n\n| a | b |\n|---|---|\n| [toi] | 1 |\n\n---\n\n- [toi] fin');
  });

  it('une sous-remarque étiquetée reste avec son parent', () => {
    expect(tagSplit('- [toi] a\n  - [agent] b')).toEqual({ toi: '- [toi] a\n  - [agent] b', agent: '', agents: 0, rest: '' });
  });
});
