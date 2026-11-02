// @vitest-environment happy-dom
// ContextMenu (context-menu.tsx) : posé au point, recalé près d'un bord ; le choix appelle onPick puis onClose ;
// un grisé ne choisit rien ; Échap et un clic ailleurs ferment (un clic dedans non) ; flèches (grisés sautés) et Entrée.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it } from 'vitest';
import { ContextMenu } from '../../context-menu';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const entries = [{ id: 'a', label: 'Ouvrir' }, { id: 'b', label: 'Copier', disabled: true }, { id: 'c', label: 'Supprimer' }];

let calls: string[] = [];
beforeEach(() => { calls = []; act(() => root.render(null)); });
const draw = (x = 10, y = 20) => act(() => {
  root.render(createElement(ContextMenu, { x, y, entries, onPick: (id) => calls.push(`pick ${id}`), onClose: () => calls.push('close') }));
});
const menu = () => page.querySelector<HTMLElement>('[role=menu]')!;
const item = (text: string) => [...page.querySelectorAll('button')].find((b) => b.textContent === text)!;
const key = (k: string) => act(() => { (document.activeElement ?? document.body).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); });

it('posé au point ; le premier choix actif a le focus', async () => {
  await draw(30, 40);
  expect([menu().style.left, menu().style.top]).toEqual(['30px', '40px']);
  expect(document.activeElement).toBe(item('Ouvrir'));
});

it('gardé dans le panneau : un point hors cadre est recalé, jamais en négatif', async () => {
  const [w, h] = ['offsetWidth', 'offsetHeight'].map((k) => Object.getOwnPropertyDescriptor(HTMLElement.prototype, k));
  Object.defineProperty(HTMLElement.prototype, 'offsetWidth', { configurable: true, get: () => 100 });
  Object.defineProperty(HTMLElement.prototype, 'offsetHeight', { configurable: true, get: () => 60 });
  try {
    await draw(window.innerWidth + 50, window.innerHeight + 50);
    expect([menu().style.left, menu().style.top]).toEqual([`${window.innerWidth - 100}px`, `${window.innerHeight - 60}px`]);
  } finally {
    for (const [k, d] of [['offsetWidth', w], ['offsetHeight', h]] as const) d ? Object.defineProperty(HTMLElement.prototype, k, d) : delete (HTMLElement.prototype as never)[k];
  }
});

it('le choix : onPick(id) puis onClose ; un grisé ne choisit rien', async () => {
  await draw();
  await act(async () => item('Copier').click());
  expect(calls).toEqual([]);
  await act(async () => item('Supprimer').click());
  expect(calls).toEqual(['pick c', 'close']);
});

it('Échap ferme ; un clic ailleurs ferme, un clic dans le menu non', async () => {
  await draw();
  await act(async () => { menu().dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
  expect(calls).toEqual([]);
  await key('Escape');
  await act(async () => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
  expect(calls).toEqual(['close', 'close']);
});

it('flèches (le grisé sauté, on reboucle) et Entrée choisit', async () => {
  await draw();
  await key('ArrowDown');
  expect(document.activeElement).toBe(item('Supprimer'));
  await key('ArrowDown');
  expect(document.activeElement).toBe(item('Ouvrir'));
  await key('ArrowUp');
  expect(document.activeElement).toBe(item('Supprimer'));
  await key('Enter');
  expect(calls).toEqual(['pick c', 'close']);
});
