/** review-flow — ce que Relire prend de l'utilisateur et passe au principal :
 *  une remarque du brouillon de revue dans les
 *  bornes que le principal accepte (draftVibe : cible d'une ligne, 300
 *  caractères ; texte de 5 000) ; celle d'un fichier d'un commit cite son
 *  chemin et ses lignes en bloc de code (coupées d'abord : la remarque reste),
 *  sur la cible du commit (quoteRemark).
 *  Et, à l'étape Revue de Créer, ce que montre
 *  chaque remarque de la ponytail review (appliquée, Appliquer ou rien) et si
 *  toutes sont appliquées (remarkMark, allApplied) ; si une course retient
 *  les autres (isLive).
 *  Ne connaît pas : le DOM, React, le pont, les noms des fichiers de sortie.
 *  Utilisé par : app/panel/vibecoder (commits-view, note-view, invariants-view : remark ;
 *  commits-view : quoteRemark ; comment-box : DRAFT_MAX ;
 *  review-view : remarkMark, allApplied ; review-view, step-parts, vibe-coder : isLive). */
import type { VibeRun } from 'technicals/bridge';
import { BULLET, excerpt } from './note';
import { remarkKey } from './outputs';

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

// Une remarque sur des lignes d'un fichier d'un commit : la cible du commit (comptée sur sa carte),
// le texte = le chemin, les lignes en bloc de code (clôture plus longue que leurs ` : il reste fermé),
// puis la remarque ; les lignes coupées d'abord, pour que la remarque tienne sous DRAFT_MAX.
export function quoteRemark(target: string, path: string, block: string, text: string): { target: string; text: string } {
  const fence = '`'.repeat((block.match(/`+/g) ?? []).reduce((n, b) => Math.max(n, b.length + 1), 3));
  const note = text.trim();
  const lines = clip(block, Math.max(1, DRAFT_MAX - path.length - note.length - 2 * fence.length - 4));
  return remark(target, `${path}\n${fence}\n${lines}\n${fence}\n${note}`);
}

// Une course qui retient les autres : en cours, en attente d'une autorisation, arrêtée non tranchée.
export const isLive = (state: VibeRun['state'] | null | undefined) => state === 'running' || state === 'asking' || state === 'stopped';

// Une remarque de la ponytail review (son texte) : appliquée (sa clé dans
// applied) ; sinon Appliquer, sauf pendant une course apply (Tout appliquer ou
// une autre remarque : en cours, en attente, arrêtée non tranchée) → rien.
export function remarkMark(text: string, applied: Set<string>, apply: VibeRun['state'] | null): 'applied' | 'apply' | null {
  const key = remarkKey(text);
  if (key && applied.has(key)) return 'applied';
  return isLive(apply) ? null : 'apply';
}

// ponytail.md : chacune de ses lignes de liste (au moins une) appliquée → le bandeau « Appliquée ».
export function allApplied(md: string, applied: Set<string>): boolean {
  const items = md.split(/\r?\n/).filter((l) => BULLET.test(l)).map((l) => l.replace(BULLET, ''));
  return items.length > 0 && items.every((x) => applied.has(remarkKey(x) ?? ''));
}
