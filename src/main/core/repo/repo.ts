/** repo — la page GitHub du dépôt d'un dossier : le remote `origin` de son
 *  `.git`, reconnu sur github.com, rendu en https://github.com/<o>/<d> (I-32).
 *  Ne connaît pas : Electron, git (aucun programme lancé, I-27), le disque
 *  (read injecté : chemin → texte, ou null si illisible).
 *  Utilisé par : app/menus. */
import path from 'node:path';

// schéma://[identifiants@]github.com[:port]/o/d ou [utilisateur@]github.com:o/d,
// puis .git et / facultatifs ; rien d'autre avant ni après.
const ORIGIN = /^(?:(?:https?|ssh|git):\/\/(?:[^@/\s?#]+@)?github\.com(?::\d+)?\/|(?:[^@/\s:]+@)?github\.com:)([A-Za-z0-9-]+)\/([A-Za-z0-9._-]+?)(?:\.git)?\/?$/i;

// L'origine reconnue sur github.com, reconstruite à partir du propriétaire et
// du dépôt seuls (ni identifiants, ni port, ni suffixe .git), ou null.
export function githubUrl(remote: string): string | null {
  const m = ORIGIN.exec(remote);
  if (!m || m[2] === '.' || m[2] === '..') return null;
  return `https://github.com/${m[1]}/${m[2]}`;
}

// La page GitHub du dossier : son `.git` (dossier, ou fichier `gitdir:` d'un
// worktree ou d'un sous-module), la config du dépôt (via `commondir`), l'url
// de [remote "origin"]. Pas de remontée aux dossiers parents.
export function githubPage(dir: string, read: (file: string) => string | null): string | null {
  const pointer = read(path.join(dir, '.git'));
  const gitDir = pointer?.startsWith('gitdir:') ? path.resolve(dir, pointer.slice(7).trim()) : path.join(dir, '.git');
  const common = read(path.join(gitDir, 'commondir'));
  const config = read(path.join(common ? path.resolve(gitDir, common.trim()) : gitDir, 'config'));
  const url = config === null ? null : originUrl(config);
  return url === null ? null : githubUrl(url);
}

// Première clé `url` de la section [remote "origin"] ; les commentaires (# ;)
// ne ressemblent ni à un en-tête ni à une clé, ils sont ignorés d'eux-mêmes.
function originUrl(config: string): string | null {
  let origin = false;
  for (const raw of config.split(/\r?\n/)) {
    const line = raw.trim();
    if (line.startsWith('[')) origin = /^\[remote\s+"origin"\]$/.test(line);
    else if (origin) {
      const m = /^url\s*=\s*(.*)$/i.exec(line);
      if (m) return m[1].replace(/^"(.*)"$/, '$1');
    }
  }
  return null;
}
