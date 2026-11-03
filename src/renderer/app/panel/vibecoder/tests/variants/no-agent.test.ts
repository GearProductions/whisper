// @vitest-environment happy-dom
// NoAgent (no-agent.tsx) : le titre, la phrase et Nouvel agent… (Ctrl+N), qui appelle onAdd.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { t } from 'core/vibecoder';
import { NoAgent } from '../../no-agent';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('Nouvel agent… appelle onAdd', async () => {
  const page = document.createElement('div');
  const onAdd = vi.fn();
  await act(() => createRoot(page).render(createElement(NoAgent, { t: t('fr'), onAdd })));
  expect(page.querySelector('h2')!.textContent).toBe('Aucun agent');
  const b = page.querySelector('button')!;
  expect(b.textContent).toBe('Nouvel agent… Ctrl+N');
  await act(async () => b.click());
  expect(onAdd).toHaveBeenCalledOnce();
});
