/** module-diff-view — le diff d'un fichier de module (Voir le code, F-113),
 *  comme celui de VS Code : de before à after, en ligne ou côte à côte, en
 *  lecture seule, numéroté et coloré comme CodeView, replié autour des
 *  changements ; le texte en texte, jamais en HTML (I-40).
 *  Ne connaît pas : le pont, le relevé, git, lineDiff.
 *  Utilisé par : module-code. */
import type { ReactElement } from 'react';
import type { VibeLang } from 'technicals/bridge';

export function ModuleDiffView(_props: {
  before: string;
  after: string;
  path: string;
  mode: 'inline' | 'split';
  lang: VibeLang;
}): ReactElement {
  throw new Error('not implemented');
}
