// @vitest-environment happy-dom
// PrPicker (pr-picker.tsx) : les choix de la PR chargée d'après le relevé, Décharger (unload-pr) et Rester sur la branche.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeAction, VibeView } from 'technicals/bridge';
import { PrPicker } from '../../pr-picker';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
const root = createRoot(page);
const a = (id: string, hidden = false, disabled: string | null = null) => ({
  id, label: id, hint: '', kind: 'send', step: 'pr', models: [], hidden, disabled, direct: { running: false, last: null, only: true },
}) as unknown as VibeAction;
const pr = { number: 7, title: 'T', url: '', author: '', base: 'master', head: 'feat', body: '', state: 'OPEN' };

const sets: unknown[] = [];
const runs: unknown[] = [];
const draw = (actions: VibeAction[]) => act(() => {
  const view = { lang: 'fr', flow: 'review', actions, pr, prs: null, outputs: { 'pr-7.json': {} }, worktree: null } as unknown as VibeView;
  const props = {
    view, t: t('fr'), busy: false, step: { id: 'pr', status: 'current', facts: '', open: true }, text: '', setText: () => {},
    act: { set: (p: unknown) => sets.push(p), run: async (id: string, x: unknown) => { runs.push([id, x]); return true; }, openLink: () => {} },
  } as unknown as StepProps;
  root.render(createElement(PrPicker, props));
});
const labels = () => [...page.querySelectorAll('button')].map((b) => b.textContent ?? '');
const button = (text: string) => [...page.querySelectorAll('button')].find((b) => b.textContent?.startsWith(text))!;

it('PrPicker : dossier propre, Changer de branche et Décharger, rien de masqué ni Rester', async () => {
  await draw([a('load-pr'), a('pr-here'), a('pr-worktree', true), a('stash', true), a('unload-pr')]);
  const l = labels();
  expect(l.some((x) => x.startsWith('pr-here'))).toBe(true);
  expect(l.some((x) => x.startsWith('unload-pr'))).toBe(true);
  expect(l.some((x) => x.startsWith('pr-worktree') || x.startsWith('stash'))).toBe(false);
  expect(l).not.toContain('Rester sur la branche');
  expect(l).not.toContain('Décharger la PR');   // unload-pr remplace le Décharger sans git
  button('unload-pr').click();
  expect(runs.at(-1)).toEqual(['unload-pr', { direct: true }]);
});

it('PrPicker : des modifications, Changer de branche grisé, stash une fois, Rester sur la branche', async () => {
  await draw([a('load-pr'), a('pr-here', false, 'Des modifications en cours'), a('pr-worktree'), a('stash'), a('unload-pr', false, 'Des modifications en cours')]);
  expect(button('pr-here').disabled).toBe(true);
  expect(labels().filter((x) => x.startsWith('stash'))).toHaveLength(1);
  button('stash').click();
  expect(runs.at(-1)).toEqual(['stash', { direct: true }]);
  button('Rester sur la branche').click();
  expect(sets.at(-1)).toEqual({ pr: null });
});

it('PrPicker : unload-pr masqué (robot), Décharger ne fait que ne plus suivre', async () => {
  await draw([a('load-pr'), a('pr-here', true), a('unload-pr', true), a('stash', true)]);
  expect(labels().some((x) => x.startsWith('unload-pr'))).toBe(false);
  button('Décharger la PR').click();
  expect(sets.at(-1)).toEqual({ pr: null });
});
