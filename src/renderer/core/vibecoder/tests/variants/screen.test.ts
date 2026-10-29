import { describe, expect, it } from 'vitest';
import { chosenModel, convWidth, modelArg, runningRuns, stepActions } from 'core/vibecoder';
import type { VibeAction, VibeRun, VibeStep, VibeView } from 'technicals/bridge';

const action = (over: Partial<VibeAction> = {}): VibeAction => ({
  id: 'read-invariants', step: 'invariants', label: 'Lire en pseudo-code', hint: '', who: 'sonnet · moyen',
  models: ['haiku', 'sonnet', 'opus'], model: 'sonnet', kind: 'send', needs: 'none', usesText: false, primary: false, disabled: null, hidden: false,
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
  const step = (status: VibeStep['status']): VibeStep => ({ id: 'forme', status, facts: '', open: true });
  const row = (v: VibeView, s: VibeStep, own: string[] = []) => stepActions(v, s, own).map(({ a, tone }) => `${a.id}:${tone}`);

  it('étape en cours, Créer : vibe, puis la mise en avant, puis les siennes ; sans masquée, qui cite, ni d\'une autre étape', () => {
    expect(row(view(), step('current'))).toEqual(['vibe:vibe', 'forme:accent', 'forme-review:plain', 'prep-forme:plain']);
  });

  it('étape pas en cours : les siennes seulement, sans accent ni vibe', () => {
    expect(row(view(), step('done'))).toEqual(['forme-review:plain', 'forme:plain', 'prep-forme:plain']);
  });

  it('Relire : pas de vibe', () => {
    expect(row(view({ flow: 'review' }), step('current'))).toEqual(['forme:accent', 'forme-review:plain', 'prep-forme:plain']);
  });

  it('vibe masquée (note pas validée, Vibe en cours) : absente', () => {
    const hidden = actions.map((a) => (a.id === 'vibe' ? { ...a, hidden: true } : a));
    expect(row(view({ actions: hidden }), step('current'))).toEqual(['forme:accent', 'forme-review:plain', 'prep-forme:plain']);
  });

  it('celles que la vue montre elle-même (own) : retirées, vibe comprise', () => {
    expect(row(view(), step('current'), ['vibe', 'forme-review'])).toEqual(['forme:accent', 'prep-forme:plain']);
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
