import { describe, expect, it, vi } from 'vitest';
import { findEditor } from 'technicals/editor';

// `which` ne trouve que les programmes de `found`.
const found = new Set<string>();
vi.mock('technicals/paths', () => ({ which: (name: string) => (found.has(name) ? `/usr/bin/${name}` : null) }));
const only = (...names: string[]) => { found.clear(); names.forEach((n) => found.add(n)); };
// spawn relève ses arguments, ne lance rien.
const spawned: unknown[][] = [];
vi.mock('node:child_process', () => ({ spawn: (...a: unknown[]) => { spawned.push(a); return { on() { return this; }, unref() {} }; } }));
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
  it('commande réglée introuvable : null', () => {
    only('zed');
    expect(findEditor('/nulle/part/zed')).toBeNull();
    expect(findEditor('code')).toBeNull();
  });
});
