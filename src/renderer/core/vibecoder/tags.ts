/** tags — les étiquettes `[toi]` / `[agent]` des fichiers de retour du créateur (align.md, ponytail.md,
 *  review.md, ci.md, le detail de checks.json ; SPEC « Les étiquettes ») : celle qui ouvre une ligne
 *  (tagOf, sur un texte ; untag, sur une ligne déjà lue par parseMarkdown), retirée du texte affiché,
 *  et ce qu'elle couvre (tagCover : la rubrique sous un titre ; un élément de liste couvre ses
 *  sous-points par l'imbrication, une sous-ligne étiquetée garde la sienne). Sans étiquette : null,
 *  la ligne telle quelle.
 *  Ne connaît pas : le DOM, React, les noms des fichiers de retour.
 *  Utilisé par : app/panel/vibecoder (markdown-view, review-view : checks.json). */
import type { Block, Inline } from './markdown';

export const TAGS = ['toi', 'agent'] as const;
export type Tag = (typeof TAGS)[number];

// L'étiquette en tête d'un texte (blancs de tête permis), et le texte sans elle (le blanc qui la suit
// compris) ; ailleurs dans le texte, ou aucune : tag null, le texte tel quel.
export function tagOf(text: string): { tag: Tag | null; text: string } {
  void text;
  throw new Error('not implemented');
}

// L'étiquette d'une ligne lue (un titre, un élément de liste) : en tête de son texte, ou juste après une
// adresse `<fichier>:L<ligne>` en code qui l'ouvre (ponytail.md). head : ce qui la précède (l'adresse, ou
// rien), rest : ce qui la suit ; le badge va entre les deux. Aucune : tag null, head vide, rest = inline.
export function untag(inline: Inline[]): { tag: Tag | null; head: Inline[]; rest: Inline[] } {
  void inline;
  throw new Error('not implemented');
}

// L'étiquette qui couvre chaque bloc de premier niveau, dans l'ordre de blocks : un titre étiqueté, la
// sienne ; ce qui le suit, la même, jusqu'au titre suivant de même niveau ou plus haut (un sous-titre
// sans étiquette en hérite, un sous-titre étiqueté garde la sienne) ; ailleurs : null.
export function tagCover(blocks: Block[]): (Tag | null)[] {
  void blocks;
  throw new Error('not implemented');
}
