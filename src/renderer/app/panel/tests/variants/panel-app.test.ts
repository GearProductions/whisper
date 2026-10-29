// @vitest-environment happy-dom
// PanelApp (panel-app.tsx), la dictée : insérée dans la zone de texte qui a le clavier (son onChange
// suit), rien au-delà de sa longueur ; aucune zone, un <input> ou un éditeur CodeMirror : au champ
// de la conversation.
import { EditorView } from '@codemirror/view';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { DRAFT_MAX } from 'core/vibecoder';
import type { ConvApi } from 'technicals/bridge';
import { PanelApp } from '../../panel-app';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Le pont : chaque on…(cb) retient son rappel ; le reste ne fait rien.
const on: Record<string, (v: unknown) => void> = {};
const conv = new Proxy({}, {
  get: (_, k: string) => (cb: (v: unknown) => void) => { if (k.startsWith('on')) on[k] = cb; return Promise.resolve(null); },
}) as unknown as ConvApi;

// happy-dom n'a pas execCommand : insérer à la place de la sélection, comme Chromium.
const inserted: string[] = [];
document.execCommand = (_cmd: string, _ui?: boolean, text = '') => {
  const f = document.activeElement as HTMLTextAreaElement;
  inserted.push(text);
  f.setRangeText(text, f.selectionStart, f.selectionEnd, 'end');
  f.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
};

const page = document.body.appendChild(document.createElement('div'));
await act(() => { createRoot(page).render(createElement(PanelApp, { conv })); });
const input = page.querySelector<HTMLTextAreaElement>('#message')!;
const dictate = (text: string) => act(() => { on.onDictation(text); });
const area = (value = '', maxLength?: number) => {
  const f = document.body.appendChild(document.createElement('textarea'));
  f.value = value;
  if (maxLength !== undefined) f.maxLength = maxLength;
  f.focus();
  f.setSelectionRange(value.length, value.length);
  return f;
};

it('aucune zone de texte n\'a le clavier : la dictée va au champ de la conversation', async () => {
  (document.activeElement as HTMLElement | null)?.blur();
  await dictate('bonjour');
  expect(input.value).toBe('bonjour');
});

it('une zone de texte a le clavier : la dictée s\'y insère, son onChange suit', async () => {
  const f = area('Salut');
  let changed = '';
  f.addEventListener('input', () => { changed = f.value; });
  await dictate('toi');
  expect(f.value).toBe('Salut toi');
  expect(changed).toBe('Salut toi');
  expect(input.value).toBe('bonjour');
  f.remove();
});

it('une zone de commentaire à sa limite : rien au-delà de DRAFT_MAX, rien perdu ailleurs', async () => {
  const f = area('x'.repeat(DRAFT_MAX), DRAFT_MAX);
  inserted.length = 0;
  await dictate('encore');
  expect(inserted).toEqual([]);
  expect(f.value).toHaveLength(DRAFT_MAX);
  expect(input.value).toBe('bonjour');
  f.value = 'x'.repeat(DRAFT_MAX - 3);
  f.setSelectionRange(f.value.length, f.value.length);
  await dictate('encore');
  expect(f.value).toHaveLength(DRAFT_MAX);
  f.remove();
});

it('un <input> ou un éditeur CodeMirror a le clavier : la dictée va au champ de la conversation', async () => {
  const one = document.body.appendChild(document.createElement('input'));
  one.focus();
  expect(document.activeElement).toBe(one);
  await dictate('un');
  expect(one.value).toBe('');
  const cm = new EditorView({ doc: 'note', parent: document.body.appendChild(document.createElement('div')) });
  cm.contentDOM.focus();
  expect(document.activeElement).toBe(cm.contentDOM);
  await dictate('deux');
  expect(cm.state.doc.toString()).toBe('note');
  expect(input.value).toBe('bonjour un deux');
});
