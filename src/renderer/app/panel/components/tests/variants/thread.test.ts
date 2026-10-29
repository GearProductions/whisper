// @vitest-environment happy-dom
// Variant du fil (note 0.13.0, « Épurer encore ») : seul un message de l'agent
// passe en Markdown ; celui de l'utilisateur (ou une sortie de commande) reste
// le texte tel quel.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { ThreadContent, type ThreadActions } from 'app/panel/components';
import type { Message, Thread } from 'technicals/bridge';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const noop: ThreadActions = { openLink() {}, showFile() {}, listen() {}, copy: async () => true, zoom() {}, answer: () => true };

async function shown(role: Message['role']) {
  const data: Thread = { mode: 'full', key: 'k', live: false, name: 'Agent', color: '#888', title: 'T', status: 'idle',
    messages: [{ role, text: 'du **gras**', time: 0 }] };
  const page = document.createElement('div');
  const root = createRoot(page);
  await act(async () => { root.render(createElement(ThreadContent, { data, act: noop })); });
  const body = page.querySelector('.body')!;
  act(() => root.unmount());
  return body;
}

it('l’agent en Markdown, les autres en texte', async () => {
  // l'agent : le gras rendu
  expect((await shown('assistant')).querySelector('strong')?.textContent).toBe('gras');
  // l'utilisateur et une sortie de commande : les ** affichés
  for (const role of ['user', 'system'] as const) expect((await shown(role)).textContent).toBe('du **gras**');
});
