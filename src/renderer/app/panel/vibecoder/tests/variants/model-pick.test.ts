// @vitest-environment happy-dom
// model-pick (model-pick.tsx) : le choix du modèle, et celui de l'effort si a.efforts et que le contexte le porte ;
// un effort hors de la liste est ignoré (affiché « par défaut »).
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeAction } from 'technicals/bridge';
import { ModelPick, Picks } from '../../model-pick';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
const root = createRoot(page);
const action = (a: Partial<VibeAction> = {}): VibeAction => ({
  id: 'commit', step: 'modules', label: 'Commiter', hint: '', who: 'agent', models: [], model: null, kind: 'send',
  needs: 'none', usesText: false, primary: false, disabled: null, hidden: false, ...a,
});
const show = (a: VibeAction, ctx: Record<string, unknown> = {}) => act(() => {
  root.render(createElement(Picks.Provider, { value: { picks: {}, lang: 'fr', pick: () => {}, ...ctx }, children: createElement(ModelPick, { a }) }));
});

it('sans efforts dans l\'action ou sans eux dans le contexte : pas de choix d\'effort', async () => {
  await show(action({ models: ['opus'], model: 'opus' }), { efforts: {}, pickEffort: () => {} });
  expect(page.querySelectorAll('select').length).toBe(1);
  await show(action({ efforts: ['low', 'high'] }));
  expect(page.querySelector('select')).toBeNull();
  await show(action({ efforts: ['low', 'high'] }), { efforts: {} });
  expect(page.querySelector('select')).toBeNull();
});

it('l\'effort : par défaut d\'abord, puis la liste ; le choix remonte par pickEffort', async () => {
  const pickEffort = vi.fn();
  await show(action({ efforts: ['low', 'high'] }), { efforts: {}, pickEffort });
  const select = page.querySelector('select')!;
  expect([...select.options].map((o) => o.value)).toEqual(['', 'low', 'high']);
  expect(select.options[0].textContent).toBe(t('fr').effortDefault);
  expect(page.querySelector('label span')!.textContent).toBe(t('fr').effortDefault);
  expect(page.querySelector('label')!.hasAttribute('data-other')).toBe(false);
  select.value = 'high';
  await act(() => { select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(pickEffort).toHaveBeenCalledWith('commit', 'high');
});

it('un effort choisi s\'affiche en accent ; hors de la liste, il est ignoré', async () => {
  const ctx = (e: string) => ({ efforts: { commit: e }, pickEffort: () => {} });
  await show(action({ efforts: ['low', 'high'] }), ctx('high'));
  expect(page.querySelector('label span')!.textContent).toBe('élevé');
  expect(page.querySelector('label')!.hasAttribute('data-other')).toBe(true);
  await show(action({ efforts: ['low', 'high'] }), ctx('max'));
  expect(page.querySelector('select')!.value).toBe('');
  expect(page.querySelector('label span')!.textContent).toBe(t('fr').effortDefault);
});

it('modèle et effort côte à côte : deux choix', async () => {
  await show(action({ models: ['opus', 'sonnet'], model: 'opus', efforts: ['low'] }), { efforts: {}, pickEffort: () => {} });
  expect(page.querySelectorAll('label.vc-model').length).toBe(2);
});
