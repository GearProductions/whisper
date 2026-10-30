/** file-tree — copier ou déplacer un fichier ou un dossier dans un dossier
 *  racine, sur le disque : un lien jamais suivi, jamais d'écrasement (le
 *  nouveau prend le premier numéro libre), racine créée et refusée si elle est
 *  un lien ; une erreur va dans `failed` et n'arrête pas les suivants ; aucun
 *  appel synchrone, aucune limite de nombre ni de taille.
 *  Ne connaît pas : les artefacts, les agents, Electron.
 *  Utilisé par : controllers (artifacts, artifact-moves). */

export type TreeReport = {
  copied: string[];                          // chemins sous root
  links: string[];                           // lien ou fichier spécial, passés
  hidden: string[];                          // dossiers cachés, passés
  failed: { path: string; error: string }[];
};

export async function copyInto(_src: string, _root: string): Promise<TreeReport> {
  throw new Error('not implemented');
}

export async function moveContents(_from: string, _root: string): Promise<TreeReport> {
  throw new Error('not implemented');
}

export async function hasFiles(_dir: string): Promise<boolean> {
  throw new Error('not implemented');
}
