/** findings-view — les constats de l'agent sur le code de la PR, pour le relecteur, à l'arrêt « publier », au-dessus du
 *  brouillon de revue (note 0.16.0-revue-essentielle) : la relecture du code en une passe (pr-<n>-commits.md, lue par
 *  findings de core/vibecoder). Une carte : son introduction, puis un constat par titre — son titre, son détail
 *  (MarkdownView, jamais de HTML) et sa 💬. La 💬 ouvre sous le constat une zone de remarque déjà remplie avec lui
 *  (findingDraft), à corriger ; Ajouter la verse au brouillon de revue sur la cible du constat (remark,
 *  findingTarget ; act.draft), Annuler ne fait rien : un constat n'entre au brouillon que par ce geste. Sous chaque
 *  constat, ses remarques déjà au brouillon (remarksAt, DraftRemarks : grisées, crayon, croix). Une relecture sans
 *  constat : son texte seul, aucune 💬. Pas encore de relecture : une phrase qui renvoie à Préparer la revue, sans
 *  bouton. Aucun bouton de lecture (ni Relire les commits, ni Relancer), aucun verdict, aucun code, aucun commit.
 *  FindingsView(p: StepProps): ReactNode
 *  Ne connaît pas : le pont (rappels passés), le créateur (pr-view ne la rend qu'au relecteur), le verdict, la
 *  publication (draft-view).
 *  Utilisé par : pr-view. */
import type { ReactNode } from 'react';
import type { StepProps } from './step-views';

export function FindingsView(_p: StepProps): ReactNode {
  throw new Error('not implemented');
}
