import { describe, expect, it } from 'vitest';
import { keptSelection, select, type Selection } from 'helpers';

const order = ['a', 'b', 'c', 'd', 'e'];
const none: Selection = { keys: [], anchor: null };
const plain = { ctrl: false, shift: false };

describe('select', () => {
  it('un clic sélectionne seul et pose l’ancre', () => {
    const s = select({ keys: ['a', 'b'], anchor: 'a' }, order, 'c', plain);
    expect(s).toEqual({ keys: ['c'], anchor: 'c' });
  });
  it('Ctrl bascule la clé', () => {
    const s1 = select({ keys: ['a'], anchor: 'a' }, order, 'c', { ctrl: true, shift: false });
    expect(s1).toEqual({ keys: ['a', 'c'], anchor: 'c' });
    expect(select(s1, order, 'a', { ctrl: true, shift: false }).keys).toEqual(['c']);
  });
  it('Maj prend de l’ancre à la clé, dans les deux sens, ancre conservée', () => {
    const s = { keys: ['b'], anchor: 'b' };
    expect(select(s, order, 'd', { ctrl: false, shift: true })).toEqual({ keys: ['b', 'c', 'd'], anchor: 'b' });
    expect(select(s, order, 'a', { ctrl: false, shift: true })).toEqual({ keys: ['a', 'b'], anchor: 'b' });
  });
  it('Maj sans ancre valide sélectionne la clé seule', () => {
    expect(select(none, order, 'c', { ctrl: false, shift: true })).toEqual({ keys: ['c'], anchor: 'c' });
    expect(select({ keys: ['x'], anchor: 'x' }, order, 'c', { ctrl: false, shift: true }).keys).toEqual(['c']);
  });
});

describe('keptSelection', () => {
  it('même référence si rien ne change', () => {
    const s = { keys: ['a', 'b'], anchor: 'a' };
    expect(keptSelection(s, order)).toBe(s);
    expect(keptSelection(none, order)).toBe(none);
  });
  it('retire les clés disparues, et l’ancre si elle a disparu', () => {
    expect(keptSelection({ keys: ['a', 'x', 'c'], anchor: 'x' }, order)).toEqual({ keys: ['a', 'c'], anchor: null });
  });
});
