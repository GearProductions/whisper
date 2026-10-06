/** attachments — le contexte joint à un message : images (envoyées à Claude,
 *  réduites si besoin), autres fichiers (par leur chemin : l'agent les lit
 *  lui-même), texte sélectionné. Le message composé, et l'inverse pour le
 *  panneau (le retrouver dans la transcription).
 *  Ne connaît pas : le disque ni le décodage des images (passés).
 *  Utilisé par : app/controllers/conversation. */
import path from 'node:path';

export const SELECTION_MAX = 100000;   // caractères ; au-delà, coupée
const FILES_MAX = 50;
const IMAGES_MAX = 20;
const IMAGE_INPUT_MAX = 50 * 1024 * 1024;

// Le texte écrit, suivi du contexte : la sélection (balisée, pour que l'agent
// la distingue de la demande), les chemins des fichiers joints.
const SELECTION_HEAD = 'Texte sélectionné, joint comme contexte :\n<selection>\n';
const SELECTION_END = '\n</selection>';
const FILES_HEAD = 'Fichiers joints (chemins sur cette machine) :\n';
export const composeMessage = (text: string, selected: string, files: string[]) => [
  text,
  selected && `${SELECTION_HEAD}${selected}${SELECTION_END}`,
  files.length && `${FILES_HEAD}${files.map((f) => `- ${f}`).join('\n')}`,
].filter(Boolean).join('\n\n');

// L'inverse, pour le panneau : { text, selection, files }. Un bloc n'est
// reconnu qu'à sa place (à la fin, après une ligne vide).
export function splitComposed(message: unknown) {
  let text = String(message || '');
  const at = (i: number) => i >= 0 && (i === 0 || text.slice(i - 2, i) === '\n\n');
  let files: string[] = [];
  const fi = text.lastIndexOf(FILES_HEAD);
  const lines = fi >= 0 ? text.slice(fi + FILES_HEAD.length).split('\n') : [];
  if (at(fi) && lines.every((l) => l.startsWith('- '))) {
    files = lines.map((l) => l.slice(2));
    text = text.slice(0, fi).trimEnd();
  }
  let selection = '';
  const si = text.indexOf(SELECTION_HEAD);
  if (at(si) && text.endsWith(SELECTION_END)) {
    selection = text.slice(si + SELECTION_HEAD.length, -SELECTION_END.length);
    text = text.slice(0, si).trimEnd();
  }
  return { text, selection, files };
}

export type DraftImage = { name?: string; type?: string; data?: unknown };
export type PreparedImage = { mediaType: string; data: string };
export type DraftTools = {
  prepareImage(img: DraftImage): PreparedImage | null;
  files: { size(p: string): number; read(p: string): Buffer };
};

// Un brouillon (le champ du panneau) → { message: { text, images } } ou
// { error }. Une image désignée par son chemin (trombone du panneau) part en
// image ; les autres fichiers, par leur chemin.
const IMAGE_FILE = /\.(png|jpe?g|gif|webp)$/i;
const IMAGE_MIME: Record<string, string> = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp' };
export function prepareDraft(draft: unknown, { prepareImage, files: disk }: DraftTools):
  { message: { text: string; images: PreparedImage[] }; error?: undefined } | { error: string } {
  const d = (draft && typeof draft === 'object' ? draft : {}) as { text?: unknown; images?: unknown; files?: unknown; selection?: unknown };
  const text = typeof d.text === 'string' ? d.text.trim() : '';
  const selection = typeof d.selection === 'string' ? d.selection.slice(0, SELECTION_MAX) : '';
  const paths = (Array.isArray(d.files) ? d.files : []).filter((f): f is string => typeof f === 'string' && path.isAbsolute(f));
  const list: DraftImage[] = Array.isArray(d.images) ? [...d.images] : [];
  const others: string[] = [];
  for (const f of paths) {
    if (!IMAGE_FILE.test(f)) { others.push(f); continue; }
    try {
      if (disk.size(f) > IMAGE_INPUT_MAX) return { error: `Image trop lourde : ${path.basename(f)}.` };
      list.push({ name: path.basename(f), type: IMAGE_MIME[path.extname(f).slice(1).toLowerCase()], data: disk.read(f) });
    } catch { return { error: `Image introuvable : ${path.basename(f)}.` }; }
  }
  if (others.length > FILES_MAX || list.length > IMAGES_MAX) {
    return { error: `Trop de pièces jointes (${IMAGES_MAX} images et ${FILES_MAX} fichiers au plus).` };
  }
  const ready: PreparedImage[] = [];
  for (const img of list) {
    const one = prepareImage(img);
    if (!one) return { error: `Image illisible ou trop lourde : ${String((img && img.name) || 'image')}.` };
    ready.push(one);
  }
  const message = composeMessage(text, selection, others);
  if (!message && !ready.length) return { error: 'Message vide.' };
  return { message: { text: message, images: ready } };
}
