/** invariants-view — l'aiguillage de l'étape Invariants (notes 0.16.0-ecran-essentiel, 0.16.0-revue-essentielle).
 *  Une seule vue, les deux rôles : l'en-tête de l'étape (StepHead) puis RulesView (rules-view : les règles rangées par ligne
 *  « → invariant », leurs tests en pseudo-code, l'alignement) ; rien d'autre — ni cartes par cas, ni Tout valider, ni
 *  résumé, ni barre, ni arbre des tests, ni Invariants seuls, ni Voir le fichier, ni menu de diff, ni bouton de lecture
 *  (Lire en pseudo-code, Relire, Tout relire), ni « non rattaché », ni phrase des cas à valider (la ligne d'état la dit),
 *  ni éditeur : aucun test ne s'édite ici, aucun fichier n'est suivi. Ce que le relecteur y a de plus (brouillon de
 *  remarques, « modifié par la PR », pas de preuve) est dans rules-view.
 *  Ne connaît pas : le pont (rappels passés), le brouillon (rules-view), le rôle (rules-view). Utilisé par : step-views. */
import type { StepProps } from './step-views';
import { RulesView } from './rules-view';
import { StepHead } from './step-parts';

export function InvariantsView(props: StepProps) {
  return <><StepHead p={props} /><RulesView {...props} /></>;
}
