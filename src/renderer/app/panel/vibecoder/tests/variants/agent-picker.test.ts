// @vitest-environment happy-dom
// AgentPicker (agent-picker.tsx) : la pastille (initiales, couleur de l'agent), le dépôt, le titre et la
// branche ; clic → onOpen ; clic droit → onMenu (menu natif du navigateur retenu).
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { AgentView } from 'technicals/bridge';
import { AgentPicker } from '../../agent-picker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
const root = createRoot(page);
const agent = (more: Partial<AgentView> = {}) => ({
  id: 'a1', name: 'whisper-dev', color: '#4ea1ff', repo: 'whisper', title: 'worktree', branch: 'feat/x',
  step: null, activity: 'idle', detail: null, parent: 'a0', ...more }) as AgentView;
const calls: string[] = [];
const draw = (a: AgentView) => act(() => {
  root.render(createElement(AgentPicker, { agent: a, t: t('fr'), onOpen: () => { calls.push('open'); }, onMenu: () => { calls.push('menu'); } }));
});
const text = (cls: string) => page.querySelector(`.${cls}`)?.textContent;
const button = () => page.querySelector('button') as HTMLButtonElement;

it('AgentPicker : initiales, dépôt, titre, branche et couleur de l\'agent', async () => {
  await draw(agent());
  expect([text('vc-picker-dot'), text('vc-picker-repo'), text('vc-picker-title'), text('vc-picker-branch')])
    .toEqual(['WD', 'whisper', 'worktree', '⎇ feat/x']);
  expect(button().style.getPropertyValue('--vc-agent')).toBe('#4ea1ff');
  await draw(agent({ name: 'gear', title: 'pr', pr: 12, branch: null }));
  expect([text('vc-picker-dot'), text('vc-picker-title'), page.querySelector('.vc-picker-branch')]).toEqual(['GE', 'PR #12', null]);
});

it('AgentPicker : clic → onOpen, clic droit → onMenu sans le menu natif', async () => {
  calls.length = 0;
  await draw(agent());
  await act(() => { button().click(); });
  const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  await act(() => { button().dispatchEvent(menu); });
  expect(calls).toEqual(['open', 'menu']);
  expect(menu.defaultPrevented).toBe(true);
});
