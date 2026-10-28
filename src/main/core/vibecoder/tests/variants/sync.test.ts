import { describe, expect, it } from 'vitest';
import { syncReason } from 'core/vibecoder';

describe('syncReason', () => {
  it('pull grisé sans branche suivie ou à jour, actif en retard', () => {
    expect(syncReason('pull', { behind: null, rebased: false })).toBe('noUpstream');
    expect(syncReason('pull', { behind: 0, rebased: false })).toBe('upToDate');
    expect(syncReason('pull', { behind: 3, rebased: false })).toBeNull();
  });

  it('rebase et pousser jamais grisés, une autre action non plus', () => {
    for (const id of ['rebase', 'push', 'stash']) expect(syncReason(id, { behind: null, rebased: true })).toBeNull();
  });
});
