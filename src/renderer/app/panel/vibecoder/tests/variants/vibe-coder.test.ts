// @vitest-environment happy-dom
// VibeCoder (vibe-coder.tsx) : l'en-tête (les robots des agents, Chercher, ⚙ Réglages ; plus de retour à
// la conversation ni de fermer) et l'onglet Conversation (🕘 : l'historique à la place du fil).
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { createKept, t } from 'core/vibecoder';
import type { Thread, VibeView } from 'technicals/bridge';
import { VibeCoder } from '../../vibe-coder';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
const root = createRoot(page);
const fr = t('fr');
const view = { lang: 'fr', agentId: 'a1', steps: [], actions: [], runs: [], processes: [], commits: [], agent: {}, time: 0, flow: 'create' } as unknown as VibeView;
const thread = { name: 'whisper', status: 'idle', tasks: [] } as unknown as Thread;
const noop = () => {};
const acts = { follow: noop, set: noop, refresh: noop } as never;
const calls: string[] = [];
const kept = createKept();
const draw = (more: { historyOpen?: boolean; tasksOpen?: boolean; others?: ReactNode } = {}) => act(() => {
  root.render(createElement(VibeCoder, {
    view, thread, act: acts, tasks: 'TASKS' as ReactNode, tasksOpen: more.tasksOpen ?? false, contextOpen: false, onGauge: noop, onTasks: noop,
    others: more.others, onSearch: () => { calls.push('palette:all'); },
    onSettings: () => { calls.push('settings'); }, historyOpen: more.historyOpen ?? false, onHistory: () => { calls.push('history'); },
    history: createElement('p', { className: 'the-history' }, 'HISTORIQUE'),
    side: { open: true, width: 400 }, onSide: noop, kept, code: null,
    children: createElement('p', { className: 'the-thread' }, 'FIL'),
  }));
});
const top = () => page.querySelector('.vc-top') as HTMLElement;
const byText = (s: string) => [...page.querySelectorAll('button')].find((b) => b.textContent === s);

it('VibeCoder : l\'en-tête de la vue C — les robots (others) à gauche, puis la branche une seule fois ; Chercher à droite', async () => {
  await draw({ others: createElement('div', { className: 'the-robots' }) });
  const ident = top().querySelector('.vc-ident')!;
  expect(ident.firstElementChild?.className).toBe('the-robots');
  expect(top().querySelector('.vc-name')).toBeNull();
  expect(top().querySelectorAll('.vc-branch')).toHaveLength(0); // pas de dépôt dans ce relevé
  expect(top().querySelector('.vc-tools .vc-search')?.textContent).toBe(`${fr.search}${fr.searchKeys}`);
  expect(ident.querySelector('.vc-search')).toBeNull();
});

it('VibeCoder : sans relevé des agents, le nom de l\'agent comme avant, sans sélecteur', async () => {
  await draw();
  expect(top().querySelector('.the-robots')).toBeNull();
  expect(top().querySelector('.vc-name')?.textContent).toBe('whisper');
});

it('VibeCoder : Chercher → palette « Tout », ⚙ Réglages → onSettings, plus de retour ni de fermer', async () => {
  calls.length = 0;
  await draw();
  await act(() => { (top().querySelector('.vc-search') as HTMLButtonElement).click(); });
  await act(() => { (byText(fr.settings) as HTMLButtonElement).click(); });
  expect(calls).toEqual(['palette:all', 'settings']);
  expect(top().querySelector(`[aria-label="${fr.close}"]`)).toBeNull();
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
