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
