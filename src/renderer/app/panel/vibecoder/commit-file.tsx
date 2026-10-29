/** commit-file — un fichier d'un commit (étape Commits, Relire), ouvert sous
 *  sa carte : le texte poussé pour file.id seulement ; un sélecteur
 *  (DiffPicker) Fichier · Diff de ce commit (at.commit.before → after) · Diff
 *  depuis la base de la PR (at.base → at.head) ; Fichier : CodeView en lecture
 *  seule (sans edit), fix false, onQuote ; un diff : ModuleDiffView ; text
 *  null : « absent à la tête de la PR, ou trop gros ». En texte, jamais en
 *  HTML (I-40).
 *  Ne connaît pas : le pont, git, le brouillon.
 *  Utilisé par : commits-view. */
import type { ReactElement } from 'react';
import type { Strings } from 'core/vibecoder';
import type { VibeCode, VibeFile, VibeLang } from 'technicals/bridge';

export function CommitFile(_props: {
  file: VibeFile;
  code: VibeCode | null;
  lang: VibeLang;
  t: Strings;
  onQuote(block: string): void;
}): ReactElement {
  throw new Error('not implemented');
}
