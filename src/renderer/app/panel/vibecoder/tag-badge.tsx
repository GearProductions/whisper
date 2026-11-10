/** tag-badge — le badge d'une étiquette des fichiers de retour, à la place de son texte brut : [toi] →
 *  « pour toi » en couleur d'accent, [agent] → « pour l'agent » grisé (libellés : t.tags) ; du texte,
 *  jamais de crochets. Le grisé de la ligne n'est pas le sien (data-tag, posé par l'appelant).
 *  Ne connaît pas : le pont, les fichiers de retour, ce que couvre l'étiquette.
 *  Utilisé par : markdown-view (tagged), review-view (checks.json). */
import type { ReactNode } from 'react';
import type { Strings, Tag } from 'core/vibecoder';
import './tag-badge.css';

export function TagBadge({ tag, t }: { tag: Tag; t: Strings }): ReactNode {
  return <span className="vc-tag-badge" data-tag={tag}>{t.tags[tag]}</span>;
}
