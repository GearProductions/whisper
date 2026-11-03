// @vitest-environment happy-dom
// VibeCoder (vibe-coder.tsx) : l'en-tête (le sélecteur d'agent, Chercher, ⚙ Réglages ; plus de retour à
// la conversation ni de fermer) et l'onglet Conversation (🕘 : l'historique à la place du fil).
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { createKept, t } from 'core/vibecoder';
import type { Scope } from 'core/switcher';
import type { AgentView, Thread, VibeView } from 'technicals/bridge';
import { VibeCoder } from '../../vibe-coder';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
const root = createRoot(page);
const fr = t('fr');
const view = { lang: 'fr', agentId: 'a1', steps: [], actions: [], runs: [], processes: [], commits: [], agent: {}, time: 0, flow: 'create' } as unknown as VibeView;
const thread = { name: 'whisper', status: 'idle', tasks: [] } as unknown as Thread;
const agent = { id: 'a1', name: 'whisper', color: '#4ea1ff', repo: 'whisper', title: 'main', branch: 'master', step: null, activity: 'idle', detail: null, parent: null } as AgentView;
const noop = () => {};
const acts = { follow: noop, set: noop, refresh: noop } as never;
const calls: string[] = [];
const kept = createKept();
const draw = (more: { agent?: AgentView | null; historyOpen?: boolean; tasksOpen?: boolean } = {}) => act(() => {
  root.render(createElement(VibeCoder, {
    view, thread, act: acts, tasks: 'TASKS' as ReactNode, tasksOpen: more.tasksOpen ?? false, contextOpen: false, onGauge: noop, onTasks: noop,
    agent: more.agent === undefined ? agent : more.agent,
    onPalette: (scope: Scope) => { calls.push(`palette:${scope}`); }, onAgentMenu: (id: string) => { calls.push(`menu:${id}`); },
    onSettings: () => { calls.push('settings'); }, historyOpen: more.historyOpen ?? false, onHistory: () => { calls.push('history'); },
    history: createElement('p', { className: 'the-history' }, 'HISTORIQUE'),
    side: { open: true, width: 400 }, onSide: noop, kept, code: null,
    children: createElement('p', { className: 'the-thread' }, 'FIL'),
  }));
});
const top = () => page.querySelector('.vc-top') as HTMLElement;
const byText = (s: string) => [...page.querySelectorAll('button')].find((b) => b.textContent === s);

it('VibeCoder : le sélecteur ouvre la palette sur Agents, le clic droit le menu de l\'agent', async () => {
  calls.length = 0;
  await draw();
  const picker = top().querySelector('.vc-picker') as HTMLButtonElement;
  expect(top().querySelector('.vc-name')).toBeNull();
  await act(() => { picker.click(); });
  await act(() => { picker.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true })); });
  expect(calls).toEqual(['palette:agents', 'menu:a1']);
});

it('VibeCoder : sans relevé des agents, le nom de l\'agent comme avant, sans sélecteur', async () => {
  await draw({ agent: null });
  expect(top().querySelector('.vc-picker')).toBeNull();
  expect(top().querySelector('.vc-name')?.textContent).toBe('whisper');
});

it('VibeCoder : Chercher → palette « Tout », ⚙ Réglages → onSettings, plus de retour ni de fermer', async () => {
  calls.length = 0;
  await draw();
  await act(() => { (byText(`${fr.search} ${fr.searchKeys}`) as HTMLButtonElement).click(); });
  await act(() => { (byText(fr.settings) as HTMLButtonElement).click(); });
  expect(calls).toEqual(['palette:all', 'settings']);
  expect(top().querySelector(`[aria-label="${fr.back}"], [aria-label="${fr.close}"]`)).toBeNull();
});

it('VibeCoder : 🕘 bascule l\'historique ; ouvert, il prend la place du fil, avec « ← Conversation en cours »', async () => {
  calls.length = 0;
  await draw();
  expect(page.querySelector('.the-thread')).not.toBeNull();
  expect(page.querySelector('.the-history')).toBeNull();
  await act(() => { (page.querySelector('.vc-side-tabs .vc-history') as HTMLButtonElement).click(); });
  await draw({ historyOpen: true });
  expect(page.querySelector('.the-thread')).toBeNull();
  expect(page.querySelector('.the-history')?.textContent).toBe('HISTORIQUE');
  await act(() => { (byText(fr.historyBack) as HTMLButtonElement).click(); });
  expect(calls).toEqual(['history', 'history']);
});
