/** markdown — un texte Markdown (note, sortie d'un skill, réponse) en blocs :
 *  titres, paragraphes, listes (cases à cocher), citations, code, tableaux,
 *  filets ; en ligne (parseInline, aussi seul) : texte, code, gras,
 *  italique, liens http(s). Jamais de HTML : une balise reste du texte, un
 *  lien qui n'est pas en http(s) aussi (I-21).
 *  Ne connaît pas : le DOM, React. Utilisé par : app/panel/vibecoder (markdown-view). */

export type Inline = { kind: 'text' | 'code' | 'strong' | 'em'; text: string } | { kind: 'link'; text: string; href: string };
export type ListItem = { inline: Inline[]; checked: boolean | null; line: number; children: Block[] };
// line : la ligne du texte (depuis 0) où commence le bloc.
export type Block =
  | { kind: 'heading'; level: number; inline: Inline[]; line: number }
  | { kind: 'paragraph'; inline: Inline[]; line: number }
  | { kind: 'list'; ordered: boolean; items: ListItem[]; line: number }
  | { kind: 'quote'; blocks: Block[]; line: number }
  | { kind: 'code'; lang: string; text: string; line: number }
  | { kind: 'table'; head: Inline[][]; rows: Inline[][][]; line: number }
  | { kind: 'rule'; line: number };

export function parseMarkdown(md: string): Block[] {
  return blocks(md.split(/\r?\n/), 0);
}

const FENCE = /^( {0,3})(`{3,}|~{3,})(.*)$/;
const HEADING = /^ {0,3}(#{1,6})(?:[ \t]+(.*))?$/;
const RULE = /^ {0,3}(?:(?:-[ \t]*){3,}|(?:\*[ \t]*){3,}|(?:_[ \t]*){3,})$/;
const QUOTE = /^ {0,3}> ?/;
const LIST = /^([ \t]*)([-*+]|\d{1,9}[.)])(?:[ \t]+(.*))?$/;
const SEPARATOR = /^ {0,3}\|?[ \t]*:?-+:?[ \t]*(?:\|[ \t]*:?-+:?[ \t]*)*\|?[ \t]*$/;

const indentOf = (l: string) => l.length - l.trimStart().length;
const dedent = (l: string, n: number) => l.slice(Math.min(n, indentOf(l)));
// Les cellules d'une ligne de tableau, coupées aux | non échappés.
const cells = (row: string) => row.trim().replace(/^\||(?<!\\)\|$/g, '').split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, '|'));

// Ce qui commence à la ligne i : une ligne « paragraph » continue le
// paragraphe en cours, toute autre sorte l'interrompt.
function kindOf(lines: string[], i: number) {
  const l = lines[i];
  if (!l.trim()) return 'blank';
  const fence = FENCE.exec(l);
  if (fence &&!(fence[2][0] === '`' && fence[3].includes('`'))) return 'fence';
  if (HEADING.test(l)) return 'heading';
  if (RULE.test(l)) return 'rule';
  if (QUOTE.test(l)) return 'quote';
  if (LIST.test(l)) return 'list';
  if (l.includes('|') && SEPARATOR.test(lines[i + 1] ?? '') && cells(l).length === cells(lines[i + 1]).length) return 'table';
  return 'paragraph';
}

// lines[k] est la ligne offset + k du texte.
function blocks(lines: string[], offset: number): Block[] {
  const out: Block[] = [];
  let i = 0;
  while (i < lines.length) {
    const l = lines[i], line = offset + i;
    switch (kindOf(lines, i)) {
      case 'blank': i++; break;
      case 'fence': { // non fermé : jusqu'à la fin
        const [, indent, fence, info] = FENCE.exec(l)!;
        const close = new RegExp(`^ {0,3}${fence[0]}{${fence.length},}[ \\t]*$`);
        const text: string[] = [];
        for (i++; i < lines.length && !close.test(lines[i]); i++) text.push(dedent(lines[i], indent.length));
        i++;
        out.push({ kind: 'code', lang: info.trim().split(/\s/)[0], text: text.join('\n'), line });
        break;
      }
      case 'heading': {
        const [, hashes, text = ''] = HEADING.exec(l)!;
        out.push({ kind: 'heading', level: hashes.length, inline: inline(text.replace(/(?:^|[ \t]+)#+[ \t]*$/, '').trim()), line });
        i++;
        break;
      }
      case 'rule': out.push({ kind: 'rule', line }); i++; break;
      case 'quote': {
        const inner: string[] = [];
        for (; i < lines.length && QUOTE.test(lines[i]); i++) inner.push(lines[i].replace(QUOTE, ''));
        out.push({ kind: 'quote', blocks: blocks(inner, line), line });
        break;
      }
      case 'list': i = list(lines, i, offset, out); break;
      case 'table': {
        const head = cells(l).map(inline);
        const rows: Inline[][][] = [];
        for (i += 2; i < lines.length && lines[i].trim() && lines[i].includes('|'); i++) rows.push(cells(lines[i]).map(inline));
        out.push({ kind: 'table', head, rows, line });
        break;
      }
      default: { // lignes jointes par une espace
        const text = [l.trim()];
        for (i++; i < lines.length && kindOf(lines, i) === 'paragraph'; i++) text.push(lines[i].trim());
        out.push({ kind: 'paragraph', inline: inline(text.join(' ')), line });
      }
    }
  }
  return out;
}

// Une liste, ajoutée à out ; rend la ligne qui la suit. Un élément garde ce qui
// est plus indenté que sa puce (ses sous-blocs, sa sous-liste) et une ligne de
// paragraphe qui suit sans ligne vide ; la liste continue tant qu'un élément de
// la même sorte (ordonnée ou non) suit.
function list(lines: string[], i: number, offset: number, out: Block[]): number {
  const isOrdered = (m: RegExpExecArray) => /\d/.test(m[2]);
  let m = LIST.exec(lines[i])!;
  const block: Block & { kind: 'list' } = { kind: 'list', ordered: isOrdered(m), items: [], line: offset + i };
  out.push(block);
  for (;;) {
    let end = i + 1;
    for (let j = end; j < lines.length; j++) {
      if (!lines[j].trim()) continue;
      if (indentOf(lines[j]) > m[1].length || (j === end && kindOf(lines, j) === 'paragraph')) end = j + 1;
      else break;
    }
    const body = lines.slice(i + 1, end);
    const indent = Math.min(...body.filter((l) => l.trim() && indentOf(l) > m[1].length).map(indentOf));
    const box = /^\[([ xX])\](?:[ \t]+|$)/.exec(m[3] ?? '');
    const children = blocks([(m[3] ?? '').slice(box ? box[0].length : 0), ...body.map((l) => dedent(l, indent))], offset + i);
    const first = children[0]?.kind === 'paragraph' && children[0].line === offset + i ? children.shift() : undefined;
    block.items.push({ inline: first?.kind === 'paragraph' ? first.inline : [], checked: box ? box[1] !== ' ' : null, line: offset + i, children });
    i = end;
    let k = i;
    while (k < lines.length && !lines[k].trim()) k++;
    const next = k < lines.length && kindOf(lines, k) === 'list' ? LIST.exec(lines[k]) : null;
    if (!next || isOrdered(next) !== block.ordered) return i;
    i = k;
    m = next;
  }
}

// En ligne, de gauche à droite ; à une même position, la première forme qui
// convient. Une adresse n'est un lien qu'en http(s) ; le reste est du texte.
// Exporté seul (parseInline) pour un texte d'une ligne : une réponse proposée,
// un cas limite, un contrat.
const INLINE = new RegExp([
  /(?<!`)(?<tick>`+)(?!`)(?<code>[\s\S]*?[^`])\k<tick>(?!`)/u,
  /\\(?<escaped>[!-/:-@[-`{-~])/u,
  /\[(?<label>[^\]]*)\]\((?<href>(?:[^()\s]|\([^()\s]*\))*)\)/u,
  // adresse nue, sans la ponctuation qui la suit ; ses parenthèses équilibrées
  /(?<url>https?:\/\/(?:[^\s<>"'`()]|\([^\s<>"'`()]*\))*(?:[^\s<>"'`().,;:!?»]|\([^\s<>"'`()]*\)))/u,
  /\*\*(?<strong>(?!\s)[\s\S]*?\S)\*\*(?!\*)/u,
  /(?<![\p{L}\p{N}])__(?<strong_>(?!\s)[\s\S]*?\S)__(?![\p{L}\p{N}_])/u,
  /\*(?<em>(?![\s*])[\s\S]*?[^\s*])\*(?!\*)/u,
  /(?<![\p{L}\p{N}])_(?<em_>(?![\s_])[\s\S]*?[^\s_])_(?![\p{L}\p{N}_])/u,
].map((r) => r.source).join('|'), 'giu');
const HTTP = /^https?:\/\//i;

export { inline as parseInline };

function inline(src: string): Inline[] {
  const out: Inline[] = [];
  const push = (i: Inline) => {
    const last = out[out.length - 1];
    if (i.kind === 'text' && last?.kind === 'text') last.text += i.text;
    else if (i.text) out.push(i);
  };
  let at = 0;
  for (const m of src.matchAll(INLINE)) {
    push({ kind: 'text', text: src.slice(at, m.index) });
    at = m.index + m[0].length;
    const g = m.groups!;
    if (g.code != null) push({ kind: 'code', text: g.code.startsWith(' ') && g.code.endsWith(' ') && g.code.trim() ? g.code.slice(1, -1) : g.code });
    else if (g.escaped != null) push({ kind: 'text', text: g.escaped });
    else if (g.url != null) push({ kind: 'link', text: g.url, href: g.url });
    else if (g.href != null) {
      const label = inline(g.label).map((i) => i.text).join('');
      push(HTTP.test(g.href) ? { kind: 'link', text: label || g.href, href: g.href } : { kind: 'text', text: m[0] });
    } else { // gras ou italique : ce qu'il contient garde son code et ses liens
      const kind = g.strong != null || g.strong_ != null ? 'strong' : 'em';
      for (const i of inline(g.strong ?? g.strong_ ?? g.em ?? g.em_)) push(i.kind === 'text' ? { kind, text: i.text } : i);
    }
  }
  push({ kind: 'text', text: src.slice(at) });
  return out;
}
