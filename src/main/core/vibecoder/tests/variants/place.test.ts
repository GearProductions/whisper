import { describe, expect, it } from 'vitest';
import { onBase, onPr, PLACE_ACTIONS, placeReason, placeShown, type PlaceState } from 'core/vibecoder';

const base: PlaceState = {
  head: null, branch: 'master', onBase: true, dirty: false, child: false, robot: false, prWorktree: false, recipe: false,
};
const ALWAYS = ['switch-branch', 'new-here', 'new-worktree'];
const shown = (s: Partial<PlaceState>) =>
  Object.entries(placeShown({ ...base, ...s })).filter(([, v]) => v).map(([k]) => k);

describe('onBase', () => {
  it('la branche est la base, avec ou sans origin/', () => {
    expect(onBase('master', 'master')).toBe(true);
    expect(onBase('master', 'origin/master')).toBe(true);
    expect(onBase('origin/main', 'main')).toBe(true);
    expect(onBase('feat/x', 'origin/master')).toBe(false);
    expect(onBase('master', 'origin/main')).toBe(false);
  });

  it('sans branche ou sans base : non', () => {
    expect(onBase(null, 'master')).toBe(false);
    expect(onBase('master', null)).toBe(false);
    expect(onBase(null, null)).toBe(false);
    expect(onBase('', '')).toBe(false);
  });
});

describe('onPr', () => {
  it('sur la tête de la PR, ou son robot', () => {
    expect(onPr({ ...base, head: 'feat/x', branch: 'feat/x' })).toBe(true);
    expect(onPr({ ...base, head: 'feat/x', robot: true, branch: 'pr-7' })).toBe(true);
    expect(onPr({ ...base, head: 'feat/x' })).toBe(false);
    expect(onPr(base)).toBe(false);
  });
});

describe('placeShown', () => {
  it('sur la base, sans PR : aller sur une branche, créer une branche ici ou dans un worktree', () => {
    expect(shown({})).toEqual(ALWAYS);
  });

  it('avec des modifications : mettre de côté, même sans PR ni demande', () => {
    expect(shown({ dirty: true })).toEqual([...ALWAYS, 'stash']);
  });

  it('hors de la base, sans PR : revenir sur la base', () => {
    expect(shown({ branch: 'feat/y', onBase: false })).toEqual(['unload-pr', ...ALWAYS]);
  });

  it('PR chargée, dossier propre hors de sa tête : changer de branche, un worktree, revenir sur la base', () => {
    expect(shown({ head: 'feat/x' })).toEqual(['pr-here', 'pr-worktree', 'unload-pr', ...ALWAYS]);
  });

  it('avec des modifications : en plus mettre de côté', () => {
    expect(shown({ head: 'feat/x', dirty: true })).toEqual(['pr-here', 'pr-worktree', 'unload-pr', ...ALWAYS, 'stash']);
  });

  it('pas de worktree sur un enfant, ni quand la PR a déjà le sien, propre ou pas', () => {
    for (const dirty of [false, true]) {
      expect(shown({ head: 'feat/x', dirty, child: true })).not.toContain('pr-worktree');
      expect(shown({ head: 'feat/x', dirty, child: true })).not.toContain('new-worktree');
      expect(shown({ head: 'feat/x', dirty, prWorktree: true })).not.toContain('pr-worktree');
    }
  });

  it('sur la tête : revenir sur la base (et mettre de côté avec des modifications)', () => {
    expect(shown({ head: 'feat/x', branch: 'feat/x', onBase: false })).toEqual(['unload-pr', ...ALWAYS]);
    expect(shown({ head: 'feat/x', branch: 'feat/x', onBase: false, dirty: true })).toEqual(['unload-pr', ...ALWAYS, 'stash']);
  });

  it('le robot de la PR : ni charger ni revenir sur la base', () => {
    const s = shown({ head: 'feat/x', branch: 'pr-7', onBase: false, robot: true, child: true });
    expect(s).toEqual(['switch-branch', 'new-here']);
    expect(shown({ head: 'feat/x', branch: 'pr-7', onBase: false, robot: true, child: true, dirty: true })).toEqual([...s, 'stash']);
  });

  it('une clé par action de lieu', () => {
    expect(Object.keys(placeShown(base)).sort()).toEqual([...PLACE_ACTIONS].sort());
  });
});

describe('placeReason', () => {
  it('des modifications grisent les changements de branche seulement', () => {
    const s = { ...base, dirty: true };
    expect(['pr-here', 'unload-pr', 'switch-branch', 'new-here'].map((id) => placeReason(id, s))).toEqual(['dirty', 'dirty', 'dirty', 'dirty']);
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
