import { describe, expect, it } from 'vitest';
import { canAssign, unassignable, vibeRole, type PrPeople } from 'core/vibecoder';

const people = (p: Partial<PrPeople> = {}): PrPeople => ({ author: 'bob', assignees: [], ...p });
const role = (o: { open?: boolean; people?: PrPeople | null; login?: string | null; was?: 'create' | 'review' }) =>
  vibeRole({ open: true, people: people(), login: 'kb', was: 'create', ...o });

describe('vibeRole', () => {
  it('sans PR ouverte : créateur, quoi que dise le reste', () => {
    expect(role({ open: false, was: 'review' })).toBe('create');
  });
  it('personnes ou identifiant inconnus : le rôle d’avant', () => {
    expect(role({ people: null, was: 'review' })).toBe('review');
    expect(role({ login: null, was: 'review' })).toBe('review');
  });
  it('auteur ou assigné : créateur (casse ignorée)', () => {
    expect(role({ people: people({ author: 'KB' }), was: 'review' })).toBe('create');
    expect(role({ people: people({ assignees: ['Kb'] }), was: 'review' })).toBe('create');
  });
  it('ni auteur ni assigné : relecteur', () => {
    expect(role({})).toBe('review');
  });
});

describe('canAssign / unassignable', () => {
  it('s’assigner : ni auteur ni assigné', () => {
    expect(canAssign(people(), 'kb')).toBe(true);
    expect(canAssign(people({ author: 'kb' }), 'kb')).toBe(false);
    expect(canAssign(people({ assignees: ['kb'] }), 'kb')).toBe(false);
    expect(canAssign(null, 'kb')).toBe(false);
    expect(canAssign(people(), null)).toBe(false);
  });
  it('se retirer : assigné, pas l’auteur', () => {
    expect(unassignable(people({ assignees: ['kb'] }), 'kb')).toBe(true);
    expect(unassignable(people({ author: 'kb', assignees: ['kb'] }), 'kb')).toBe(false);
    expect(unassignable(people(), 'kb')).toBe(false);
    expect(unassignable(null, 'kb')).toBe(false);
  });
});
