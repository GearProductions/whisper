// @vitest-environment happy-dom
// NoteEditor (note-editor.tsx) : Ctrl+S → onSave, sauf grisé ; le texte changé par les props
// remplace le document sans revenir à onChange ; 💬 cite son bloc, et suit les blocs tapés.
// Le défilement porté par .cm-scroller (la barre de l'appli sur lui), pas par le cadre.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { expect, it } from 'vitest';
import { NoteEditor } from '../../note-editor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Props = Parameters<typeof NoteEditor>[0];
const base: Props = { text: '', locked: null, tags: [], onChange: () => {}, onSave: () => {}, onOpenLink: () => {} };

function mount() {
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  const render = (props: Partial<Props>) => act(() => { root.render(createElement(NoteEditor, { ...base, ...props })); });
  const view = () => EditorView.findFromDOM(page.querySelector('.cm-editor') as HTMLElement)!;
  const ctrlS = () => act(() => {
    page.querySelector('.cm-content')!.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
  });
  const buttons = () => [...page.querySelectorAll<HTMLButtonElement>('.cm-md-button')];
  return { page, render, view, ctrlS, buttons };
}

it('Ctrl+S enregistre, sauf grisé', async () => {
  const saved: number[] = [];
  const v = mount();
  await v.render({ text: 'a', onSave: () => saved.push(1) });
  await v.ctrlS();
  expect(saved).toHaveLength(1);
  await v.render({ text: 'a', locked: 'une course', onSave: () => saved.push(1) });
  await v.ctrlS();
  expect(saved).toHaveLength(1);
  expect(v.view().state.readOnly).toBe(true);
  expect(v.page.querySelector('.vc-note-editor')!.getAttribute('title')).toBe('une course');
});

it('le texte changé par les props remplace le document, sans le renvoyer à onChange', async () => {
  const typed: string[] = [];
  const v = mount();
  await v.render({ text: 'un', onChange: (t) => typed.push(t) });
  await v.render({ text: 'deux', onChange: (t) => typed.push(t) });
  expect(v.view().state.doc.toString()).toBe('deux');
  expect(typed).toEqual([]);
  await act(() => { v.view().dispatch({ changes: { from: 4, insert: '!' } }); });
  expect(typed).toEqual(['deux!']);
});

it('💬 cite le texte de son bloc, et suit les blocs tapés', async () => {
  const quoted: string[] = [];
  const v = mount();
  await v.render({ text: '# Un **titre**\n\nUn paragraphe.', onQuote: (t) => quoted.push(t) });
  expect(v.buttons()).toHaveLength(2);
  // happy-dom n'a pas de mise en page : le clic tombe sur la première ligne
  await act(() => { v.buttons()[0].click(); });
  expect(quoted).toEqual(['Un titre']);
  // le parent renvoie le texte tapé (onChange → brouillon → text), comme note-view
  let typed = '';
  await v.render({ text: '# Un **titre**\n\nUn paragraphe.', onQuote: (t) => quoted.push(t), onChange: (t) => { typed = t; } });
  await act(() => { v.view().dispatch({ changes: { from: v.view().state.doc.length, insert: '\n\nUn autre.' } }); });
  await v.render({ text: typed, onQuote: (t) => quoted.push(t) });
  expect(v.buttons()).toHaveLength(3);
});

it('sans onQuote, pas de 💬 ; pastilles et liseré sur leurs lignes', async () => {
  const v = mount();
  await v.render({ text: 'a\nb\nc', changed: new Set([1]), tags: [{ line: 2, text: 'inv', title: 'invariant', cls: 'vc-tag' }] });
  expect(v.buttons()).toHaveLength(0);
  expect(v.page.querySelector('.cm-line.vc-changed')?.textContent).toBe('b');
  expect(v.page.querySelector('.vc-tag')?.textContent).toBe('inv');
});

it('le défilement est celui de l\'éditeur (.cm-scroller), pas de son cadre', async () => {
  const v = mount();
  await v.render({ text: 'a' });
  expect(v.view().scrollDOM.classList.contains('scroll')).toBe(true);
  expect(v.page.querySelector('.vc-note-editor')!.classList.contains('scroll')).toBe(false);
});
