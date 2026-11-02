// @vitest-environment happy-dom
// ConfirmBox (confirm-box.tsx) : le focus est sur Annuler ; Échap, Annuler et le fond annulent sans jamais confirmer ;
// seul un clic sur Confirmer appelle onConfirm ; les 5 premiers éléments, puis « … ».
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { ConfirmBox } from '../../confirm-box';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(items: string[]) {
  const page = document.createElement('div');
  document.body.append(page);
  const onConfirm = vi.fn(), onCancel = vi.fn();
  await act(() => createRoot(page).render(createElement(ConfirmBox, { message: 'Supprimer ?', items, confirm: 'Supprimer', cancel: 'Annuler', onConfirm, onCancel })));
  return { page, onConfirm, onCancel, buttons: () => [...page.querySelectorAll('button')] };
}

it('Annuler porte le focus ; Échap annule sans confirmer', async () => {
  const m = await mount(['a.md']);
  expect(document.activeElement).toBe(m.buttons()[0]);
  expect(m.buttons()[0].textContent).toBe('Annuler');
  await act(() => { m.buttons()[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  expect(m.onCancel).toHaveBeenCalledOnce();
  expect(m.onConfirm).not.toHaveBeenCalled();
});

it('Annuler et le fond annulent ; seul Confirmer confirme', async () => {
  const m = await mount([]);
  await act(() => { m.buttons()[0].click(); });
  await act(() => { (m.page.querySelector('.vc-confirm-back') as HTMLElement).click(); });
  await act(() => { (m.page.querySelector('.vc-confirm') as HTMLElement).click(); });
  expect(m.onCancel).toHaveBeenCalledTimes(2);
  expect(m.onConfirm).not.toHaveBeenCalled();
  await act(() => { m.buttons()[1].click(); });
  expect(m.onConfirm).toHaveBeenCalledOnce();
});

it('les premiers éléments, puis « … »', async () => {
  const few = await mount(['a', 'b']);
  expect([...few.page.querySelectorAll('li')].map((l) => l.textContent)).toEqual(['a', 'b']);
  const many = await mount(['1', '2', '3', '4', '5', '6', '7']);
  expect([...many.page.querySelectorAll('li')].map((l) => l.textContent)).toEqual(['1', '2', '3', '4', '5', '…']);
});
