// @vitest-environment happy-dom
// EcranSection (ecran-view.tsx), le plan de test (note 0.16.0-ecran-essentiel) : en créateur, pas de plan = rien (ni
// carte vide, ni bouton Plan de test à l'écran), un plan = ses cases, cocher valide (check:<rang>), Tout cocher, pas de
// Relancer ; le relecteur garde son invitation et son Relancer.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeAction, VibeView } from 'technicals/bridge';
import { EcranSection } from '../../ecran-view';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const screen = { id: 'screen', label: 'Plan de test à l\'écran', hint: '', kind: 'run', step: 'revue', who: 'haiku', models: [],
  hidden: false, disabled: null, primary: false } as unknown as VibeAction;
const calls: unknown[][] = [];
const cases = [{ text: 'lancer la branche', done: false }, { text: 'cliquer sur Valider', done: true }, { text: 'voir le titre', done: false }];
const draw = (flow: string, plan: boolean, over: Partial<VibeView> = {}, lang = 'fr') => act(() => {
  const view = { lang, flow, actions: [screen], time: 1, screen: plan ? cases : [], draft: [], commits: [], steps: [],
    outputs: plan ? { 'ecran.md': { text: '- [ ] lancer la branche', time: 1 } } : {}, ...over } as unknown as VibeView;
  const props = { view, step: { id: 'revue', status: 'current', facts: '', open: true }, t: t(lang as 'fr'), busy: false, text: '', setText: () => {},
    code: null, drafts: [{}, () => {}], act: { run: (...a: unknown[]) => { calls.push(['run', ...a]); }, mark: (...a: unknown[]) => { calls.push(['mark', ...a]); },
      follow: () => {}, prefill: () => {}, draft: () => {}, open: () => {}, openLink: () => {}, save: async () => true } } as unknown as StepProps;
  root.render(createElement(EcranSection, props));
});
const buttons = () => [...page.querySelectorAll('button')].map((b) => b.textContent);
const boxes = () => [...page.querySelectorAll<HTMLInputElement>('.vc-plan input[type="checkbox"]')];

it('créateur, pas de plan : rien, ni carte vide ni bouton ni invitation', async () => {
  await draw('create', false);
  expect(page.innerHTML).toBe('');
  await draw('create', false, { screen: undefined } as never);
  expect(page.innerHTML).toBe('');
  await draw('create', false, { lang: 'en' });
  expect(page.innerHTML).toBe('');
});

it('créateur, un plan : ses cases, cocher valide, décocher refuse, Tout cocher, pas de Relancer', async () => {
  calls.length = 0;
  await draw('create', true);
  expect(boxes().map((b) => b.checked)).toEqual([false, true, false]);
  expect(page.querySelector('.vc-count')!.textContent).toBe('1 / 3');
  expect(buttons().join('|')).not.toMatch(/Relancer/);
  expect(page.querySelector('.vc-card-end button.vc-run')).toBeNull();
  await act(() => { boxes()[0].click(); });
  expect(calls).toEqual([['mark', 'check:0', 'ok']]);
  expect(boxes()[0].checked).toBe(true);
  calls.length = 0;
  await act(() => { boxes()[1].click(); });
  expect(calls).toEqual([['mark', 'check:1', 'ko']]);
  calls.length = 0;
  await act(() => { [...page.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Tout cocher')!.click(); });
  expect(calls).toEqual([['mark', 'check:1', 'ok'], ['mark', 'check:2', 'ok']]);   // la 0 est déjà cochée par le clic
  expect(buttons()).not.toContain('Tout cocher');
});

it('créateur, un plan sans case : la carte dit que le plan est vide, toujours sans Relancer', async () => {
  await draw('create', true, { screen: [] });
  expect(page.querySelector('.vc-plan-empty')!.textContent).toBe('Le plan ne contient aucune case.');
  expect(buttons().join('|')).not.toMatch(/Relancer/);
});

it('relecteur, pas de plan : son invitation et son bouton, comme avant', async () => {
  calls.length = 0;
  await draw('review', false);
  expect(page.querySelector('.vc-invite')!.textContent).toContain('Pas encore de plan de test');
  expect(page.querySelector('.vc-plan')).toBeNull();
  await act(() => { page.querySelector<HTMLButtonElement>('.vc-invite button')!.click(); });
  expect(calls).toEqual([['run', 'screen']]);
  await draw('review', false, { lang: 'en' });
  expect(page.querySelector('.vc-invite')!.textContent).toContain('No test plan yet');
});

it('relecteur, un plan : ses cases et Relancer, comme avant', async () => {
  calls.length = 0;
  await draw('review', true);
  expect(boxes()).toHaveLength(3);
  expect(page.querySelector('.vc-invite')).toBeNull();
  const again = [...page.querySelectorAll<HTMLButtonElement>('.vc-card-end button.vc-run')].find((b) => b.textContent?.includes('Relancer'))!;
  expect(again).toBeDefined();
  await act(() => { again.click(); });
  expect(calls).toEqual([['run', 'screen']]);
});
