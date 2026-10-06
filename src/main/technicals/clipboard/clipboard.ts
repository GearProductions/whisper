/** clipboard — le presse-papiers du système : le photographier (texte, HTML,
 *  RTF, image) pour le rendre tel quel, y écrire un texte.
 *  Ne connaît pas : le collage, la dictée. Utilisé par : technicals/selection,
 *  app (collage, Copier). */
import { clipboard, type NativeImage } from 'electron';

export type ClipboardSnapshot = { text?: string; html?: string; rtf?: string; image?: NativeImage };

// Ce que l'utilisateur avait copié, pour le lui rendre après un collage ou un
// Ctrl+C simulé.
export function snapshot(): ClipboardSnapshot {
  const snap: ClipboardSnapshot = {};
  try {
    const formats = clipboard.availableFormats();
    if (formats.some((f) => f.startsWith('text/plain'))) snap.text = clipboard.readText();
    if (formats.includes('text/html')) snap.html = clipboard.readHTML();
    if (formats.includes('text/rtf')) snap.rtf = clipboard.readRTF();
    if (formats.some((f) => f.startsWith('image/'))) {
      const img = clipboard.readImage();
      if (!img.isEmpty()) snap.image = img;
    }
  } catch { /* presse-papiers occupé : on ne restaurera rien */ }
  return snap;
}

export function restore(snap: ClipboardSnapshot) {
  try {
    if (Object.keys(snap).length) clipboard.write(snap); else clipboard.clear();
  } catch { /* tant pis */ }
}

export const writeText = (text: string) => clipboard.writeText(text);

// `type` : 'selection' pour la sélection primaire (X11).
export function readText(type?: 'selection' | 'clipboard') {
  try { return clipboard.readText(type); } catch { return ''; }
}

export function clear() {
  try { clipboard.clear(); } catch { /* occupé */ }
}
