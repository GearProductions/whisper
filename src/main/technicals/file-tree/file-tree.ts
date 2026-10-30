/** file-tree — copier ou déplacer un fichier ou un dossier dans un dossier
 *  racine, sur le disque : un lien jamais suivi, jamais d'écrasement (le
 *  nouveau prend le premier numéro libre), racine créée et refusée si elle est
 *  un lien ; une erreur va dans `failed` et n'arrête pas les suivants ; aucun
 *  appel synchrone, aucune limite de nombre ni de taille.
 *  Déplacer seulement : un nom pris par un fichier ordinaire de mêmes taille et
 *  octets (lus par morceaux) est le même fichier, déjà arrivé (coupure entre
 *  la copie et l'effacement) : la source est effacée, rien n'est copié. Lien,
 *  dossier, octets différents ou illisibles : le numéro libre. `copyInto` ne
 *  compare rien (ajouter deux fois numérote).
 *  Ne connaît pas : les artefacts, les agents, Electron.
 *  Utilisé par : controllers (artifacts, artifact-migration, worktrees). */
import { constants } from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import { numberedName } from 'helpers';

export type TreeReport = {
  copied: string[];                          // chemins sous root
  links: string[];                           // lien ou fichier spécial, passés
  hidden: string[];                          // dossiers cachés, passés
  failed: { path: string; error: string }[];
};

const newReport = (): TreeReport => ({ copied: [], links: [], hidden: [], failed: [] });
const fail = (report: TreeReport, p: string, e: unknown) =>
  report.failed.push({ path: p, error: e instanceof Error ? e.message : String(e) });
const code = (e: unknown) => (e as NodeJS.ErrnoException).code;
const isHidden = (name: string) => name.startsWith('.');

// Crée la racine ; un lien (même cassé) ou un fichier la refuse : on n'écrit jamais dans sa cible.
async function ensureRoot(root: string) {
  const st = await fs.lstat(root).catch(e => { if (code(e) === 'ENOENT') return null; throw e; });
  if (!st) await fs.mkdir(root, { recursive: true });
  else if (!st.isDirectory()) throw new Error(`${root} n'est pas un dossier (lien ou fichier)`);
}

// Un dossier qui contient la racine (créée avant) se copierait lui-même sans fin.
async function refuseIfContains(dir: string, root: string) {
  const [d, r] = await Promise.all([fs.realpath(dir), fs.realpath(root)]);
  if (r === d || r.startsWith(d + path.sep)) throw new Error(`${dir} contient ${root}`);
}

// `b` est un fichier ordinaire (pas un lien) de mêmes taille et octets que `a`, lus par morceaux ;
// toute erreur (illisible…) : pas le même.
async function sameBytes(a: string, b: string) {
  let fa, fb;
  try {
    const [sa, sb] = await Promise.all([fs.lstat(a), fs.lstat(b)]);
    if (!sa.isFile() || !sb.isFile() || sa.size !== sb.size) return false;
    [fa, fb] = [await fs.open(a), await fs.open(b)];
    const [x, y] = [Buffer.alloc(65536), Buffer.alloc(65536)];
    for (let left = sa.size; left > 0;) {
      const [ra, rb] = await Promise.all([fa.read(x, 0, x.length, null), fb.read(y, 0, y.length, null)]);
      if (!ra.bytesRead || ra.bytesRead !== rb.bytesRead || !x.subarray(0, ra.bytesRead).equals(y.subarray(0, rb.bytesRead))) return false;
      left -= ra.bytesRead;
    }
    return true;
  } catch { return false; }
  finally { await Promise.all([fa?.close(), fb?.close()]).catch(() => {}); }
}

// Copie sans écraser : le nom pris (même un lien) fait passer au numéro suivant. EEXIST, ou, sur un dossier
// du même nom sous Windows, une autre erreur : c'est le disque qui dit si le nom est pris.
// `dedupe` : un nom pris par les mêmes octets n'est pas recopié (null : le fichier est déjà là).
async function copyFree(file: string, dir: string, name: string, dedupe = false) {
  for (let n = 1; ; n++) {
    const target = path.join(dir, numberedName(name, n));
    try {
      await fs.copyFile(file, target, constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE);
      return target;
    } catch (e) {
      if (code(e) !== 'EEXIST' && !await fs.lstat(target).catch(() => null)) throw e;
      if (dedupe && await sameBytes(file, target)) return null;
    }
  }
}

// Le dossier d'arrivée : créé, ou un vrai dossier existant mêlé ; tout autre (fichier, lien) → numéro suivant.
async function openDir(dir: string, name: string) {
  for (let n = 1; ; n++) {
    const target = path.join(dir, numberedName(name, n));
    try { await fs.mkdir(target); return target; } catch (e) {
      if (code(e) !== 'EEXIST') throw e;
      if ((await fs.lstat(target)).isDirectory()) return target;
    }
  }
}

// Le contenu de `from` dans `to`, un à un ; `remove` : la source part une fois arrivée.
async function walk(from: string, to: string, report: TreeReport, remove: boolean) {
  for (const entry of await fs.readdir(from, { withFileTypes: true })) {
    const p = path.join(from, entry.name);
    try {
      if (entry.isDirectory()) {
        if (isHidden(entry.name)) { report.hidden.push(p); continue; }
        await walk(p, await openDir(to, entry.name), report, remove);
        // non vide (échec, lien, caché resté) : rmdir refuse, la source reste
        if (remove) await fs.rmdir(p).catch(() => {});
      } else if (entry.isFile()) {
        const target = await copyFree(p, to, entry.name, remove);
        if (target) report.copied.push(target);
        if (remove) await fs.unlink(p);
      } else report.links.push(p);
    } catch (e) { fail(report, p, e); }
  }
}

// `report` : celui où s'ajoute le résultat (un seul pour plusieurs sources, sans les fusionner).
export async function copyInto(src: string, root: string, report: TreeReport = newReport()): Promise<TreeReport> {
  const from = path.resolve(src);
  try {
    const st = await fs.lstat(from);
    const name = path.basename(from);
    if (!st.isFile() && !st.isDirectory()) { report.links.push(from); return report; }
    if (st.isDirectory() && isHidden(name)) { report.hidden.push(from); return report; }
    await ensureRoot(root);
    if (st.isFile()) report.copied.push((await copyFree(from, root, name))!);
    else {
      await refuseIfContains(from, root);
      await walk(from, await openDir(root, name), report, false);
    }
  } catch (e) { fail(report, from, e); }
  return report;
}

export async function moveContents(from: string, root: string): Promise<TreeReport> {
  const report = newReport();
  try {
    const st = await fs.lstat(from).catch(e => { if (code(e) === 'ENOENT') return null; throw e; });
    if (!st?.isDirectory()) return report;
    await ensureRoot(root);
    await walk(from, root, report, true);
  } catch (e) { fail(report, from, e); }
  return report;
}

// Un fichier ordinaire, hors dossier caché ; en cas de doute (erreur de lecture), il en reste.
export async function hasFiles(dir: string): Promise<boolean> {
  try {
    if (!(await fs.lstat(dir)).isDirectory()) return false;
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      if (entry.isFile()) return true;
      if (entry.isDirectory() && !isHidden(entry.name) && await hasFiles(path.join(dir, entry.name))) return true;
    }
    return false;
  } catch (e) { return code(e) !== 'ENOENT'; }
}
