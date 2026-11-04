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
  expect(mic.getAttribute('data-phase')).toBe('recording');
  const down = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
  mic.dispatchEvent(down);
  expect(down.defaultPrevented).toBe(true);
  await fire(mic, 'pointerdown');
  expect(document.activeElement).toBe(field.current);
  await fire(mic, 'pointerup'); await fire(mic, 'pointerleave');
  await act(async () => (page.querySelector('.vc-send') as HTMLElement).click());
  expect(calls).toEqual(['down', 'up', 'send']);
});

it('sans micro : Envoyer seul, grisé par sendDisabled', async () => {
  await act(() => root.render(createElement(PromptTools, { t: t('fr'), onSend: () => {}, sendDisabled: true })));
  expect(page.querySelector('.vc-mic')).toBeNull();
  expect((page.querySelector('.vc-send') as HTMLButtonElement).disabled).toBe(true);
});
