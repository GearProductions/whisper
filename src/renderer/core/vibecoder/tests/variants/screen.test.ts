import { describe, expect, it } from 'vitest';
import { convWidth, runningRuns, stepActions } from 'core/vibecoder';
import type { VibeAction, VibeRun, VibeStep, VibeView } from 'technicals/bridge';

const action = (over: Partial<VibeAction> = {}): VibeAction => ({
  id: 'read-invariants', step: 'invariants', label: 'Lire en pseudo-code', hint: '', who: 'sonnet · moyen',
  models: ['haiku', 'sonnet', 'opus'], model: 'sonnet', kind: 'send', needs: 'none', usesText: false, primary: false, disabled: null, hidden: false,
  ...over,
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

describe('stepActions', () => {
  const actions = [
    action({ id: 'forme-review', step: 'forme' }),
    action({ id: 'forme', step: 'forme', primary: true }),
    action({ id: 'vibe', step: null }),
    action({ id: 'quote-forme', step: 'forme', kind: 'prefill', text: 'Sur {{quote}} :' }),
    action({ id: 'prep-forme', step: 'forme', kind: 'prefill', text: 'Revoir la forme' }),
    action({ id: 'gone', step: 'forme', hidden: true }),
    action({ id: 'other', step: 'modules' }),
  ];
  const view = (over: Partial<VibeView> = {}) => ({ flow: 'create', actions, ...over }) as VibeView;
  const step = (status: VibeStep['status']): VibeStep => ({ id: 'forme', status, facts: '' });
  const row = (v: VibeView, s: VibeStep, own: string[] = []) => stepActions(v, s, own).map(({ a, tone }) => `${a.id}:${tone}`);

  it('étape en cours : la mise en avant, puis les siennes ; sans masquée, qui cite, ni d\'une autre étape', () => {
    expect(row(view(), step('current'))).toEqual(['forme:accent', 'forme-review:plain', 'prep-forme:plain']);
  });

  it('étape pas en cours : les siennes seulement, sans accent', () => {
    expect(row(view(), step('done'))).toEqual(['forme-review:plain', 'forme:plain', 'prep-forme:plain']);
  });

  it('jamais Vibe : ni Créer, ni Relire, même mise en avant ou de l\'étape', () => {
    for (const flow of ['create', 'review'] as const) {
      for (const s of ['current', 'done'] as const) expect(row(view({ flow }), step(s)).some((r) => r.startsWith('vibe:'))).toBe(false);
    }
    const mine = actions.map((a): VibeAction => (a.id === 'vibe' ? { ...a, step: 'forme', primary: true } : a));
    expect(row(view({ actions: mine }), step('current'))).toEqual(['forme:accent', 'forme-review:plain', 'prep-forme:plain']);
  });

  it('celles que la vue montre elle-même (own) : retirées', () => {
    expect(row(view(), step('current'), ['forme-review'])).toEqual(['forme:accent', 'prep-forme:plain']);
  });

  it('la mise en avant d\'une autre étape : à l\'étape en cours seulement', () => {
    const next = [...actions, action({ id: 'modules', step: 'modules', primary: true })];
    expect(row(view({ actions: next }), step('current'))).toContain('modules:accent');
    expect(row(view({ actions: next }), step('done'))).not.toContain('modules:accent');
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
