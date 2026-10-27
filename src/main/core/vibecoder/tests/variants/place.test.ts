import { describe, expect, it } from 'vitest';
import { onPr, PLACE_ACTIONS, placeReason, placeShown, type PlaceState } from 'core/vibecoder';

const base: PlaceState = {
  head: null, branch: 'master', dirty: false, child: false, robot: false, prWorktree: false, request: null, recipe: false,
};
const shown = (s: Partial<PlaceState>) =>
  Object.entries(placeShown({ ...base, ...s })).filter(([, v]) => v).map(([k]) => k);

describe('onPr', () => {
  it('sur la tête de la PR, ou son robot', () => {
    expect(onPr({ ...base, head: 'feat/x', branch: 'feat/x' })).toBe(true);
    expect(onPr({ ...base, head: 'feat/x', robot: true, branch: 'pr-7' })).toBe(true);
    expect(onPr({ ...base, head: 'feat/x' })).toBe(false);
    expect(onPr(base)).toBe(false);
  });
});

describe('placeShown', () => {
  it('rien sans PR chargée ni demande', () => {
    expect(shown({})).toEqual([]);
    expect(shown({ dirty: true })).toEqual([]);
  });

  it('PR chargée, dossier propre hors de sa tête : changer de branche, décharger', () => {
    expect(shown({ head: 'feat/x' })).toEqual(['pr-here', 'unload-pr']);
  });

  it('avec des modifications : en plus un worktree et mettre de côté', () => {
    expect(shown({ head: 'feat/x', dirty: true })).toEqual(['pr-here', 'pr-worktree', 'unload-pr', 'stash']);
  });

  it('pas de worktree sur un enfant, ni quand la PR a déjà le sien', () => {
    expect(shown({ head: 'feat/x', dirty: true, child: true })).not.toContain('pr-worktree');
    expect(shown({ head: 'feat/x', dirty: true, prWorktree: true })).not.toContain('pr-worktree');
  });

  it('sur la tête : décharger seulement (et mettre de côté avec des modifications)', () => {
    expect(shown({ head: 'feat/x', branch: 'feat/x' })).toEqual(['unload-pr']);
    expect(shown({ head: 'feat/x', branch: 'feat/x', dirty: true })).toEqual(['unload-pr', 'stash']);
  });

  it('le robot de la PR : rien', () => {
    expect(shown({ head: 'feat/x', robot: true, child: true, dirty: true })).toEqual([]);
  });

  it('une demande en attente : ici ; avec des modifications, un worktree (pas sur un enfant) et mettre de côté', () => {
    expect(shown({ request: 'feat/y' })).toEqual(['new-here']);
    expect(shown({ request: 'feat/y', dirty: true })).toEqual(['new-here', 'new-worktree', 'stash']);
    expect(shown({ request: 'feat/y', dirty: true, child: true })).toEqual(['new-here', 'stash']);
  });

  it('une clé par action de lieu', () => {
    expect(Object.keys(placeShown(base)).sort()).toEqual([...PLACE_ACTIONS].sort());
  });
});

describe('placeReason', () => {
  it('des modifications grisent les changements de branche seulement', () => {
    const s = { ...base, dirty: true };
    expect(['pr-here', 'unload-pr', 'new-here'].map((id) => placeReason(id, s))).toEqual(['dirty', 'dirty', 'dirty']);
    expect(['pr-worktree', 'new-worktree', 'stash'].map((id) => placeReason(id, s))).toEqual([null, null, null]);
  });

  it('une recette en cours grise tous les choix', () => {
    expect(PLACE_ACTIONS.map((id) => placeReason(id, { ...base, recipe: true, dirty: true }))).toEqual(PLACE_ACTIONS.map(() => 'preparing'));
  });

  it('propre, sans recette, ou une autre action : null', () => {
    expect(PLACE_ACTIONS.map((id) => placeReason(id, base)).every((r) => r === null)).toBe(true);
    expect(placeReason('commit', { ...base, dirty: true, recipe: true })).toBeNull();
  });
});
