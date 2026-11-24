/** validation — ce que l'étape en cours attend de l'utilisateur quand il n'y a
 *  rien à lancer : valider la note, et pour le relecteur la forme ou les cas d'invariants
 *  (la lecture en pseudo-code est facultative).
 *  Créer : la validation (✓) de la note seule. Relire : un verdict
 *  (✓ ou ✗) sur la note et sur chaque cas (lu par sa clé, caseKeys de shared/test-cases).
 *  Le contrôle en trois points (note 0.16.0-controle-en-trois-points) : en créateur, seule la note est attendue
 *  ({ kind: 'note' } : à vérifier, puis à valider, deux gestes de l'utilisateur), le moteur en marche ou pas ; la Forme et les cas ne le sont plus jamais (le système les valide) ;
 *  le relecteur : inchangé.
 *  L'écran de l'essentiel (note 0.16.0-ecran-essentiel) : le ✓ d'une étape sur son badge d'état, et ce que fait un clic
 *  dessus.
 *  stepBadge(flow: VibeFlow, step: Pick<VibeStep, 'id' | 'check'>): StepBadge
 *  En créateur, à la Forme, aux Invariants et aux Modules seulement : validée (check.state 'ok') → mark 'ok' (« faite ✓ »),
 *  click 'withdraw' (retirer le ✓) ; le ✓ retiré à la main et qui tient (check.withdrawn) → mark 'withdrawn'
 *  (« faite · ✓ retiré »), click 'restore' (le rendre) ; sinon — jamais validée, modifiée depuis, à revoir, une preuve
 *  qui ne passe pas — ni ✓ ni clic : le badge ne valide jamais à la place du système. La note, la Revue, la PR et le
 *  relecteur : ni ✓ ni clic.
 *  Ne connaît pas : le DOM, React, ce que le clic envoie (step-parts : act.mark de l'étape, null ou 'ok').
 *  Utilisé par : app/panel/vibecoder (invariants-view : les cas à valider du relecteur ; step-parts : stepBadge). */
import { caseKeys } from 'shared/test-cases';
import type { VibeFlow, VibeMarkState, VibeStep, VibeView } from 'technicals/bridge';

export type Awaiting = { kind: 'note' } | { kind: 'forme' } | { kind: 'cases'; count: number };

export function awaiting(view: VibeView): Awaiting | null {
  const { note, flow } = view;
  const judged = (s: VibeMarkState) => s === 'ok' || (flow === 'review' && s === 'ko');
  const current = view.steps.find((s) => s.status === 'current')?.id;
  if (current === 'note' && note && !judged(note.mark) && (flow === 'review' || (note.filled && !view.questions.length))) return { kind: 'note' };
  if (flow === 'create') return null;   // la Forme et les cas : le système les valide, rien d'attendu
  if (current === 'forme' && note && view.modules.length && !judged(note.formeMark)) return { kind: 'forme' };
  if (current === 'invariants' && view.invariants.length) {
    const count = view.invariants.reduce((n, f) => n + caseKeys(f.cases).filter((k) => !judged(Object.hasOwn(f.marks, k) ? f.marks[k] : null)).length, 0);
    if (count) return { kind: 'cases', count };
  }
  return null;
}

// Le badge d'état d'une étape : son ✓ (validée, ou retiré à la main) et ce que fait un clic (le retirer, le rendre, rien).
export type StepBadge = { mark: 'ok' | 'withdrawn' | null; click: 'withdraw' | 'restore' | null };

export function stepBadge(_flow: VibeFlow, _step: Pick<VibeStep, 'id' | 'check'>): StepBadge {
  throw new Error('not implemented');
}
