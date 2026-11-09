// @vitest-environment happy-dom
// Palette (palette.tsx) : les groupes (dépôt, actions), la recherche, Tab change de portée, flèches + Entrée / Maj+Entrée
// rendent le déplacement de core/switcher, Échap et le fond ferment.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { AgentView } from 'technicals/bridge';
import { Palette } from '../../palette';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const agent = (id: string, name: string, repo: string): AgentView =>
  ({ id, name, color: '#c00', repo, title: 'main', branch: 'main', step: null, activity: 'working', detail: null, parent: null });
const agents = [agent('a', 'Alice', 'gear'), agent('b', 'Bob', 'other')];

let calls: unknown[] = [];
beforeEach(() => { calls = []; act(() => root.render(null)); });
const draw = (scope: 'all' | 'agents' = 'all') => act(() => {
  root.render(createElement(Palette, { agents, view: null, scope, t: t('fr'), onPick: (m) => calls.push(m), onClose: () => calls.push('close') }));
});
const key = (k: string, init: KeyboardEventInit = {}) => act(() => {
  page.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true, ...init }));
});
const text = (sel: string) => [...page.querySelectorAll(sel)].map((e) => e.textContent);

it('les groupes : un par dépôt, puis les actions ; la recherche filtre', async () => {
  await draw();
  expect(text('.vc-pal-group')).toEqual(['gear', 'other', 'Actions']);
  await act(async () => {
    const input = page.querySelector('input')!;
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'bob');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  expect(text('.vc-pal-group')).toEqual(['other']);
});

it('Tab change de portée ; flèches puis Entrée : le déplacement de la ligne ; Maj+Entrée', async () => {
  await draw('agents');
  expect(page.querySelector('[data-on]')!.textContent).toBe('Agents');
  await key('Tab');
  expect(page.querySelector('[data-on]')!.textContent).toBe('Branches');
  await key('Tab');
  await key('Tab');
  expect(page.querySelector('[data-on]')!.textContent).toBe('Tout');
  await key('ArrowDown');
  await key('Enter');
  await key('ArrowDown');
  await key('Enter', { shiftKey: true });
  expect(calls).toEqual([{ show: 'b' }, { add: true }]);
});

it('Échap et le fond ferment', async () => {
  await draw();
  await key('Escape');
  await act(async () => { page.querySelector('.vc-pal-back')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
  expect(calls).toEqual(['close', 'close']);
});

const sub = (a: Partial<AgentView>) => {
  act(() => root.render(createElement(Palette, { agents: [{ ...agent('a', 'Alice', 'gear'), ...a }], view: null, scope: 'all', t: t('fr'), onPick: () => {}, onClose: () => {} })));
  return text('.vc-pal-sub');
};

it('un agent failed : « en échec », jamais « en pause »', () => {
  expect(sub({ activity: 'failed' })).toEqual(['en échec']);
});

it('un agent au repos avec des tâches de fond : le dit', () => {
  expect(sub({ activity: 'idle', tasks: 2 })).toEqual(['surveille 2 tâches de fond']);
  expect(sub({ activity: 'idle' })).toEqual(['au repos']);
  expect(sub({ activity: 'working', tasks: 2 })).toEqual(['travaille']);
});
