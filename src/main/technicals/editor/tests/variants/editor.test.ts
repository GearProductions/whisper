import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it, vi } from 'vitest';
import { findEditor } from 'technicals/editor';

// `which` ne trouve que les programmes de `found`.
const found = new Set<string>();
vi.mock('technicals/paths', () => ({ which: (name: string) => (found.has(name) ? `/usr/bin/${name}` : null) }));
const only = (...names: string[]) => { found.clear(); names.forEach((n) => found.add(n)); };
// spawn relève ses arguments, ne lance rien.
const spawned: unknown[][] = [];
// `real` : les cas d'échec lancent pour de bon (I-29).
let real = false;
vi.mock('node:child_process', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:child_process')>();
  return { ...actual, spawn: (...a: unknown[]) => { if (real) return (actual.spawn as (...b: unknown[]) => unknown)(...a); spawned.push(a); return { on() { return this; }, unref() {} }; } };
});
const argsOf = (command: string) => { findEditor(command)!.open('/projet'); return spawned.at(-1)?.[1]; };

describe('findEditor', () => {
  it('rien de réglé : le premier d\'EDITORS qui existe', () => {
    only('code', 'codium');
    expect(findEditor('')?.name).toBe('code');
    expect(findEditor(undefined)?.name).toBe('code');
  });
  it('rien de réglé, aucun trouvé : null', () => {
    only();
    expect(findEditor('  ')).toBeNull();
  });
  it('commande réglée : son texte entier comme nom', () => {
    only('flatpak');
    expect(findEditor(' flatpak run com.visualstudio.code ')?.name).toBe('flatpak run com.visualstudio.code');
  });
  it('rien de réglé : une nouvelle fenêtre (-n)', () => {
    only('zed');
    expect(argsOf('')).toEqual(['-n', '/projet']);
  });
  it('commande réglée : ses arguments tels quels, sans -n ajouté', () => {
    only('zed');
    expect(argsOf('zed')).toEqual(['/projet']);
    expect(argsOf('zed --add')).toEqual(['--add', '/projet']);
  });
  it('un fichier : là où l\'éditeur le range, sans -n ; commande réglée : ses arguments tels quels', () => {
    only('zed');
    findEditor('')!.openFile('/projet/a.ts');
    expect(spawned.at(-1)?.[1]).toEqual(['/projet/a.ts']);
    findEditor('zed --add')!.openFile('/projet/a.ts');
    expect(spawned.at(-1)?.[1]).toEqual(['--add', '/projet/a.ts']);
  });
  it('à une ligne : zed fichier:ligne ; code, cursor, codium -g fichier:ligne', () => {
    only('zed', 'code', 'cursor', 'codium', 'flatpak');
    const at = (command: string) => { findEditor(command)!.openFile('/projet/a.ts', 12); return spawned.at(-1)?.[1]; };
    expect([at(''), at('code'), at('cursor'), at('codium'), at('flatpak run com.visualstudio.code')]).toEqual([
      ['/projet/a.ts:12'], ['-g', '/projet/a.ts:12'], ['-g', '/projet/a.ts:12'], ['-g', '/projet/a.ts:12'],
      ['run', 'com.visualstudio.code', '-g', '/projet/a.ts:12'],
    ]);
  });
  it('à une ligne, un éditeur inconnu ou une ligne invalide : le fichier seul', () => {
    only('gedit', 'zed');
    findEditor('gedit')!.openFile('/projet/a.ts', 12);
    expect(spawned.at(-1)?.[1]).toEqual(['/projet/a.ts']);
    findEditor('zed')!.openFile('/projet/a.ts', 0);
    expect(spawned.at(-1)?.[1]).toEqual(['/projet/a.ts']);
  });
  it('commande réglée introuvable : null', () => {
    only('zed');
    expect(findEditor('/nulle/part/zed')).toBeNull();
    expect(findEditor('code')).toBeNull();
  });
});

// Un échec ne fait pas tomber l'appli (I-29) : de vrais fichiers, lancés pour de bon.
describe('un échec ne fait pas tomber l\'appli (I-29)', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'editeur-'));
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

  it('programme introuvable : pas d\'éditeur', () => {
    expect(findEditor(path.join(tmp, 'absent'))).toBeNull();
  });

  it.skipIf(process.platform === 'win32')('fichier non exécutable : rien ne tombe', async () => {
    real = true;
    const file = path.join(tmp, 'pas-executable');
    fs.writeFileSync(file, 'rien', { mode: 0o644 });
    expect(() => findEditor(file)!.open(tmp)).not.toThrow();
    await new Promise((r) => setTimeout(r, 200)); // l'erreur de spawn arrive après
    real = false;
  });

  it.skipIf(process.platform === 'win32')('éditeur qui échoue : rien ne tombe', async () => {
    real = true;
    const file = path.join(tmp, 'echoue');
    fs.writeFileSync(file, '#!/bin/sh\nexit 3\n', { mode: 0o755 });
    expect(() => findEditor(file)!.open(tmp)).not.toThrow();
    await new Promise((r) => setTimeout(r, 200));
    real = false;
  });
});
