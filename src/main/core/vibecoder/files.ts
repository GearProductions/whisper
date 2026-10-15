/** files — un fichier désigné par une page, sans qu'elle puisse en nommer un
 *  autre (I-34) : elle ne donne qu'un id du dernier relevé, que itemPath
 *  traduit en chemin sans jamais lire l'id comme un chemin ; et un chemin
 *  n'est retenu que s'il reste, `..` et liens résolus, dans le dossier de
 *  l'agent (safePath).
 *  Ne connaît pas : Electron, le disque (realpath passé).
 *  Utilisé par : app/controllers/vibecoder (ouvrir un fichier du relevé). */
import type { VibeView } from 'shared/bridge';

// Squelette : chaque fonction s'écrit dans le commit de son module.
const todo = (..._args: unknown[]): never => { throw new Error('à implémenter'); };

// Le chemin absolu de `rel` dans `dir`, `..` et liens résolus par realpath (le
// dossier comme la cible) ; null s'il en sort, si `rel` est absolu ou contient
// un NUL, ou si realpath échoue.
export function safePath(dir: string, rel: string, realpath: (p: string) => string): string | null {
  return todo(dir, rel, realpath);
}

// Le chemin relatif du fichier du relevé qui porte cet id (la note, un test
// d'invariant, un variant, le fichier d'un module) ; null pour un id inconnu.
export function itemPath(view: VibeView | null, id: string): string | null { return todo(view, id); }
