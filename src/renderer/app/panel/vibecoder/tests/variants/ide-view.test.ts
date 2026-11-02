// @vitest-environment happy-dom
// IdeView (ide-view.tsx) : le premier fichier est choisi d'emblée ; un clic en choisit un autre et children
// le reçoit ; le choix tient par chemin d'un `files` à l'autre, et retombe sur le premier quand il disparaît ;
// un dossier se plie (et un dossier nouveau s'ouvre seul) ; le point d'état de chaque fichier, aucun s'il n'a pas d'état ;
// son numéro, le rang de son module + 1.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it } from 'vitest';
import type { IdeFile } from 'core/vibecoder';
import { IdeView } from '../../ide-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const f = (path: string, state: IdeFile['state'] = 'todo'): IdeFile => ({ path, rank: 0, state, code: null });
const files = [f('a/x.ts', 'done'), f('a/y.ts'), f('z.ts', 'wip')];

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
beforeEach(() => { act(() => root.render(null)); });

const draw = (list: IdeFile[] = files) => act(() => {
  root.render(createElement(IdeView, { files: list, children: (file) => `[${file?.path ?? 'rien'}]` }));
});
const row = (key: string) => [...page.querySelectorAll<HTMLElement>('.vc-tree-row')].find((r) => r.dataset.key === key);
const shown = () => page.querySelector('.vc-ide-main')!.textContent;

it('le premier fichier est choisi d\'emblée, tout est déplié', async () => {
  await draw();
  expect(shown()).toBe('[a/x.ts]');
  expect(row('a/x.ts')!.getAttribute('aria-selected')).toBe('true');
  expect(row('a')!.getAttribute('aria-expanded')).toBe('true');
});

it('un clic choisit un autre fichier, children le reçoit', async () => {
  await draw();
  await act(() => row('z.ts')!.click());
  expect(shown()).toBe('[z.ts]');
});

it('le choix tient par chemin d\'un files à l\'autre, et retombe sur le premier si le chemin disparaît', async () => {
  await draw();
  await act(() => row('z.ts')!.click());
  await draw([f('b.ts'), f('z.ts'), f('a/x.ts')]);
  expect(shown()).toBe('[z.ts]');
  await draw([f('b.ts'), f('c.ts')]);
  expect(shown()).toBe('[b.ts]');
  await draw([]);
  expect(shown()).toBe('[rien]');
});

it('un dossier se plie ; un dossier nouveau s\'ouvre seul', async () => {
  await draw();
  await act(() => row('a')!.click());
  expect(row('a/x.ts')).toBeUndefined();
  expect(row('a')!.getAttribute('aria-expanded')).toBe('false');
  await draw([...files, f('n/w.ts')]);
  expect(row('a/x.ts')).toBeUndefined();
  expect(row('n/w.ts')).toBeDefined();
  await act(() => row('a')!.click());
  expect(row('a/x.ts')).toBeDefined();
});

it('le point d\'état de chaque fichier, aucun sans état', async () => {
  await draw([{ ...f('n.ts'), rank: null, state: null }]);
  expect(page.querySelector('.vc-mod-dot')).toBeNull();
  await draw();
  expect(row('a/x.ts')!.dataset.state).toBe('done');
  expect(row('z.ts')!.dataset.state).toBe('wip');
  expect(row('a')!.querySelector('.vc-mod-dot')).toBeNull();
});

it('le numéro de chaque fichier : le rang de son module + 1, aucun pour un fichier de la branche', async () => {
  await draw([{ ...f('a/x.ts'), rank: 0 }, { ...f('z.ts'), rank: 2 }, { ...f('b.ts'), rank: null, state: null }]);
  expect(row('a/x.ts')!.querySelector('.vc-tree-rank')!.textContent).toBe('1');
  expect(row('z.ts')!.querySelector('.vc-tree-rank')!.textContent).toBe('3');
  expect(row('b.ts')!.querySelector('.vc-tree-rank')).toBeNull();
});
