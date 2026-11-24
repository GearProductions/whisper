/** rules-view — l'étape Invariants du créateur (note 0.16.0-ecran-essentiel) : les règles critiques de la note, une par
 *  ligne « → invariant » (ruleGroups, core/vibecoder). En titre, le texte de la ligne tel que l'utilisateur l'a écrit et
 *  son état (écrite : ses tests sont rouges ; prouvée ; non prouvée) ; dessous, le résultat de la preuve pour cette
 *  ligne (le mutant qui l'a prouvée, ou pourquoi elle remonte à l'utilisateur : il ne s'affiche qu'ici), puis les tests
 *  qui la gardent, en pseudo-code (leur titre, le pseudo-code coloré, pseudoLines ; leur point d'attention), chacun
 *  avec Ouvrir dans l'éditeur en icône discrète. Une ligne sans test : « aucun test ». Les tests qui ne gardent aucune
 *  ligne : un dernier groupe, « Autres tests ». Un test pas encore lu : son titre, « lecture en cours » (le moteur lance
 *  la lecture lui-même). 💬 sur une règle la cite dans le champ de la conversation (act.prefill('comment', la ligne)).
 *  En tête, l'alignement (align.md) par FeedbackView : ses écarts [toi] en avant, les [agent] repliés avec leur nombre,
 *  rien quand tout est aligné.
 *  Aucun bouton d'action, aucune validation (ni cas par cas, ni Tout valider, ni Rien à écrire), aucun chiffre en tête,
 *  aucune barre, ni code ni éditeur ; sans ligne « → invariant » dans la note : une phrase, « La note ne demande aucun
 *  invariant ». L'en-tête d'étape (StepHead) est rendu par invariants-view.
 *  RulesView(p: StepProps): ReactNode
 *  Ne connaît pas : le pont (rappels passés), le relecteur (invariants-view garde sa vue), le brouillon de revue.
 *  Utilisé par : invariants-view. */
import type { ReactNode } from 'react';
import type { StepProps } from './step-views';

export function RulesView(_p: StepProps): ReactNode {
  throw new Error('not implemented');
}
