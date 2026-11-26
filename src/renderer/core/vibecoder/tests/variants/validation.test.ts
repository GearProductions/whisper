import { describe, expect, it } from 'vitest';
import { stepBadge } from 'core/vibecoder';
import type { VibeFlow, VibeStepCheck, VibeStepId } from 'technicals/bridge';

// 0.16.0 : le ✓ sur le badge d'état d'une étape (note 0.16.0-ecran-essentiel).
describe('stepBadge', () => {
  const CHECKED = ['forme', 'invariants', 'modules'] as const;
  const OTHERS = ['note', 'revue', 'pr'] as const;
  const badge = (flow: VibeFlow, id: VibeStepId, check?: VibeStepCheck, prevOk = true) => stepBadge(flow, { id, ...(check && { check }) }, prevOk);
  const NOTHING = { mark: null, click: null };

  it.each(CHECKED)('créateur, %s validée : le ✓, un clic le retire', (id) => {
    expect(badge('create', id, { state: 'ok', now: 'h' })).toEqual({ mark: 'ok', click: 'withdraw' });
    expect(badge('create', id, { state: 'ok', now: 'h', by: 'system' })).toEqual({ mark: 'ok', click: 'withdraw' });
  });

  it.each(CHECKED)('créateur, %s : le ✓ retiré à la main qui tient : « ✓ retiré », un clic le rend', (id) => {
    expect(badge('create', id, { state: null, now: 'h', withdrawn: true })).toEqual({ mark: 'withdrawn', click: 'restore' });
  });

  // validateStep refuse l'étape dont celle d'avant n'est pas validée : « rendre » ne s'offre pas, le badge reste sans clic.
  it.each(CHECKED)('créateur, %s : ✓ retiré mais l\'étape d\'avant pas validée : « ✓ retiré » sans clic', (id) => {
    expect(badge('create', id, { state: null, now: null, withdrawn: true }, false)).toEqual({ mark: 'withdrawn', click: null });
  });

  it.each(CHECKED)('créateur, %s validée : le clic « retirer » ne dépend pas de l\'étape d\'avant', (id) => {
    expect(badge('create', id, { state: 'ok', now: 'h' }, false)).toEqual({ mark: 'ok', click: 'withdraw' });
  });

  it.each(CHECKED)('créateur, %s jamais validée : ni ✓ ni clic', (id) => {
    expect(badge('create', id)).toEqual(NOTHING);
    expect(badge('create', id, { state: null, now: null })).toEqual(NOTHING);
  });

  it.each(CHECKED)('créateur, %s modifiée depuis la validation, ou à revoir : ni ✓ ni clic', (id) => {
    expect(badge('create', id, { state: 'changed', now: 'h' })).toEqual(NOTHING);
    expect(badge('create', id, { state: 'cascade', cause: 'forme', now: 'h' })).toEqual(NOTHING);
  });

  it.each(OTHERS)('créateur, %s : ni ✓ ni clic, validée ou pas', (id) => {
    expect(badge('create', id)).toEqual(NOTHING);
    expect(badge('create', id, { state: 'ok', now: 'h' })).toEqual(NOTHING);
    expect(badge('create', id, { state: null, now: 'h', withdrawn: true })).toEqual(NOTHING);
  });

  it.each([...CHECKED, ...OTHERS])('relecteur, %s : ni ✓ ni clic, à toute étape', (id) => {
    expect(badge('review', id)).toEqual(NOTHING);
    expect(badge('review', id, { state: 'ok', now: 'h' })).toEqual(NOTHING);
    expect(badge('review', id, { state: null, now: 'h', withdrawn: true })).toEqual(NOTHING);
  });
});
