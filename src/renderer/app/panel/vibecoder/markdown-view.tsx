/** markdown-view — un texte Markdown rendu (note, sortie d'un skill) : les
 *  blocs de parseMarkdown en éléments — titres, paragraphes, listes et leurs
 *  cases, citations, code, tableaux, filets ; en ligne : code, gras,
 *  italique, liens. Rien n'est rendu en HTML (aucun dangerouslySetInnerHTML)
 *  et un lien ne navigue pas : onOpenLink (le principal l'ouvre dans le
 *  navigateur, I-21). Avec onQuote, un 💬 au survol de chaque bloc et de
 *  chaque élément de liste le cite.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-view (et les vues d'étape). */
import { useMemo } from 'react';
import { parseMarkdown, type Block, type Inline, type Strings } from 'core/vibecoder';

type Ctx = { t: Strings; onOpenLink(url: string): void; onQuote?(text: string): void };

export function MarkdownView({ md, ...ctx }: Ctx & { md: string }) {
  const blocks = useMemo(() => parseMarkdown(md), [md]);
  return (
    <div className="vc-md">
      {blocks.map((b, i) => (b.kind === 'list' || b.kind === 'rule' ? <BlockView key={i} b={b} ctx={ctx} /> : (
        <div key={i} className="vc-block"><BlockView b={b} ctx={ctx} /><Quote text={said(b)} ctx={ctx} /></div>
      )))}
    </div>
  );
}

const plain = (inline: Inline[]) => inline.map((x) => x.text).join('');

// Le texte d'un bloc, tel qu'un 💬 le cite (une liste se cite élément par élément).
function said(b: Block): string {
  switch (b.kind) {
    case 'heading': case 'paragraph': return plain(b.inline);
    case 'code': return b.text;
    case 'quote': return b.blocks.map(said).join(' ');
    case 'table': return [b.head, ...b.rows].map((row) => row.map(plain).join(' | ')).join(' · ');
    default: return '';
  }
}

function Quote({ text, ctx }: { text: string; ctx: Ctx }) {
  const { onQuote, t } = ctx;
  if (!onQuote || !text.trim()) return null;
  return <button type="button" className="vc-quote" title={t.quote} aria-label={t.quote} onClick={() => onQuote(text)}>💬</button>;
}

function Inlines({ inline, ctx }: { inline: Inline[]; ctx: Ctx }) {
  return (
    <>
      {inline.map((x, i) => {
        if (x.kind === 'link') {
          return <a key={i} href={x.href} title={x.href} onClick={(e) => { e.preventDefault(); ctx.onOpenLink(x.href); }}>{x.text}</a>;
        }
        if (x.kind === 'code') return <code key={i}>{x.text}</code>;
        if (x.kind === 'strong') return <strong key={i}>{x.text}</strong>;
        if (x.kind === 'em') return <em key={i}>{x.text}</em>;
        return x.text;
      })}
    </>
  );
}

const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

function BlockView({ b, ctx }: { b: Block; ctx: Ctx }) {
  switch (b.kind) {
    case 'heading': {
      const H = HEADINGS[Math.min(6, Math.max(1, b.level)) - 1];
      return <H><Inlines inline={b.inline} ctx={ctx} /></H>;
    }
    case 'paragraph': return <p><Inlines inline={b.inline} ctx={ctx} /></p>;
    case 'list': {
      const List = b.ordered ? 'ol' : 'ul';
      return (
        <List>
          {b.items.map((item, i) => (
            <li key={i} className={item.checked === null ? undefined : 'vc-task'}>
              {item.checked === null ? null : <span className="vc-box" data-checked={item.checked || undefined} aria-hidden="true" />}
              <Inlines inline={item.inline} ctx={ctx} />
              <Quote text={plain(item.inline)} ctx={ctx} />
              {item.children.map((c, j) => <BlockView key={j} b={c} ctx={ctx} />)}
            </li>
          ))}
        </List>
      );
    }
    case 'quote': return <blockquote>{b.blocks.map((c, i) => <BlockView key={i} b={c} ctx={ctx} />)}</blockquote>;
    case 'code': return <pre className="vc-code"><code>{b.text}</code></pre>;
    case 'table':
      return (
        <div className="vc-table scroll">
          <table>
            <thead><tr>{b.head.map((c, i) => <th key={i}><Inlines inline={c} ctx={ctx} /></th>)}</tr></thead>
            <tbody>{b.rows.map((row, i) => <tr key={i}>{row.map((c, j) => <td key={j}><Inlines inline={c} ctx={ctx} /></td>)}</tr>)}</tbody>
          </table>
        </div>
      );
    default: return <hr />;
  }
}
