import { describe, expect, it } from 'vitest';
import { lastShown, recent, shortcut } from 'core/switcher';

const key = (k: string, ctrl = true, shift = false) => shortcut({ key: k, ctrl, shift });

describe('shortcut', () => {
  it('Ctrl+K, Ctrl+Tab, Ctrl+N, Ctrl+Maj+B (b ou B)', () => {
    expect([key('k'), key('K'), key('Tab'), key('n'), key('b', true, true), key('B', true, true)])
      .toEqual(['palette', 'palette', 'last', 'new-agent', 'branches', 'branches']);
  });
  it('sans Ctrl, ou une autre combinaison : rien', () => {
    expect([key('k', false), key('b'), key('k', true, true), key('Tab', true, true), key('x')]).toEqual([null, null, null, null, null]);
  });
});

describe('recent / lastShown', () => {
  it('l\'affiché passe en tête, sans doublon, au plus 10', () => {
    expect(recent(['a', 'b', 'c'], 'c')).toEqual(['c', 'a', 'b']);
    const long = Array.from({ length: 12 }, (_, i) => `x${i}`);
    expect(recent(long, 'new')).toHaveLength(10);
  });
  it('Ctrl+Tab : le premier autre que l\'affiché, ou null', () => {
    expect(lastShown(['c', 'a', 'b'], 'c')).toBe('a');
    expect(lastShown(['a'], 'a')).toBeNull();
    expect(lastShown([], null)).toBeNull();
  });
});
