/** tags — les étiquettes `[toi]` / `[agent]` des fichiers de retour du créateur (align.md, ponytail.md,
 *  review.md, ci.md, le detail de checks.json ; SPEC « Les étiquettes ») : celle qui ouvre une ligne
 *  (tagOf, sur un texte ; untag, sur une ligne déjà lue par parseMarkdown), retirée du texte affiché,
 *  et ce qu'elle couvre (tagCover : la rubrique sous un titre ; un élément de liste couvre ses
 *  sous-points par l'imbrication, une sous-ligne étiquetée garde la sienne). Sans étiquette : null,
 *  la ligne telle quelle.
 *  Ne connaît pas : le DOM, React, les noms des fichiers de retour ; d'outputs, que ADDRESS.
 *  Utilisé par : app/panel/vibecoder (markdown-view, review-view : checks.json). */
import type { Block, Inline } from './markdown';
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
  // L'adresse en texte (ponytail.md l'écrit sans backticks, remarkKey la lit ainsi) : gardée en head.
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
