/** pieces — les pièces jointes du champ de saisie : images (envoyées à
 *  Claude), fichiers (par leur chemin), texte sélectionné ; leur libellé, et
 *  le brouillon envoyé au principal.
 *  Ne connaît pas : le DOM, le pont. Utilisé par : PanelApp, Composer, Thread. */
import type { Attached, OutgoingDraft } from '../bridge';

export type Piece =
  | { kind: 'image'; name: string; type: string; data: ArrayBuffer; url: string }
  | { kind: 'file'; name: string; path: string }
  | { kind: 'selection'; text: string; cut: boolean };

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'];

// Pictogramme d'un fichier joint, d'après son extension.
const KINDS: [RegExp, string][] = [
  [/\.(png|jpe?g|gif|webp|svg|bmp|tiff?|heic|avif)$/i, '🖼'], [/\.(mp4|mkv|mov|webm|avi|m4v)$/i, '🎞'],
  [/\.(mp3|wav|flac|ogg|m4a|opus)$/i, '🎵'], [/\.(pdf|docx?|odt|txt|md|rtf)$/i, '📄'],
  [/\.(zip|tar|gz|xz|7z|rar)$/i, '🗜'], [/(^|\/)[^./]+$/, '📁'],
];
export const kindOf = (file: string) => (KINDS.find(([re]) => re.test(file)) || [null, '📎'])[1];

export const baseName = (file: string) => file.split('/').filter(Boolean).pop() || file;

export function pieceLabel(p: Piece) {
  if (p.kind === 'selection') return `❝ Sélection (${p.text.length.toLocaleString('fr-FR')} car.${p.cut ? ', coupée' : ''})`;
  return p.kind === 'file' ? `${kindOf(p.path)} ${p.name}` : p.name;
}

export const pieceTitle = (p: Piece) => (p.kind === 'selection' ? p.text.slice(0, 600) : p.kind === 'file' ? p.path : p.name);

// Un fichier n'est joint qu'une fois.
export const withFile = (pieces: Piece[], path: string, name = path.split('/').pop() || path): Piece[] => (
  pieces.some((p) => p.kind === 'file' && p.path === path) ? pieces : [...pieces, { kind: 'file', name, path }]);

// Le choix du trombone : la sélection remplace la précédente, les fichiers s'ajoutent.
export function withAttached(pieces: Piece[], what: Attached): Piece[] {
  let out = what.selection ? [...pieces.filter((p) => p.kind !== 'selection'), { kind: 'selection' as const, ...what.selection }] : pieces;
  for (const f of what.files || []) out = withFile(out, f);
  return out;
}

export function toDraft(text: string, pieces: Piece[]): OutgoingDraft {
  return {
    text,
    images: pieces.flatMap((p) => (p.kind === 'image' ? [{ name: p.name, type: p.type, data: p.data }] : [])),
    files: pieces.flatMap((p) => (p.kind === 'file' ? [p.path] : [])),
    selection: pieces.find((p): p is Extract<Piece, { kind: 'selection' }> => p.kind === 'selection')?.text || '',
  };
}

export function revoke(pieces: Piece[]) {
  for (const p of pieces) if (p.kind === 'image') URL.revokeObjectURL(p.url);
}
