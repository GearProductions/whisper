// Variants de dir-size : la somme d'un dossier, et sa surveillance (vraies
// horloges, périodes de quelques ms ; un readdir ralenti à la demande pour la
// mesure plus longue que la période).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dirSize, watchDirSize } from 'technicals/dir-size';

// Le readdir de la racine surveillée : retardé de `slow.ms`, ses appels en vol comptés.
const slow = vi.hoisted(() => ({ root: '', ms: 0, calls: 0, inFlight: 0, maxInFlight: 0 }));
vi.mock('node:fs/promises', async (orig) => {
  const real = await orig<typeof import('node:fs/promises')>();
  const readdir = (async (p: string, ...rest: unknown[]) => {
    if (p !== slow.root || !slow.ms) return (real.readdir as any)(p, ...rest);
    slow.calls++;
    slow.maxInFlight = Math.max(slow.maxInFlight, ++slow.inFlight);
    try {
      await new Promise((r) => setTimeout(r, slow.ms));
      return await (real.readdir as any)(p, ...rest);
    } finally {
      slow.inFlight--;
    }
  }) as typeof real.readdir;
  return { ...real, default: { ...real, readdir }, readdir };
});

let root: string;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const write = (rel: string, n: number) => {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), Buffer.alloc(n));
};

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-dir-size-'));
  Object.assign(slow, { root, ms: 0, calls: 0, inFlight: 0, maxInFlight: 0 });
});
afterEach(() => fs.rmSync(root, { recursive: true, force: true }));

describe('dirSize', () => {
  it('somme deux fichiers dont un dans un sous-dossier', async () => {
    write('a.bin', 10);
    write('sub/b.bin', 32);
    expect(await dirSize(root)).toBe(42);
  });

  it('un dossier absent : 0, sans erreur', async () => {
    expect(await dirSize(path.join(root, 'absent'))).toBe(0);
  });

  it('un lien vers un gros fichier hors du dossier : pas compté', async () => {
    const outside = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-dir-size-out-'));
    try {
      fs.writeFileSync(path.join(outside, 'gros.bin'), Buffer.alloc(5000));
      write('a.bin', 7);
      fs.symlinkSync(path.join(outside, 'gros.bin'), path.join(root, 'lien'));
      expect(await dirSize(root)).toBe(7);
    } finally {
      fs.rmSync(outside, { recursive: true, force: true });
    }
  });

  it('un lien vers un dossier n’est pas suivi (ni boucle, ni double compte)', async () => {
    write('sub/a.bin', 5);
    fs.symlinkSync(root, path.join(root, 'sub', 'boucle'));
    fs.symlinkSync(path.join(root, 'sub'), path.join(root, 'copie'));
    expect(await dirSize(root)).toBe(5);
  });

  it('des sous-dossiers imbriqués', async () => {
    write('a/b/c/d.bin', 3);
    write('a/b/e.bin', 4);
    write('a/f.bin', 5);
    expect(await dirSize(root)).toBe(12);
  });

  it('un fichier disparu en route : 0 pour lui, jamais d’erreur', async () => {
    for (let i = 0; i < 200; i++) write(`d${i % 10}/f${i}.bin`, 1);
    const measure = dirSize(root);
    for (let i = 0; i < 200; i += 2) fs.rmSync(path.join(root, `d${i % 10}/f${i}.bin`), { force: true });
    fs.rmSync(path.join(root, 'd3'), { recursive: true, force: true });
    const n = await measure;
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n).toBeLessThanOrEqual(200);
  });
});

describe('watchDirSize', () => {
  it('un fichier qui grossit au-delà de max : onOver une fois, avec la taille mesurée', async () => {
    const onOver = vi.fn();
    write('a.bin', 10);
    const stop = watchDirSize(root, { max: 100, everyMs: 10 }, onOver);
    await sleep(60);
    expect(onOver).not.toHaveBeenCalled();
    write('a.bin', 500);
    await sleep(100);
    expect(onOver).toHaveBeenCalledTimes(1);
    expect(onOver).toHaveBeenCalledWith(500);
    await sleep(60); // la surveillance s'est arrêtée
    expect(onOver).toHaveBeenCalledTimes(1);
    stop();
    expect(onOver).toHaveBeenCalledTimes(1);
  });

  it('sous max : jamais', async () => {
    const onOver = vi.fn();
    write('a.bin', 100); // égal à max : pas au-delà
    const stop = watchDirSize(root, { max: 100, everyMs: 10 }, onOver);
    await sleep(100);
    stop();
    expect(onOver).not.toHaveBeenCalled();
  });

  it('stop() avant : jamais, même si le dossier dépasse', async () => {
    const onOver = vi.fn();
    write('a.bin', 500);
    const stop = watchDirSize(root, { max: 100, everyMs: 10 }, onOver);
    stop();
    await sleep(80);
    expect(onOver).not.toHaveBeenCalled();
  });

  it('stop() pendant une mesure en cours : pas d’onOver après', async () => {
    const onOver = vi.fn();
    write('a.bin', 500);
    slow.ms = 50;
    const stop = watchDirSize(root, { max: 100, everyMs: 10 }, onOver);
    await vi.waitFor(() => expect(slow.inFlight).toBe(1));
    stop();
    await sleep(120);
    expect(onOver).not.toHaveBeenCalled();
    expect(slow.calls).toBe(1); // et aucune mesure de plus
  });

  it('une mesure plus longue que la période : jamais deux à la fois', async () => {
    write('a.bin', 1);
    slow.ms = 40;
    const stop = watchDirSize(root, { max: 100, everyMs: 5 }, vi.fn());
    await sleep(250);
    stop();
    expect(slow.calls).toBeGreaterThan(1);
    expect(slow.maxInFlight).toBe(1);
  });

  it('un dossier absent : jamais d’erreur ni d’onOver', async () => {
    const onOver = vi.fn();
    const stop = watchDirSize(path.join(root, 'absent'), { max: 0, everyMs: 10 }, onOver);
    await sleep(60);
    stop();
    expect(onOver).not.toHaveBeenCalled();
  });
});
