// @vitest-environment happy-dom
// questions-view (questions-view.tsx) : la précision libre est un PromptField ; les pièces sont celles du questionnaire
// entier (une liste, montrée dans le champ de chaque question) ; Envoyer du champ envoie les réponses.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { QuestionsView } from '../../questions-view';
import type { VibeActs } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.body.appendChild(document.createElement('div'));
const root = createRoot(page);
const answers = { 'Q1 ?': { choice: 0, free: '' }, 'Q2 ?': { choice: null, free: '' } };
const view = {
  lang: 'fr', actions: [{ id: 'answers', label: 'Envoyer les réponses', hint: '', who: 'agent', models: [], model: null, kind: 'send', needs: 'none', disabled: null, hidden: false }],
  questions: [{ n: 1, text: 'Q1 ?', options: ['oui'] }, { n: 2, text: 'Q2 ?', options: ['non'] }],
} as unknown as VibeView;

it('les pièces du questionnaire apparaissent dans chaque champ ; × et Joindre remontent ; Envoyer envoie les réponses', async () => {
  const calls: string[] = [];
  const act2 = { run: (id: string, x?: unknown) => calls.push(`run:${id}:${JSON.stringify(x)}`), openLink() {} } as unknown as VibeActs;
  await act(async () => {
    root.render(createElement(QuestionsView, {
      view, t: t('fr'), act: act2, busy: false, answers, onAnswer() {},
      pieces: [{ kind: 'file', name: 'a.ts', path: '/p/a.ts' }], onRemove: () => calls.push('remove'), onAttach: () => calls.push('attach'), onFiles() {},
    }));
  });
  expect(page.querySelectorAll('.vc-q-free .piece').length).toBe(2);
  await act(async () => page.querySelectorAll<HTMLElement>('.piece .remove')[1].click());
  await act(async () => page.querySelectorAll<HTMLElement>('.vc-attach')[0].click());
  await act(async () => page.querySelector<HTMLElement>('.vc-q-free .vc-send')!.click());
  expect(calls).toEqual(['remove', 'attach', 'run:answers:{"answers":["oui",""]}']);
});

it('sans pièces tenues par l\'appelant : aucune pièce, le champ marche', async () => {
  await act(async () => { root.render(createElement(QuestionsView, { view, t: t('fr'), act: {} as VibeActs, busy: false, answers, onAnswer() {} })); });
  expect(page.querySelector('.piece')).toBeNull();
  expect(page.querySelectorAll('.vc-q-free textarea').length).toBe(2);
});
