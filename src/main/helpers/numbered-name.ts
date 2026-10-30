/** numbered-name — le nom d'un fichier ou dossier avec son numéro avant l'extension :
 *  rapport.md → rapport-2.md, .env → .env-2, a → a-2 ; n = 1 rend le nom tel quel.
 *  Ne connaît pas : le disque, les artefacts.
 *  Utilisé par : technicals/file-tree. */

export const numberedName = (name: string, n: number) => {
  if (n < 2) return name;
  const dot = name.lastIndexOf('.');
  // un point en tête (.env) n'ouvre pas une extension
  const at = dot > 0 ? dot : name.length;
  return `${name.slice(0, at)}-${n}${name.slice(at)}`;
};
