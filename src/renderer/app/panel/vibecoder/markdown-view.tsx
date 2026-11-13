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
 *  Avec onAsk (Relire), un bouton « Poser une question » (t.askAgent) à côté du 💬 cite de même
 *  le texte (onAsk(texte)) ; blockEnd rend quelque chose après chaque bloc qui a un 💬 (ses
 *  remarques), comme itemEnd après un élément de liste.
 *  Avec changed (des numéros de ligne du
 *  texte), un liseré sur les blocs et éléments qui en contiennent une ; tag
 *  met une pastille devant le texte d'un élément de liste (par sa ligne),
 *  itemStart une case devant lui et itemEnd un bouton après lui (par son texte : cocher, Appliquer une remarque).
 *  Avec focus (une ligne du texte), le bloc ou l'élément de liste qui y commence défile dans la vue et
 *  est mis en évidence (data-focus). Avec tagged (les fichiers de retour du créateur), l'étiquette
 *  [toi] / [agent] d'un titre ou d'un élément de liste est remplacée par son badge (TagBadge, à sa place :
 *  après l'adresse d'une remarque ponytail) ; ce qu'elle couvre (tagCover, l'imbrication des listes)
 *  porte data-tag : [agent] grisé, toujours lisible ; une ligne [toi] sous lui reste normale ; sans
 *  étiquette : comme avant.
 *  Avec removed (placeRemoved : les lignes retirées depuis la référence), chaque groupe est rendu à part
 *  juste avant le bloc de premier niveau ou l'élément de liste qui le suit (end : après le dernier),
 *  mis en forme comme le reste (parseMarkdown, jamais de HTML) et barré en rouge (vc-removed), en lecture
 *  seule : ni 💬, ni pastille, ni zone de remarque, ni case ; les numéros de ligne (changed, tag, focus,
 *  les citations) restent ceux du texte actuel.
 *  InlineMd : un texte d'une ligne (réponse proposée, cas limite…) en ligne.
 *  Ne connaît pas : le pont (rappels passés).
 *  Utilisé par : les vues d'étape (note-view en Relire, questions-view, forme-view, invariants-view,
 *  modules-view, review-view, pr-view, branches-view, commits-view, ecran-view, draft-view, runs-view) ;
 *  components (thread : un message de l'agent, sans onQuote ni onComment). */
import { Fragment, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { blockQuotes, parseInline, parseMarkdown, tagCover, untag, type Block, type Inline, type RemovedPlaces, type Strings, type Tag } from 'core/vibecoder';
import { CommentBox } from './comment-box';
import { Icon } from './icons';
import { TagBadge } from './tag-badge';

type Ctx = {
  t: Strings;
  onOpenLink(url: string): void;
  onQuote?(text: string): void;
  onAsk?(text: string): void;                      // Relire : un bouton à côté du 💬, qui cite ce que le 💬 cite
  blockEnd?(text: string): ReactNode;              // après le bloc qui a un 💬 (son texte brut), comme itemEnd
  onComment?(quote: string, text: string): void;   // Relire : 💬 ouvre une zone de commentaire sous ce qu'il cite
  changed?: Set<number>;           // lignes ajoutées ou changées (depuis 0)
  removed?: RemovedPlaces;         // les lignes retirées, rendues à part et barrées, devant ce qui les suit
  tag?(line: number): ReactNode;   // devant le texte de l'élément de liste qui commence à cette ligne
  itemStart?(text: string): ReactNode;   // devant le texte d'un élément de liste (son texte brut)
  itemEnd?(text: string): ReactNode;   // après le texte d'un élément de liste (son texte brut)
  focus?: number;                  // la ligne (depuis 0) du bloc ou de l'élément à faire défiler et mettre en évidence
  tagged?: boolean;                // les étiquettes [toi] / [agent] en badges, et leur grisé
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
  const covers = useMemo(() => (given.tagged ? tagCover(blocks) : []), [blocks, given.tagged]);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector('[data-focus]')?.scrollIntoView?.({ block: 'center' }); }, [given.focus]);
  const ctx: Full = { ...given, open: { at, set }, quotes };
  return (
    <div className="vc-md" ref={ref}>
      {blocks.map((b, i) => {
        const end = blocks[i + 1]?.line ?? Infinity;
        const tag = covers[i] ?? undefined;
        return (
          <Fragment key={i}>
            {b.kind === 'list' ? null : <Removed md={ctx.removed?.before.get(b.line)} ctx={ctx} />}
            {b.kind === 'list' || b.kind === 'rule' ? <BlockView b={b} end={end} ctx={ctx} tag={tag} /> : (
              <div className="vc-block" data-changed={touched(ctx, b.line, end) || undefined} data-tag={tag} data-focus={ctx.focus === b.line || undefined}>
                <BlockView b={b} end={end} ctx={ctx} done={b.line} /><Quote line={b.line} ctx={ctx} />
                {ctx.quotes.has(b.line) ? ctx.blockEnd?.(ctx.quotes.get(b.line)!) : null}
              </div>
            )}
          </Fragment>
        );
      })}
      <Removed md={ctx.removed?.end} ctx={ctx} />
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
  const { onQuote, onComment, onAsk, open, t } = ctx;
  const text = ctx.quotes.get(line);
  if ((!onQuote && !onComment) || !text) return null;
  const here = open.at === line;
  const title = onComment ? t.commentAdd : t.quote;
  return (
    <>
      <button type="button" className="vc-quote" title={title} aria-label={title} aria-pressed={onComment ? here : undefined}
        onClick={() => (onComment ? open.set(here ? null : line) : onQuote!(text))}><Icon name="comment" /></button>
      {onAsk ? <button type="button" className="vc-quote vc-ask" title={t.askAgent} aria-label={t.askAgent} onClick={() => onAsk(text)}><Icon name="ask" /></button> : null}
      {onComment && here ? (
        <CommentBox t={t} onCancel={() => open.set(null)} onSave={(said) => { onComment(text, said); open.set(null); }} />
      ) : null}
    </>
  );
}

// Un titre ou un élément de liste : avec tagged, son étiquette devient un badge, entre l'adresse qui
// l'ouvre (s'il y en a une) et la suite ; sinon, ses inlines tels quels.
function Lead({ inline, ctx }: { inline: Inline[]; ctx: Full }) {
  const { tag, head, rest } = ctx.tagged ? untag(inline) : { tag: null, head: [], rest: inline };
  if (!tag) return <Inlines inline={inline} ctx={ctx} />;
  return <><Inlines inline={head} ctx={ctx} />{head.length ? ' ' : null}<TagBadge tag={tag} t={ctx.t} />{rest.length ? ' ' : null}<Inlines inline={rest} ctx={ctx} /></>;
}

// L'étiquette de la ligne elle-même (tagged), à poser en data-tag.
const own = (inline: Inline[], ctx: Full) => (ctx.tagged ? untag(inline).tag ?? undefined : undefined);

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

// Un retrait : son Markdown rendu comme le reste mais sans rien d'interactif (contexte vide : ni 💬, ni
// pastille, ni case, ni remarque), barré par vc-removed ; as : li dans une liste.
function Removed({ md, ctx, as: Tag = 'div' }: { md?: string | null; ctx: Full; as?: 'div' | 'li' }) {
  const blocks = useMemo(() => (md ? parseMarkdown(md) : []), [md]);
  if (!blocks.length) return null;
  const bare: Full = { t: ctx.t, onOpenLink: ctx.onOpenLink, open: { at: null, set: () => {} }, quotes: new Map() };
  return <Tag className="vc-removed">{blocks.map((b, i) => <BlockView key={i} b={b} end={blocks[i + 1]?.line ?? Infinity} ctx={bare} />)}</Tag>;
}

const HEADINGS = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

// end : la ligne où commence ce qui suit le bloc (la fin de son dernier élément de liste) ; tag : ce qui
// couvre un bloc de premier niveau sans enveloppe (liste, filet) ; done : la ligne dont le retrait est déjà
// rendu plus haut (un élément qui s'ouvre sur un autre, « - - a », n'en rend pas un second).
function BlockView({ b, end, ctx, tag, done }: { b: Block; end: number; ctx: Full; tag?: Tag; done?: number }) {
  switch (b.kind) {
    case 'heading': {
      const H = HEADINGS[Math.min(6, Math.max(1, b.level)) - 1];
      return <H><Lead inline={b.inline} ctx={ctx} /></H>;
    }
    case 'paragraph': return <p><Inlines inline={b.inline} ctx={ctx} /></p>;
    case 'list': {
      const List = b.ordered ? 'ol' : 'ul';
      return (
        <List data-tag={tag}>
          {b.items.map((item, i) => {
            const next = b.items[i + 1]?.line ?? end;
            const sub = item.children.find((c) => c.kind === 'list')?.line ?? next; // une sous-liste a ses propres liserés
            return (
              <Fragment key={i}>
              {item.line === done ? null : <Removed as="li" md={ctx.removed?.before.get(item.line)} ctx={ctx} />}
              <li className={item.checked === null ? undefined : 'vc-task'} data-changed={touched(ctx, item.line, sub) || undefined}
                data-tag={own(item.inline, ctx)} data-focus={ctx.focus === item.line || undefined}>
                {item.checked === null ? null : <span className="vc-box" data-checked={item.checked || undefined} aria-hidden="true" />}
                {ctx.itemStart?.(ctx.quotes.get(item.line) ?? '')}
                {ctx.tag?.(item.line)}
                <Lead inline={item.inline} ctx={ctx} />
                {ctx.itemEnd?.(ctx.quotes.get(item.line) ?? '')}
                <Quote line={item.line} ctx={ctx} />
                {item.children.map((c, j) => <BlockView key={j} b={c} end={item.children[j + 1]?.line ?? next} ctx={ctx} done={item.line} />)}
              </li>
              </Fragment>
            );
          })}
        </List>
      );
    }
    case 'quote': return <blockquote>{b.blocks.map((c, i) => <BlockView key={i} b={c} end={b.blocks[i + 1]?.line ?? end} ctx={ctx} done={done} />)}</blockquote>;
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
    default: return <hr data-tag={tag} data-focus={ctx.focus === b.line || undefined} />;
  }
}
