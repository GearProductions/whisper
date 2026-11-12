// @vitest-environment happy-dom
// RunsView (runs-view.tsx) : une course ne demande rien (Arrêter seul tant qu'elle travaille, Garder / Annuler
// une fois arrêtée, sa réponse repliée) ; l'avancement d'une course sous son nom quand le flux le donne ; absent ou
// vide : rien, la ligne s'affiche quand même et l'état ne change pas.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeRun } from 'technicals/bridge';
import { RunsView } from '../../runs-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const s = t('fr');
const run = (over: Partial<VibeRun>): VibeRun => ({
  id: 'a', label: 'Modules', who: 'dev', state: 'running', since: Date.now(), end: null, reply: '', ...over,
} as VibeRun);

async function mount(runs: VibeRun[], onRunOp: (id: string, op: string) => void = () => {}) {
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  await act(() => root.render(createElement(RunsView, { runs, t: s, onRunOp, onOpenLink: () => {} })));
  return { page, unmount: () => act(() => root.unmount()) };
}

it('avancement : sous le nom, tel que runProgress le dit ; absent ou vide : rien, l\'état intact', async () => {
  const progress = { wave: 2 } as NonNullable<VibeRun['progress']>;
  const { page, unmount } = await mount([
    run({ id: 'a', progress }),
    run({ id: 'b' }),
    run({ id: 'c', progress: {} as NonNullable<VibeRun['progress']> }),
  ]);
  const rows = [...page.querySelectorAll('.vc-run-row')];
  expect(rows).toHaveLength(3);
  expect(rows[0].querySelector('.vc-run-progress')!.textContent).toBe(s.runProgress(progress));
  expect(s.runProgress(progress)).not.toBe('');
  expect(rows[1].querySelector('.vc-run-progress')).toBeNull();
  expect(rows[2].querySelector('.vc-run-progress')).toBeNull();
  expect(rows.map((r) => r.getAttribute('data-status'))).toEqual(['running', 'running', 'running']);
  await unmount();
});

const labels = (page: HTMLElement) => [...page.querySelectorAll('button')].map((b) => b.textContent || b.getAttribute('title'));

it('en cours : Arrêter, aucun bouton Autoriser, même si le relevé porte une vieille demande', async () => {
  const ops: string[] = [];
  const { page, unmount } = await mount(
    [run({ permission: { tool: 'Bash', target: 'ls' } } as Partial<VibeRun>)], (id, op) => ops.push(`${id} ${op}`));
  expect(labels(page)).toEqual([s.runStopTitle]);
  expect(page.querySelector('.vc-run-bar')).toBeNull();
  expect(page.textContent).not.toContain('Autoriser');
  page.querySelector('button')!.click();
  expect(ops).toEqual(['a stop']);
  await unmount();
});

it('arrêtée : Garder / Annuler, sans Arrêter', async () => {
  const ops: string[] = [];
  const { page, unmount } = await mount([run({ state: 'stopped', end: Date.now() })], (_id, op) => ops.push(op));
  expect(labels(page)).toEqual([s.keep, s.undo]);
  [...page.querySelectorAll('button')].forEach((b) => b.click());
  expect(ops).toEqual(['keep', 'undo']);
  await unmount();
});

it('en échec : sa réponse, la ligne qui dit pourquoi en tête, repliée ; ni Arrêter ni Garder', async () => {
  const reply = 'Refusé : Bash rm x\n\nJe n\'ai pas pu.';
  const { page, unmount } = await mount([run({ state: 'failed', end: Date.now(), reply })]);
  expect(labels(page)).toEqual([]);
  const details = page.querySelector('details.vc-run-reply') as HTMLDetailsElement;
  expect(details.open).toBe(false);
  expect(details.textContent!.indexOf('Refusé')).toBeLessThan(details.textContent!.indexOf('Je n\'ai pas pu'));
  await unmount();
});
