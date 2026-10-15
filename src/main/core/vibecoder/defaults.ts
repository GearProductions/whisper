/** defaults — les fichiers de VibeCoder chez l'utilisateur (actions, skills,
 *  README de userData/vibecoder/), écrits par défaut sans jamais écraser une
 *  retouche. Un manifeste, <dir>/.defaults.json ({ chemin: sha1 de ce que nous
 *  avons écrit }), dit si un fichier est encore le nôtre : absent, il est
 *  écrit ; inchangé depuis notre écriture, il suit le nouveau défaut ; modifié
 *  par l'utilisateur, ou jamais écrit par nous, il est gardé tel quel.
 *  Ne connaît pas : Electron, node:fs (le disque est passé).
 *  Utilisé par : app/settings (ensureVibeFiles). */

// read : null si le fichier manque ou est illisible ; write crée ses dossiers.
export type Disk = { read(path: string): string | null; write(path: string, content: string): void };
export type DefaultFile = { path: string; content: string };   // chemin relatif au dossier

// Squelette : chaque fonction s'écrit dans le commit de son module.
const todo = (..._args: unknown[]): never => { throw new Error('à implémenter'); };

export function syncDefaults(dir: string, defaults: DefaultFile[], disk: Disk): { written: string[]; kept: string[] } {
  return todo(dir, defaults, disk);
}
