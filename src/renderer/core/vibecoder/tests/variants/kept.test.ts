import { describe, expect, it } from 'vitest';
import { createKept } from 'core/vibecoder';

describe('createKept : la saisie de l’écran, par agent', () => {
  it('rendue au retour sur l’agent, jamais à un autre', () => {
    const kept = createKept();
    kept.set('a1', 'answers', { 0: 'Oui' });
    kept.set('a1', 'texts', { note: 'la demande' });
    expect(kept.get('a2', 'answers', {})).toEqual({});
    expect(kept.get('a1', 'answers', {})).toEqual({ 0: 'Oui' });
    expect(kept.get('a1', 'texts', {})).toEqual({ note: 'la demande' });
  });
  it('rien de gardé : la valeur de départ', () => {
    expect(createKept().get('a1', 'verdict', 'comment')).toBe('comment');
  });
  it('vidé (envoyé) : vide au retour', () => {
    const kept = createKept();
    kept.set('a1', 'texts', { note: 'la demande' });
    kept.set('a1', 'texts', { note: '' });
    expect(kept.get('a1', 'texts', {})).toEqual({ note: '' });
  });
});
