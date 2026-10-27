// @vitest-environment happy-dom
// SkillsBar (skills-bar.tsx) : new-worktree montré comme ask, rien de masqué.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import type { VibeAction, VibeView } from 'technicals/bridge';
import { SkillsBar } from '../../skills-bar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
const root = createRoot(page);
const render = (el: ReturnType<typeof createElement>) => act(() => { root.render(el); });
const view = (v: Partial<VibeView>) => ({ lang: 'fr', actions: [], processes: [], ...v }) as unknown as VibeView;

it('SkillsBar : new-worktree à côté d\'ask, pas les masquées', async () => {
  const a = (id: string, hidden?: boolean) => ({ id, label: id, hint: '', kind: 'send', step: null, hidden }) as unknown as VibeAction;
  const bar = (actions: VibeAction[]) => render(createElement(SkillsBar, { view: view({ actions }), busy: false, onRun: () => {} }));
  const shown = () => [...page.querySelectorAll('button')].map((b) => b.textContent);

  await bar([a('ask'), a('new-worktree'), a('note')]);
  expect(shown()).toEqual(['ask', 'new-worktree']);
  await bar([a('ask'), a('new-worktree', true)]);
  expect(shown()).toEqual(['ask']);
});
