/** validation — ce que l'étape en cours attend de l'utilisateur quand il n'y a
 *  rien à lancer : valider la note, la forme, ou les cas d'invariants, lus en
 *  pseudo-code ou pas (la lecture est facultative ; l'écran n'en montre plus
 *  que les cas : la note et la forme ont leur ✓).
 *  Créer : la validation (✓) ; pendant Vibe (view.vibe), rien. Relire : un verdict
 *  (✓ ou ✗) sur la note et sur chaque cas.
 *  Ne connaît pas : le DOM, React. Utilisé par : app/panel/vibecoder (invariants-view : les cas à valider). */
import type { VibeMarkState, VibeView } from 'technicals/bridge';

export type Awaiting = { kind: 'note' } | { kind: 'forme' } | { kind: 'cases'; count: number };

export function awaiting(view: VibeView): Awaiting | null {
  const { note, flow } = view;
  if (flow === 'create' && view.vibe) return null;
  const judged = (s: VibeMarkState) => s === 'ok' || (flow === 'review' && s === 'ko');
  const current = view.steps.find((s) => s.status === 'current')?.id;
  if (current === 'note' && note && !judged(note.mark) && (flow === 'review' || (note.filled && !view.questions.length))) return { kind: 'note' };
  if (current === 'forme' && note && view.modules.length && !judged(note.formeMark)) return { kind: 'forme' };
  if (current === 'invariants' && view.invariants.length) {
    const count = view.invariants.reduce((n, f) => n + f.cases.filter((c) => !judged(Object.hasOwn(f.marks, c) ? f.marks[c] : null)).length, 0);
    if (count) return { kind: 'cases', count };
  }
  return null;
}
