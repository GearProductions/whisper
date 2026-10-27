/** project-file — où vit le fichier du projet : `<dossier>/.vibecoder/project.json`,
 *  et la ligne `.vibecoder/` à ajouter à `.git/info/exclude` pour que git
 *  l'ignore sans rien à commiter.
 *  Ne connaît pas : le disque, git, Electron.
 *  Utilisé par : app/controllers/processes. */
import path from 'node:path';

export const PROJECT_DIR = '.vibecoder';

// Le fichier du projet du dossier `home`.
export const projectPath = (home: string) => path.join(home, PROJECT_DIR, 'project.json');

// Le texte de .git/info/exclude (null : pas de fichier) avec la ligne
// .vibecoder/ à la fin ; null si .vibecoder y est déjà ignoré.
export function withExclude(exclude: string | null): string | null {
  const text = exclude ?? '';
  if (text.split('\n').some((l) => ['.vibecoder', '.vibecoder/', '/.vibecoder/'].includes(l.trim()))) return null;
  return `${text}${text && !text.endsWith('\n') ? '\n' : ''}${PROJECT_DIR}/\n`;
}
