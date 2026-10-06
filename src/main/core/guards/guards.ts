/** guards — ce que les pages peuvent obtenir du système : le micro, et
 *  seulement pour nos pages (I-9) ; l'ouverture d'un lien, seulement en
 *  http(s) ; un fichier joint montré, jamais ouvert, et seulement un chemin
 *  absolu existant (I-21).
 *  Ne connaît pas : Electron (le principal applique ces réponses).
 *  Utilisé par : app. */
import path from 'node:path';

const isOwn = (url: unknown) => typeof url === 'string' && url.startsWith('file://');

// Demande de permission d'une page : le micro, en audio seul, pour nos pages.
export function allowPermission(permission: string, requestingUrl: unknown, mediaTypes: unknown[]) {
  const types = Array.isArray(mediaTypes) ? mediaTypes : [];
  return permission === 'media' && isOwn(requestingUrl) && types.length > 0 && types.every((t) => t === 'audio');
}

// Vérification de permission (sans demande) : la même règle.
export const allowPermissionCheck = (permission: string, origin: unknown, mediaType: unknown) => (
  permission === 'media' && isOwn(origin) && mediaType === 'audio');

// L'adresse à ouvrir dans le navigateur, ou null : une adresse web et rien d'autre.
export function webUrl(url: unknown): string | null {
  if (typeof url !== 'string') return null;
  try {
    const u = new URL(url);
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : null;
  } catch { return null; }
}

// Un fichier joint à montrer dans le gestionnaire de fichiers.
export const showableFile = (file: unknown, exists: (p: string) => boolean): file is string => (
  typeof file === 'string' && path.isAbsolute(file) && exists(file));
