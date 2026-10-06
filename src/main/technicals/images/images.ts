/** images — les images d'une conversation : préparer une image jointe pour
 *  Claude (réduite si besoin, dans un format accepté), faire l'aperçu d'une
 *  image du fil.
 *  Ne connaît pas : les conversations. Utilisé par : app/controllers/conversation. */
import { createHash } from 'node:crypto';
import { nativeImage } from 'electron';

export const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']; // acceptés par Claude
const IMAGE_SIDE = 1568;               // au-delà, Claude la réduirait lui-même : autant envoyer moins
const IMAGE_BYTES = 3.75 * 1024 * 1024; // ~5 Mo une fois en base64 : la limite par image
const IMAGE_MAX_INPUT = 50 * 1024 * 1024;

export type ImageInput = { name?: string; type?: string; data?: unknown };
export type PreparedImage = { mediaType: string; data: string };

// Image collée ou déposée → { mediaType, data (base64) } pour Claude, ou null.
// Trop grande (côté ou poids) ou d'un format refusé : réduite et réencodée.
export function prepareImage(img: ImageInput | null | undefined): PreparedImage | null {
  const raw = img && img.data;
  const buf = Buffer.isBuffer(raw) ? raw : raw instanceof ArrayBuffer ? Buffer.from(raw)
    : ArrayBuffer.isView(raw) ? Buffer.from(raw.buffer, raw.byteOffset, raw.byteLength) : null;
  if (!buf || !buf.length || buf.length > IMAGE_MAX_INPUT) return null;
  const type = String(img!.type || '');
  const keep = IMAGE_TYPES.includes(type) && buf.length <= IMAGE_BYTES;
  const image = nativeImage.createFromBuffer(buf);
  // Illisible ici : GIF et WebP (qu'Electron ne décode pas) passent tels quels ; un PNG ou un JPEG est abîmé.
  if (image.isEmpty()) return keep && ['image/gif', 'image/webp'].includes(type) ? { mediaType: type, data: buf.toString('base64') } : null;
  const { width, height } = image.getSize();
  const scale = Math.min(1, IMAGE_SIDE / Math.max(width, height));
  if (scale === 1 && keep) return { mediaType: type, data: buf.toString('base64') };
  const out = scale < 1 ? image.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'best' }) : image;
  const png = out.toPNG(); // net pour une capture d'écran ; en JPEG si trop lourd
  return png.length <= IMAGE_BYTES ? { mediaType: 'image/png', data: png.toString('base64') }
    : { mediaType: 'image/jpeg', data: out.toJPEG(85).toString('base64') };
}

// Aperçu d'une image d'un message (envoyée en base64 dans la transcription) :
// une data URL réduite à THUMB_SIDE, gardée en cache — le fil est renvoyé à
// chaque changement. null si illisible.
const THUMB_SIDE = 800;
const thumbs = new Map<string, string | null>();
export function thumbnail(src: { data?: unknown; media_type?: string } | null | undefined): string | null {
  if (!src || typeof src.data !== 'string') return null;
  const key = createHash('sha1').update(src.data).digest('hex');
  if (!thumbs.has(key)) {
    if (thumbs.size > 200) thumbs.clear();
    const buf = Buffer.from(src.data, 'base64');
    const image = nativeImage.createFromBuffer(buf);
    let url: string | null = null;
    if (!image.isEmpty()) {
      const { width, height } = image.getSize();
      const scale = Math.min(1, THUMB_SIDE / Math.max(width, height));
      const out = scale < 1 ? image.resize({ width: Math.round(width * scale), height: Math.round(height * scale), quality: 'good' }) : image;
      const png = out.toPNG(); // une capture d'écran : en PNG, net ; trop lourde, en JPEG
      url = png.length < 300 * 1024 ? `data:image/png;base64,${png.toString('base64')}`
        : `data:image/jpeg;base64,${out.toJPEG(85).toString('base64')}`;
    } else if (buf.length < 2 * 1024 * 1024 && /^image\/(gif|webp)$/.test(String(src.media_type))) {
      url = `data:${src.media_type};base64,${src.data}`; // GIF, WebP : tels quels, s'ils sont légers
    }
    thumbs.set(key, url);
  }
  return thumbs.get(key)!;
}
