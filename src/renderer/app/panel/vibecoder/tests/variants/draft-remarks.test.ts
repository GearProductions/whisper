// @vitest-environment happy-dom
// DraftRemarks (draft-remarks.tsx) : des remarques empilées, grisées, dans l'ordre ; le crayon ouvre la zone sur
// place (Enregistrer → onEdit(id, texte)) ; la croix → onRemove(id) ; target : la cible au-dessus (T-21).
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import { DraftRemarks } from '../../draft-remarks';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.body.appendChild(document.createElement('div'));
const root = createRoot(page);
const remarks = [{ id: 3, target: 'note', text: 'premier' }, { id: 5, target: 'commit', text: 'second' }];
const calls: unknown[] = [];
const show = (props: Record<string, unknown> = {}) => act(async () => {
  root.render(createElement(DraftRemarks, { remarks, t: t('fr'), onEdit: (id: number, text: string) => calls.push(['edit', id, text]),
    onRemove: (id: number) => calls.push(['remove', id]), ...props }));
});
const tool = (label: string, i = 0) => page.querySelectorAll<HTMLButtonElement>(`button.vc-tool[aria-label^="${label}"]`)[i];

it('deux remarques : empilées, grisées, dans l\'ordre', async () => {
  await show();
  const items = [...page.querySelectorAll('li')];
  expect(items.map((li) => li.textContent)).toEqual(['premier', 'second']);
  expect(page.querySelector('ul')!.classList.contains('vc-remarks-muted')).toBe(true);
  expect(page.querySelector('.vc-draft-target')).toBeNull();
});

it('target : la cible de chaque remarque au-dessus de son texte, sans grisé', async () => {
  await show({ target: true });
  expect([...page.querySelectorAll('.vc-draft-target')].map((e) => e.textContent)).toEqual(['note', 'commit']);
  expect(page.querySelector('ul')!.classList.contains('vc-remarks-muted')).toBe(false);
});

it('le crayon : la zone sur place, Enregistrer → onEdit(id, texte)', async () => {
  await show();
  await act(() => tool('Modifier cette remarque', 1).click());
  const ta = page.querySelector('textarea')!;
  expect(page.querySelectorAll('textarea')).toHaveLength(1);
  expect(ta.value).toBe('second');
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(ta, 'changé');
  await act(async () => { ta.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(() => [...page.querySelectorAll<HTMLButtonElement>('button.vc-run')].find((b) => b.textContent === 'Enregistrer')!.click());
  expect(calls).toEqual([['edit', 5, 'changé']]);
  expect(page.querySelector('textarea')).toBeNull();
});

it('la croix : onRemove(id)', async () => {
  calls.length = 0;
  await show();
  await act(() => tool('Retirer du brouillon', 0).click());
  expect(calls).toEqual([['remove', 3]]);
});
