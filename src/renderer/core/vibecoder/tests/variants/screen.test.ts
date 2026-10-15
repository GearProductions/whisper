import { describe, expect, it } from 'vitest';
import { chosenModel, convWidth, modelArg } from 'core/vibecoder';
import type { VibeAction } from 'technicals/bridge';

const action = (over: Partial<VibeAction> = {}): VibeAction => ({
  id: 'read-invariants', step: 'invariants', label: 'Lire en pseudo-code', hint: '', who: 'sonnet · moyen',
  models: ['haiku', 'sonnet', 'opus'], model: 'sonnet', kind: 'send', needs: 'none', usesText: false, primary: false, disabled: null,
  ...over,
});

describe('chosenModel', () => {
  it('rien de choisi : le conseillé', () => {
    expect(chosenModel(action(), {})).toBe('sonnet');
  });

  it('un modèle des siens : celui-là', () => {
    expect(chosenModel(action(), { 'read-invariants': 'haiku' })).toBe('haiku');
  });

  it('un modèle qui n\'est pas des siens (fable, inconnu, vide) : le conseillé', () => {
    for (const m of ['fable', 'gpt', '']) expect(chosenModel(action(), { 'read-invariants': m })).toBe('sonnet');
  });

  it('le choix d\'une autre action ne compte pas', () => {
    expect(chosenModel(action(), { forme: 'opus' })).toBe('sonnet');
  });

  it('modèle de l\'agent (pas de sous-contexte) : vide', () => {
    expect(chosenModel(action({ models: [], model: null }), { 'read-invariants': 'opus' })).toBe('');
  });
});

describe('modelArg', () => {
  it('le conseillé, choisi ou non : rien à envoyer', () => {
    expect(modelArg(action(), {})).toBeUndefined();
    expect(modelArg(action(), { 'read-invariants': 'sonnet' })).toBeUndefined();
  });

  it('un autre des siens : envoyé', () => {
    expect(modelArg(action(), { 'read-invariants': 'opus' })).toBe('opus');
  });

  it('pas des siens, ou modèle de l\'agent : rien', () => {
    expect(modelArg(action(), { 'read-invariants': 'fable' })).toBeUndefined();
    expect(modelArg(action({ models: [], model: null }), { 'read-invariants': 'haiku' })).toBeUndefined();
  });
});

describe('convWidth', () => {
  it('dans les bornes : telle quelle, arrondie', () => {
    expect(convWidth(420.4, 1280)).toBe(420);
  });

  it('300 px au moins', () => {
    expect(convWidth(120, 1280)).toBe(300);
    expect(convWidth(-50, 1280)).toBe(300);
  });

  it('60 % de l\'écran au plus', () => {
    expect(convWidth(1000, 1280)).toBe(768);
  });

  it('écran trop étroit pour les deux bornes : 300 px', () => {
    expect(convWidth(400, 400)).toBe(300);
  });
});
