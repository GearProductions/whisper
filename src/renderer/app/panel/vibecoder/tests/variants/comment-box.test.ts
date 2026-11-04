// @vitest-environment happy-dom
// comment-box (comment-box.tsx) : le texte borné à DRAFT_MAX, Ctrl+Entrée valide, Échap annule ; pas de Joindre
// (un commentaire va au brouillon de revue, sans pièces).
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { DRAFT_MAX, t } from 'core/vibecoder';
import { CommentBox } from '../../comment-box';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.body.appendChild(document.createElement('div'));
const root = createRoot(page);
const show = (props: Record<string, unknown> = {}) => act(async () => {
  root.render(createElement(CommentBox, { t: t('fr'), onSave() {}, onCancel() {}, ...props }));
});
const type = async (value: string) => {
  const ta = page.querySelector('textarea')!;
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(ta, value);
  await act(async () => { ta.dispatchEvent(new Event('input', { bubbles: true })); });
};
const key = (init: KeyboardEventInit) => act(async () => { page.querySelector('textarea')!.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })); });

it('a le focus ; Ctrl+Entrée valide le texte, Échap annule ; le texte est borné', async () => {
  const calls: string[] = [];
  await show({ onSave: (s: string) => calls.push(`save:${s.length}`), onCancel: () => calls.push('cancel') });
  expect(document.activeElement).toBe(page.querySelector('textarea'));
  await type('x'.repeat(DRAFT_MAX + 50));
  await key({ key: 'Enter', ctrlKey: true });
  await key({ key: 'Escape' });
  expect(calls).toEqual([`save:${DRAFT_MAX}`, 'cancel']);
});

it('pas de pièces jointes : rien pour joindre', async () => {
  await show();
  expect(page.querySelector('.vc-attach')).toBeNull();
  expect(page.querySelector('.piece')).toBeNull();
});
