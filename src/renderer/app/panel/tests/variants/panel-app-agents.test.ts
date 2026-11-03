// @vitest-environment happy-dom
// PanelApp (panel-app.tsx), les agents : le sélecteur d'après onAgents, les raccourcis (Ctrl+K, Ctrl+Tab,
// Ctrl+N), les mouvements de la palette, les notices des autres agents, l'accueil sans agent, l'historique
// dans la colonne.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import type { AgentEvent, AgentView, ConvApi } from 'technicals/bridge';
import { PanelApp } from '../../panel-app';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const on: Record<string, (v: unknown) => void> = {};
const calls: string[] = [];
const conv = new Proxy({}, {
  get: (_, k: string) => (...args: unknown[]) => {
    if (k.startsWith('on')) { on[k] = args[0] as (v: unknown) => void; return undefined; }
    calls.push(`${k}${args.length ? `:${args.map(String).join(',')}` : ''}`);
    return k === 'history' ? Promise.resolve([{ sessionId: 's1', title: 'Hier', lastModified: 0, current: false }]) : Promise.resolve(null);
  },
}) as unknown as ConvApi;

const agent = (id: string, name: string): AgentView => ({ id, name, color: '#4ea1ff', repo: 'whisper', title: 'main', branch: 'master', step: null, activity: 'idle', detail: null, parent: null });
const A = agent('a1', 'alpha'), B = agent('a2', 'beta');
const page = document.body.appendChild(document.createElement('div'));
await act(() => { createRoot(page).render(createElement(PanelApp, { conv })); });
const push = (shown: string | null, agents: AgentView[], events: AgentEvent[] = []) => act(() => { on.onAgents({ agents, shown, events }); });
const key = (init: KeyboardEventInit) => act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })); });
const vibeUp = () => act(() => {
  on.onThread({ mode: 'full', key: 'a1', live: true, name: 'alpha', color: '#fff', title: 't', status: 'idle', messages: [] });
  on.onVibe({ lang: 'fr', agentId: 'a1', steps: [], actions: [], runs: [], processes: [], commits: [], agent: {}, time: 0, flow: 'create', repo: { branch: 'master', base: 'master', changed: 0 } });
});

it('onAgents : l\'agent affiché au sélecteur de VibeCoder ; l\'accueil seulement sans agent', async () => {
  await vibeUp();
  await push('a1', [A, B]);
  expect(page.querySelector('.vc-picker')?.textContent).toContain('whisper');
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

it('les notices : celles des autres agents, retenues jusqu\'à ×, retirées quand l\'agent est affiché', async () => {
  const done: AgentEvent = { agentId: 'a2', kind: 'done', step: null, detail: null };
  await push('a1', [A, B], [done]);
  await push('a1', [A, B], [{ ...done, kind: 'asking' }]);
  expect(page.querySelectorAll('.vc-notice')).toHaveLength(2);
  await act(() => { page.querySelector<HTMLElement>('.vc-notice-x')!.click(); });
  expect(page.querySelectorAll('.vc-notice')).toHaveLength(1);
  await push('a2', [A, B]);
  expect(page.querySelectorAll('.vc-notice')).toHaveLength(0);
  await push('a1', [A, B], [done]);
  calls.length = 0;
  await act(() => { page.querySelector<HTMLElement>('.vc-notice .vc-run')!.click(); });
  expect(calls).toEqual(['showAgent:a2']);
  expect(page.querySelectorAll('.vc-notice')).toHaveLength(0);
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
