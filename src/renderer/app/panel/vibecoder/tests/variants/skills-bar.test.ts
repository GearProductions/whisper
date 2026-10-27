// @vitest-environment happy-dom
// SkillsBar (skills-bar.tsx) : new-request montré comme ask, rien de masqué ; une demande retenue :
// sa branche et ses choix directs (new-here, new-worktree, stash), grisés avec leur raison.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import type { VibeAction, VibeArgs, VibeView } from 'technicals/bridge';
import { SkillsBar } from '../../skills-bar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
const root = createRoot(page);
const render = (el: ReturnType<typeof createElement>) => act(() => { root.render(el); });
const view = (v: Partial<VibeView>) => ({ lang: 'fr', actions: [], processes: [], ...v }) as unknown as VibeView;
const a = (id: string, more: Partial<VibeAction> = {}) =>
  ({ id, label: id, hint: '', kind: 'send', step: null, hidden: false, disabled: null, ...more }) as unknown as VibeAction;
const shown = () => [...page.querySelectorAll('button')].map((b) => b.textContent);

it('SkillsBar : new-request à côté d\'ask, pas les masquées', async () => {
  const bar = (actions: VibeAction[]) => render(createElement(SkillsBar, { view: view({ actions }), busy: false, onRun: () => {} }));
  await bar([a('ask'), a('new-request'), a('note'), a('new-here')]);
  expect(shown()).toEqual(['ask', 'new-request']);
  await bar([a('ask'), a('new-request', { hidden: true })]);
  expect(shown()).toEqual(['ask']);
});

it('SkillsBar : la demande retenue, sa branche et ses choix directs', async () => {
  const runs: [string, VibeArgs | undefined][] = [];
  const actions = [a('ask'), a('new-here', { disabled: 'Modifications en cours' }), a('new-worktree'),
    a('stash', { direct: { running: false, last: { ok: false, line: 'stash refusé', detail: '', time: 0 } } }), a('pr-here')];
  await render(createElement(SkillsBar, { view: view({ actions, request: { branch: 'feat/x' } }), busy: false, onRun: (id: string, args?: VibeArgs) => { runs.push([id, args]); } }));
  expect(shown()).toEqual(['ask', 'new-here', 'new-worktree', 'stash']);
  expect(page.textContent).toContain('feat/x');
  expect(page.textContent).toContain('stash refusé');
  const [ask, here, wt] = page.querySelectorAll('button');
  expect(here.disabled).toBe(true);
  expect(here.title).toContain('Modifications en cours');
  await act(() => { ask.click(); wt.click(); });
  expect(runs).toEqual([['ask', undefined], ['new-worktree', { direct: true }]]);
});
