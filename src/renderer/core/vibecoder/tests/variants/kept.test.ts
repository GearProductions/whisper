import { describe, expect, it } from 'vitest';
import { createKept, scoped } from 'core/vibecoder';

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

describe('scoped : ce qu’un agent garde pour une étape', () => {
  it('deux agents, même étape, même clé : chacun sa valeur', () => {
    const kept = createKept();
    scoped(kept, 'a1', 'code').set('open', true);
    expect(scoped(kept, 'a2', 'code').get('open', false)).toBe(false);
    expect(scoped(kept, 'a1', 'code').get('open', false)).toBe(true);
  });
  it('un agent, deux étapes, même clé : chacune la sienne', () => {
    const kept = createKept();
    scoped(kept, 'a1', 'code').set('file', 'a.ts');
    scoped(kept, 'a1', 'review').set('file', 'b.ts');
    expect(scoped(kept, 'a1', 'code').get('file', '')).toBe('a.ts');
    expect(scoped(kept, 'a1', 'review').get('file', '')).toBe('b.ts');
    expect(scoped(kept, 'a1', 'forme').get('file', '')).toBe('');
  });
  it('un ensemble (dossiers pliés) rendu tel qu’il a été gardé', () => {
    const kept = createKept();
    const folded = new Set(['src', 'src/app']);
    scoped(kept, 'a1', 'code').set('folded', folded);
    expect(scoped(kept, 'a1', 'code').get('folded', new Set<string>())).toEqual(new Set(['src', 'src/app']));
  });
});
