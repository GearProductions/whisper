/** artifacts — les artefacts de l'agent (vibecoder-out/<agent>/artifacts/) :
 *  le nom du dossier et du schéma qui les sert, le genre et le type MIME d'un
 *  fichier d'après son extension, la liste du relevé (ids a<i> dans l'ordre
 *  des noms, url, truncated), et l'artefact d'un id du dernier relevé (la page
 *  ne donne qu'un id, jamais un chemin : I-37).
 *  Ne connaît pas : Electron, le disque (fichiers passés), git, les libellés.
 *  Utilisé par : app/controllers (artifacts, vibecoder, module-code). */
import path from 'node:path';
import type { VibeArtifact, VibeView } from 'shared/bridge';

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
