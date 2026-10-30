// @vitest-environment happy-dom
// Breadcrumb (breadcrumb.tsx) : les étapes en une ligne, une pas ouverte sans clic (toute étape ouverte
// reste atteignable), état et faits en title ; « N commits » déplie la liste, re-clic la replie ; aucun
// commit : le texte, sans bouton ; un commit déplié : diff et GitHub en IconButton, mêmes ids
// (c<rang>, gh:c<rang>), ses fichiers en texte simple.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { Breadcrumb } from '../../breadcrumb';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const s = t('fr');

async function mount(view: VibeView, picked: string[] = [], opened: string[] = []) {
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  await act(() => root.render(createElement(Breadcrumb, { view, t: s, selected: 'note', onPick: (id: string) => { picked.push(id); }, onOpen: (id: string) => { opened.push(id); } })));
  return { page, unmount: () => act(() => root.unmount()) };
}

it('étapes : une ligne, pas ouverte sans clic, choisie en aria-current, état et faits en title', async () => {
  const picked: string[] = [];
  const view = { steps: [
    { id: 'note', status: 'done', facts: '3 sections', open: true },
    { id: 'forme', status: 'todo', facts: '', open: false },
  ], commits: [] } as unknown as VibeView;
  const { page, unmount } = await mount(view, picked);
  expect(page.querySelector('nav')!.getAttribute('aria-label')).toBe(s.journey);
  const steps = [...page.querySelectorAll<HTMLButtonElement>('.vc-jstep')];
  expect(steps.map((b) => [b.textContent, b.disabled, b.getAttribute('aria-current'), b.title])).toEqual([
    [s.steps.note, false, 'step', `${s.steps.note} — ${s.stepStatus.done} · 3 sections (${s.shortcut(1)})`],
    [s.steps.forme, true, null, `${s.steps.forme} — ${s.stepStatus.todo} · ${s.notOpen}`],
  ]);
  for (const b of steps) await act(() => b.click());
  expect(picked).toEqual(['note']);
  expect(page.querySelector('.vc-ccount')!.tagName).toBe('SPAN');
  expect(page.querySelector('.vc-ccount')!.textContent).toBe(s.commitsOf(0));
  await unmount();
});

it('commits : N commits déplie, re-clic replie ; un commit déplié : diff et GitHub en icônes, mêmes ids, fichiers en texte', async () => {
  const opened: string[] = [];
  const view = { steps: [], commits: [{ hash: 'aaaaaaa1', subject: 'un', fixup: false, files: ['src/a.ts'] },
    { hash: 'bbbbbbb2', subject: 'fixup! un', fixup: true, files: ['src/b.ts'] }] } as unknown as VibeView;
  const { page, unmount } = await mount(view, [], opened);
  const count = page.querySelector<HTMLButtonElement>('button.vc-ccount')!;
  expect([count.textContent, count.getAttribute('aria-expanded')]).toEqual([s.commitsOf(2), 'false']);
  expect(page.querySelector('.vc-commits')).toBeNull();
  await act(() => count.click());
  expect(count.getAttribute('aria-expanded')).toBe('true');
  expect([...page.querySelectorAll('.vc-commits li.fixup code')].map((c) => c.textContent)).toEqual(['bbbbbbb']);
  await act(() => (page.querySelectorAll('.vc-jcommit')[1] as HTMLButtonElement).click());
  const tools = [...page.querySelectorAll<HTMLButtonElement>('.vc-jcommit-links button')];
  expect(tools.map((b) => [b.className, b.title, b.getAttribute('aria-label'), !!b.querySelector('svg')]))
    .toEqual([['vc-tool', s.diffTitle, s.diffTitle, true], ['vc-tool', s.githubTitle, s.githubTitle, true]]);
  for (const b of tools) await act(() => b.click());
  expect([...page.querySelectorAll('.vc-jfiles li')].map((li) => [li.textContent, !!li.querySelector('button')])).toEqual([['src/b.ts', false]]);
  expect(opened).toEqual(['c1', 'gh:c1']);
  await act(() => count.click());
  expect(page.querySelector('.vc-commits')).toBeNull();
  await unmount();
});

it('liste ouverte : Échap (n\'atteint pas les autres Échap) ou un clic dehors la ferme, un clic dedans non ; écouteurs retirés', async () => {
  const view = { steps: [], commits: [{ hash: 'aaaaaaa1', subject: 'un', fixup: false, files: [] }] } as unknown as VibeView;
  const { page, unmount } = await mount(view);
  const count = page.querySelector<HTMLButtonElement>('button.vc-ccount')!;
  const other: string[] = [];
  const spy = (e: KeyboardEvent) => other.push(e.key);
  document.addEventListener('keydown', spy);
  const esc = () => act(() => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  await esc();
  expect(other).toEqual(['Escape']); // fermée : l'Échap passe
  await act(() => count.click());
  await act(() => { page.querySelector('.vc-commits')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
  expect(page.querySelector('.vc-commits')).not.toBeNull();
  await act(() => { count.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
  expect(page.querySelector('.vc-commits')).not.toBeNull();
  await esc();
  expect(page.querySelector('.vc-commits')).toBeNull();
  expect(other).toEqual(['Escape']); // ouverte : capturé
  await act(() => count.click());
  await act(() => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
  expect(page.querySelector('.vc-commits')).toBeNull();
  await esc();
  expect(other).toEqual(['Escape', 'Escape']); // écouteurs retirés
  document.removeEventListener('keydown', spy);
  await unmount();
});
