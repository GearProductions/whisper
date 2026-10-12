/** repo — la page GitHub du dépôt d'un dossier : le remote `origin` de son
 *  `.git`, reconnu sur github.com, rendu en https://github.com/<o>/<d> (I-32).
 *  Ne connaît pas : Electron, git (aucun programme lancé, I-27), le disque
 *  (read injecté : chemin → texte, ou null si illisible).
 *  Utilisé par : app/menus. */

// L'origine reconnue sur github.com, reconstruite à partir du propriétaire et
// du dépôt seuls (ni identifiants, ni port, ni suffixe .git), ou null.
export function githubUrl(remote: string): string | null {
  return null;
}

// La page GitHub du dossier : son `.git` (dossier, ou fichier `gitdir:` d'un
// worktree ou d'un sous-module), la config du dépôt (via `commondir`), l'url
// de [remote "origin"]. Pas de remontée aux dossiers parents.
export function githubPage(dir: string, read: (file: string) => string | null): string | null {
  return null;
}
