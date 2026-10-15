/** files — un fichier désigné par une page, sans qu'elle puisse en nommer un
 *  autre (I-37) : elle ne donne qu'un id du dernier relevé, que itemPath
 *  traduit en chemin sans jamais lire l'id comme un chemin ; et un chemin
 *  n'est retenu que s'il reste, `..` et liens résolus, dans le dossier de
 *  l'agent (safePath).
 *  Ne connaît pas : Electron, le disque (realpath passé).
 *  Utilisé par : app/controllers/vibecoder (lire la note et les tests, ouvrir un fichier du relevé). */
import path from 'node:path';
import type { VibeView } from 'shared/bridge';

// Le chemin absolu de `rel` dans `dir`, `..` et liens résolus par realpath (le
// dossier comme la cible) ; null s'il en sort, si `rel` est absolu ou contient
// un NUL, ou si realpath échoue.
export function safePath(dir: string, rel: string, realpath: (p: string) => string): string | null {
  if (path.isAbsolute(rel) || rel.includes('\0')) return null;
  try {
    const root = realpath(dir);
    const target = realpath(path.resolve(root, rel));
    const inside = path.relative(root, target);
    return inside === '..' || inside.startsWith(`..${path.sep}`) || path.isAbsolute(inside) ? null : target;
  } catch {
    return null;
  }
}

// Le chemin relatif du fichier du relevé qui porte cet id (la note, un test
// d'invariant, un variant, le fichier d'un module) ; null pour un id inconnu.
export function itemPath(view: VibeView | null, id: string): string | null {
  if (!view) return null;
  const files = [view.note, ...view.invariants, ...view.variants, ...view.modules.map((m) => m.file)];
  return files.find((f) => f?.id === id)?.path ?? null;
}
