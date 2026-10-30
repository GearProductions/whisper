/** artifacts — les artefacts de l'agent (vibecoder-out/<agent>/artifacts/) :
 *  le nom du dossier et du schéma qui les sert, le genre et le type MIME d'un
 *  fichier d'après son extension, la liste du relevé (ids a<i> dans l'ordre
 *  des noms, url, truncated), et l'artefact d'un id du dernier relevé (la page
 *  ne donne qu'un id, jamais un chemin : I-37), les chemins d'un dépôt
 *  (droppedPaths : lus du File par le pont, revérifiés ici), la clé d'un
 *  dossier (folderKey : le même dossier, même parti ou derrière un lien), et
 *  les deux libellés du dépôt et du retour (addedLine, failedLine : fr et en).
 *  Ne connaît pas : Electron, le disque (realpath et fichiers passés), git.
 *  Utilisé par : app/controllers (artifacts, artifact-moves, vibecoder, module-code). */
import path from 'node:path';
import type { VibeArtifact, VibeLang, VibeView } from 'shared/bridge';
import type { TreeReport } from 'technicals/file-tree';

export const ARTIFACTS = 'artifacts';
export const ARTIFACT_SCHEME = 'vibe-artifact';

const PAGES = new Map([['html', 'text/html'], ['htm', 'text/html'], ['svg', 'image/svg+xml']]);
const MEDIA = new Map([
  ['png', 'image/png'], ['jpg', 'image/jpeg'], ['jpeg', 'image/jpeg'], ['gif', 'image/gif'],
  ['webp', 'image/webp'], ['avif', 'image/avif'], ['bmp', 'image/bmp'], ['ico', 'image/x-icon'],
  ['pdf', 'application/pdf'],
  ['mp3', 'audio/mpeg'], ['wav', 'audio/wav'], ['ogg', 'audio/ogg'], ['flac', 'audio/flac'], ['m4a', 'audio/mp4'],
  ['mp4', 'video/mp4'], ['webm', 'video/webm'], ['mov', 'video/quicktime'],
]);

const ext = (name: string) => path.posix.extname(name).slice(1).toLowerCase();

export function artifactKind(name: string): VibeArtifact['kind'] {
  const e = ext(name);
  if (e === 'md') return 'markdown';
  if (PAGES.has(e)) return 'page';
  if (MEDIA.has(e)) return 'media';
  return 'text';
}

// Le type MIME d'un page ou d'un media ; tout autre : application/octet-stream.
export function artifactType(name: string): string {
  const e = ext(name);
  return PAGES.get(e) ?? MEDIA.get(e) ?? 'application/octet-stream';
}

export function artifactList(
  agentId: string, files: { name: string; size: number; time: number }[], max: number,
): VibeArtifact[] {
  return [...files]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((f, i) => {
      const id = `a${i}`;
      const kind = artifactKind(f.name);
      const text = kind === 'markdown' || kind === 'text';
      return {
        id, name: f.name, kind, size: f.size, time: f.time,
        url: text ? null : `${ARTIFACT_SCHEME}://${agentId}/${id}?t=${f.time}`,
        truncated: text && f.size > max,
      };
    });
}

// L'artefact de l'id dans le relevé ; un id inconnu (ou un chemin) : null.
export function artifactOf(view: VibeView | null, id: string): VibeArtifact | null {
  return view?.artifacts?.find((a) => a.id === id) ?? null;
}

// Les chemins reçus du pont : absolus, sans NUL ni segment `..`, ni racine ; le reste compté dans noPath.
// path.resolve retire le / de fin : un lien passé avec un / de fin ne serait pas suivi par lstat.
export function droppedPaths(list: unknown): { paths: string[]; noPath: number } {
  const paths: string[] = [];
  let noPath = 0;
  for (const p of Array.isArray(list) ? list : []) {
    const r = typeof p === 'string' && path.isAbsolute(p) && !p.includes('\0') && !p.split(/[\\/]/).includes('..') ? path.resolve(p) : '';
    if (path.basename(r)) paths.push(r);
    else noPath++;
  }
  return { paths, noPath };
}

// Le dossier tel qu'on le compare une fois parti : le plus long début qui existe, résolu, plus la suite.
export function folderKey(dir: string, realpath: (p: string) => string): string {
  const rest: string[] = [];
  let head = path.resolve(dir);
  for (;;) {
    try { return path.join(realpath(head), ...rest); } catch { /* absent : un cran plus haut */ }
    const up = path.dirname(head);
    if (up === head) return path.join(head, ...rest);
    rest.unshift(path.basename(head));
    head = up;
  }
}

export type ArtifactsReport = TreeReport & { noPath: number };

const SHOWN = 3;
const names = (paths: string[]) =>
  paths.slice(0, SHOWN).map((p) => path.basename(p)).join(', ') + (paths.length > SHOWN ? ', …' : '');

// Ce qui s'est passé au dépôt : les ajoutés, puis ce qui a été passé ou a échoué, avec quelques noms.
export function addedLine(r: ArtifactsReport, lang: VibeLang): string {
  const fr = lang === 'fr';
  const n = r.copied.length;
  const out = [fr ? `${n} ajouté${n > 1 ? 's' : ''}.` : `${n} added.`];
  if (r.links.length)
    out.push(fr ? `Lien${r.links.length > 1 ? 's' : ''} non suivi${r.links.length > 1 ? 's' : ''} : ${names(r.links)}.`
      : `Link${r.links.length > 1 ? 's' : ''} not followed: ${names(r.links)}.`);
  if (r.hidden.length)
    out.push(fr ? `Dossier${r.hidden.length > 1 ? 's' : ''} caché${r.hidden.length > 1 ? 's' : ''} passé${r.hidden.length > 1 ? 's' : ''} : ${names(r.hidden)}.`
      : `Hidden folder${r.hidden.length > 1 ? 's' : ''} skipped: ${names(r.hidden)}.`);
  if (r.noPath)
    out.push(fr ? `${r.noPath} fichier${r.noPath > 1 ? 's' : ''} sans chemin sur le disque : déposez-${r.noPath > 1 ? 'les' : 'le'} depuis le gestionnaire de fichiers.`
      : `${r.noPath} file${r.noPath > 1 ? 's' : ''} without a path on disk: drop ${r.noPath > 1 ? 'them' : 'it'} from the file manager.`);
  if (r.failed.length)
    out.push(fr ? `${r.failed.length} échec${r.failed.length > 1 ? 's' : ''} : ${names(r.failed.map((f) => f.path))}. Première erreur : ${r.failed[0].error}`
      : `${r.failed.length} failed: ${names(r.failed.map((f) => f.path))}. First error: ${r.failed[0].error}`);
  return out.join(' ');
}

// Des artefacts n'ont pas pu partir : ils restent sur le disque.
export function failedLine(failed: number, lang: VibeLang): string {
  return lang === 'fr'
    ? `${failed} artefact${failed > 1 ? 's' : ''} resté${failed > 1 ? 's' : ''} sur le disque.`
    : `${failed} artifact${failed > 1 ? 's' : ''} left on disk.`;
}
