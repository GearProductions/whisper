/** file-scheme — un schéma de l'appli qui sert des fichiers du disque à une
 *  page : registerScheme (avant ready : standard, secure, stream ; rien
 *  d'autre de privilégié), serveFiles (protocol.handle : le fichier que
 *  `resolve` désigne, ouvert sans suivre de lien, en flux, Range compris
 *  (un seul intervalle), avec son type et X-Content-Type-Options: nosniff sur
 *  toute réponse ; null, absent, lien ou pas un fichier → 404 ; sandbox →
 *  FRAME_CSP, sans script ni réseau ; toute autre méthode que GET → 405).
 *  Ne connaît pas : VibeCoder, les agents, la configuration.
 *  Utilisé par : app/lifecycle. */
import { constants } from 'node:fs';
import { open } from 'node:fs/promises';
import { Readable } from 'node:stream';
import { protocol } from 'electron';

export type Served = { file: string; type: string; sandbox: boolean };

// Une page servie en bac à sable : ni script, ni réseau ; le style en ligne et data: seulement.
export const FRAME_CSP = "sandbox; default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:";

const NOSNIFF = { 'X-Content-Type-Options': 'nosniff' };
// ponytail: Windows n'a pas O_NOFOLLOW ; le lien y est suivi (resolve doit l'avoir écarté).
const NOFOLLOW = constants.O_NOFOLLOW ?? 0;

const refuse = (status: number, extra: Record<string, string> = {}) =>
  new Response(null, { status, headers: { ...NOSNIFF, ...extra } });

export function registerScheme(name: string): void {
  protocol.registerSchemesAsPrivileged([{ scheme: name, privileges: { standard: true, secure: true, stream: true } }]);
}

// « bytes=a-b », « bytes=a-», « bytes=-n » → [début, fin] inclus ; autre forme (plusieurs
// intervalles…) → null : tout le fichier ; hors du fichier → 'invalid' (416).
function parseRange(header: string | null, size: number): [number, number] | null | 'invalid' {
  const m = header && /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m || (!m[1] && !m[2])) return null;
  const [start, end] = m[1]
    ? [Number(m[1]), m[2] ? Math.min(Number(m[2]), size - 1) : size - 1]
    : [Math.max(size - Number(m[2]), 0), size - 1];
  return start > end || start >= size ? 'invalid' : [start, end];
}

export function serveFiles(name: string, resolve: (url: URL) => Served | null): void {
  protocol.handle(name, async (req) => {
    if (req.method !== 'GET') return refuse(405, { Allow: 'GET' });
    const served = resolve(new URL(req.url));
    if (!served) return refuse(404);
    const fh = await open(served.file, constants.O_RDONLY | NOFOLLOW).catch(() => null);
    if (!fh) return refuse(404);
    const stat = await fh.stat();
    if (!stat.isFile()) { await fh.close(); return refuse(404); }
    const range = parseRange(req.headers.get('range'), stat.size);
    if (range === 'invalid') { await fh.close(); return refuse(416, { 'Content-Range': `bytes */${stat.size}` }); }
    const [start, end] = range ?? [0, stat.size - 1];
    const headers: Record<string, string> = {
      ...NOSNIFF,
      'Content-Type': served.type,
      'Content-Length': String(Math.max(end - start + 1, 0)),
      'Accept-Ranges': 'bytes',
    };
    if (range) headers['Content-Range'] = `bytes ${start}-${end}/${stat.size}`;
    if (served.sandbox) headers['Content-Security-Policy'] = FRAME_CSP;
    // Le flux ferme le fichier à sa fin (autoClose).
    const body = stat.size ? Readable.toWeb(fh.createReadStream({ start, end })) as ReadableStream : (await fh.close(), null);
    return new Response(body, { status: range ? 206 : 200, headers });
  });
}
