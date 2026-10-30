// @vitest-environment happy-dom
// RunsView (runs-view.tsx) : l'avancement d'une course sous son nom quand le flux le donne ; absent ou
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
  id: 'a', label: 'Modules', who: 'dev', state: 'running', since: Date.now(), end: null, reply: '', permission: null, ...over,
} as VibeRun);

async function mount(runs: VibeRun[]) {
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  await act(() => root.render(createElement(RunsView, { runs, t: s, onRunOp: () => {}, onOpenLink: () => {} })));
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
