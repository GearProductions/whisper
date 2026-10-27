// @vitest-environment happy-dom
// ProcessesView (processes-view.tsx) : Préparer le projet montré si le fichier a un
// setup, grisé pendant une recette, son dernier échec dessous.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeRecipe, VibeView } from 'technicals/bridge';
import { ProcessesView } from '../../processes-view';
import type { VibeActs } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
const root = createRoot(page);
const render = (el: ReturnType<typeof createElement>) => act(() => { root.render(el); });
const view = (v: Partial<VibeView>) => ({ lang: 'fr', actions: [], processes: [], ...v }) as unknown as VibeView;
const setupButton = () => [...page.querySelectorAll('button')].find((b) => b.textContent === 'Préparer le projet');

it('Préparer le projet : montré si setup, grisé pendant une recette, le dernier échec dessous', async () => {
  const process = vi.fn();
  const acts = { process, run: vi.fn() } as unknown as VibeActs;
  const procs = (v: Partial<VibeView>) => render(createElement(ProcessesView, { view: view(v), t: t('fr'), act: acts, busy: false }));

  await procs({});
  expect(setupButton()).toBeUndefined();

  await procs({ setup: true });
  await act(() => { setupButton()!.click(); });
  expect(process).toHaveBeenCalledWith('setup');

  const recipe = (r: Partial<VibeRecipe>): VibeRecipe => ({ op: 'setup', running: false, last: null, ...r });
  await procs({ setup: true, recipe: recipe({ op: 'create', running: true }) });
  expect(setupButton()!.disabled).toBe(true);

  await procs({ setup: true, recipe: recipe({ last: { ok: false, line: 'yarn: introuvable', time: 1 } }) });
  expect(setupButton()!.disabled).toBe(false);
  expect(page.querySelector('[data-state="ko"]')?.textContent).toContain('yarn: introuvable');

  await procs({ setup: true, recipe: recipe({ last: { ok: true, line: 'fait', time: 1 } }) });
  expect(page.querySelector('[data-state="ko"]')).toBeNull();
});
