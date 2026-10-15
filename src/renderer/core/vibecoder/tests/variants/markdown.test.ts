import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseMarkdown, type Block, type Inline } from 'core/vibecoder';

const t = (text: string): Inline => ({ kind: 'text', text });
const item = (text: string, line: number, over: object = {}) => ({ inline: [t(text)], checked: null, line, children: [], ...over });
const kinds = (md: string) => parseMarkdown(md).map((b) => b.kind);
// Les éléments en ligne du premier bloc, titre ou paragraphe.
const firstInline = (md: string) => {
  const [b] = parseMarkdown(md);
  return b.kind === 'heading' || b.kind === 'paragraph' ? b.inline : null;
};

describe('titres', () => {
  it('# à ###### : le niveau, le texte et la ligne', () => {
    expect(parseMarkdown('# Un\n### Trois\n###### Six')).toEqual([
      { kind: 'heading', level: 1, inline: [t('Un')], line: 0 },
      { kind: 'heading', level: 3, inline: [t('Trois')], line: 1 },
      { kind: 'heading', level: 6, inline: [t('Six')], line: 2 },
    ]);
  });

  it('#mot sans espace, ####### : pas un titre', () => {
    expect(kinds('#mot\n\n####### sept')).toEqual(['paragraph', 'paragraph']);
  });

  it('# Titre ## : les # de fin retirés, ceux de C# gardés', () => {
    expect(firstInline('# Titre ##')).toEqual([t('Titre')]);
    expect(firstInline('# C#')).toEqual([t('C#')]);
  });
});

describe('paragraphes', () => {
  it('lignes qui se suivent : un paragraphe, jointes par une espace', () => {
    expect(parseMarkdown('un\n  deux\ntrois')).toEqual([{ kind: 'paragraph', inline: [t('un deux trois')], line: 0 }]);
  });

  it('ligne vide : un paragraphe de plus, à sa ligne', () => {
    expect(parseMarkdown('un\n\n\ndeux')).toEqual([
      { kind: 'paragraph', inline: [t('un')], line: 0 },
      { kind: 'paragraph', inline: [t('deux')], line: 3 },
    ]);
  });

  it('fins de ligne CRLF : les mêmes blocs, aux mêmes lignes', () => {
    const md = '# T\n\n- a\n  b\n\n```\nx\n```';
    expect(parseMarkdown(md.replace(/\n/g, '\r\n'))).toEqual(parseMarkdown(md));
  });
});

describe('listes', () => {
  it('-, * ou + : une liste non ordonnée', () => {
    for (const bullet of ['-', '*', '+']) {
      expect(parseMarkdown(`${bullet} a\n${bullet} b`)).toEqual([{ kind: 'list', ordered: false, items: [item('a', 0), item('b', 1)], line: 0 }]);
    }
  });

  it('1. ou 1) : une liste ordonnée', () => {
    for (const n of ['1.', '1)']) {
      expect(parseMarkdown(`${n} a\n${n} b`)).toEqual([{ kind: 'list', ordered: true, items: [item('a', 0), item('b', 1)], line: 0 }]);
    }
  });

  it('sous-liste indentée : dans son élément, à sa ligne', () => {
    expect(parseMarkdown('- a\n  - b\n    - c\n- d')).toEqual([{ kind: 'list', ordered: false, line: 0, items: [
      item('a', 0, { children: [{ kind: 'list', ordered: false, line: 1, items: [
        item('b', 1, { children: [{ kind: 'list', ordered: false, line: 2, items: [item('c', 2)] }] }),
      ] }] }),
      item('d', 3),
    ] }]);
  });

  it('sous-liste indentée de deux espaces sous « 1. » : dans son élément aussi', () => {
    expect(parseMarkdown('1. a\n  - b\n2. c')).toEqual([{ kind: 'list', ordered: true, line: 0, items: [
      item('a', 0, { children: [{ kind: 'list', ordered: false, line: 1, items: [item('b', 1)] }] }),
      item('c', 2),
    ] }]);
  });

  it('cases à cocher : [ ] non cochée, [x] et [X] cochées, sans case null', () => {
    expect(parseMarkdown('- [ ] à faire\n- [x] fait\n- [X] fait aussi\n- rien\n  - [x] sous-tâche')).toEqual([{ kind: 'list', ordered: false, line: 0, items: [
      item('à faire', 0, { checked: false }),
      item('fait', 1, { checked: true }),
      item('fait aussi', 2, { checked: true }),
      item('rien', 3, { children: [{ kind: 'list', ordered: false, line: 4, items: [item('sous-tâche', 4, { checked: true })] }] }),
    ] }]);
  });

  it('[x](https://…) en tête d\'élément : un lien, pas une case', () => {
    const [list] = parseMarkdown('- [x](https://a.test)');
    expect(list.kind === 'list' && list.items[0]).toEqual({ inline: [{ kind: 'link', text: 'x', href: 'https://a.test' }], checked: null, line: 0, children: [] });
  });

  it('ligne suivante, indentée ou non : le même élément', () => {
    expect(parseMarkdown('- un\n  deux\ntrois\n- quatre')).toEqual([{ kind: 'list', ordered: false, line: 0, items: [item('un deux trois', 0), item('quatre', 3)] }]);
  });

  it('ligne vide entre deux éléments : une seule liste', () => {
    expect(parseMarkdown('- a\n\n- b')).toEqual([{ kind: 'list', ordered: false, line: 0, items: [item('a', 0), item('b', 2)] }]);
  });

  it('ligne vide puis texte non indenté : la liste s\'arrête', () => {
    expect(kinds('- a\n\ntexte')).toEqual(['list', 'paragraph']);
  });

  it('liste juste après un paragraphe, sans ligne vide : elle commence', () => {
    expect(kinds('Les étapes :\n1. a\n2. b')).toEqual(['paragraph', 'list']);
  });

  it('ordonnée puis non ordonnée : deux listes', () => {
    expect(parseMarkdown('1. a\n- b').map((b) => b.kind === 'list' && b.ordered)).toEqual([true, false]);
  });
});

describe('code', () => {
  it('``` et son langage : le texte tel quel, rien d\'interprété', () => {
    expect(parseMarkdown('```ts\n# pas un titre\n- pas une liste\n<b>**x**</b> [x](https://a.test)\n```\nsuite')).toEqual([
      { kind: 'code', lang: 'ts', text: '# pas un titre\n- pas une liste\n<b>**x**</b> [x](https://a.test)', line: 0 },
      { kind: 'paragraph', inline: [t('suite')], line: 5 },
    ]);
  });

  it('~~~ : fermé par ~~~, pas par ```', () => {
    expect(parseMarkdown('~~~\na\n```\nb\n~~~')).toEqual([{ kind: 'code', lang: '', text: 'a\n```\nb', line: 0 }]);
  });

  it('bloc non fermé : jusqu\'à la fin du texte', () => {
    expect(parseMarkdown('```sh\nnpm test\n\n# fin')).toEqual([{ kind: 'code', lang: 'sh', text: 'npm test\n\n# fin', line: 0 }]);
  });

  it('dans un élément de liste : un sous-bloc, sans l\'indentation de l\'élément', () => {
    expect(parseMarkdown('1. Lancer :\n   ```sh\n   npm test\n\n     --watch\n   ```\n2. Lire')).toEqual([{ kind: 'list', ordered: true, line: 0, items: [
      item('Lancer :', 0, { children: [{ kind: 'code', lang: 'sh', text: 'npm test\n\n  --watch', line: 1 }] }),
      item('Lire', 6),
    ] }]);
  });
});

describe('tableaux', () => {
  it('en-tête, séparateur, lignes : des cellules en ligne', () => {
    expect(parseMarkdown('| a | **b** |\n|:---|---:|\n| 1 | `2` |\n| 3 | 4 |')).toEqual([{ kind: 'table', line: 0,
      head: [[t('a')], [{ kind: 'strong', text: 'b' }]],
      rows: [[[t('1')], [{ kind: 'code', text: '2' }]], [[t('3')], [t('4')]]],
    }]);
  });

  it('sans | aux bords : un tableau aussi', () => {
    expect(kinds('a | b\n--|--\n1 | 2')).toEqual(['table']);
  });

  it('\\| : une barre dans la cellule, même dans du code', () => {
    expect(parseMarkdown('| a \\| b | c |\n|---|---|\n| `x\\|y` | z |')).toEqual([{ kind: 'table', line: 0,
      head: [[t('a | b')], [t('c')]],
      rows: [[[{ kind: 'code', text: 'x|y' }], [t('z')]]],
    }]);
  });

  it('séparateur d\'un autre nombre de colonnes : pas un tableau', () => {
    expect(kinds('a | b\n---')).toEqual(['paragraph', 'rule']);
  });

  it('ligne sans | : le tableau s\'arrête', () => {
    expect(kinds('| a |\n|---|\n| 1 |\nTotal')).toEqual(['table', 'paragraph']);
  });
});

describe('citations', () => {
  it('> : des blocs, chacun à sa ligne du texte', () => {
    expect(parseMarkdown('avant\n\n> # Titre\n> - a\n>\n> texte')).toEqual([
      { kind: 'paragraph', inline: [t('avant')], line: 0 },
      { kind: 'quote', line: 2, blocks: [
        { kind: 'heading', level: 1, inline: [t('Titre')], line: 2 },
        { kind: 'list', ordered: false, line: 3, items: [item('a', 3)] },
        { kind: 'paragraph', inline: [t('texte')], line: 5 },
      ] },
    ]);
  });

  it('> > : une citation dans la citation', () => {
    expect(parseMarkdown('> > a\n> b')).toEqual([{ kind: 'quote', line: 0, blocks: [
      { kind: 'quote', line: 0, blocks: [{ kind: 'paragraph', inline: [t('a')], line: 0 }] },
      { kind: 'paragraph', inline: [t('b')], line: 1 },
    ] }]);
  });
});

describe('filets', () => {
  it('---, ***, ___, - - - : un filet', () => {
    expect(parseMarkdown('---\n\n***\n\n___\n\n- - -')).toEqual([0, 2, 4, 6].map((line) => ({ kind: 'rule', line })));
  });
});

describe('en ligne', () => {
  it('`code`, **gras**, __gras__, *italique*, _italique_', () => {
    expect(firstInline('a `b` **c** __d__ *e* _f_')).toEqual([
      t('a '), { kind: 'code', text: 'b' }, t(' '), { kind: 'strong', text: 'c' }, t(' '), { kind: 'strong', text: 'd' },
      t(' '), { kind: 'em', text: 'e' }, t(' '), { kind: 'em', text: 'f' },
    ]);
  });

  it('snake_case, 2 * 3 * 4 : du texte, pas d\'italique', () => {
    expect(firstInline('USE_POLL_WATCHER et run_in_background, 2 * 3 * 4')).toEqual([t('USE_POLL_WATCHER et run_in_background, 2 * 3 * 4')]);
  });

  it('dans le code, rien d\'autre : ni gras, ni lien, ni balise', () => {
    expect(firstInline('`**a** [x](https://a.test) <b>`')).toEqual([{ kind: 'code', text: '**a** [x](https://a.test) <b>' }]);
  });

  it('du gras autour de code ou d\'un lien : le code et le lien restent', () => {
    expect(firstInline('**voir `f` et [x](https://a.test)**')).toEqual([
      { kind: 'strong', text: 'voir ' }, { kind: 'code', text: 'f' }, { kind: 'strong', text: ' et ' },
      { kind: 'link', text: 'x', href: 'https://a.test' },
    ]);
  });

  it('[texte](https://…) : le lien, son texte sans les marques', () => {
    expect(firstInline('[`f` **g**](https://a.test/x)')).toEqual([{ kind: 'link', text: 'f g', href: 'https://a.test/x' }]);
  });

  it('HTTPS:// en majuscules : un lien aussi, vers l\'adresse telle qu\'écrite', () => {
    expect(firstInline('[y](HTTPS://B.TEST/Y)')).toEqual([{ kind: 'link', text: 'y', href: 'HTTPS://B.TEST/Y' }]);
  });

  it('adresse nue : un lien, sans la ponctuation qui la suit', () => {
    expect(firstInline('voir https://a.test/x. et (https://b.test/y_(z)).')).toEqual([
      t('voir '), { kind: 'link', text: 'https://a.test/x', href: 'https://a.test/x' }, t('. et ('),
      { kind: 'link', text: 'https://b.test/y_(z)', href: 'https://b.test/y_(z)' }, t(').'),
    ]);
  });

  it('\\* \\_ \\` : le caractère tel quel', () => {
    expect(firstInline('\\*pas en italique\\* \\_ \\`')).toEqual([t('*pas en italique* _ `')]);
  });
});

describe('une note réelle : 0.7.0-taches-en-arriere-plan.md', () => {
  const md = fs.readFileSync(path.resolve(__dirname, '../../../../../../docs/tickets/feat/0.7.0-taches-en-arriere-plan.md'), 'utf8').replace(/\r\n/g, '\n'); // Windows : la copie de travail est en CRLF
  // Le texte rendu, bloc après bloc ; le langage d'un bloc de code compris.
  const rendered = (blocks: Block[]): string[] => blocks.flatMap((b): string[] => {
    switch (b.kind) {
      case 'heading': case 'paragraph': return b.inline.map((i) => i.text);
      case 'list': return b.items.flatMap((i) => [...i.inline.map((x) => x.text), ...rendered(i.children)]);
      case 'quote': return rendered(b.blocks);
      case 'code': return [b.lang, b.text];
      case 'table': return [...b.head.flat(), ...b.rows.flat(2)].map((i) => i.text);
      case 'rule': return [];
    }
  });
  const words = (s: string) => s.match(/[\p{L}\p{N}]+/gu) ?? [];

  it('aucun mot perdu ni ajouté, dans l\'ordre', () => {
    expect(words(rendered(parseMarkdown(md)).join(' '))).toEqual(words(md));
  });

  it('ses rubriques : des titres, à leur ligne', () => {
    expect(parseMarkdown(md).filter((b) => b.kind === 'heading').map((b) => b.line)).toEqual([0, 5, 38, 53, 71, 116]);
  });

  it('sa Forme : un bloc de code, tel quel', () => {
    expect(parseMarkdown(md).find((b) => b.kind === 'code')).toEqual({ kind: 'code', lang: '', text: md.split('\n').slice(81, 114).join('\n'), line: 80 });
  });
});
