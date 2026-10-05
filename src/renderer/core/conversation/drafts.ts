/** drafts — un brouillon par conversation (texte et pièces jointes), gardé
 *  quand on change d'agent ; la dictée s'ajoute au brouillon affiché.
 *  Ne connaît pas : le DOM, le pont. Utilisé par : app/panel (panel-app). */
import type { Piece } from './pieces';

export type Draft = { text: string; pieces: Piece[] };
export const EMPTY: Draft = { text: '', pieces: [] };

export function createDrafts() {
  const saved = new Map<string, Draft>();
  return {
    // On quitte la conversation `from` (son brouillon : `current`) pour `to`.
    switchTo(from: string | null, current: Draft, to: string): Draft {
      if (from) saved.set(from, current);
      return saved.get(to) || EMPTY;
    },
    // Envoyé : le brouillon de cette conversation n'existe plus.
    drop(key: string | null) {
      if (key) saved.delete(key);
    },
  };
}

// La dictée, à la suite du texte, séparée d'une espace.
export const appendDictation = (value: string, text: string) => `${value}${value && !/\s$/.test(value) ? ' ' : ''}${text}`;
