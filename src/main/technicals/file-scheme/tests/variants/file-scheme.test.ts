// Variants du schéma qui sert des fichiers (note 0.13.0, Forme, technicals/file-scheme) :
// GET seulement, null → 404, le fichier avec son type et nosniff, Range (un
// intervalle, la fin, hors du fichier), la CSP du bac à sable, un lien ou un
// dossier jamais servis.
// Sur du réel : un dossier temporaire, de vraies Request ; faux : protocol.handle (garde le gestionnaire).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';

const handlers = vi.hoisted(() => new Map<string, (req: Request) => Promise<Response>>());
const privileged = vi.hoisted(() => [] as unknown[]);
vi.mock('electron', () => ({
  protocol: {
    registerSchemesAsPrivileged: (s: unknown[]) => { privileged.push(...s); },
    handle: (name: string, fn: (req: Request) => Promise<Response>) => { handlers.set(name, fn); },
  },
}));
import { FRAME_CSP, registerScheme, serveFiles } from 'technicals/file-scheme';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-file-scheme-v-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
const file = path.join(tmp, 'f.txt');
fs.writeFileSync(file, '0123456789');
const link = path.join(tmp, 'lien.txt');
if (process.platform !== 'win32') fs.symlinkSync(file, link);

// Ce que resolve donne pour chaque chemin d'adresse.
const table: Record<string, { file: string; type: string; sandbox: boolean }> = {
  '/f': { file, type: 'text/plain', sandbox: false },
  '/page': { file, type: 'text/html', sandbox: true },
  '/lien': { file: link, type: 'text/plain', sandbox: false },
  '/dossier': { file: tmp, type: 'text/plain', sandbox: false },
  '/absent': { file: path.join(tmp, 'absent'), type: 'text/plain', sandbox: false },
};
serveFiles('essai', (url) => table[url.pathname] ?? null);
const get = (p: string, init?: RequestInit) => handlers.get('essai')!(new Request(`essai://x${p}`, init));

describe('registerScheme', () => {
  it('standard, secure, stream ; rien d’autre', () => {
    registerScheme('essai');
    expect(privileged).toEqual([{ scheme: 'essai', privileges: { standard: true, secure: true, stream: true } }]);
  });
});

describe('serveFiles', () => {
  it('le fichier entier, son type, nosniff, pas de CSP hors bac à sable', async () => {
    const res = await get('/f');
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('0123456789');
    expect(res.headers.get('content-type')).toBe('text/plain');
    expect(res.headers.get('content-length')).toBe('10');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('content-security-policy')).toBeNull();
  });
  it('sandbox : FRAME_CSP', async () => {
    expect((await get('/page')).headers.get('content-security-policy')).toBe(FRAME_CSP);
  });
  it('resolve donne null : 404, nosniff', async () => {
    const res = await get('/rien');
    expect(res.status).toBe(404);
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
  it('absent ou dossier : 404', async () => {
    expect((await get('/absent')).status).toBe(404);
    expect((await get('/dossier')).status).toBe(404);
  });
  it.skipIf(process.platform === 'win32')('un lien n’est pas suivi : 404', async () => {
    const res = await get('/lien');
    expect(res.status).toBe(404);
    expect(await res.text()).toBe('');
  });
  it('une autre méthode que GET : 405', async () => {
    expect((await get('/f', { method: 'POST', body: 'x' })).status).toBe(405);
    expect((await get('/f', { method: 'HEAD' })).status).toBe(405);
  });
  it('Range : un intervalle, la suite, la fin', async () => {
    const part = await get('/f', { headers: { Range: 'bytes=2-4' } });
    expect(part.status).toBe(206);
    expect(part.headers.get('content-range')).toBe('bytes 2-4/10');
    expect(await part.text()).toBe('234');
    expect(await (await get('/f', { headers: { Range: 'bytes=7-' } })).text()).toBe('789');
    expect(await (await get('/f', { headers: { Range: 'bytes=-3' } })).text()).toBe('789');
    expect(await (await get('/f', { headers: { Range: 'bytes=8-99' } })).text()).toBe('89');
  });
  it('Range hors du fichier : 416 ; plusieurs intervalles : le fichier entier', async () => {
    const res = await get('/f', { headers: { Range: 'bytes=10-' } });
    expect(res.status).toBe(416);
    expect(res.headers.get('content-range')).toBe('bytes */10');
    const all = await get('/f', { headers: { Range: 'bytes=0-1,4-5' } });
    expect(all.status).toBe(200);
    expect(await all.text()).toBe('0123456789');
  });
});
