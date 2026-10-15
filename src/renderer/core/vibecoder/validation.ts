/** validation — ce que l'étape en cours attend de l'utilisateur quand il n'y a
 *  rien à lancer : valider la note, la forme, ou les cas d'invariants lus.
 *  Créer en Guide : la validation (✓) ; en Vibe, rien. Relire : un verdict
 *  (✓ ou ✗) sur la note et sur chaque cas lu.
 *  Ne connaît pas : le DOM, React. Utilisé par : app/panel/vibecoder (vibe-coder, validation). */
import type { VibeMarkState, VibeView } from 'technicals/bridge';

export type Awaiting = { kind: 'note' } | { kind: 'forme' } | { kind: 'cases'; count: number };

export function awaiting(view: VibeView): Awaiting | null {
  const { note, flow } = view;
  if (flow === 'create' && view.autonomy === 'vibe') return null;
  const judged = (s: VibeMarkState) => s === 'ok' || (flow === 'review' && s === 'ko');
  const current = view.steps.find((s) => s.status === 'current')?.id;
  if (current === 'note' && note && !judged(note.mark) && (flow === 'review' || (note.filled && !view.questions.length))) return { kind: 'note' };
  if (current === 'forme' && note && view.modules.length && !judged(note.formeMark)) return { kind: 'forme' };
  if (current === 'invariants' && view.invariants.length && view.invariants.every((f) => f.reading)) {
    const count = view.invariants.reduce((n, f) => n + f.cases.filter((c) => !judged(Object.hasOwn(f.marks, c) ? f.marks[c] : null)).length, 0);
    if (count) return { kind: 'cases', count };
  }
  return null;
}
