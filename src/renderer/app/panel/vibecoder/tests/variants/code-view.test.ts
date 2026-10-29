// @vitest-environment happy-dom
// CodeView (code-view.tsx) : Ctrl+S → onSave, sauf grisé ; le code changé par les props
// remplace le document ; 💬 cite les lignes entières de la sélection ; fix false : 💬 seul ; .cm-scroller défile, pas .vc-src.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { expect, it } from 'vitest';
import { CodeView } from '../../code-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount() {
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  const render = (props: Parameters<typeof CodeView>[0]) => act(() => { root.render(createElement(CodeView, props)); });
  const view = () => EditorView.findFromDOM(page.querySelector('.cm-editor') as HTMLElement)!;
  const ctrlS = () => act(() => {
    page.querySelector('.cm-content')!.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
  });
  return { page, render, view, ctrlS };
}

it('Ctrl+S enregistre, sauf grisé', async () => {
  const saved: number[] = [];
  const edit = (locked: string | null) => ({ locked, onChange: () => {}, onSave: () => saved.push(1) });
  const v = mount();
  await v.render({ code: 'a', path: 'src/a.ts', edit: edit(null) });
  await v.ctrlS();
  expect(saved).toHaveLength(1);
  await v.render({ code: 'a', path: 'src/a.ts', edit: edit('une course') });
  await v.ctrlS();
  expect(saved).toHaveLength(1);
  expect(v.view().state.readOnly).toBe(true);
  expect(v.page.querySelector('.vc-src')!.getAttribute('title')).toBe('une course');
});

it('le code changé par les props remplace le document, sans le renvoyer à onChange', async () => {
  const typed: string[] = [];
  const v = mount();
  const edit = { locked: null, onChange: (t: string) => typed.push(t), onSave: () => {} };
  await v.render({ code: 'un', path: 'src/a.ts', edit });
  await v.render({ code: 'deux', path: 'src/a.ts', edit });
  expect(v.view().state.doc.toString()).toBe('deux');
  expect(typed).toEqual([]);
  await act(() => { v.view().dispatch({ changes: { from: 4, insert: '!' } }); });
  expect(typed).toEqual(['deux!']);
});

it('💬 cite les lignes entières de la sélection, numérotées depuis from', async () => {
  const quoted: string[] = [];
  const v = mount();
  await v.render({ code: 'l1\nl2\nl3', path: 'src/a.ts', from: 10, onQuote: (b) => quoted.push(b) });
  const button = v.page.querySelector('.vc-tool') as HTMLButtonElement;
  expect(button.disabled).toBe(true);
  expect(v.page.querySelector('.cm-gutterElement:last-child')?.textContent).toBe('12');
  await act(() => { v.view().dispatch({ selection: { anchor: 4, head: 7 } }); });
  await act(() => { button.click(); });
  expect(quoted).toEqual(['l2\nl3']);
});

it("le défilement est celui de l'éditeur : .cm-scroller porte la barre, .vc-src n'est qu'un cadre", async () => {
  const v = mount();
  await v.render({ code: 'a', path: 'src/a.ts' });
  expect(v.page.querySelector('.cm-scroller')!.classList.contains('scroll')).toBe(true);
  expect(v.page.querySelector('.vc-src')!.classList.contains('scroll')).toBe(false);
});

it('fix false : 💬 seul, sans Retour → fixup', async () => {
  const v = mount();
  await v.render({ code: 'a', path: 'src/a.ts', onQuote: () => {} });
  expect(v.page.querySelector('.vc-mini')).not.toBeNull();
  await v.render({ code: 'a', path: 'src/a.ts', onQuote: () => {}, fix: false });
  expect(v.page.querySelector('.vc-tool')).not.toBeNull();
  expect(v.page.querySelector('.vc-mini')).toBeNull();
});
