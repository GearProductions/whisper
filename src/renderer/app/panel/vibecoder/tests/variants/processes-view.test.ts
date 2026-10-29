// @vitest-environment happy-dom
// ProcessesView (processes-view.tsx) : Préparer le projet montré si le fichier a un
// setup, grisé pendant une recette, son dernier échec dessous ; Lancer, Arrêter, Relancer en icônes.
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

it('Lancer, Arrêter, Relancer : des icônes, libellé en infobulle et aria-label, même état grisé, même action', async () => {
  const process = vi.fn();
  const acts = { process, run: vi.fn() } as unknown as VibeActs;
  const p = { name: 'web', run: 'yarn dev', status: 'running', since: 1, exit: null, log: '' } as const;
  await render(createElement(ProcessesView, { view: view({ processes: [p] }), t: t('fr'), act: acts, busy: false }));
  const icons = [...page.querySelectorAll<HTMLButtonElement>('.vc-proc .vc-icon')];
  expect(icons.map((b) => [b.title, b.getAttribute('aria-label'), b.disabled, b.textContent, !!b.querySelector('svg')])).toEqual([
    ['Lancer', 'Lancer', true, '', true], ['Arrêter', 'Arrêter', false, '', true], ['Relancer', 'Relancer', false, '', true]]);
  await act(() => { icons[1].click(); });
  expect(process).toHaveBeenCalledWith('stop', 0);
});
