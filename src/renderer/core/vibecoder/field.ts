/** field — les champs de VibeCoder : ce qu'il écrit dans le champ de la
 *  conversation (une action « préparer » : son texte, {{quote}} remplacé par
 *  ce qu'on cite, sur une ligne de 300 caractères au plus — un bloc de code,
 *  lui, en entier, ses lignes gardées, et à la suite d'un texte sans
 *  {{quote}} — ajouté à la ligne) ; les lignes entières d'un code que couvre
 *  une sélection (le bloc cité) ; le champ dont une action emporte le texte
 *  (celui de son étape, ou aucun : vibe ne prend pas de texte, le champ de la
 *  note sert en Vibe).
 *  Ne connaît pas : le DOM, React, le pont.
 *  Utilisé par : app/panel/panel-app, app/panel/vibecoder (vibe-coder,
 *  step-parts, code-view). */
import type { VibeAction } from 'technicals/bridge';
import { excerpt } from './note';

const QUOTE_MAX = 300;

/** Le champ, suivi du texte d'une action « préparer » (à la ligne s'il n'est pas vide). block : la
 *  citation est un bloc de code, gardée entière (F-98), et mise à la suite d'un texte sans {{quote}}
 *  (Retour → fixup). */
export function withPrefill(field: string, template: string, quote: string, block = false): string {
  const cited = block ? quote : excerpt(quote, QUOTE_MAX);
  const text = block && !template.includes('{{quote}}')
    ? `${template.trimEnd()}\n${quote}`
    : template.replaceAll('{{quote}}', () => cited);
  return field.trim() ? `${field.trimEnd()}\n${text}` : text;
}

/** Les lignes entières de `code` que couvre la sélection [start, end) (positions de caractères,
 *  comme selectionStart/End) ; start = end : la ligne du clic. Une sélection qui finit au début
 *  d'une ligne ne la prend pas. */
export function codeBlock(code: string, start: number, end: number): string {
  const a = Math.min(start, end);
  let b = Math.max(start, end);
  if (b > a && code[b - 1] === '\n') b--;
  const from = a > 0 ? code.lastIndexOf('\n', a - 1) + 1 : 0;
  const to = code.indexOf('\n', b);
  return code.slice(from, to < 0 ? code.length : to);
}

// Les actions dont la vue donne elle-même le texte (Appliquer : la remarque, ou rien pour toutes).
const VIEW_TEXT = ['apply'];

/** Le champ dont une action emporte le texte : celui de son étape (son id) ; null : elle n'en prend
 *  pas (vibe), la vue le donne (apply), ou c'est un message de la conversation sans étape (ask, guide,
 *  propose-run : le champ de la conversation). */
export function fieldOf(a: Pick<VibeAction, 'id' | 'step' | 'kind' | 'needs' | 'usesText'>): string | null {
  if (a.kind !== 'send' || !(a.usesText || a.needs === 'text') || VIEW_TEXT.includes(a.id)) return null;
  return a.step;
}
