// @vitest-environment happy-dom
// EcranSection (ecran-view.tsx), le plan de test (note 0.16.0-ecran-essentiel) : en créateur, pas de plan = rien (ni
// carte vide, ni bouton Plan de test à l'écran), un plan = ses cases, cocher valide (check:<rang>), Tout cocher, pas de
// Relancer ; le relecteur (0.16.0-revue-essentielle) : un plan, ses cases, Tout cocher, sans Relancer ; pas de plan, une phrase, aucun bouton.
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
// Le composant garde ce qu'on vient de cocher d'un cas à l'autre (même relevé) : on repart d'un montage neuf.
const fresh = () => act(() => root.render(null));
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

it('relecteur, pas de plan : une phrase qui renvoie à Préparer la revue, aucun bouton, en français et en anglais', async () => {
  calls.length = 0;
  await draw('review', false);
  expect(page.querySelector('.vc-invite')!.textContent).toBe('Pas de plan de test à l\'écran : Préparer la revue le prépare.');
  expect(page.querySelector('.vc-plan')).toBeNull();
  expect(page.querySelector('button')).toBeNull();
  await draw('review', false, { lang: 'en' }, 'en');
  expect(page.querySelector('.vc-invite')!.textContent).toBe(t('en').essentialReview.noPlan);
  expect(page.querySelector('button')).toBeNull();
  await draw('review', false, { screen: undefined } as never);
  expect(page.querySelector('.vc-invite')).not.toBeNull();
  expect(calls).toEqual([]);
});

it('relecteur, un plan : ses cases, cocher valide, décocher refuse, pas de Relancer ni d\'invitation', async () => {
  await fresh();
  calls.length = 0;
  await draw('review', true);
  expect(boxes().map((b) => b.checked)).toEqual([false, true, false]);
  expect(page.querySelector('.vc-invite')).toBeNull();
  expect(buttons().join('|')).not.toMatch(/Relancer/);
  expect(page.querySelector('.vc-card-end button.vc-run')).toBeNull();
  await act(() => { boxes()[0].click(); });
  expect(calls).toEqual([['mark', 'check:0', 'ok']]);
  calls.length = 0;
  await act(() => { boxes()[1].click(); });
  expect(calls).toEqual([['mark', 'check:1', 'ko']]);
  expect(calls.some((c) => c[0] === 'run')).toBe(false);
});

it('relecteur, Tout cocher : chaque case pas cochée validée, aucune autre, aucune lecture lancée', async () => {
  await fresh();
  calls.length = 0;
  await draw('review', true);
  await act(() => { [...page.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === 'Tout cocher')!.click(); });
  expect(calls).toEqual([['mark', 'check:0', 'ok'], ['mark', 'check:2', 'ok']]);
  expect(boxes().every((b) => b.checked)).toBe(true);
  expect(buttons()).not.toContain('Tout cocher');
});

it('relecteur, un plan sans case : la carte le dit, sans Tout cocher ni Relancer', async () => {
  await draw('review', true, { screen: [] });
  expect(page.querySelector('.vc-plan-empty')!.textContent).toBe('Le plan ne contient aucune case.');
  expect(page.querySelector('button')).toBeNull();
});
