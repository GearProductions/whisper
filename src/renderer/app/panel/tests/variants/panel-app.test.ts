// @vitest-environment happy-dom
// PanelApp (panel-app.tsx), la dictée : insérée dans la zone de texte qui a le clavier (son onChange
// suit), rien au-delà de sa longueur ; aucune zone, un <input> ou un éditeur CodeMirror : au champ
// de la conversation.
import { EditorView } from '@codemirror/view';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { DRAFT_MAX } from 'core/vibecoder';
import type { ConvApi } from 'technicals/bridge';
import { PanelApp } from '../../panel-app';

// Le micro et le bip : un flux et un enregistrement factices, assez longs et forts pour être transcrits.
vi.mock('technicals/audio', async (orig) => ({
  ...(await orig<typeof import('technicals/audio')>()),
  openMic: async () => ({ getTracks: () => [] }),
  record: () => ({ chunks: [new Float32Array(16000).fill(0.5)], length: 16000, peak: 0.5, release() {} }),
  beep: () => {},
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Le pont : chaque on…(cb) retient son rappel ; le reste ne fait rien.
const on: Record<string, (v: unknown) => void> = {};
const own: Record<string, unknown> = {}; // les méthodes qu'un test remplace
const conv = new Proxy({}, {
  get: (_, k: string) => k in own ? own[k] : (cb: (v: unknown) => void) => { if (k.startsWith('on')) on[k] = cb; return Promise.resolve(null); },
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
// VibeCoder, seul écran : la conversation de a1 et son relevé arrivent, le champ est monté.
await act(() => {
  on.onThread({ key: 'a1', live: true, name: 'A', color: '#fff', title: 't', status: 'idle', messages: [] });
  on.onVibe({ lang: 'fr', agentId: 'a1', steps: [], actions: [], runs: [], processes: [], commits: [], agent: {}, time: 0, flow: 'create', repo: { branch: 'master', base: 'master', changed: 0 } });
});
const input = page.querySelector<HTMLTextAreaElement>('#message')!;
// Une dictée de bout en bout : le micro (#mic) maintenu puis relâché, whisper rend `text`.
const dictate = async (text: string) => {
  own.getConfig = () => Promise.resolve({});
  own.transcribe = () => Promise.resolve({ ok: true, text });
  const mic = page.querySelector('#mic')!;
  await act(async () => { mic.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
  await act(async () => { mic.dispatchEvent(new Event('pointerup', { bubbles: true })); });
};
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

// Le dépôt sur la page : un fichier extérieur rejoint la conversation (le pont lit son chemin),
// sauf sous [data-own-drop] ; un glisser interne de l'arborescence (aucun File) ne joint rien.
const dropOn = (target: Element, files: File[]) => act(async () => {
  const e = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'dataTransfer', { value: { files } });
  target.dispatchEvent(e);
});

it('un fichier lâché hors de l\'arborescence est joint ; sous [data-own-drop] ou en glisser interne, rien', async () => {
  const asked: File[] = [];
  own.pathFor = (f: File) => { asked.push(f); return `/tmp/${f.name}`; };
  await act(() => {
    on.onThread({ key: 'a1', live: true, name: 'A', color: '#fff', title: 't', status: 'idle', messages: [] });
  });
  const tree = page.appendChild(document.createElement('div'));
  tree.setAttribute('data-own-drop', '');
  const row = tree.appendChild(document.createElement('span'));
  const file = new File(['x'], 'a.md');

  await dropOn(row, [file]);
  expect(asked).toEqual([]);
  await dropOn(row, []);   // un artefact glissé dans l'arborescence
  await dropOn(document.body, []);   // le même, lâché hors de l'arborescence
  expect(asked).toEqual([]);
  await dropOn(document.body, [file]);
  expect(asked).toEqual([file]);
  tree.remove();
});

it('la conversation d\'un autre agent avant son relevé : l\'écran d\'avant reste (pas de page vide), rien ne plante', async () => {
  await act(() => { on.onThread({ key: 'a2', live: true, name: 'B', color: '#fff', title: 't', status: 'idle', messages: [] }); });
  expect(page.querySelector('.vc')).not.toBeNull();
  await act(() => { (on.onFocusInput as () => void)(); });   // le focus du champ, demandé avant que l'écran soit là
});
