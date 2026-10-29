// @vitest-environment happy-dom
// ModulesView (modules-view.tsx) : le 💬 du commit proposé devenu IconButton comment, même action (cite la
// première ligne du message), absent sans l'action comment.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { ModulesView } from '../../modules-view';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const prefills: unknown[][] = [];
const draw = (actions: { id: string }[]) => act(() => {
  const view = { lang: 'fr', flow: 'create', actions, modules: [], commits: [],
    outputs: { 'commit.md': { text: 'feat : sujet\n\ncorps\n', time: 0 } } } as unknown as VibeView;
  const props = { view, step: { id: 'modules', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
    code: null, drafts: [{}, () => {}], act: { run: async () => true, prefill: (...a: unknown[]) => { prefills.push(a); }, open: () => {},
      openLink: () => {}, follow: () => {}, save: async () => true } } as unknown as StepProps;
  root.render(createElement(ModulesView, props));
});
const quote = () => page.querySelector<HTMLButtonElement>('button[aria-label="Citer le message dans le champ"]');

it('commit proposé : IconButton comment, cite le sujet ; absent sans l\'action', async () => {
  await draw([{ id: 'comment' }]);
  expect(page.textContent).not.toContain('💬');
  expect(quote()!.className).toBe('vc-tool');
  expect(quote()!.title).toBe('Citer le message dans le champ');
  expect(quote()!.querySelector('svg')).not.toBeNull();
  quote()!.click();
  expect(prefills).toEqual([['comment', 'feat : sujet']]);
  await draw([]);
  expect(quote()).toBeNull();
});
