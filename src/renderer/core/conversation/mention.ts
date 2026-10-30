/** mention — le « @ » du champ : le mot tapé, les artefacts qui correspondent
 *  (d'abord ceux dont le nom commence par la saisie), le choix ; matchByName,
 *  la correspondance par le nom, que les commandes « / » (slash) reprennent.
 *  Ne connaît pas : le DOM, le pont. Utilisé par : app/panel (artifact-mention), slash. */
import type { VibeArtifact } from 'technicals/bridge';

const SHOWN = 50;

// Un « @ » en début de champ ou après un espace, sans espace jusqu'au curseur
// (« a@b.fr » n'ouvre rien) : où il commence et ce qui le suit, sinon null.
export function mentionQuery(value: string, caret: number) {
  const m = /(?:^|\s)@(\S*)$/.exec(value.slice(0, caret));
  return m ? { start: caret - m[1].length - 1, query: m[1] } : null;
}

// Les éléments dont le nom (sans casse) commence par q (en minuscules), puis ceux qui le contiennent, au plus SHOWN.
// Aussi pour les commandes « / » (slash).
export function matchByName<T>(list: T[], q: string, nameOf: (item: T) => string) {
  const name = (item: T) => nameOf(item).toLowerCase();
  return list.filter((item) => name(item).startsWith(q))
    .concat(list.filter((item) => !name(item).startsWith(q) && name(item).includes(q))).slice(0, SHOWN);
}

// Rien ne correspond : liste vide (l'appelant laisse alors Entrée et Tab au champ).
export const matchArtifacts = (list: VibeArtifact[], q: string) => matchByName(list, q.toLowerCase(), (a) => a.name);

// Le chemin du fichier remplace le « @… » tapé (de start au curseur) ; le reste du champ suit.
export function pickArtifact(value: string, caret: number, start: number, file: string) {
  return { value: `${value.slice(0, start)}${file} ${value.slice(caret).trimStart()}`, caret: start + file.length + 1 };
}
