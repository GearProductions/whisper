/** field — les champs de VibeCoder : ce qu'il écrit dans le champ de la
 *  conversation (une action « préparer » : son texte, {{quote}} remplacé par
 *  ce qu'on cite, sur une ligne de 300 caractères au plus, ajouté à la
 *  ligne) ; le champ dont une action emporte le texte (celui de son étape,
 *  celui de Tout dérouler, ou aucun).
 *  Ne connaît pas : le DOM, React, le pont.
 *  Utilisé par : app/panel/panel-app, app/panel/vibecoder (vibe-coder, step-parts). */
import type { VibeAction } from 'technicals/bridge';
import { excerpt } from './note';

const QUOTE_MAX = 300;

// Le champ, suivi du texte d'une action « préparer » (à la ligne s'il n'est pas vide).
export function withPrefill(field: string, template: string, quote: string): string {
  const text = template.replaceAll('{{quote}}', () => excerpt(quote, QUOTE_MAX));
  return field.trim() ? `${field.trimEnd()}\n${text}` : text;
}

// Les actions dont la vue donne elle-même le texte (Appliquer : la remarque, ou rien pour toutes).
const VIEW_TEXT = ['apply'];

/** Le champ dont une action emporte le texte : celui de son étape (son id), celui de Tout dérouler
 *  ('vibe', dans le bandeau du mode Vibe) ; null : elle n'en prend pas, la vue le donne (apply), ou
 *  c'est un message de la conversation sans étape (ask, guide, propose-run : le champ de la conversation). */
export function fieldOf(a: Pick<VibeAction, 'id' | 'step' | 'kind' | 'needs' | 'usesText'>): string | null {
  if (a.kind !== 'send' || !(a.usesText || a.needs === 'text') || VIEW_TEXT.includes(a.id)) return null;
  return a.step ?? (a.id === 'vibe' ? 'vibe' : null);
}
