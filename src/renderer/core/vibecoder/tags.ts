/** tags — les étiquettes `[toi]` / `[agent]` des fichiers de retour du créateur (align.md, ponytail.md,
 *  review.md, ci.md, le detail de checks.json ; SPEC « Les étiquettes ») : celle qui ouvre une ligne
 *  (tagOf, sur un texte ; untag, sur une ligne déjà lue par parseMarkdown), retirée du texte affiché,
 *  et ce qu'elle couvre (tagCover : la rubrique sous un titre ; un élément de liste couvre ses
 *  sous-points par l'imbrication, une sous-ligne étiquetée garde la sienne). Sans étiquette : null,
 *  la ligne telle quelle.
 *  L'écran de l'essentiel (note 0.16.0-ecran-essentiel) : un fichier de retour coupé selon ses étiquettes.
 *  tagSplit(md: string): TagSplit
 *  toi : le Markdown de ce qui est pour l'utilisateur (une rubrique `## [toi]` entière, jusqu'au titre suivant de même
 *  niveau ou plus haut ; un élément de liste [toi] avec ses sous-points, l'étiquette après son adresse comprise) ;
 *  agent : de même ce qui est pour l'agent, et agents, combien de rubriques ou d'éléments [agent] ; rest : le reste,
 *  sans étiquette, dans l'ordre. Les trois textes gardent leurs étiquettes (MarkdownView tagged les rend en badges) et
 *  l'ordre du fichier ; un bloc de code n'est jamais coupé ni lu comme une étiquette.
 *  Ne connaît pas : le DOM, React, les noms des fichiers de retour ; d'outputs, que ADDRESS.
 *  Utilisé par : app/panel/vibecoder (markdown-view, review-view : checks.json ; feedback-view : tagSplit). */
import { parseMarkdown, type Block, type Inline } from './markdown';
import { ADDRESS } from './outputs';

export const TAGS = ['toi', 'agent'] as const;
export type Tag = (typeof TAGS)[number];

// L'étiquette en tête d'un texte (blancs de tête permis), et le texte sans elle (le blanc qui la suit
// compris) ; ailleurs dans le texte, ou aucune : tag null, le texte tel quel.
export function tagOf(text: string): { tag: Tag | null; text: string } {
  const m = /^\s*\[(toi|agent)\](?:\s+|$)/.exec(text);
  return m ? { tag: m[1] as Tag, text: text.slice(m[0].length) } : { tag: null, text };
}

// L'étiquette d'une ligne lue (un titre, un élément de liste) : en tête de son texte, ou juste après une
// adresse `<fichier>:L<ligne>` en code qui l'ouvre (ponytail.md). head : ce qui la précède (l'adresse, ou
// rien), rest : ce qui la suit ; le badge va entre les deux. Aucune : tag null, head vide, rest = inline.
export function untag(inline: Inline[]): { tag: Tag | null; head: Inline[]; rest: Inline[] } {
  const at = inline[0]?.kind === 'code' && ADDRESS.test(inline[0].text) ? 1 : 0;
  const first = inline[at];
  if (first?.kind !== 'text') return { tag: null, head: [], rest: inline };
  // L'adresse en texte (ponytail.md l'écrit sans backticks) : gardée en head.
  const lead = (!at && ADDRESS.exec(first.text)?.[0]) || '';
  const { tag, text } = tagOf(first.text.slice(lead.length));
  if (!tag) return { tag: null, head: [], rest: inline };
  const head = [...inline.slice(0, at), ...(lead ? [{ kind: 'text' as const, text: lead }] : [])];
  return { tag, head, rest: [...(text ? [{ kind: 'text' as const, text }] : []), ...inline.slice(at + 1)] };
}

// L'étiquette qui couvre chaque bloc de premier niveau, dans l'ordre de blocks : un titre étiqueté, la
// sienne ; ce qui le suit, la même, jusqu'au titre suivant de même niveau ou plus haut (un sous-titre
// sans étiquette en hérite, un sous-titre étiqueté garde la sienne) ; ailleurs : null.
export function tagCover(blocks: Block[]): (Tag | null)[] {
  const open: { level: number; tag: Tag | null }[] = []; // les titres encore ouverts, du plus haut au plus bas
  return blocks.map((b) => {
    if (b.kind === 'heading') {
      while (open.length && open[open.length - 1].level >= b.level) open.pop();
      open.push({ level: b.level, tag: untag(b.inline).tag ?? open[open.length - 1]?.tag ?? null });
    }
    return open[open.length - 1]?.tag ?? null;
  });
}

// Un fichier de retour coupé selon ses étiquettes (voir l'en-tête) : pour l'utilisateur, pour l'agent et combien, le reste.
export type TagSplit = { toi: string; agent: string; agents: number; rest: string };

export function tagSplit(md: string): TagSplit {
  const lines = md.split(/\r?\n/);
  const blocks = parseMarkdown(md);
  const covers = tagCover(blocks);
  const owner = lines.map((): Tag | null => null); // à qui va chaque ligne ; un bloc prend jusqu'au suivant (ses lignes vides comprises)
  let agents = 0;
  blocks.forEach((b, i) => {
    const end = blocks[i + 1]?.line ?? lines.length;
    if (b.kind === 'heading' && untag(b.inline).tag === 'agent') agents++;
    if (b.kind !== 'list') return void owner.fill(covers[i], b.line, end);
    // Un élément garde ses sous-points ; son étiquette, sinon celle de ce qui couvre la liste.
    b.items.forEach((it, j) => {
      const tag = untag(it.inline).tag;
      if (tag === 'agent' && covers[i] !== 'agent') agents++;
      owner.fill(tag ?? covers[i], it.line, b.items[j + 1]?.line ?? end);
    });
  });
  const part = (tag: Tag | null) => lines.filter((_, i) => owner[i] === tag).join('\n').replace(/^(\s*\n)+/, '').trimEnd();
  return { toi: part('toi'), agent: part('agent'), agents, rest: part(null) };
}
