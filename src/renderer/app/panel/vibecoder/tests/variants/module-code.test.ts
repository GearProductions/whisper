// @vitest-environment happy-dom
// ModuleCode (module-code.tsx) : l'arbre marque un fichier supprimé ; choisi, son diff depuis la base
// tout en retraits, sans sélecteur, ni éditeur modifiable, ni Enregistrer ; un fichier changé : le
// sélecteur (DiffPicker) et l'éditeur avec Enregistrer.
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

function mount() {
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  const followed: (string | null)[] = [];
  const Probe = ({ code }: { code: VibeCode | null }) => createElement(ModuleCode, {
    m, code, t: t('fr'), lang: 'fr', open: true, onFollow: (id) => { followed.push(id); },
    onSave: async () => true, drafts: useState<Drafts>({}),
  });
  const render = (code: VibeCode | null) => act(() => { root.render(createElement(Probe, { code })); });
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
