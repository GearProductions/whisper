// Invariant du rendu Markdown de VibeCoder. Protégé : si un test échoue,
// corriger le code.
//   Note 0.8.0, « Ce que ça ne doit pas faire » : rendre du HTML venu d'un
//   texte (note, sortie d'un skill, réponse) — le rendu Markdown ne produit
//   que du texte, du code et des liens http(s) ouverts dans le navigateur
//   (I-21).
// Le type Block n'a pas de sorte « html » : une balise reste du texte, ses
// caractères tels quels ; un lien qui n'est pas en http(s) aussi.
import { describe, expect, it } from 'vitest';
import { parseMarkdown, type Block, type Inline } from 'core/vibecoder';

// Tous les éléments en ligne d'un document : titres, paragraphes, éléments de
// liste (et leurs sous-blocs), citations, cellules de tableau.
function inlines(blocks: Block[]): Inline[] {
  return blocks.flatMap((b): Inline[] => {
    switch (b.kind) {
      case 'heading': case 'paragraph': return b.inline;
      case 'list': return b.items.flatMap((i) => [...i.inline, ...inlines(i.children)]);
      case 'quote': return inlines(b.blocks);
      case 'table': return [...b.head.flat(), ...b.rows.flat(2)];
      default: return [];
    }
  });
}
// Le texte rendu, bout à bout ; les liens produits ; ce qui n'est pas du texte.
const text = (blocks: Block[]) => inlines(blocks).map((i) => i.text).join('');
const links = (blocks: Block[]) => inlines(blocks).filter((i): i is Extract<Inline, { kind: 'link' }> => i.kind === 'link');
const notText = (blocks: Block[]) => inlines(blocks).filter((i) => i.kind !== 'text');
// Les sortes de blocs du type Block, rien d'autre.
const KINDS: string[] = ['heading', 'paragraph', 'list', 'quote', 'code', 'table', 'rule'];
const all = (blocks: Block[]): Block[] => blocks.flatMap((b) => [b,
  ...(b.kind === 'quote' ? all(b.blocks) : b.kind === 'list' ? all(b.items.flatMap((i) => i.children)) : [])]);

describe('une balise HTML reste du texte', () => {
  it('<script>…</script>', () => {
    const blocks = parseMarkdown('<script>alert(1)</script>');
    // ses caractères restent, en texte
    expect(text(blocks)).toContain('<script>alert(1)</script>');
    // rien d'autre que du texte
    expect(notText(blocks)).toEqual([]);
  });

  it('<img src=x onerror=alert(1)>', () => {
    const blocks = parseMarkdown('<img src=x onerror=alert(1)>');
    // ses caractères restent, en texte
    expect(text(blocks)).toContain('<img src=x onerror=alert(1)>');
    // rien d'autre que du texte
    expect(notText(blocks)).toEqual([]);
  });

  it('<a href="javascript:…">', () => {
    const blocks = parseMarkdown('<a href="javascript:alert(1)">clic</a>');
    // ses caractères restent, en texte
    expect(text(blocks)).toContain('<a href="javascript:alert(1)">clic</a>');
    // rien d'autre que du texte : pas de lien
    expect(notText(blocks)).toEqual([]);
  });

  it('un bloc HTML sur plusieurs lignes : que des sortes de blocs connues', () => {
    const blocks = parseMarkdown('<div onclick="alert(1)">\n<script>alert(1)</script>\n</div>');
    // aucun bloc d'une autre sorte que celles du type
    expect(all(blocks).map((b) => b.kind).filter((k) => !KINDS.includes(k))).toEqual([]);
    // la balise reste, en texte
    expect(text(blocks)).toContain('<script>alert(1)</script>');
  });
});

describe('seul un lien http(s) est un lien', () => {
  it('[x](javascript:…) : pas un lien', () => {
    // aucun lien produit
    expect(links(parseMarkdown('[x](javascript:alert(1))'))).toEqual([]);
  });

  it('[x](JaVaScRiPt:…) : pas un lien', () => {
    // la casse ne change rien
    expect(links(parseMarkdown('[x](JaVaScRiPt:alert(1))'))).toEqual([]);
  });

  it('[x](data:…) : pas un lien', () => {
    // aucun lien produit
    expect(links(parseMarkdown('[x](data:text/html,<script>alert(1)</script>)'))).toEqual([]);
  });

  it('[x](file:…) : pas un lien', () => {
    // aucun lien produit
    expect(links(parseMarkdown('[x](file:///etc/passwd)'))).toEqual([]);
  });

  it('[x](vbscript:…) : pas un lien', () => {
    // aucun lien produit
    expect(links(parseMarkdown('[x](vbscript:msgbox(1))'))).toEqual([]);
  });

  it('[x](//hote) : pas un lien (depuis une page file://, il resterait en file:)', () => {
    // aucun lien produit
    expect(links(parseMarkdown('[x](//evil.test/x)'))).toEqual([]);
  });

  it('[x](https://…) : un lien, vers cette adresse', () => {
    // le lien, son texte et son adresse tels qu'écrits
    expect(links(parseMarkdown('[x](https://ok.test/a)'))).toEqual([{ kind: 'link', text: 'x', href: 'https://ok.test/a' }]);
  });

  it('[x](http://…) : un lien, vers cette adresse', () => {
    // le lien, son texte et son adresse tels qu'écrits
    expect(links(parseMarkdown('[x](http://ok.test/a)'))).toEqual([{ kind: 'link', text: 'x', href: 'http://ok.test/a' }]);
  });

  it('dans un document mêlé, tout lien produit est en http(s)', () => {
    const blocks = parseMarkdown('# [t](javascript:a())\n\nvoir [a](https://a.test), [b](file:///x) et [c](http://c.test)\n\n- [d](data:x)');
    // des liens sont produits
    expect(links(blocks).length).toBeGreaterThan(0);
    // aucun en dehors de http(s)
    expect(links(blocks).filter((l) => !/^https?:\/\//.test(l.href))).toEqual([]);
  });
});

describe('de même dans une liste, un tableau, une citation', () => {
  it('dans un élément de liste', () => {
    const blocks = parseMarkdown('- <img src=x onerror=alert(1)> [x](javascript:alert(1))');
    // la balise reste, en texte
    expect(text(blocks)).toContain('<img src=x onerror=alert(1)>');
    // aucun lien produit
    expect(links(blocks)).toEqual([]);
  });

  it('dans une cellule de tableau', () => {
    const blocks = parseMarkdown('| a | b |\n|---|---|\n| <img src=x onerror=alert(1)> | [x](javascript:alert(1)) |');
    // la balise reste, en texte
    expect(text(blocks)).toContain('<img src=x onerror=alert(1)>');
    // aucun lien produit
    expect(links(blocks)).toEqual([]);
  });

  it('dans une citation', () => {
    const blocks = parseMarkdown('> <img src=x onerror=alert(1)> [x](javascript:alert(1))');
    // la balise reste, en texte
    expect(text(blocks)).toContain('<img src=x onerror=alert(1)>');
    // aucun lien produit
    expect(links(blocks)).toEqual([]);
  });
});
