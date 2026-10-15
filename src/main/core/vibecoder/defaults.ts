/** defaults — les fichiers de VibeCoder chez l'utilisateur (actions, skills,
 *  README de userData/vibecoder/), écrits par défaut sans jamais écraser une
 *  retouche. Un manifeste, <dir>/.defaults.json ({ chemin: sha1 de ce que nous
 *  avons écrit }), dit si un fichier est encore le nôtre : absent, il est
 *  écrit ; inchangé depuis notre écriture, il suit le nouveau défaut ; modifié
 *  par l'utilisateur, jamais écrit par nous, ou illisible, il est gardé tel
 *  quel. Manifeste illisible : rien n'est plus à nous (seul l'absent est écrit).
 *  Ne connaît pas : Electron, node:fs (le disque est passé).
 *  Utilisé par : app/settings (ensureVibeFiles). */
import { createHash } from 'node:crypto';
import path from 'node:path';

// read : null si le fichier manque, une erreur s'il est illisible (EACCES…) ; write crée ses dossiers.
export type Disk = { read(path: string): string | null; write(path: string, content: string): void };
export type DefaultFile = { path: string; content: string };   // chemin relatif au dossier

const sha1 = (text: string) => createHash('sha1').update(text).digest('hex');

// written : écrits (absents, ou encore les nôtres) ; kept : gardés tels quels (retouchés, ou pas de nous).
export function syncDefaults(dir: string, defaults: DefaultFile[], disk: Disk): { written: string[]; kept: string[] } {
  const manifestPath = path.join(dir, '.defaults.json');
  let manifest: Record<string, string> = {};
  try {
    const parsed = JSON.parse(disk.read(manifestPath) ?? '{}');
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) manifest = parsed;
  } catch { /* illisible : rien n'est plus à nous */ }
  const written: string[] = [];
  const kept: string[] = [];
  for (const d of defaults) {
    const file = path.join(dir, d.path);
    let current: string | null;
    try { current = disk.read(file); } catch { kept.push(d.path); continue; }   // illisible n'est pas absent
    if (current === d.content) manifest[d.path] = sha1(d.content);      // déjà le défaut : le nôtre
    else if (current === null || (Object.hasOwn(manifest, d.path) && manifest[d.path] === sha1(current))) {
      disk.write(file, d.content);
      manifest[d.path] = sha1(d.content);
      written.push(d.path);
    } else kept.push(d.path);
  }
  disk.write(manifestPath, JSON.stringify(manifest, null, 2));
  return { written, kept };
}
