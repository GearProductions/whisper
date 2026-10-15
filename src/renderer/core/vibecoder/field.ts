/** field — ce que VibeCoder écrit dans le champ de la conversation : une
 *  action « préparer » (son texte, {{quote}} remplacé par ce qu'on cite, sur
 *  une ligne de 300 caractères au plus, ajouté à la ligne).
 *  Ne connaît pas : le DOM, React, le pont. Utilisé par : app/panel/panel-app. */
import { excerpt } from './note';

const QUOTE_MAX = 300;

// Le champ, suivi du texte d'une action « préparer » (à la ligne s'il n'est pas vide).
export function withPrefill(field: string, template: string, quote: string): string {
  const text = template.replaceAll('{{quote}}', () => excerpt(quote, QUOTE_MAX));
  return field.trim() ? `${field.trimEnd()}\n${text}` : text;
}
