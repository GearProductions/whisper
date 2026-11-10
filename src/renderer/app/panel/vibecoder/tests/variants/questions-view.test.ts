// @vitest-environment happy-dom
// questions-view (questions-view.tsx) : la précision libre est un PromptField ; les pièces sont celles du questionnaire
// entier (une liste, montrée dans le champ de chaque question) ; le champ d'une question n'a pas d'Envoyer (le micro
// reste), « Envoyer les réponses » en bas envoie ; le niveau d'une question en badge ; une réponse en trois parties.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { QuestionsView } from '../../questions-view';
import { Mic } from '../../prompt-tools';
import type { VibeActs } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.body.appendChild(document.createElement('div'));
const root = createRoot(page);
const answers = { 'Q1 ?': { choice: 0, free: '' }, 'Q2 ?': { choice: null, free: '' } };
const view = {
  lang: 'fr', actions: [{ id: 'answers', label: 'Envoyer les réponses', hint: '', who: 'agent', models: [], model: null, kind: 'send', needs: 'none', disabled: null, hidden: false }],
  questions: [{ n: 1, text: 'Q1 ?', options: ['oui'] }, { n: 2, text: 'Q2 ?', options: ['non'] }],
} as unknown as VibeView;

it('les pièces du questionnaire apparaissent dans chaque champ ; × et Joindre remontent ; Envoyer les réponses envoie', async () => {
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
  await act(async () => [...page.querySelectorAll<HTMLElement>('.vc-q-send button')].at(-1)!.click());
  expect(calls).toEqual(['remove', 'attach', 'run:answers:{"answers":["oui",""]}']);
});

const render = async (v: VibeView, calls: string[] = []) => {
  const act2 = { run: (id: string, x?: unknown) => calls.push(`run:${id}:${JSON.stringify(x)}`), openLink() {} } as unknown as VibeActs;
  await act(async () => {
    root.render(createElement(Mic.Provider, { value: { phase: 'idle', down() {}, up() {} } },
      createElement(QuestionsView, { view: v, t: t('fr'), act: act2, busy: false, answers: {}, onAnswer() {}, pieces: [], onRemove() {}, onAttach() {}, onFiles() {} })));
  });
};
const withQuestions = (questions: unknown[]) => ({ ...view, questions }) as unknown as VibeView;

it('le niveau : important a son badge, secondary le sien, sans niveau rien', async () => {
  await render(withQuestions([
    { n: 1, text: 'A ?', options: [], level: 'important' }, { n: 2, text: 'B ?', options: [], level: 'secondary' }, { n: 3, text: 'C ?', options: [] },
  ]));
  const qs = page.querySelectorAll('.vc-q');
  expect(qs[0].querySelector('.vc-q-level')?.getAttribute('data-level')).toBe('important');
  expect(qs[0].querySelector('.vc-q-level')?.textContent).toBe(t('fr').levels.important);
  expect(qs[1].querySelector('.vc-q-level')?.getAttribute('data-level')).toBe('secondary');
  expect(qs[1].querySelector('.vc-q-level')?.textContent).toBe(t('fr').levels.secondary);
  expect(qs[2].querySelector('.vc-q-level')).toBeNull();
});

it('une réponse en trois parties : ses trois morceaux dans un seul bouton ; une autre : comme avant ; une balise reste du texte', async () => {
  const calls: string[] = [];
  await render(withQuestions([{ n: 1, text: 'Q ?', options: ['**Garder** — *note, § Forme* : « le texte »', 'oui `x`', '**A** *b* <b>c</b>'] }]), calls);
  const [three, plain, tag] = page.querySelectorAll<HTMLElement>('.vc-q-opt');
  expect(three.querySelector('strong')?.textContent).toBe('Garder');
  expect(three.querySelector('.vc-q-where')?.textContent).toBe('note, § Forme');
  expect(three.querySelector('.vc-q-quote')?.textContent).toBe('« le texte »');
  expect(plain.querySelector('.vc-q-where')).toBeNull();
  expect(plain.querySelector('code')?.textContent).toBe('x');
  expect(tag.querySelector('b')).toBeNull();
  expect(tag.textContent).toContain('<b>c</b>');
});

it('le champ d\'une question : le micro, pas d\'Envoyer ; Envoyer les réponses en bas', async () => {
  await render(view);
  expect(page.querySelectorAll('.vc-q-free .vc-mic').length).toBe(2);
  expect(page.querySelectorAll('.vc-q-free .vc-send').length).toBe(0);
  expect(page.querySelectorAll('.vc-q-send button').length).toBe(1);
});
