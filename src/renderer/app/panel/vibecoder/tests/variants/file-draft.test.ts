// @vitest-environment happy-dom
// useFileDraft (file-draft.tsx) : le disque suivi, la modification gardée,
// périmée si le disque change, abandonnée ou enregistrée ; grisé, le disque.
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import type { VibeCode } from 'technicals/bridge';
import { useFileDraft, type Drafts, type FileDraft } from '../../file-draft';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const file = { id: 'm1/0', path: 'src/a.ts' };

function mount(onSave: (id: string, text: string) => Promise<boolean> = async () => true) {
  let d!: FileDraft;
  const root = createRoot(document.createElement('div'));
  const Probe = ({ code, locked }: { code: VibeCode | null; locked: string | null }) => {
    d = useFileDraft(file, code, locked, onSave, useState<Drafts>({}));
    return null;
  };
  const render = (code: VibeCode | null, locked: string | null = null) =>
    act(() => { root.render(createElement(Probe, { code, locked })); });
  return { render, get d() { return d; } };
}

it('suit le disque, garde la modification, périmée quand le disque change, abandonnée', async () => {
  const v = mount();
  await v.render({ id: 'm1/0', text: 'a', time: 1 });
  expect(v.d.text).toBe('a');
  await act(() => v.d.change('b'));
  expect(v.d).toMatchObject({ text: 'b', draft: true, stale: false });
  await v.render({ id: 'm1/0', text: 'c', time: 2 });
  expect(v.d).toMatchObject({ text: 'b', draft: true, stale: true });
  await v.render({ id: 'm1/0', text: 'c', time: 2 }, 'verrou');
  expect(v.d.text).toBe('c');
  await v.render({ id: 'm1/0', text: 'c', time: 2 });
  await act(() => v.d.drop());
  expect(v.d).toMatchObject({ text: 'c', draft: false, stale: false });
});

it('enregistrée : écrite par onSave, supprimée quand le disque la rejoint', async () => {
  const saved: string[] = [];
  const v = mount(async (_, text) => { saved.push(text); return true; });
  await v.render({ id: 'm1/0', text: 'a', time: 1 });
  await act(() => v.d.change('b'));
  await act(() => v.d.save());
  expect(saved).toEqual(['b']);
  await v.render({ id: 'm1/0', text: 'b', time: 2 });
  expect(v.d).toMatchObject({ text: 'b', draft: false });
});

it('un texte poussé pour un autre fichier est ignoré ; sans texte : trop gros', async () => {
  const v = mount();
  await v.render({ id: 'm1/1', text: 'x', time: 1 });
  expect(v.d).toMatchObject({ text: null, tooBig: false });
  await v.render({ id: 'm1/0', text: null, time: 1 });
  expect(v.d).toMatchObject({ text: null, tooBig: true });
});

it('DraftEditor : le pied sous le code, ou dans la rangée d\'outils de CodeView (footInTools)', async () => {
  const { DraftEditor } = await import('../../file-draft');
  const { t } = await import('core/vibecoder');
  const d = { text: 'a', draft: true, stale: false, tooBig: false, change() {}, save: async () => {}, drop() {} } as FileDraft;
  const render = async (footInTools?: boolean) => {
    const div = document.createElement('div');
    await act(() => { createRoot(div).render(createElement(DraftEditor, { d, file, locked: null, t: t('fr'), onQuote: () => {}, footInTools })); });
    return div;
  };
  const under = await render();
  expect(under.querySelector('.vc-src-tools .vc-mod-code-foot')).toBeNull();
  expect(under.querySelector('.vc-mod-code-foot')).not.toBeNull();
  const inTools = await render(true);
  expect(inTools.querySelector('.vc-src-tools .vc-mod-code-foot')).not.toBeNull();
  expect(inTools.querySelectorAll('.vc-mod-code-foot')).toHaveLength(1);
});
