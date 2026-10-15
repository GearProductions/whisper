/** marks — les validations de l'utilisateur (la note, la forme, un cas de
 *  test), chacune pour l'empreinte du contenu validé : « modifié depuis » si
 *  le contenu a changé. Et le brouillon de revue de chaque PR (Relire). Rend
 *  un nouvel état, ne touche pas à l'ancien.
 *  Ne connaît pas : Electron, le disque (l'état est rangé par app/settings).
 *  Utilisé par : core/vibecoder (journey), app/controllers/vibecoder, app/settings. */
import type { VibeComment, VibeMarkState } from 'shared/bridge';

// Par cible ('note', 'forme', 'case:<id du fichier>:<titre du cas>').
export type Marks = Record<string, { hash: string; verdict: 'ok' | 'ko' }>;
// Par numéro de PR.
export type Drafts = Record<string, VibeComment[]>;

// Squelette : chaque fonction s'écrit dans le commit de son module.
const todo = (..._args: unknown[]): never => { throw new Error('à implémenter'); };

// Le verdict s'il porte sur `hash`, 'changed' s'il porte sur un autre contenu, null sans validation.
export function markState(marks: Marks, target: string, hash: string): VibeMarkState { return todo(marks, target, hash); }

// null : oublie la validation.
export function setMark(marks: Marks, target: string, hash: string, verdict: 'ok' | 'ko' | null): Marks {
  return todo(marks, target, hash, verdict);
}

export function addComment(drafts: Drafts, pr: number, target: string, text: string): Drafts { return todo(drafts, pr, target, text); }

export function removeComment(drafts: Drafts, pr: number, id: number): Drafts { return todo(drafts, pr, id); }
