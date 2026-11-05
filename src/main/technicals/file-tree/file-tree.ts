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
 *  Un dossier source déposé, copié ou déplacé n'est jamais mêlé à un dossier du
 *  même nom : il prend le premier numéro libre, comme un fichier (seul
 *  `moveContents` mêle, sous la racine). `moveInto` : copie puis source effacée
 *  une fois arrivée ; `renameItem` : même dossier, nom pris → 'taken' sans
 *  numéro, sinon copie exclusive puis effacement ; un dossier dont un caché ou
 *  un lien est resté (la source reste) → 'left'. Jamais `rename` (il écrase).
 *  Changer la seule casse sur un disque insensible à la casse : le nom visé « pris »
 *  par soi-même (absent du relevé du dossier) passe par un nom provisoire visible.
 *  `writeInto` : écrit des octets reçus (pas un fichier du disque) sous la
 *  racine, jamais d'écrasement (le premier numéro libre, écriture exclusive),
 *  racine lien refusée, une erreur dans `failed`.
 *  Ne connaît pas : les artefacts, les agents, Electron.
 *  Utilisé par : controllers (artifacts, artifact-ops, artifact-migration, worktrees). */
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

// Un dossier d'arrivée sous un dossier mêlé : créé, ou un vrai dossier existant mêlé ; tout autre (fichier, lien) → numéro suivant.
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

// Un dossier neuf, jamais mêlé à un existant (fichier, dossier ou lien) : le premier numéro libre.
async function newDir(dir: string, name: string) {
  for (let n = 1; ; n++) {
    const target = path.join(dir, numberedName(name, n));
    try { await fs.mkdir(target); return target; } catch (e) {
      if (code(e) !== 'EEXIST' && !await fs.lstat(target).catch(() => null)) throw e;
    }
  }
}

// Copie (ou, avec `remove`, déplace) `src` sous `root` ; la source n'est effacée qu'une fois arrivée.
async function place(src: string, root: string, report: TreeReport, remove: boolean) {
  const from = path.resolve(src);
  try {
    const st = await fs.lstat(from);
    if (!st.isFile() && !st.isDirectory()) { report.links.push(from); return report; }
    if (st.isDirectory() && isHidden(path.basename(from))) { report.hidden.push(from); return report; }
    await ensureRoot(root);
    if (st.isFile()) {
      report.copied.push((await copyFree(from, root, path.basename(from)))!);
      if (remove) await fs.unlink(from);
    } else {
      await refuseIfContains(from, root);
      await walk(from, await newDir(root, path.basename(from)), report, remove);
      // non vide (échec, lien, caché resté) : rmdir refuse, la source reste
      if (remove) await fs.rmdir(from).catch(() => {});
    }
  } catch (e) { fail(report, from, e); }
  return report;
}

// `report` : celui où s'ajoute le résultat (un seul pour plusieurs sources, sans les fusionner).
export const copyInto = (src: string, root: string, report: TreeReport = newReport()) =>
  place(src, root, report, false);

export const moveInto = (src: string, root: string, report: TreeReport = newReport()) =>
  place(src, root, report, true);

// `from` → `to` (même dossier), sans écraser : copie exclusive puis effacement (pas de rename).
async function renameOnce(from: string, to: string, isFile: boolean): Promise<'ok' | 'taken' | 'left'> {
  try {
    if (isFile) await fs.copyFile(from, to, constants.COPYFILE_EXCL | constants.COPYFILE_FICLONE);
    else await fs.mkdir(to);
  } catch (e) {
    if (code(e) === 'EEXIST' || await fs.lstat(to).catch(() => null)) return 'taken';
    throw e;
  }
  if (isFile) await fs.unlink(from);
  else {
    const report = newReport();
    await walk(from, to, report, true);
    if (report.failed.length) throw new Error(report.failed[0].error);
    // liens et cachés restés : la source reste, et on le dit
    if (await fs.rmdir(from).then(() => false, () => true)) return 'left';
  }
  return 'ok';
}

// Renomme dans le même dossier, sans jamais écraser. Disque insensible à la casse (Windows, macOS) : changer
// la seule casse (Rapport.md → rapport.md) se heurte à soi-même ; si le dossier ne contient pas exactement le
// nom visé, c'est ce cas, et on passe par un nom provisoire visible (jamais `rename`, qui écrase).
export async function renameItem(src: string, name: string): Promise<'ok' | 'taken' | 'left'> {
  const from = path.resolve(src);
  if (!name || name === '.' || name === '..' || path.basename(name) !== name) throw new Error(`nom invalide : ${name}`);
  const dir = path.dirname(from);
  const to = path.join(dir, name);
  const st = await fs.lstat(from);
  if (!st.isFile() && !st.isDirectory()) throw new Error(`${from} est un lien ou un fichier spécial`);
  const first = await renameOnce(from, to, st.isFile());
  const base = path.basename(from);
  if (first !== 'taken' || name === base || name.toLowerCase() !== base.toLowerCase()) return first;
  if ((await fs.readdir(dir)).includes(name)) return 'taken';
  const temp = path.join(dir, `${name}.renommage`);
  const moved = await renameOnce(from, temp, st.isFile());
  return moved === 'ok' ? renameOnce(temp, to, st.isFile()) : moved;
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

export async function writeInto(_root: string, _name: string, _bytes: Buffer, _report?: TreeReport): Promise<TreeReport> {
  throw new Error('not implemented');
}
