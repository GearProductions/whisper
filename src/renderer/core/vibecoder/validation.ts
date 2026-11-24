/** validation — ce que l'étape en cours attend de l'utilisateur quand il n'y a
 *  rien à lancer : valider la note, et pour le relecteur la forme ou les cas d'invariants
 *  (la lecture en pseudo-code est facultative).
 *  Créer : la validation (✓) de la note seule. Relire : un verdict
 *  (✓ ou ✗) sur la note et sur chaque cas (lu par sa clé, caseKeys de shared/test-cases).
 *  Le contrôle en trois points (note 0.16.0-controle-en-trois-points) : en créateur, seule la note est attendue
 *  ({ kind: 'note' } : à vérifier, puis à valider, deux gestes de l'utilisateur), le moteur en marche ou pas ; la Forme et les cas ne le sont plus jamais (le système les valide) ;
 *  le relecteur : inchangé.
 *  Ne connaît pas : le DOM, React. Utilisé par : app/panel/vibecoder (invariants-view : les cas à valider). */
import { caseKeys } from 'shared/test-cases';
import type { VibeMarkState, VibeView } from 'technicals/bridge';

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
