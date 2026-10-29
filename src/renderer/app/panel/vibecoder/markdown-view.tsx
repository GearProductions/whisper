/** markdown-view — un texte Markdown rendu (note, sortie d'un skill, message
 *  de l'agent) : les
 *  blocs de parseMarkdown en éléments — titres, paragraphes, listes et leurs
 *  cases, citations, code, tableaux, filets ; en ligne : code, gras,
 *  italique, liens. Rien n'est rendu en HTML (aucun dangerouslySetInnerHTML)
 *  et un lien ne navigue pas : onOpenLink (le principal l'ouvre dans le
 *  navigateur, I-21). Avec onQuote, un 💬 (Icon comment) au survol de chaque bloc et de
 *  chaque élément de liste cite son texte (blockQuotes) ; avec onComment
 *  (Relire), ce 💬 ouvre
 *  sous lui une zone de commentaire, et la remarque part avec ce qu'il cite.
 *  Avec changed (des numéros de ligne du
 *  texte), un liseré sur les blocs et éléments qui en contiennent une ; tag
 *  met une pastille devant le texte d'un élément de liste (par sa ligne),
 *  itemEnd un bouton après lui (par son texte : Appliquer une remarque).
 *  InlineMd : un texte d'une ligne (réponse proposée, cas limite…) en ligne.
 *  Ne connaît pas : le pont (rappels passés).
 *  Utilisé par : les vues d'étape (note-view en Relire, questions-view, forme-view, invariants-view,
 *  modules-view, review-view, pr-view, branches-view, commits-view, ecran-view, draft-view, runs-view) ;
 *  components (thread : un message de l'agent, sans onQuote ni onComment). */
import { useMemo, useState, type ReactNode } from 'react';
import { blockQuotes, parseInline, parseMarkdown, type Block, type Inline, type Strings } from 'core/vibecoder';
import { CommentBox } from './comment-box';
import { Icon } from './icons';

type Ctx = {
  t: Strings;
  onOpenLink(url: string): void;
  onQuote?(text: string): void;
  onComment?(quote: string, text: string): void;   // Relire : 💬 ouvre une zone de commentaire sous ce qu'il cite
  changed?: Set<number>;           // lignes ajoutées ou changées (depuis 0)
  tag?(line: number): ReactNode;   // devant le texte de l'élément de liste qui commence à cette ligne
  itemEnd?(text: string): ReactNode;   // après le texte d'un élément de liste (son texte brut)
};

// La zone de commentaire ouverte : la ligne de ce qu'elle cite.
type Open = { at: number | null; set(line: number | null): void };
// Ce que cite le 💬 du bloc ou de l'élément qui commence à une ligne (depuis 0).
// ponytail: une ligne, un texte — une citation ou un élément qui s'ouvre sur une
// liste (« > - a », « - - a ») prend le texte de son élément ; clé plus fine si gênant.
type Quotes = Map<number, string>;

export function MarkdownView({ md, ...given }: Ctx & { md: string }) {
  const blocks = useMemo(() => parseMarkdown(md), [md]);
  const quotes = useMemo<Quotes>(() => new Map(blockQuotes(md).map((q) => [q.line, q.text])), [md]);
  const [at, set] = useState<number | null>(null);
  const ctx: Full = { ...given, open: { at, set }, quotes };
  return (
    <div className="vc-md">
      {blocks.map((b, i) => {
        const end = blocks[i + 1]?.line ?? Infinity;
        return b.kind === 'list' || b.kind === 'rule' ? <BlockView key={i} b={b} end={end} ctx={ctx} /> : (
          <div key={i} className="vc-block" data-changed={touched(ctx, b.line, end) || undefined}>
            <BlockView b={b} end={end} ctx={ctx} /><Quote line={b.line} ctx={ctx} />
          </div>
        );
      })}
    </div>
  );
}

// Un texte d'une ligne : code, gras, italique, liens (jamais de HTML).
export function InlineMd({ text, ...ctx }: Ctx & { text: string }) {
  const inline = useMemo(() => parseInline(text), [text]);
  return <Inlines inline={inline} ctx={{ ...ctx, open: { at: null, set: () => {} }, quotes: new Map() }} />;
}

// Une ligne de [from, to) est ajoutée ou changée.
const touched = ({ changed }: Ctx, from: number, to: number) => !!changed && [...changed].some((l) => l >= from && l < to);

type Full = Ctx & { open: Open; quotes: Quotes };

// 💬 : cite (onQuote) ; Relire (onComment) : ouvre ou ferme la zone de commentaire, rendue juste après.
function Quote({ line, ctx }: { line: number; ctx: Full }) {
  const { onQuote, onComment, open, t } = ctx;
  const text = ctx.quotes.get(line);
  if ((!onQuote && !onComment) || !text) return null;
  const here = open.at === line;
  const title = onComment ? t.commentAdd : t.quote;
  return (
    <>
      <button type="button" className="vc-quote" title={title} aria-label={title} aria-pressed={onComment ? here : undefined}
        onClick={() => (onComment ? open.set(here ? null : line) : onQuote!(text))}><Icon name="comment" /></button>
      {onComment && here ? (
        <CommentBox t={t} onCancel={() => open.set(null)} onSave={(said) => { onComment(text, said); open.set(null); }} />
      ) : null}
    </>
  );
}

function Inlines({ inline, ctx }: { inline: Inline[]; ctx: Full }) {
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

// end : la ligne où commence ce qui suit le bloc (la fin de son dernier élément de liste).
function BlockView({ b, end, ctx }: { b: Block; end: number; ctx: Full }) {
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
          {b.items.map((item, i) => {
            const next = b.items[i + 1]?.line ?? end;
            const sub = item.children.find((c) => c.kind === 'list')?.line ?? next; // une sous-liste a ses propres liserés
            return (
              <li key={i} className={item.checked === null ? undefined : 'vc-task'} data-changed={touched(ctx, item.line, sub) || undefined}>
                {item.checked === null ? null : <span className="vc-box" data-checked={item.checked || undefined} aria-hidden="true" />}
                {ctx.tag?.(item.line)}
                <Inlines inline={item.inline} ctx={ctx} />
                {ctx.itemEnd?.(ctx.quotes.get(item.line) ?? '')}
                <Quote line={item.line} ctx={ctx} />
                {item.children.map((c, j) => <BlockView key={j} b={c} end={item.children[j + 1]?.line ?? next} ctx={ctx} />)}
              </li>
            );
          })}
        </List>
      );
    }
    case 'quote': return <blockquote>{b.blocks.map((c, i) => <BlockView key={i} b={c} end={b.blocks[i + 1]?.line ?? end} ctx={ctx} />)}</blockquote>;
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
