// @vitest-environment happy-dom
// DiffPicker (diff-picker.tsx) : Fichier puis les options passées (une grisée), le choix → onShown ; En ligne · Côte à côte
// seulement avec un diff (mode non null), le mode pressé, un clic → onMode.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { DiffPicker } from '../../diff-picker';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
const root = createRoot(page);
const got: string[] = [];
const options = [{ key: 'base', label: 'Base', disabled: true }, { key: 'head', label: 'Tête' }];
const draw = (shown: string, mode: 'inline' | 'split' | null) => act(() => {
  root.render(createElement(DiffPicker<string>, { options, shown, mode, lang: 'fr',
    onShown: (k) => { got.push(`shown:${k}`); }, onMode: (m) => { got.push(`mode:${m}`); } }));
});

it('DiffPicker : Fichier, les options, une grisée, le choix → onShown ; pas de choix du mode sans diff', async () => {
  await draw('file', null);
  const select = page.querySelector('select.vc-mod-shown') as HTMLSelectElement;
  expect(select.getAttribute('aria-label')).toBe('Ce qui est affiché');
  expect([...select.options].map((o) => [o.value, o.textContent, o.disabled])).toEqual(
    [['file', 'Fichier', false], ['base', 'Base', true], ['head', 'Tête', false]]);
  expect(page.querySelector('.vc-seg')).toBeNull();
  await act(() => { select.value = 'head'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  expect(got.at(-1)).toBe('shown:head');
});

it('DiffPicker : avec un diff, En ligne · Côte à côte, le mode pressé, un clic → onMode', async () => {
  await draw('head', 'inline');
  const seg = page.querySelector('.vc-seg')!;
  expect(seg.getAttribute('aria-label')).toBe('Affichage du diff');
  const buttons = [...seg.querySelectorAll('button')];
  expect(buttons.map((b) => [b.textContent, b.getAttribute('aria-pressed')])).toEqual([['En ligne', 'true'], ['Côte à côte', 'false']]);
  buttons[1].click();
  expect(got.at(-1)).toBe('mode:split');
});
