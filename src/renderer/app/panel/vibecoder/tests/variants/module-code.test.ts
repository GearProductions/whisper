// @vitest-environment happy-dom
// ModuleCode (module-code.tsx) : l'arbre marque un fichier supprimé ; choisi, son diff depuis la base
// tout en retraits, sans sélecteur, ni éditeur modifiable, ni Enregistrer ; un fichier changé : le
// sélecteur (DiffPicker) et l'éditeur avec Enregistrer ; readOnly : lecture seule, sans pied ;
// noTree : sans la rangée des fichiers quand il n'y en a qu'un ; first 'base' : le diff depuis la base d'abord.
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeCode, VibeModule } from 'technicals/bridge';
import type { Drafts } from '../../file-draft';
import { ModuleCode } from '../../module-code';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const m: VibeModule = {
  path: 'src/x', contract: '', file: null, touched: true, commits: [],
  files: [{ id: 'm1/0', path: 'src/x/gone.ts', deleted: true }, { id: 'm1/1', path: 'src/x/kept.ts' }],
};

function mount(extra: Partial<Parameters<typeof ModuleCode>[0]> = {}, mod: VibeModule = m) {
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  const followed: (string | null)[] = [];
  const Probe = ({ code, readOnly }: { code: VibeCode | null; readOnly?: string }) => createElement(ModuleCode, {
    ...extra, m: mod, code, t: t('fr'), lang: 'fr', open: true, onFollow: (id) => { followed.push(id); },
    onSave: async () => true, drafts: useState<Drafts>({}), readOnly,
  });
  const render = (code: VibeCode | null, readOnly?: string) => act(() => { root.render(createElement(Probe, { code, readOnly })); });
  const saveButton = () => [...page.querySelectorAll('button')].find((b) => b.textContent === 'Enregistrer');
  return { page, render, followed, saveButton };
}

it('un fichier supprimé : marqué, son diff depuis la base, ni sélecteur, ni éditeur, ni Enregistrer', async () => {
  const v = mount();
  await v.render(null);
  expect(v.followed).toEqual(['m1/0']);
  const gone = v.page.querySelector('.vc-mod-tree button[aria-current]')!;
  expect(gone.querySelector('.vc-mod-gone')?.textContent).toBe('supprimé');
  await v.render({ id: 'm1/0', text: null, time: 1, at: { base: 'a\nb', head: 'a\nb' } });
  expect(v.page.querySelector('select.vc-mod-shown')).toBeNull();
  expect(v.saveButton()).toBeUndefined();
  expect(v.page.querySelector('.vc-empty')).toBeNull();          // pas « fichier trop gros »
  const editors = [...v.page.querySelectorAll('.cm-editor')].map((e) => EditorView.findFromDOM(e as HTMLElement)!);
  expect(editors).toHaveLength(1);
  expect(v.page.querySelector('.vc-mdiff')).not.toBeNull();
  expect(editors[0].state.readOnly).toBe(true);
  expect(editors[0].state.doc.toString()).toBe('');             // after : rien, tout en retraits
});

it('un fichier changé : pas marqué, le sélecteur et l\'éditeur avec Enregistrer', async () => {
  const v = mount();
  await v.render(null);
  await act(() => { ([...v.page.querySelectorAll('.vc-mod-tree button')][1] as HTMLButtonElement).click(); });
  expect(v.followed.at(-1)).toBe('m1/1');
  expect(v.page.querySelector('.vc-mod-tree button[aria-current] .vc-mod-gone')).toBeNull();
  await v.render({ id: 'm1/1', text: 'a', time: 1, at: { base: null, head: 'a' } });
  expect(v.page.querySelector('select.vc-mod-shown')).not.toBeNull();
  expect(v.saveButton()).toBeDefined();
  const editor = EditorView.findFromDOM(v.page.querySelector('.cm-editor') as HTMLElement)!;
  expect(editor.state.readOnly).toBe(false);
  expect(v.saveButton()!.closest('.vc-src-tools .vc-mod-code-foot')).not.toBeNull(); // le pied dans la rangée d'outils
});

it('readOnly : l\'éditeur en lecture seule, ni Enregistrer ni Abandonner', async () => {
  const v = mount();
  await v.render(null, 'Lecture seule');
  await act(() => { ([...v.page.querySelectorAll('.vc-mod-tree button')][1] as HTMLButtonElement).click(); });
  await v.render({ id: 'm1/1', text: 'a', time: 1, at: { base: null, head: 'a' } }, 'Lecture seule');
  expect(EditorView.findFromDOM(v.page.querySelector('.cm-editor') as HTMLElement)!.state.readOnly).toBe(true);
  expect(v.saveButton()).toBeUndefined();
  expect(v.page.querySelector('.vc-mod-code-foot')).toBeNull();
});

const one: VibeModule = { ...m, files: [{ id: 'm1/1', path: 'src/x/kept.ts' }] };

it('noTree : sans la rangée des fichiers quand il n\'y en a qu\'un, gardée quand il y en a plusieurs', async () => {
  const solo = mount({ noTree: true }, one);
  await solo.render({ id: 'm1/1', text: 'a', time: 1, at: { base: 'b', head: 'a' } });
  expect(solo.page.querySelector('.vc-mod-tree')).toBeNull();
  expect(solo.page.querySelector('select.vc-mod-shown')).not.toBeNull();
  expect(solo.followed).toEqual(['m1/1']);
  const many = mount({ noTree: true });
  await many.render(null);
  expect(many.page.querySelector('.vc-mod-tree')).not.toBeNull();
});

it('first base : s\'ouvre sur le diff depuis la base ; grisé (pas de base), le fichier', async () => {
  const v = mount({ first: 'base' }, one);
  await v.render({ id: 'm1/1', text: 'a', time: 1, at: { base: 'b', head: 'a' } });
  expect((v.page.querySelector('select.vc-mod-shown') as HTMLSelectElement).value).toBe('base');
  expect(v.page.querySelector('.vc-mdiff')).not.toBeNull();
  const noBase = mount({ first: 'base' }, one);
  await noBase.render({ id: 'm1/1', text: 'a', time: 1, at: { base: null, head: 'a' } });
  expect((noBase.page.querySelector('select.vc-mod-shown') as HTMLSelectElement).value).toBe('file');
  expect(noBase.page.querySelector('.vc-mdiff')).toBeNull();
  const plain = mount({}, one);
  await plain.render({ id: 'm1/1', text: 'a', time: 1, at: { base: 'b', head: 'a' } });
  expect((plain.page.querySelector('select.vc-mod-shown') as HTMLSelectElement).value).toBe('file');
});
