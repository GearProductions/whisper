/** review-flow — ce que Relire prend de l'utilisateur et passe au principal :
 *  un numéro de PR tapé ou collé, une remarque du brouillon de revue dans les
 *  bornes que le principal accepte (draftVibe : cible d'une ligne, 300
 *  caractères ; texte de 5 000).
 *  Ne connaît pas : le DOM, React, le pont.
 *  Utilisé par : app/panel/vibecoder (pr-picker, commits-view, note-view, invariants-view, comment-box : DRAFT_MAX). */
import { excerpt } from './note';

// « 27 », « #27 » ou l'adresse d'une PR (…/pull/27) → 27 ; sinon null.
export function prNumber(input: string): number | null {
  const m = /^\s*(?:#?(\d+)|https?:\/\/\S+?\/pull\/(\d+)(?:[/?#]\S*)?)\s*$/i.exec(input);
  const n = m ? Number(m[1] ?? m[2]) : NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// Les bornes du principal (draftVibe) : la cible d'une remarque, son texte.
const TARGET_MAX = 300;
export const DRAFT_MAX = 5000;

const clip = (s: string, max: number) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

// Une remarque : sa cible sur une ligne, son texte (vide : la cible), coupés à
// la taille que le principal accepte.
export function remark(target: string, text: string): { target: string; text: string } {
  const t = excerpt(target, TARGET_MAX);
  return { target: t, text: clip(text.trim() || t, DRAFT_MAX) };
}
