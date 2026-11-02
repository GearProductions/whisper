// @vitest-environment happy-dom
// ArtifactTreeView (artifact-tree-view.tsx) : lignes indentées, chevrons, sélection ; clic avec ses touches ;
// menu (ligne ou vide) ; saisie à la place d'un nom ou sous un dossier ; glisser interne = notre MIME seul
// (toute la sélection si la ligne en fait partie), lâcher → onMove avec le bon dossier, jamais onDropFiles ;
// fichiers extérieurs → onDropFiles ; data-own-drop sur toute l'arborescence.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it } from 'vitest';
import type { TreeNode } from 'core/vibecoder';
import { ArtifactTreeView, TREE_MIME, type ArtifactTreeViewProps } from '../../artifact-tree-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const node = (key: string, folder = false): TreeNode => ({
  key, label: key.slice(key.lastIndexOf('/') + 1), id: 'x', folder, depth: key.split('/').length - 1,
  parent: key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : '',
});
const rows = [node('a', true), node('a/b.md'), node('c', true), node('z.md')];

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
let log: string[] = [];
beforeEach(() => { log = []; act(() => root.render(null)); });

const draw = (over: Partial<ArtifactTreeViewProps> = {}) => act(() => {
  root.render(createElement(ArtifactTreeView, {
    rows, open: new Set(['a']), selected: [], focus: null, editing: null, problem: null,
    onToggle: (k) => log.push(`toggle ${k}`), onSelect: (k, m) => log.push(`select ${k} ${m.ctrl ? 'c' : ''}${m.shift ? 's' : ''}`),
    onKey: (e) => log.push(`key ${e.key}`), onMenu: (_x, _y, k) => log.push(`menu ${k}`),
    onEdit: (n) => log.push(`edit ${n}`), onEditDone: (n) => log.push(`done ${n}`), onEditCancel: () => log.push('cancel'),
    onMove: (k, f) => log.push(`move ${k.join(',')} -> ${f}`), onDropFiles: (fl, f) => log.push(`files ${fl.length} -> ${f}`),
    ...over,
  }));
});
const row = (key: string) => [...page.querySelectorAll<HTMLElement>('.vc-tree-row')].find((r) => r.dataset.key === key)!;
const tree = () => page.querySelector<HTMLElement>('.vc-tree')!;

// happy-dom n'a pas de DataTransfer fonctionnel : un faux, accroché à l'événement.
function fakeData(types: string[] = [], files: File[] = []) {
  const store = new Map<string, string>();
  return { types, files, dropEffect: '', effectAllowed: '', setData: (t: string, v: string) => { store.set(t, v); }, getData: (t: string) => store.get(t) ?? '', store };
}
const fire = (el: Element, type: string, props: object = {}) => act(() => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, props);
  el.dispatchEvent(e);
  return e;
});
const dragFrom = async (key: string) => {
  const dt = fakeData();
  await fire(row(key), 'dragstart', { dataTransfer: dt });
  return dt;
};
const dropMove = async (target: Element, dt: ReturnType<typeof fakeData>) =>
  fire(target, 'drop', { dataTransfer: { ...dt, types: [TREE_MIME], files: [] } });

it('une ligne par nœud, indentée selon sa profondeur ; chevron aux dossiers, ouvert ou fermé', async () => {
  await draw();
  expect([...page.querySelectorAll('.vc-tree-label')].map((l) => l.textContent)).toEqual(['a', 'b.md', 'c', 'z.md']);
  expect(row('a/b.md').style.paddingLeft).toBe('20px');
  expect(row('a').getAttribute('aria-expanded')).toBe('true');
  expect(row('c').getAttribute('aria-expanded')).toBe('false');
  expect(row('z.md').hasAttribute('aria-expanded')).toBe(false);
});

it('sélection et ligne au clavier marquées', async () => {
  await draw({ selected: ['c', 'z.md'], focus: 'z.md' });
  expect(['a', 'c', 'z.md'].map((k) => row(k).getAttribute('aria-selected'))).toEqual(['false', 'true', 'true']);
  expect(row('z.md').hasAttribute('data-focus')).toBe(true);
  expect(row('c').hasAttribute('data-focus')).toBe(false);
});

it('le chevron déplie sans sélectionner ; le clic sélectionne avec ses touches (Cmd = Ctrl)', async () => {
  await draw();
  await act(async () => row('c').querySelector<HTMLElement>('.vc-tree-chevron')!.click());
  expect(log).toEqual(['toggle c']);
  log.length = 0;
  await act(async () => row('z.md').click());
  await act(async () => { row('z.md').dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true })); });
  await act(async () => { row('z.md').dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true })); });
  expect(log).toEqual(['select z.md ', 'select z.md s', 'select z.md c']);
});

it('menu : sur une ligne, sa clé ; sur le vide, null', async () => {
  await draw();
  await fire(row('a/b.md'), 'contextmenu');
  await fire(tree(), 'contextmenu');
  expect(log).toEqual(['menu a/b.md', 'menu null']);
});

it('les touches vont à onKey, pas celles du champ de saisie', async () => {
  await draw({ editing: { key: 'z.md', folder: false, parent: '' } });
  await fire(tree(), 'keydown', { key: 'ArrowDown' });
  await fire(page.querySelector('input')!, 'keydown', { key: 'a' });
  expect(log.filter((l) => l.startsWith('key'))).toEqual(['key ArrowDown']);
});

it('renommer : le champ prend la place du nom ; frappe, Entrée, Échap relayés ; le problème s\'affiche', async () => {
  await draw({ editing: { key: 'z.md', folder: false, parent: '' }, problem: 'Nom déjà pris' });
  expect(row('z.md').querySelector('.vc-tree-label')).toBeNull();
  const input = row('z.md').querySelector('input')!;
  expect(input.value).toBe('z.md');
  expect(page.querySelector('[role=alert]')!.textContent).toBe('Nom déjà pris');
  await draw({ editing: { key: 'z.md', folder: false, parent: '' } });
  await fire(row('z.md').querySelector('input')!, 'keydown', { key: 'Enter' });
  expect(log).toEqual(['done z.md']);
});

it('nouvel élément : une ligne vide sous son dossier, à la bonne profondeur ; à la racine, en tête', async () => {
  await draw({ editing: { key: 'a/new', folder: true, parent: 'a' } });
  const lines = [...page.querySelectorAll<HTMLElement>('.vc-tree-row')];
  expect(lines.map((l) => l.dataset.key)).toEqual(['a', 'a/new', 'a/b.md', 'c', 'z.md']);
  expect(lines[1].style.paddingLeft).toBe('20px');
  expect(lines[1].querySelector('input')!.value).toBe('');
  await draw({ editing: { key: 'new.md', folder: false, parent: '' } });
  expect(page.querySelector('.vc-tree-row')!.querySelector('input')).not.toBeNull();
  expect(page.querySelectorAll('.vc-tree-row')).toHaveLength(5);
});

it('glisser une ligne : notre MIME seul, la clé ; ligne dans la sélection : toute la sélection', async () => {
  await draw({ selected: ['c', 'z.md'] });
  const one = await dragFrom('a/b.md');
  expect([...one.store.keys()]).toEqual([TREE_MIME]);
  expect(JSON.parse(one.store.get(TREE_MIME)!)).toEqual(['a/b.md']);
  const many = await dragFrom('z.md');
  expect(JSON.parse(many.store.get(TREE_MIME)!)).toEqual(['c', 'z.md']);
});

it('lâcher un nœud : sur un dossier ce dossier, sur un fichier son dossier, sur le vide la racine ; jamais onDropFiles', async () => {
  await draw();
  const dt = await dragFrom('z.md');
  await dropMove(row('c'), dt);
  await dropMove(row('a/b.md'), dt);
  await dropMove(tree(), dt);
  await dropMove(row('z.md'), dt);
  expect(log).toEqual(['move z.md -> c', 'move z.md -> a', 'move z.md -> ', 'move z.md -> ']);
});

it('des fichiers extérieurs : copiés dans le dossier visé (onDropFiles, jamais onMove)', async () => {
  await draw();
  const files = [new File(['x'], 'x.md')];
  const drop = (el: Element) => fire(el, 'drop', { dataTransfer: fakeData(['Files'], files) });
  await drop(row('a'));
  await drop(row('a/b.md'));
  await drop(tree());
  expect(log).toEqual(['files 1 -> a', 'files 1 -> a', 'files 1 -> ']);
});

it('un lâcher qui n\'est ni l\'un ni l\'autre ne fait rien ; data-own-drop sur toute l\'arborescence', async () => {
  await draw();
  await fire(tree(), 'drop', { dataTransfer: fakeData(['text/plain']) });
  expect(log).toEqual([]);
  expect(tree().hasAttribute('data-own-drop')).toBe(true);
  expect(row('z.md').closest('[data-own-drop]')).toBe(tree());
});

it('survol de lâcher : le dossier visé est marqué, retiré au lâcher', async () => {
  await draw();
  await fire(row('a/b.md'), 'dragover', { dataTransfer: fakeData([TREE_MIME]) });
  expect(row('a').hasAttribute('data-over')).toBe(true);
  await dropMove(row('a'), fakeData());
  expect(row('a').hasAttribute('data-over')).toBe(false);
});
