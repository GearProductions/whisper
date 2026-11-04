// @vitest-environment happy-dom
// StatusBar (status-bar.tsx) : les actions qui tournent après ⚙ Tâches — une : le point vert et son
// nom ; plusieurs : « N actions en cours » ; clic → onRuns ; aucune (ni le tour de l'agent) : rien ;
// ↻ à côté de l'heure du relevé : onRefresh, tourne au clic ; le modèle et l'effort de l'agent y restent.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { Thread, VibeRun, VibeView } from 'technicals/bridge';
import { StatusBar } from '../../status-bar';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
const root = createRoot(page);
const run = (label: string, state: VibeRun['state']) => ({ id: label, label, state }) as VibeRun;
const view = (runs?: VibeRun[]) => ({ lang: 'fr', agent: {}, time: 0, runs }) as unknown as VibeView;
const thread = { tasks: [] } as unknown as Thread;
let opened = 0;
let refreshed = 0;
const bar = (runs: VibeRun[] | undefined, busy = false) => act(() => {
  root.render(createElement(StatusBar, {
    view: view(runs), thread, t: t('fr'), busy, tasksOpen: false, contextOpen: false,
    onSet: () => {}, onGauge: () => {}, onTasks: () => {}, onRuns: () => { opened++; }, onRefresh: () => { refreshed++; },
  }));
});
const item = () => page.querySelector('.vc-srun')?.parentElement as HTMLButtonElement | undefined;

it('StatusBar : une action qui tourne, son point vert et son nom ; clic → onRuns', async () => {
  await bar([run('Vibe', 'running'), run('Relire', 'done')]);
  expect(item()?.textContent).toBe('Vibe');
  expect(item()?.title).toBe(t('fr').runsTitle);
  await act(() => { item()!.click(); });
  expect(opened).toBe(1);
});

it('StatusBar : plusieurs → « N actions en cours » (asking compte)', async () => {
  await bar([run('Vibe', 'running'), run('Relire', 'asking'), run('Note', 'stopped')]);
  expect(item()?.textContent).toBe('2 actions en cours');
});

it('StatusBar : aucune action, même l\'agent au travail : rien', async () => {
  await bar(undefined, true);
  expect(item()).toBeUndefined();
  await bar([run('Vibe', 'failed')], true);
  expect(item()).toBeUndefined();
  expect(page.textContent).toContain(t('fr').stop);
});

it('StatusBar : ↻ après l\'heure du relevé, appelle onRefresh et tourne ; modèle et effort de l\'agent gardés', async () => {
  await bar(undefined);
  const btn = page.querySelector<HTMLButtonElement>('.vc-refresh')!;
  expect([btn.title, btn.previousElementSibling?.textContent]).toEqual([t('fr').refresh, t('fr').at(new Date(0).toLocaleTimeString(t('fr').locale))]);
  expect(btn.querySelector('.vc-spin')).toBeNull();
  await act(() => { btn.click(); });
  expect(refreshed).toBe(1);
  expect(btn.querySelector('.vc-spin')).not.toBeNull();
  expect([...page.querySelectorAll('select')].length).toBe(3);
  expect(page.textContent).toContain(t('fr').model);
  expect(page.textContent).toContain(t('fr').effort);
});
