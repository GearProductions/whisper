/** files — un fichier désigné par une page, sans qu'elle puisse en nommer un
 *  autre (I-37) : elle ne donne qu'un id du dernier relevé, que itemPath
 *  traduit en chemin sans jamais lire l'id comme un chemin ; et un chemin
 *  n'est retenu que s'il reste, `..` et liens résolus, dans le dossier de
 *  l'agent (safePath).
 *  Ne connaît pas : Electron, le disque (realpath passé).
 *  Un fichier d'un module touché par la branche (codeFile) : son id
 *  `m<rang>/<i>` dans le dernier relevé, jamais lu comme un chemin.
 *  Utilisé par : app/controllers (vibecoder : lire la note et les tests, ouvrir
 *  un fichier ou un commit du relevé ; module-code : le fichier de Voir le code). */
import path from 'node:path';
import type { VibeModule, VibeView } from 'shared/bridge';

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
// d'invariant, un variant, le fichier d'un module ; `c<rang>/<i>` : le i-ème
// fichier du commit de ce rang) ; null pour un id inconnu.
export function itemPath(view: VibeView | null, id: string): string | null {
  if (!view) return null;
  const files = [view.note, ...view.invariants, ...view.variants, ...view.modules.map((m) => m.file),
    ...view.commits.flatMap((c, r) => c.files.map((p, i) => ({ id: `c${r}/${i}`, path: p })))];
  return files.find((f) => f?.id === id)?.path ?? null;
}

// Le commit du relevé que désigne `c<rang>` (son diff) ou `gh:c<rang>` (sa page
// GitHub, web) ; null pour un autre id.
export function itemCommit(view: VibeView | null, id: string): { hash: string; web: boolean } | null {
  const m = /^(gh:)?c(\d+)$/.exec(id);
  const c = m && view?.commits[Number(m[2])];
  return m && c ? { hash: c.hash, web: !!m[1] } : null;
}

// Le fichier d'un module touché du relevé que désigne `m<rang>/<i>` (et son
// module) ; null pour tout autre id (note, test, commit, module pas touché,
// id inconnu), l'id n'étant jamais lu comme un chemin.
export function codeFile(view: VibeView | null, id: string): { path: string; module: VibeModule } | null {
  void view; void id;
  throw new Error('not implemented');
}
