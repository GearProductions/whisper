// @vitest-environment happy-dom
// ModuleCode (module-code.tsx) : l'arbre marque un fichier supprimé ; choisi, son diff depuis la base
// tout en retraits, sans sélecteur, ni éditeur modifiable, ni Enregistrer ; un fichier changé : le
// sélecteur (DiffPicker) et l'éditeur avec Enregistrer ; readOnly : lecture seule, sans pied ;
// noTree : sans la rangée des fichiers quand il n'y en a qu'un ; le diff depuis la base d'abord, et le choix
// d'affichage commun à tous les fichiers (d'un fichier à l'autre, d'un ModuleCode à l'autre) ; diff (le menu de
// la vue IDE) : sans sélecteur ni choix commun, le texte d'avant de la base, du dernier commit ou de la validation.
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { getOriginalDoc } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeCode, VibeModule } from 'technicals/bridge';
import type { Drafts } from '../../file-draft';
import { ModuleCode } from '../../module-code';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const m: VibeModule = {
  path: 'src/x', paths: ['src/x'], contract: '', file: null, touched: true, commits: [],
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

// Le diff du menu de la vue IDE (diff) : ni sélecteur ni choice ; le texte d'avant vient de at.base, at.head ou
// at.validations[step] ; absent ou null → '' (tout ajouté) ; un supprimé : tout en retraits depuis la référence.
const beforeOf = (page: HTMLElement) => {
  const first = EditorView.findFromDOM(page.querySelector('.cm-editor') as HTMLElement)!;
  return page.querySelector('.vc-mdiff')!.getAttribute('data-mode') === 'split' ? first.state.doc.toString() : getOriginalDoc(first.state).toString();
};
const afterOf = (page: HTMLElement) => {
  const editors = [...page.querySelectorAll('.cm-editor')].map((e) => EditorView.findFromDOM(e as HTMLElement)!);
  return editors[editors.length - 1].state.doc.toString();
};
const at = { base: 'B', head: 'H', validations: { modules: 'V', forme: 'F' } };

it('diff : le texte d\'avant vient de at.base, at.head ou at.validations[step], sans sélecteur', async () => {
  for (const [shown, step, expected] of [['base', 'modules', 'B'], ['head', 'modules', 'H'], ['validated', 'modules', 'V'], ['validated', 'forme', 'F']] as const) {
    const v = mount({ diff: { shown, mode: 'inline', step } }, one);
    await v.render({ id: 'm1/1', text: 'a', time: 1, at });
    expect(v.page.querySelector('select.vc-mod-shown')).toBeNull();
    expect(v.page.querySelector('.vc-seg')).toBeNull();
    expect(beforeOf(v.page)).toBe(expected);
    expect(afterOf(v.page)).toBe('a');
  }
});

it('diff : validations absentes pour l\'étape, ou référence null : tout ajouté (avant vide)', async () => {
  for (const [shown, code] of [
    ['validated', { base: 'B', head: 'H', validations: { forme: 'F' } }],   // rien pour modules
    ['validated', { base: 'B', head: 'H' }],                                // pas de validations du tout
    ['validated', { base: 'B', head: 'H', validations: { modules: null } }],
    ['base', { base: null, head: 'H' }],
    ['head', { base: 'B', head: null }],
  ] as const) {
    const v = mount({ diff: { shown, mode: 'inline', step: 'modules' } }, one);
    await v.render({ id: 'm1/1', text: 'a', time: 1, at: code });
    expect(v.page.querySelector('.vc-mdiff')).not.toBeNull();
    expect(beforeOf(v.page)).toBe('');
  }
});

it('diff : file montre l\'éditeur, sans sélecteur ; en côte à côte, le diff en deux éditeurs', async () => {
  const file = mount({ diff: { shown: 'file', mode: 'split', step: 'modules' } }, one);
  await file.render({ id: 'm1/1', text: 'a', time: 1, at });
  expect(file.page.querySelector('.vc-mdiff')).toBeNull();
  expect(file.page.querySelector('select.vc-mod-shown')).toBeNull();
  expect(file.saveButton()).toBeDefined();
  const split = mount({ diff: { shown: 'validated', mode: 'split', step: 'modules' } }, one);
  await split.render({ id: 'm1/1', text: 'a', time: 1, at });
  expect(split.page.querySelector('.vc-mdiff')!.getAttribute('data-mode')).toBe('split');
  expect(split.page.querySelectorAll('.cm-editor')).toHaveLength(2);
  expect(beforeOf(split.page)).toBe('V');
  expect(afterOf(split.page)).toBe('a');
});

it('diff : un supprimé, tout en retraits depuis la référence (base, head, validated, absente)', async () => {
  const gone: VibeModule = { ...m, files: [{ id: 'm1/0', path: 'src/x/gone.ts', deleted: true }] };
  for (const [shown, mode, expected] of [['base', 'inline', 'B'], ['head', 'inline', 'H'], ['validated', 'inline', 'V'], ['validated', 'split', 'V'], ['file', 'inline', 'B']] as const) {
    const v = mount({ diff: { shown, mode, step: 'modules' } }, gone);
    await v.render({ id: 'm1/0', text: null, time: 1, at });
    expect(v.page.querySelector('.vc-mdiff')!.getAttribute('data-mode')).toBe(mode);
    expect(beforeOf(v.page)).toBe(expected);
    expect(afterOf(v.page)).toBe('');
    expect(v.saveButton()).toBeUndefined();
  }
  const none = mount({ diff: { shown: 'validated', mode: 'inline', step: 'modules' } }, gone);
  await none.render({ id: 'm1/0', text: null, time: 1, at: { base: 'B', head: null } });
  expect(beforeOf(none.page)).toBe('');
  expect(afterOf(none.page)).toBe('');
});

it('diff : le choix du menu ne touche pas le choix de la liste de Modules (commun à la page)', async () => {
  const v = mount({ diff: { shown: 'head', mode: 'split', step: 'modules' } }, one);
  await v.render({ id: 'm1/1', text: 'a', time: 1, at });
  const list = mount({}, one);
  await list.render({ id: 'm1/1', text: 'a', time: 1, at });
  expect((list.page.querySelector('select.vc-mod-shown') as HTMLSelectElement).value).toBe('base');
  expect(list.page.querySelector('.vc-mdiff')!.getAttribute('data-mode')).toBe('inline');
});

// Le choix est commun à tout le fichier de test (comme à la page) : ce test est le dernier à le changer.
it('s\'ouvre sur le diff depuis la base (grisé, pas de base : le fichier) ; le choix vaut pour les fichiers suivants', async () => {
  const shown = (v: ReturnType<typeof mount>) => (v.page.querySelector('select.vc-mod-shown') as HTMLSelectElement).value;
  const v = mount({}, one);
  await v.render({ id: 'm1/1', text: 'a', time: 1, at: { base: 'b', head: 'a' } });
  expect(shown(v)).toBe('base');
  expect(v.page.querySelector('.vc-mdiff')).not.toBeNull();
  const noBase = mount({}, one);
  await noBase.render({ id: 'm1/1', text: 'a', time: 1, at: { base: null, head: 'a' } });
  expect(shown(noBase)).toBe('file');
  expect(noBase.page.querySelector('.vc-mdiff')).toBeNull();
  // changé ici (le dernier commit, côte à côte) : un autre ModuleCode, un autre fichier, s'ouvre dessus
  const select = v.page.querySelector('select.vc-mod-shown') as HTMLSelectElement;
  await act(() => { select.value = 'head'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  await act(() => { [...v.page.querySelectorAll<HTMLButtonElement>('.vc-seg button')].find((b) => b.textContent === 'Côte à côte')!.click(); });
  const next = mount({}, { ...one, files: [{ id: 'm2/0', path: 'src/y/other.ts' }] });
  await next.render({ id: 'm2/0', text: 'a', time: 1, at: { base: 'b', head: 'c' } });
  expect(shown(next)).toBe('head');
  expect(next.page.querySelector('.vc-mdiff')!.getAttribute('data-mode')).toBe('split');
});
