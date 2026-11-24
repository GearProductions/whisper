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
import { tagSplit, type Strings } from 'core/vibecoder';
import { MarkdownView } from './markdown-view';

export type FeedbackProps = {
  md: string;                       // le texte du fichier de retour
  t: Strings;
  onOpenLink(url: string): void;
  onQuote?(text: string): void;
};

export function FeedbackView({ md, t, onOpenLink, onQuote }: FeedbackProps): ReactNode {
  const { toi, agent, agents, rest } = tagSplit(md);
  if (!toi && !agent && !rest.includes('\n')) return null; // « Aligné. » : tout va bien
  const front = [toi, rest].filter(Boolean).join('\n\n'); // le sans-étiquette reste visible : rien n'est caché
  const view = (text: string) => <MarkdownView md={text} t={t} onOpenLink={onOpenLink} onQuote={onQuote} tagged />;
  return (
    <div className="vc-feedback">
      {front ? view(front) : null}
      {agent ? <details className="vc-feedback-agent"><summary>{`${agents} ${t.tags.agent}`}</summary>{view(agent)}</details> : null}
    </div>
  );
}
