// @vitest-environment happy-dom
// PromptField (prompt-field.tsx) : les pièces avec leur ×, Joindre, coller ou déposer des fichiers, les enfants
// au-dessus du cadre, Envoyer grisé, la zone de texte, les id.
import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import type { Piece } from 'core/conversation';
import { t } from 'core/vibecoder';
import { PromptField } from '../../prompt-field';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const file = new File(['x'], 'a.png', { type: 'image/png' });
const pieces: Piece[] = [{ kind: 'file', name: 'a.ts', path: '/p/a.ts' }, { kind: 'selection', text: 'abc', cut: false }];

function show(props: Record<string, unknown> = {}, children?: unknown) {
  const calls: string[] = [];
  const view = createElement(PromptField, {
    t: t('fr'), text: 'bonjour', setText: (s: string) => calls.push(`text:${s}`), pieces,
    onRemove: (p: Piece) => calls.push(`remove:${p.kind}`), onAttach: () => calls.push('attach'),
    onFiles: (f: File[]) => calls.push(`files:${f.map((x) => x.name)}`), onSend: () => calls.push('send'), ...props,
  }, children as never);
  return { calls, render: () => act(() => root.render(view)) };
}
const event = (type: string, extra: Record<string, unknown>) => Object.assign(new Event(type, { bubbles: true, cancelable: true }), extra);

it('les pièces : libellé et ×, qui rapporte la pièce ; Joindre ; la saisie', async () => {
  const { calls, render } = show();
  await render();
  expect([...page.querySelectorAll('.piece span')].map((s) => s.textContent)).toEqual(['📎 a.ts', '❝ Sélection (3 car.)']);
  await act(async () => (page.querySelectorAll('.piece .remove')[1] as HTMLElement).click());
  await act(async () => (page.querySelector('.vc-attach') as HTMLElement).click());
  expect(calls).toEqual(['remove:selection', 'attach']);
  expect((page.querySelector('textarea') as HTMLTextAreaElement).value).toBe('bonjour');
});

it('sans pièce, pas de bande de pièces', async () => {
  await show({ pieces: [] }).render();
  expect(page.querySelector('.vc-pieces')).toBeNull();
});

it('coller ou déposer des fichiers → onFiles ; du texte collé reste au champ', async () => {
  const { calls, render } = show();
  await render();
  const area = page.querySelector('textarea')!;
  const paste = event('paste', { clipboardData: { files: [file] } });
  await act(async () => { area.dispatchEvent(paste); });
  const text = event('paste', { clipboardData: { files: [] } });
  await act(async () => { area.dispatchEvent(text); });
  const drop = event('drop', { dataTransfer: { files: [file] } });
  await act(async () => { page.querySelector('.vc-prompt')!.dispatchEvent(drop); });
  expect(calls).toEqual(['files:a.png', 'files:a.png']);
  expect([paste.defaultPrevented, text.defaultPrevented, drop.defaultPrevented]).toEqual([true, false, true]);
  expect(page.querySelector('.vc-prompt')!.hasAttribute('data-own-drop')).toBe(true);
});

it('les enfants au-dessus du cadre ; Envoyer grisé ; les id ; la zone du caller', async () => {
  const field = createRef<HTMLTextAreaElement>();
  const { calls, render } = show({ sendDisabled: true, ids: true, field, placeholder: 'Écrire…', onKeyDown: () => calls.push('key') },
    createElement('div', { id: 'menu' }));
  await render();
  expect(page.firstElementChild!.id).toBe('menu');
  expect(page.querySelector('#menu')!.nextElementSibling!.className).toBe('vc-prompt');
  expect((page.querySelector('#send') as HTMLButtonElement).disabled).toBe(true);
  expect(page.querySelector('#attach')).not.toBeNull();
  expect(field.current).toBe(page.querySelector('#message'));
  expect(field.current!.placeholder).toBe('Écrire…');
  await act(async () => { field.current!.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true })); });
  expect(calls).toEqual(['key']);
});

it('Envoyer → onSend', async () => {
  const { calls, render } = show();
  await render();
  await act(async () => (page.querySelector('.vc-send') as HTMLElement).click());
  expect(calls).toEqual(['send']);
});

it('une image jointe, pas encore envoyée : un clic l’agrandit (Zoom), comme une image d’un message envoyé', async () => {
  const { Zoom } = await import('../../prompt-field');
  const zoomed: string[] = [];
  const image: Piece = { kind: 'image', name: 'capture.png', type: 'image/png', data: new ArrayBuffer(1), url: 'blob:capture' };
  const view = createElement(Zoom.Provider, { value: (src: string) => zoomed.push(src) },
    createElement(PromptField, { t: t('fr'), text: '', setText: () => {}, pieces: [image], onRemove: () => {}, onSend: () => {} }));
  await act(() => root.render(view));
  page.querySelector<HTMLImageElement>('.vc-pieces img')!.click();
  expect(zoomed).toEqual(['blob:capture']);
});
