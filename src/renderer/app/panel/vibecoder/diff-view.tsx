/** diff-view — un diff de lignes affiché (DiffLine[], de lineDiff) : replié
 *  autour des changements (foldDiff), ajouts en vert, retraits barrés, en
 *  texte, jamais en HTML (I-40). Le diff brut de la note (Voir les
 *  modifications) et celui d'un fichier de module (Voir le code, F-113).
 *  Ne connaît pas : le pont, le relevé.
 *  Utilisé par : note-view, module-code. */
import type { ReactElement } from 'react';
import type { DiffLine } from 'core/vibecoder';
import type { VibeLang } from 'technicals/bridge';

export function DiffView(_props: { diff: DiffLine[]; lang: VibeLang }): ReactElement {
  throw new Error('not implemented');
}
