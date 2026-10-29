// @vitest-environment happy-dom
// Journey (journey.tsx) : un commit déplié, Voir le diff et GitHub en IconButton (libellé en title et aria-label),
// le même id qu'avant (c<rang>, gh:c<rang>) ; ses fichiers en texte simple, sans bouton.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { Journey } from '../../journey';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

it('commit déplié : diff et GitHub en icônes, mêmes ids ; ses fichiers en texte', async () => {
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  const opened: string[] = [];
  const view = { steps: [], commits: [{ hash: 'aaaaaaa1', subject: 'un', fixup: false, files: ['src/a.ts'] },
    { hash: 'bbbbbbb2', subject: 'deux', fixup: false, files: ['src/b.ts'] }] } as unknown as VibeView;
  const s = t('fr');
  await act(() => root.render(createElement(Journey, { view, t: s, selected: null, onPick: () => {}, onOpen: (id: string) => { opened.push(id); } })));
  await act(() => (page.querySelectorAll('.vc-jcommit')[1] as HTMLButtonElement).click());
  const tools = [...page.querySelectorAll<HTMLButtonElement>('.vc-jcommit-links button')];
  expect(tools.map((b) => [b.className, b.title, b.getAttribute('aria-label'), !!b.querySelector('svg')]))
    .toEqual([['vc-tool', s.diffTitle, s.diffTitle, true], ['vc-tool', s.githubTitle, s.githubTitle, true]]);
  for (const b of tools) await act(() => b.click());
  expect([...page.querySelectorAll('.vc-jfiles li')].map((li) => [li.textContent, !!li.querySelector('button')])).toEqual([['src/b.ts', false]]);
  expect(opened).toEqual(['c1', 'gh:c1']);
  await act(() => root.unmount());
});
