// @vitest-environment happy-dom
// Variant du champ (note 0.13.0, « Épurer encore ») : la pièce jointe et Envoyer
// en icônes gardent leur nom (aria-label, title), leur rappel, l'état désactivé
// et Entrée.
import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { Composer } from 'app/panel/components';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function shown(busy: boolean) {
  const calls: string[] = [];
  const page = document.body.appendChild(document.createElement('div'));
  await act(async () => {
    createRoot(page).render(createElement(Composer, {
      draft: { text: 'salut', pieces: [] }, setText() {}, removePiece() {}, live: true, name: 'Agent', busy, sending: false,
      status: '', setStatus() {}, dir: '/d', commands: new Map(), probe: async () => ({ commands: [] }),
      onSend: () => calls.push('send'), onAttach: () => calls.push('attach'), onFiles() {}, onLayout() {},
      ref: createRef<HTMLElement>(), input: createRef<HTMLTextAreaElement>(),
    }));
  });
  return { page, calls };
}

it('les deux icônes : nommées, leurs rappels, Entrée envoie, désactivé pendant le travail', async () => {
  const { page, calls } = await shown(false);
  const attach = page.querySelector<HTMLButtonElement>('#attach')!;
  const send = page.querySelector<HTMLButtonElement>('#send')!;
  expect([attach.getAttribute('aria-label'), send.getAttribute('aria-label')]).toEqual(['Joindre…', 'Envoyer']);
  expect(attach.title && send.title).toBeTruthy();
  expect(page.querySelector('#composer-row')!.firstElementChild).toBe(attach);
  expect(page.querySelector('#composer-row')!.lastElementChild).toBe(send);
  attach.click();
  send.click();
  page.querySelector('#message')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(calls).toEqual(['attach', 'send', 'send']);
  expect(send.disabled).toBe(false);
  expect((await shown(true)).page.querySelector<HTMLButtonElement>('#send')!.disabled).toBe(true);
});
