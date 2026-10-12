import { describe, expect, it, vi } from 'vitest';
import { findEditor } from 'technicals/editor';

// `which` ne trouve que les programmes de `found`.
const found = new Set<string>();
vi.mock('technicals/paths', () => ({ which: (name: string) => (found.has(name) ? `/usr/bin/${name}` : null) }));
const only = (...names: string[]) => { found.clear(); names.forEach((n) => found.add(n)); };

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
  it('commande réglée introuvable : null', () => {
    only('zed');
    expect(findEditor('/nulle/part/zed')).toBeNull();
    expect(findEditor('code')).toBeNull();
  });
});
