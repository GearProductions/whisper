// @vitest-environment happy-dom
// RenameField (rename-field.tsx) : le nom sélectionné sans son extension ; chaque frappe dite ;
// problem → encart rouge (aria-invalid) et message ; Entrée valide sans problème, rien avec ;
// Échap annule (sans atteindre les autres Échap) ; la perte du focus annule ; une seule fin.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { RenameField } from '../../rename-field';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(initial: string, problem: string | null = null) {
  const log: string[] = [];
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  await act(() => root.render(createElement(RenameField, {
    initial, problem,
    onChange: (n: string) => log.push(`change:${n}`), onDone: (n: string) => log.push(`done:${n}`), onCancel: () => log.push('cancel'),
  })));
  const input = page.querySelector('input')!;
  const key = (k: string) => act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true })); });
  return { page, input, log, key, unmount: () => act(() => root.unmount()) };
}

it('sélectionne le nom sans son extension (un point initial n\'en est pas une)', async () => {
  for (const [initial, end] of [['rapport.md', 7], ['archive.tar.gz', 11], ['.env', 4], ['dossier', 7]] as const) {
    const { input, unmount } = await mount(initial);
    await act(() => input.focus());
    expect([initial, input.selectionStart, input.selectionEnd]).toEqual([initial, 0, end]);
    await unmount();
  }
});

it('problem : encart rouge et message ; sans : ni l\'un ni l\'autre ; Entrée ne valide pas', async () => {
  const ok = await mount('a.md');
  expect(ok.input.hasAttribute('aria-invalid')).toBe(false);
  expect(ok.page.querySelector('.vc-rename-problem')).toBeNull();
  await ok.unmount();
  const ko = await mount('a.md', 'Nom déjà pris');
  expect(ko.input.getAttribute('aria-invalid')).toBe('true');
  expect(ko.page.querySelector('.vc-rename-problem')!.textContent).toBe('Nom déjà pris');
  await ko.key('Enter');
  expect(ko.log).toEqual([]);
  await ko.unmount();
});

it('frappe dite, Entrée valide le nom une seule fois (le blur qui suit ne l\'annule pas)', async () => {
  const { input, log, key, unmount } = await mount('a.md');
  await act(() => input.focus());
  const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!;
  await act(() => { set.call(input, 'b.md'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await key('Enter');
  await act(() => input.blur());
  await key('Enter');
  expect(log).toEqual(['change:b.md', 'done:b.md']);
  await unmount();
});

it('Échap annule sans atteindre les autres Échap ; la perte du focus annule ; une fois', async () => {
  const other: string[] = [];
  const spy = (e: KeyboardEvent) => other.push(e.key);
  document.addEventListener('keydown', spy);
  const a = await mount('a.md');
  await a.key('Escape');
  await act(() => a.input.blur());
  expect([a.log, other]).toEqual([['cancel'], []]);
  await a.unmount();
  document.removeEventListener('keydown', spy);
  const b = await mount('a.md');
  await act(() => b.input.focus());
  await act(() => b.input.blur());
  expect(b.log).toEqual(['cancel']);
  await b.unmount();
});
