// @vitest-environment happy-dom
// PanelApp (panel-app.tsx), les agents : leurs robots d'après onAgents (clic, clic droit), le bip d'un signal qui
// apparaît, les raccourcis (Ctrl+K, Ctrl+Tab, Ctrl+N), les mouvements de la palette, l'accueil sans agent,
// l'historique dans la colonne.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import type { AgentView, ConvApi } from 'technicals/bridge';
import { PanelApp } from '../../panel-app';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const on: Record<string, (v: unknown) => void> = {};
const calls: string[] = [];
const conv = new Proxy({}, {
  get: (_, k: string) => (...args: unknown[]) => {
    if (k.startsWith('on')) { on[k] = args[0] as (v: unknown) => void; return undefined; }
    calls.push(`${k}${args.length ? `:${args.map(String).join(',')}` : ''}`);
    return k === 'history' ? Promise.resolve([{ sessionId: 's1', title: 'Hier', lastModified: 0, current: false }])
      : k === 'getConfig' ? Promise.resolve({ sound: false }) : Promise.resolve(null);
  },
}) as unknown as ConvApi;

const agent = (id: string, name: string): AgentView => ({ id, name, color: '#4ea1ff', repo: 'whisper', title: 'main', branch: 'master', step: null, activity: 'idle', detail: null, parent: null });
const A = agent('a1', 'alpha'), B = agent('a2', 'beta');
const page = document.body.appendChild(document.createElement('div'));
await act(() => { createRoot(page).render(createElement(PanelApp, { conv })); });
const push = (shown: string | null, agents: AgentView[]) => act(() => { on.onAgents({ agents, shown }); });
const key = (init: KeyboardEventInit) => act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })); });
const vibeUp = () => act(() => {
  on.onThread({ key: 'a1', live: true, name: 'alpha', color: '#fff', title: 't', status: 'idle', messages: [] });
  on.onVibe({ lang: 'fr', agentId: 'a1', steps: [], actions: [], runs: [], processes: [], commits: [], agent: {}, time: 0, flow: 'create', repo: { branch: 'master', base: 'master', changed: 0 } });
});

it('onAgents : l\'agent affiché en pastille parmi les robots de VibeCoder ; l\'accueil seulement sans agent', async () => {
  await vibeUp();
  await push('a1', [A, B]);
  expect(page.querySelector('.vc-agent[aria-pressed="true"]')?.textContent).toContain('whisper');
  expect(page.querySelector('.vc-noagent')).toBeNull();
  await push(null, []);
  expect(page.querySelector('.vc-noagent')).not.toBeNull();
  await push('a1', [A, B]);
  expect(page.querySelector('.vc-noagent')).toBeNull();
});

it('Ctrl+K ouvre la palette ; Entrée sur un agent l\'affiche et ferme la palette ; Ctrl+N ajoute ; Ctrl+Tab revient à l\'agent d\'avant', async () => {
  calls.length = 0;
  await push('a2', [A, B]);
  await push('a1', [A, B]);
  await key({ key: 'k', ctrlKey: true });
  const input = page.querySelector<HTMLInputElement>('.vc-pal-input')!;
  expect(input).not.toBeNull();
  await act(() => {
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
    set.call(input, 'beta');
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  expect(calls).toEqual(['showAgent:a2']);
  expect(page.querySelector('.vc-pal')).toBeNull();
  calls.length = 0;
  await key({ key: 'n', ctrlKey: true });
  await key({ key: 'Tab', ctrlKey: true });
  expect(calls).toEqual(['addAgent', 'showAgent:a2']);
});

it('la palette : « Nouvel agent… » ajoute un agent, « Gérer les branches… » ouvre la vue des branches', async () => {
  calls.length = 0;
  await key({ key: 'k', ctrlKey: true });
  await act(() => { [...page.querySelectorAll<HTMLElement>('.vc-pal-row')].find((r) => r.textContent?.includes('Nouvel agent'))!.click(); });
  expect(calls).toEqual(['addAgent']);
  expect(page.querySelector('.vc-branch')?.getAttribute('aria-pressed')).toBe('false');
  await key({ key: 'k', ctrlKey: true });
  await act(() => { [...page.querySelectorAll<HTMLElement>('.vc-pal-row')].find((r) => r.textContent?.includes('branches'))!.click(); });
  expect(page.querySelector('.vc-branch')?.getAttribute('aria-pressed')).toBe('true');
});

it('les robots : même ordre quel que soit l\'affiché ; clic : l\'afficher (l\'affiché : la palette) ; clic droit : son menu', async () => {
  calls.length = 0;
  const robots = () => [...page.querySelectorAll<HTMLElement>('.vc-agent')];
  await push('a1', [A, B]);
  const order = () => robots().map((r) => r.getAttribute('aria-pressed'));
  expect(order()).toEqual(['true', 'false']);
  await push('a2', [A, B]);
  expect(order()).toEqual(['false', 'true']);
  await act(() => { robots()[0].click(); });
  await act(() => { robots()[0].dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
  expect(calls).toEqual(['showAgent:a1', 'agentMenu:a1']);
  await act(() => { robots()[1].click(); });
  expect(page.querySelector('.vc-pal')).not.toBeNull();
  await key({ key: 'Escape' });
  await act(() => { page.querySelector<HTMLElement>('.vc-pal-back')?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
  await push('a1', [A, B]);
});

it('le bip : quand un autre agent se met à attendre ou finit, une fois par signal ; jamais pour l\'affiché', async () => {
  calls.length = 0;
  await push('a1', [A, { ...B, activity: 'done' }]);
  await push('a1', [A, { ...B, activity: 'done' }]);
  await push('a1', [{ ...A, activity: 'asking' }, { ...B, activity: 'done' }]);
  expect(calls.filter((c) => c === 'getConfig')).toHaveLength(1);
  await push('a1', [A, { ...B, activity: 'asking' }]);
  expect(calls.filter((c) => c === 'getConfig')).toHaveLength(2);
  await push('a1', [A, B]);
});

it('🕘 : l\'historique à la place du fil ; choisir une conversation l\'ouvre et ferme l\'historique', async () => {
  calls.length = 0;
  await act(() => { page.querySelector<HTMLElement>('.vc-history')!.click(); });
  expect(calls).toEqual(['history']);
  const session = page.querySelector<HTMLElement>('.vc-history-view .session')!;
  expect(session.textContent).toContain('Hier');
  await act(() => { session.click(); });
  expect(calls).toEqual(['history', 'open:s1']);
  expect(page.querySelector('.vc-history-view')).toBeNull();
});

it('⚙ Réglages : les micros énumérés vont au principal', async () => {
  calls.length = 0;
  Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { enumerateDevices: async () => [{ kind: 'audioinput', deviceId: 'm1', label: 'Micro' }] } });
  const gear = [...page.querySelectorAll('button')].find((b) => b.textContent?.includes('Réglages'))!;
  await act(async () => { gear.click(); });
  expect(calls).toEqual(['openSettings:[object Object]']);
});
