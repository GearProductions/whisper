// @vitest-environment happy-dom
// useArtifactMention (artifact-mention.tsx) : « @ » en début de mot ouvre les artefacts qui correspondent ;
// Entrée ou Tab met dir + nom à la place du « @… » (séparateur de dir) ; Échap ferme ; « a@b.fr » n'ouvre rien ;
// aucune correspondance ou pas de dir : key rend false (« @types/node » se tape et part).
import { act, createElement, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import type { VibeArtifact } from 'technicals/bridge';
import { useArtifactMention } from '../../artifact-mention';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const art = (name: string, i: number) => ({ id: `a${i}`, name, kind: 'markdown', size: 1, time: 1, url: null, truncated: false }) as VibeArtifact;
const ARTS = [art('plan.md', 0), art('docs/spec.md', 1)];

type Api = ReturnType<typeof useArtifactMention>;

async function mount(dir: string) {
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  let api!: Api;
  function Host() {
    const [text, setText] = useState('');
    const input = useRef<HTMLTextAreaElement>(null);
    api = useArtifactMention(ARTS, dir, input, setText);
    return createElement('div', null,
      createElement('textarea', { ref: input, value: text, onChange: (e: { target: { value: string } }) => { setText(e.target.value); api.update(); } }),
      api.list);
  }
  await act(() => root.render(createElement(Host)));
  const ta = page.querySelector('textarea')!;
  const type = async (value: string) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(ta, value); // React ignore un value posé en direct
    ta.setSelectionRange(value.length, value.length);
    await act(() => { ta.dispatchEvent(new Event('input', { bubbles: true })); });
  };
  const press = async (k: string) => {
    let taken = false;
    await act(() => { taken = api.key({ key: k, preventDefault() {}, stopPropagation() {} } as never); });
    return taken;
  };
  return { page, ta, type, press, items: () => [...page.querySelectorAll('.mention .slash-item')].map((b) => b.textContent) };
}

it('« @ » ouvre les correspondances ; Entrée met le chemin (séparateur de dir) et un espace', async () => {
  const m = await mount('/p/artifacts');
  await m.type('lis @p');
  expect(m.items()).toEqual(['plan.md', 'docs/spec.md']);
  expect(await m.press('ArrowDown')).toBe(true);
  expect(await m.press('Enter')).toBe(true);
  expect(m.ta.value).toBe('lis /p/artifacts/docs/spec.md ');
  expect(m.ta.selectionStart).toBe('lis /p/artifacts/docs/spec.md '.length);
  expect(m.items()).toEqual([]);
});

it('dir Windows : le séparateur de dir sert aussi aux sous-dossiers du nom ; Tab choisit', async () => {
  const m = await mount('C:\\p\\artifacts');
  await m.type('@spec');
  expect(await m.press('Tab')).toBe(true);
  expect(m.ta.value).toBe('C:\\p\\artifacts\\docs\\spec.md ');
});

it('Échap ferme et prend la touche ; « a@b.fr » n\'ouvre rien', async () => {
  const m = await mount('/p');
  await m.type('@');
  expect(m.items().length).toBe(2);
  expect(await m.press('Escape')).toBe(true);
  expect(m.items()).toEqual([]);
  await m.type('a@p');
  expect(m.items()).toEqual([]);
  expect(await m.press('Enter')).toBe(false);
});

it('aucune correspondance ou pas de dir : key rend false, le champ garde son texte', async () => {
  const none = await mount('/p');
  await none.type('@types/node');
  expect(none.items()).toEqual([]);
  expect(await none.press('Enter')).toBe(false);
  expect(await none.press('Tab')).toBe(false);
  expect(none.ta.value).toBe('@types/node');
  const nodir = await mount('');
  await nodir.type('@plan');
  expect(nodir.items()).toEqual([]);
  expect(await nodir.press('Enter')).toBe(false);
});

it('le curseur bouge avant le choix : plus de « @ » sous le curseur, rien n\'est écrit et la liste se ferme', async () => {
  const m = await mount('/p');
  await m.type('hello @pl');
  expect(m.items().length).toBe(1);
  m.ta.setSelectionRange(0, 0);
  expect(await m.press('Enter')).toBe(true);
  expect(m.ta.value).toBe('hello @pl');
  expect(m.items()).toEqual([]);
});
