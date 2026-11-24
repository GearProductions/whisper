/** feedback-view — un fichier de retour du créateur (align.md, ponytail.md, ci.md) selon la règle de la Revue
 *  (note 0.16.0-ecran-essentiel) : ce qui est pour l'utilisateur ([toi]) en avant, ce qui est pour l'agent ([agent])
 *  replié sous son nombre (« 3 pour l'agent »), aucun bouton (ni Relancer, ni Appliquer) ; rien du tout quand le
 *  fichier n'a ni [toi] ni [agent] et tient en une ligne (« Aligné. »). Un fichier sans étiquette de plusieurs lignes
 *  (un format inattendu) est montré tel quel : rien n'est caché. La découpe vient de tagSplit (core/vibecoder), le
 *  rendu de MarkdownView tagged (jamais de HTML).
 *  FeedbackView({ md, t, onOpenLink, onQuote? }): ReactNode
 *  onQuote : 💬 sur un bloc, qui le cite dans le champ de la conversation ; absent : pas de 💬.
 *  Ne connaît pas : le pont (rappels passés), les noms des fichiers de retour, les actions.
 *  Utilisé par : rules-view (l'alignement), review-view (la ponytail review). */
import type { ReactNode } from 'react';
import type { Strings } from 'core/vibecoder';

export type FeedbackProps = {
  md: string;                       // le texte du fichier de retour
  t: Strings;
  onOpenLink(url: string): void;
  onQuote?(text: string): void;
};

export function FeedbackView(_props: FeedbackProps): ReactNode {
  throw new Error('not implemented');
}
