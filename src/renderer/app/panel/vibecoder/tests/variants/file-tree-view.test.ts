// @vitest-environment happy-dom
// FileTreeView (file-tree-view.tsx) : un clic sur un dossier le plie/déplie (onToggle), sur un fichier le
// choisit (onSelect) ; la ligne choisie est marquée ; le point d'état seulement si `dot` est donné et
// connaît le fichier (data-state sur la ligne) ; un nom avec du HTML reste du texte.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it } from 'vitest';
import type { FileNode } from 'core/vibecoder';
import { FileTreeView, type FileTreeViewProps } from '../../file-tree-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const node = (key: string, folder = false, label = key.slice(key.lastIndexOf('/') + 1)): FileNode => ({
  key, label, folder, depth: key.split('/').length - 1, parent: key.includes('/') ? key.slice(0, key.lastIndexOf('/')) : '',
});
const rows = [node('a', true), node('a/b.ts'), node('c.ts')];

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
let log: string[] = [];
beforeEach(() => { log = []; act(() => root.render(null)); });

const draw = (over: Partial<FileTreeViewProps> = {}) => act(() => {
  root.render(createElement(FileTreeView, {
    rows, open: new Set(['a']), selected: null,
    onToggle: (k) => log.push(`toggle ${k}`), onSelect: (k) => log.push(`select ${k}`), ...over,
  }));
});
const row = (key: string) => [...page.querySelectorAll<HTMLElement>('.vc-tree-row')].find((r) => r.dataset.key === key)!;

it('un dossier se déplie au clic, un fichier se choisit ; indentation et chevron', async () => {
  await draw();
  await act(() => row('a').click());
  await act(() => row('a/b.ts').click());
  expect(log).toEqual(['toggle a', 'select a/b.ts']);
  expect(row('a').getAttribute('aria-expanded')).toBe('true');
  expect(row('a/b.ts').getAttribute('aria-expanded')).toBeNull();
  expect(row('a/b.ts').style.paddingLeft).toBe('20px');
  expect(row('a').querySelector('.vc-tree-chevron')!.textContent).toBe('›');
});

it('la ligne choisie est marquée', async () => {
  await draw({ selected: 'c.ts' });
  expect(row('c.ts').getAttribute('aria-selected')).toBe('true');
  expect(row('a/b.ts').getAttribute('aria-selected')).toBe('false');
});

it('le point d\'état : sans dot, aucun ; avec dot, sur les fichiers connus, dans leur état', async () => {
  await draw();
  expect(page.querySelector('.vc-mod-dot')).toBeNull();
  await draw({ dot: (k) => (k === 'a/b.ts' ? 'done' : k === 'c.ts' ? 'wip' : null) });
  expect(row('a/b.ts').dataset.state).toBe('done');
  expect(row('a/b.ts').querySelector(':scope > .vc-mod-dot')).not.toBeNull();
  expect(row('c.ts').dataset.state).toBe('wip');
  expect(row('a').querySelector('.vc-mod-dot')).toBeNull();
});

it('un nom avec du HTML reste du texte', async () => {
  await draw({ rows: [node('x', false, '<b>gras</b>.ts')] });
  expect(page.querySelector('b')).toBeNull();
  expect(page.querySelector('.vc-tree-label')!.textContent).toBe('<b>gras</b>.ts');
});
