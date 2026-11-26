import { describe, expect, it } from 'vitest';
import { convWidth, runningRuns } from 'core/vibecoder';
import type { VibeRun } from 'technicals/bridge';

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

describe('runningRuns', () => {
  const run = (id: string, state: VibeRun['state']): VibeRun =>
    ({ id, label: id, who: 'sonnet', state, since: 0, end: null, reply: '', permission: null });

  it('en cours et en attente d\'autorisation, dans l\'ordre reçu ; ni arrêtées, ni finies', () => {
    const runs = [run('a', 'done'), run('b', 'asking'), run('c', 'stopped'), run('d', 'running'),
      run('e', 'failed'), run('f', 'kept'), run('g', 'undone')];
    expect(runningRuns(runs).map((r) => r.id)).toEqual(['b', 'd']);
  });

  it('aucune : vide', () => {
    expect(runningRuns([])).toEqual([]);
  });
});
