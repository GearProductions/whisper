// @vitest-environment happy-dom
// ModuleDiffView (module-diff-view.tsx) : en lecture seule dans les deux modes ; recréé
// quand une prop change ; replié autour des changements, « N lignes inchangées » d'après lang.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { expect, it } from 'vitest';
import { ModuleDiffView } from '../../module-diff-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount() {
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  const render = (props: Parameters<typeof ModuleDiffView>[0]) => act(() => { root.render(createElement(ModuleDiffView, props)); });
  const views = () => [...page.querySelectorAll('.cm-editor')].map((e) => EditorView.findFromDOM(e as HTMLElement)!);
  return { page, render, views };
}

const lines = (n: number, last: string) => [...Array.from({ length: n }, (_, i) => `l${i}`), last].join('\n');

it('en lecture seule, en ligne comme côte à côte', async () => {
  const v = mount();
  await v.render({ before: 'a', after: 'b', path: 'src/a.ts', mode: 'inline', lang: 'fr' });
  expect(v.views()).toHaveLength(1);
  await v.render({ before: 'a', after: 'b', path: 'src/a.ts', mode: 'split', lang: 'fr' });
  expect(v.views()).toHaveLength(2);
  for (const view of v.views()) {
    expect(view.state.readOnly).toBe(true);
    expect(view.contentDOM.contentEditable).toBe('false');
  }
});

it('recréé quand le texte change', async () => {
  const v = mount();
  await v.render({ before: 'a', after: 'b', path: 'src/a.ts', mode: 'inline', lang: 'fr' });
  await v.render({ before: 'a', after: 'c', path: 'src/a.ts', mode: 'inline', lang: 'fr' });
  expect(v.views().map((x) => x.state.doc.toString())).toEqual(['c']);
});

it('les lignes inchangées repliées, le libellé d’après lang', async () => {
  const v = mount();
  await v.render({ before: lines(20, 'x'), after: lines(20, 'y'), path: 'src/a.ts', mode: 'inline', lang: 'fr' });
  expect(v.page.querySelector('.cm-collapsedLines')?.textContent).toMatch(/^\d+ lignes inchangées$/);
  await v.render({ before: lines(20, 'x'), after: lines(20, 'y'), path: 'src/a.ts', mode: 'split', lang: 'en' });
  expect(v.page.querySelector('.cm-collapsedLines')?.textContent).toMatch(/^\d+ unchanged lines$/);
});
