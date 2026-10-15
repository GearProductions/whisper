/** marks — les validations de l'utilisateur (la note, la forme, un cas de
 *  test, une case du plan de test), chacune pour l'empreinte du contenu
 *  validé : « modifié depuis » si le contenu a changé. Et le brouillon de revue
 *  de chaque PR (Relire). Rend un nouvel état, ne touche pas à l'ancien.
 *  Ne connaît pas : Electron, le disque (l'état est rangé par app/settings).
 *  Utilisé par : core/vibecoder (journey), app/controllers/vibecoder, app/settings. */
import type { VibeComment, VibeMarkState } from 'shared/bridge';

// Par cible ('note', 'forme', 'case:<chemin du fichier>:<titre du cas>', 'check:<pr>:<rang>').
export type Marks = Record<string, { hash: string; verdict: 'ok' | 'ko' }>;
// Par numéro de PR.
export type Drafts = Record<string, VibeComment[]>;

// Le verdict s'il porte sur `hash`, 'changed' s'il porte sur un autre contenu, null sans validation.
export function markState(marks: Marks, target: string, hash: string): VibeMarkState {
  const mark = Object.hasOwn(marks, target) ? marks[target] : undefined;
  return !mark ? null : mark.hash === hash ? mark.verdict : 'changed';
}

// null : oublie la validation.
export function setMark(marks: Marks, target: string, hash: string, verdict: 'ok' | 'ko' | null): Marks {
  const { [target]: _, ...rest } = marks;
  return verdict ? { ...rest, [target]: { hash, verdict } } : rest;
}

export function addComment(drafts: Drafts, pr: number, target: string, text: string): Drafts {
  const list = drafts[pr] ?? [];
  return { ...drafts, [pr]: [...list, { id: Math.max(0, ...list.map((c) => c.id)) + 1, target, text }] };
}

export function removeComment(drafts: Drafts, pr: number, id: number): Drafts {
  return { ...drafts, [pr]: (drafts[pr] ?? []).filter((c) => c.id !== id) };
}
