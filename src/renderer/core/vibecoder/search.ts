/** search — la vue des branches, sans le DOM : la recherche (chaque mot de la
 *  requête, sans casse, dans les champs d'une PR ou d'une branche) et les PR
 *  où l'on peut se demander en relecture (dans Toutes les PR, ni des miennes ni
 *  déjà à relire ; le principal revérifie).
 *  Ne connaît pas : gh, le pont. Utilisé par : app/panel/vibecoder (branches-view). */
import type { VibePrItem } from 'technicals/bridge';

// Chaque mot de `query` dans l'un des champs, sans casse ; une requête vide : tout.
export const searchMatch = (query: string, ...fields: string[]) => {
  const hay = fields.join(' ').toLowerCase();
  return query.toLowerCase().split(/\s+/).filter(Boolean).every((word) => hay.includes(word));
};

// Une PR, par son numéro (#12), son titre, son auteur.
export const prMatch = (query: string, p: VibePrItem) => searchMatch(query, `#${p.number}`, p.title, p.author);

// La PR n de Toutes les PR : ni des miennes, ni déjà à relire.
export const reviewAskable = (prs: { mine: VibePrItem[]; review: VibePrItem[]; all: VibePrItem[] }, n: number) =>
  prs.all.some((p) => p.number === n) && !prs.mine.some((p) => p.number === n) && !prs.review.some((p) => p.number === n);
