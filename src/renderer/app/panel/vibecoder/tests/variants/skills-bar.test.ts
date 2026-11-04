// @vitest-environment happy-dom
// SkillsBar (skills-bar.tsx) : rien sans demande retenue (ni ask ni fix) ; une demande retenue :
// « Voulez-vous créer la branche … ? », le nom prérempli et modifiable, ses choix directs
// (new-here, new-worktree avec le nom saisi, stash sans), grisés avec leur raison.
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

const field = () => page.querySelector('input') as HTMLInputElement;
const type = (value: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(field(), value);
  field().dispatchEvent(new Event('input', { bubbles: true }));
});

it('SkillsBar : rien sans demande retenue, même avec des actions', async () => {
  await render(createElement(SkillsBar, { view: view({ actions: [a('new-here'), a('note')] }), busy: false, onRun: () => {} }));
  expect(shown()).toEqual([]);
});

it('SkillsBar : la demande retenue, sa branche et ses choix directs', async () => {
  const runs: [string, VibeArgs | undefined][] = [];
  const actions = [a('new-here', { disabled: 'Modifications en cours' }), a('new-worktree'),
    a('stash', { direct: { running: false, last: { ok: false, line: 'stash refusé', detail: '', time: 0 } } }), a('pr-here')];
  await render(createElement(SkillsBar, { view: view({ actions, request: { branch: 'feat/x' } }), busy: false, onRun: (id: string, args?: VibeArgs) => { runs.push([id, args]); } }));
  expect(shown()).toEqual(['new-here', 'new-worktree', 'stash']);
  expect(page.textContent).toContain('Voulez-vous créer la branche');
  expect(field().value).toBe('feat/x');
  expect(page.textContent).toContain('stash refusé');
  expect(page.querySelector('[data-state="ko"] .vc-direct-mark svg')).not.toBeNull();   // l'icône ko, plus de ✗
  const [here, wt, stash] = page.querySelectorAll('button');
  expect(here.disabled).toBe(true);
  expect(here.title).toContain('Modifications en cours');
  await act(() => { wt.click(); });
  await type(' feat/y ');
  await act(() => { wt.click(); stash.click(); });
  expect(runs).toEqual([['new-worktree', { direct: true, branch: 'feat/x' }],
    ['new-worktree', { direct: true, branch: 'feat/y' }], ['stash', { direct: true }]]);
  await type('  ');
  expect(wt.disabled).toBe(true);
  await render(createElement(SkillsBar, { view: view({ actions, request: { branch: 'feat/z' } }), busy: false, onRun: () => {} }));
  expect(field().value).toBe('feat/z');
});
