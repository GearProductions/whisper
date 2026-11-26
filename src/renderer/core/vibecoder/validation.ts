/** validation — le badge d'état d'une étape : son ✓ et ce que fait un clic dessus.
 *  Le contrôle en trois points (note 0.16.0-controle-en-trois-points) : en créateur, seule la note est attendue de l'utilisateur ;
 *  la Forme et les cas, le système les valide.
 *  L'écran de l'essentiel (note 0.16.0-ecran-essentiel) : le ✓ d'une étape sur son badge d'état, et ce que fait un clic
 *  dessus.
 *  stepBadge(flow: VibeFlow, step: Pick<VibeStep, 'id' | 'check'>, prevOk: boolean): StepBadge
 *  En créateur, à la Forme, aux Invariants et aux Modules seulement : validée (check.state 'ok') → mark 'ok' (« faite ✓ »),
 *  click 'withdraw' (retirer le ✓) ; le ✓ retiré à la main et qui tient (check.withdrawn) → mark 'withdrawn'
 *  (« faite · ✓ retiré »), click 'restore' (le rendre) seulement si l'étape d'avant est validée (prevOk : validateStep
 *  refuse sinon), sans clic autrement ; sinon — jamais validée, modifiée depuis, à revoir, une preuve
 *  qui ne passe pas — ni ✓ ni clic : le badge ne valide jamais à la place du système. La note, la Revue, la PR et le
 *  relecteur : ni ✓ ni clic.
 *  La revue essentielle (note 0.16.0-revue-essentielle) : `awaiting` (ce que l'arrêt attendait du relecteur) est retirée —
 *  cela se dit sur la ligne d'état (status-line), plus dans une phrase de la vue des invariants.
 *  Ne connaît pas : le DOM, React, ce que le clic envoie (step-parts : act.mark de l'étape, null ou 'ok').
 *  Utilisé par : app/panel/vibecoder (step-parts : stepBadge). */
import type { VibeFlow, VibeStep } from 'technicals/bridge';

// Le badge d'état d'une étape : son ✓ (validée, ou retiré à la main) et ce que fait un clic (le retirer, le rendre, rien).
export type StepBadge = { mark: 'ok' | 'withdrawn' | null; click: 'withdraw' | 'restore' | null };

export function stepBadge(flow: VibeFlow, step: Pick<VibeStep, 'id' | 'check'>, prevOk: boolean): StepBadge {
  if (flow !== 'create' || (step.id !== 'forme' && step.id !== 'invariants' && step.id !== 'modules')) return { mark: null, click: null };
  if (step.check?.state === 'ok') return { mark: 'ok', click: 'withdraw' };
  if (step.check?.withdrawn) return { mark: 'withdrawn', click: prevOk ? 'restore' : null };   // validateStep refuse si l'étape d'avant n'est pas validée
  return { mark: null, click: null };
}
