// @vitest-environment happy-dom
// KeptScope / useKept (kept-scope.tsx) : une valeur posée, le composant recréé : retrouvée ;
// même clé sous un autre agent : la valeur initiale ; sans KeptScope : un état ordinaire, rien de gardé.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { createKept, scoped, type Kept } from 'core/vibecoder/kept';
import { KeptScope, useKept } from '../../kept-scope';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Un bouton qui compte : le texte affiche la valeur, un clic l'incrémente.
function Counter() {
  const [n, setN] = useKept('n', 0);
  return createElement('button', { onClick: () => setN(n + 1) }, String(n));
}

async function mount(kept: Kept | null, agent: string) {
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  const counter = createElement(Counter);
  await act(() => root.render(kept ? createElement(KeptScope.Provider, { value: scoped(kept, agent, 'ide') }, counter) : counter));
  const button = page.querySelector('button')!;
  return { text: () => button.textContent, click: () => act(() => { button.click(); }), unmount: () => act(() => root.unmount()) };
}

it('une valeur posée, le composant recréé : retrouvée', async () => {
  const kept = createKept();
  const first = await mount(kept, 'a');
  await first.click(); await first.click();
  expect(first.text()).toBe('2');
  await first.unmount();
  expect((await mount(kept, 'a')).text()).toBe('2');
});

it('même clé sous un autre agent : la valeur initiale', async () => {
  const kept = createKept();
  const first = await mount(kept, 'a');
  await first.click();
  expect((await mount(kept, 'b')).text()).toBe('0');
});

it('sans KeptScope : un état ordinaire, rien de gardé', async () => {
  const first = await mount(null, 'a');
  await first.click();
  expect(first.text()).toBe('1');
  await first.unmount();
  expect((await mount(null, 'a')).text()).toBe('0');
});
