// @vitest-environment happy-dom
// PromptTools (prompt-tools.tsx) : le micro maintenu (down puis up une fois) donne le clavier à son champ et ne le prend
// pas ; sa phase dans data-phase ; le micro du contexte Mic à défaut ; Envoyer → onSend, grisé par sendDisabled.
import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import { Mic, PromptTools } from '../../prompt-tools';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const fire = (el: Element, type: string) => act(() => { el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true })); });

it('le micro du contexte : le clavier à son champ, down puis up une seule fois ; Envoyer', async () => {
  const calls: string[] = [];
  const field = createRef<HTMLTextAreaElement>();
  await act(() => root.render(createElement(Mic.Provider, { value: { phase: 'recording', down: () => calls.push('down'), up: () => calls.push('up') } },
    createElement('textarea', { ref: field }),
    createElement(PromptTools, { t: t('fr'), field, onSend: () => calls.push('send') }))));
  const mic = page.querySelector('.vc-mic')!;
  expect(mic.getAttribute('data-phase')).toBe('idle'); // pas tenu : au repos
  const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  mic.dispatchEvent(down);
  expect(down.defaultPrevented).toBe(true);
  await fire(mic, 'pointerdown');
  expect(document.activeElement).toBe(field.current);
  expect(mic.getAttribute('data-phase')).toBe('recording');
  await fire(mic, 'pointerup'); await fire(mic, 'pointerleave');
  await act(async () => (page.querySelector('.vc-send') as HTMLElement).click());
  expect(calls).toEqual(['down', 'up', 'send']);
});

it('sans micro : Envoyer seul, grisé par sendDisabled', async () => {
  await act(() => root.render(createElement(PromptTools, { t: t('fr'), onSend: () => {}, sendDisabled: true })));
  expect(page.querySelector('.vc-mic')).toBeNull();
  expect((page.querySelector('.vc-send') as HTMLButtonElement).disabled).toBe(true);
});

it('deux micros sous un même contexte : seul celui qu\'on tient montre la phase, jusqu\'à idle', async () => {
  const view = (phase: 'idle' | 'recording' | 'transcribing') => createElement(Mic.Provider, { value: { phase, down: () => {}, up: () => {} } },
    createElement(PromptTools, { t: t('fr'), onSend: () => {} }), createElement(PromptTools, { t: t('fr'), onSend: () => {} }));
  const phases = () => [...page.querySelectorAll('.vc-mic')].map((m) => m.getAttribute('data-phase'));
  await act(() => root.render(view('idle')));
  await fire(page.querySelectorAll('.vc-mic')[1], 'pointerdown');
  await act(() => root.render(view('recording')));
  expect(phases()).toEqual(['idle', 'recording']);
  expect(page.querySelectorAll('.vc-mic')[0].getAttribute('title')).toBe(t('fr').micHold);
  await fire(page.querySelectorAll('.vc-mic')[1], 'pointerup');
  await act(() => root.render(view('transcribing')));
  expect(phases()).toEqual(['idle', 'transcribing']);
  await act(() => root.render(view('idle')));
  expect(phases()).toEqual(['idle', 'idle']);
});
