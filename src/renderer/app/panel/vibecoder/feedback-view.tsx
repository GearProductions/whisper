/** feedback-view — un fichier de retour du créateur (align.md, ponytail.md, ci.md) selon la règle de la Revue
 *  (note 0.16.0-ecran-essentiel) : ce qui est pour l'utilisateur ([toi]) en avant, ce qui est pour l'agent ([agent])
 *  replié sous son nombre (« 3 pour l'agent »), aucun bouton (ni Relancer, ni Appliquer) ; rien du tout quand le
 *  fichier n'a ni [toi] ni [agent], tient en une ligne et dit un texte connu (« Aligné. », « Aligned. », « Déjà sobre. On
 *  livre. », « Lean already. Ship. », éventuellement suivi de ce qui a été vérifié, ou vide). Toute autre ligne sans étiquette, et un
 *  fichier sans étiquette de plusieurs lignes (un format inattendu), sont montrés tels quels : rien n'est caché. La découpe vient de tagSplit (core/vibecoder), le
 *  rendu de MarkdownView tagged (jamais de HTML).
 *  FeedbackView({ md, t, onOpenLink, onQuote? }): ReactNode
 *  onQuote : 💬 sur un bloc, qui le cite dans le champ de la conversation ; absent : pas de 💬.
 *  Ne connaît pas : le pont (rappels passés), les noms des fichiers de retour, les actions.
 *  Utilisé par : rules-view (l'alignement), review-view (la ponytail review). */
import type { ReactNode } from 'react';
import { tagSplit, type Strings } from 'core/vibecoder';
import { MarkdownView } from './markdown-view';

export type FeedbackProps = {
  md: string;                       // le texte du fichier de retour
  t: Strings;
  onOpenLink(url: string): void;
  onQuote?(text: string): void;
};

// Les textes que les skills écrivent quand il n'y a rien à dire (aligner, ponytail), éventuellement suivis de ce qui a été vérifié.
const ALL_GOOD = /^\s*(Aligné\.|Aligned\.|Déjà sobre\. On livre\.|Lean already\. Ship\.|$)/i;

export function FeedbackView({ md, t, onOpenLink, onQuote }: FeedbackProps): ReactNode {
  const { toi, agent, agents, rest } = tagSplit(md);
  if (!toi && !agent && !rest.includes('\n') && ALL_GOOD.test(rest)) return null;   // « Aligné. » : tout va bien ; toute autre ligne se montre
  const front = [toi, rest].filter(Boolean).join('\n\n'); // le sans-étiquette reste visible : rien n'est caché
  const view = (text: string) => <MarkdownView md={text} t={t} onOpenLink={onOpenLink} onQuote={onQuote} tagged />;
  return (
    <div className="vc-feedback">
      {front ? view(front) : null}
      {agent ? <details className="vc-feedback-agent"><summary>{`${agents} ${t.tags.agent}`}</summary>{view(agent)}</details> : null}
    </div>
  );
}
