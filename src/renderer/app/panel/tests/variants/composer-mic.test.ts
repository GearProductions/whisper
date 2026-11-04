// @vitest-environment happy-dom
// Composer, le bouton Dicter (#mic), celui du contexte Mic : appui = down, relâchement ou sortie = up (une fois) ;
// sa phase est dans data-phase et le title.
import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import type { Phase } from 'core/dictation';
import { Composer } from '../../components/composer';
import { Mic } from '../../vibecoder';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount(phase: Phase, onMicDown = vi.fn(), onMicUp = vi.fn()) {
  const host = document.createElement('div');
  document.body.append(host);
  const noop = () => {};
  act(() => createRoot(host).render(createElement(Mic.Provider, { value: { phase, down: onMicDown, up: onMicUp } }, createElement(Composer, {
    draft: { text: '', pieces: [] }, setText: noop, removePiece: noop, live: true, name: 'A', busy: false, sending: false,
    status: '', setStatus: noop, dir: '', commands: new Map(), probe: () => Promise.resolve({}), onSend: noop, onAttach: noop,
    onFiles: noop, input: createRef<HTMLTextAreaElement>(),
  }))));
  return { mic: host.querySelector('#mic')!, onMicDown, onMicUp };
}
const fire = (el: Element, type: string) => act(() => { el.dispatchEvent(new Event(type, { bubbles: true })); });

it('maintenu, il dicte : down puis up, une seule fois même si le pointeur sort', () => {
  const { mic, onMicDown, onMicUp } = mount('idle');
  fire(mic, 'pointerdown');
  expect(onMicDown).toHaveBeenCalledTimes(1);
  fire(mic, 'pointerleave'); fire(mic, 'pointerup');
  expect(onMicUp).toHaveBeenCalledTimes(1);
});

it('sans appui, rien à relâcher', () => {
  const { mic, onMicUp } = mount('idle');
  fire(mic, 'pointerleave');
  expect(onMicUp).not.toHaveBeenCalled();
});

it('montre sa phase', () => {
  expect(mount('recording').mic.getAttribute('data-phase')).toBe('recording');
  expect(mount('transcribing').mic.getAttribute('title')).toBe('Transcrit…');
});
