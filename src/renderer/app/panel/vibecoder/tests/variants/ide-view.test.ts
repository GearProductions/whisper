// @vitest-environment happy-dom
// IdeView (ide-view.tsx) : le premier fichier est choisi d'emblée ; un clic en choisit un autre et children
// le reçoit ; le choix tient par chemin d'un `files` à l'autre, et retombe sur le premier quand il disparaît ;
// un dossier se plie (et un dossier nouveau s'ouvre seul) ; la couleur du nom de chaque fichier (mark), aucune sans mark ;
// son numéro, le rang de son module + 1 ; sous un KeptScope (T-20) : le fichier choisi, les dossiers pliés et le
// défilement reviennent quand la vue est recréée sous le même agent, pas sous un autre.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it } from 'vitest';
import type { IdeFile } from 'core/vibecoder';
import { createKept, scoped, type Kept } from 'core/vibecoder/kept';
import { KeptScope } from '../../kept-scope';
import { IdeView } from '../../ide-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const f = (path: string, mark: IdeFile['mark'] = 'todo'): IdeFile => ({ path, rank: 0, state: null, mark, code: null });
const files = [f('a/x.ts', 'new'), f('a/y.ts'), f('z.ts', 'modified')];

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

it('la couleur du nom de chaque fichier, aucune sans mark', async () => {
  await draw([f('n.ts', null)]);
  expect(page.querySelector('[data-mark]')).toBeNull();
  await draw();
  expect(row('a/x.ts')!.dataset.mark).toBe('new');
  expect(row('z.ts')!.dataset.mark).toBe('modified');
  expect(row('a')!.dataset.mark).toBeUndefined();
});

it('le numéro de chaque fichier : le rang de son module + 1, aucun pour un fichier de la branche', async () => {
  await draw([{ ...f('a/x.ts'), rank: 0 }, { ...f('z.ts'), rank: 2 }, { ...f('b.ts'), rank: null, state: null }]);
  expect(row('a/x.ts')!.querySelector('.vc-tree-rank')!.textContent).toBe('1');
  expect(row('z.ts')!.querySelector('.vc-tree-rank')!.textContent).toBe('3');
  expect(row('b.ts')!.querySelector('.vc-tree-rank')).toBeNull();
});

// Sous un KeptScope : la vue est démontée puis recréée, comme le panneau le fait à chaque changement d'agent.
async function visit(kept: Kept, agent: string) {
  const host = document.createElement('div');
  document.body.append(host);
  const r = createRoot(host);
  const view = createElement(IdeView, { files, children: (file) => `[${file?.path ?? 'rien'}]` });
  await act(() => r.render(createElement(KeptScope.Provider, { value: scoped(kept, agent, 'ide') }, view)));
  const q = (sel: string) => host.querySelector<HTMLElement>(sel)!;
  const rowOf = (key: string) => [...host.querySelectorAll<HTMLElement>('.vc-tree-row')].find((x) => x.dataset.key === key);
  return { q, rowOf, shown: () => q('.vc-ide-main').textContent, leave: async () => { await act(() => r.unmount()); host.remove(); } };
}

it('un fichier choisi, la vue recréée sous le même agent : le même fichier', async () => {
  const kept = createKept();
  const first = await visit(kept, 'a');
  await act(() => first.rowOf('z.ts')!.click());
  await first.leave();
  const again = await visit(kept, 'a');
  expect(again.shown()).toBe('[z.ts]');
  expect(again.rowOf('z.ts')!.getAttribute('aria-selected')).toBe('true');
});

it('un dossier plié, la vue recréée : toujours plié', async () => {
  const kept = createKept();
  const first = await visit(kept, 'a');
  await act(() => first.rowOf('a')!.click());
  await first.leave();
  const again = await visit(kept, 'a');
  expect(again.rowOf('a')!.getAttribute('aria-expanded')).toBe('false');
  expect(again.rowOf('a/x.ts')).toBeUndefined();
});

it('un autre agent : le premier fichier, tout déplié', async () => {
  const kept = createKept();
  const first = await visit(kept, 'a');
  await act(() => first.rowOf('z.ts')!.click());
  await act(() => first.rowOf('a')!.click());
  await first.leave();
  const other = await visit(kept, 'b');
  expect(other.shown()).toBe('[a/x.ts]');
  expect(other.rowOf('a')!.getAttribute('aria-expanded')).toBe('true');
  expect(other.rowOf('a/x.ts')).toBeDefined();
});

it('le défilement de l\'arborescence et du fichier, la vue recréée : restauré ; un autre agent : en haut', async () => {
  const kept = createKept();
  const first = await visit(kept, 'a');
  for (const [sel, top] of [['.vc-ide-side', 40], ['.vc-ide-main', 90]] as const) {
    await act(() => { const el = first.q(sel); el.scrollTop = top; el.dispatchEvent(new Event('scroll')); });
  }
  await first.leave();
  const again = await visit(kept, 'a');
  expect([again.q('.vc-ide-side').scrollTop, again.q('.vc-ide-main').scrollTop]).toEqual([40, 90]);
  const other = await visit(kept, 'b');
  expect([other.q('.vc-ide-side').scrollTop, other.q('.vc-ide-main').scrollTop]).toEqual([0, 0]);
});
