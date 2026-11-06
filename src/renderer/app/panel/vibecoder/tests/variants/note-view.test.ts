// @vitest-environment happy-dom
// NoteView (note-view.tsx), en relecteur (T-21 à T-23) : une remarque envoyée sur un passage s'affiche sous lui,
// grisée ; *Poser une question à l'agent* cite le passage dans le champ (prefill) sans rien envoyer ; « À revoir »
// ne pose aucune remarque et n'ouvre pas la zone : le bouton de remarque l'ouvre.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { NoteView } from '../../note-view';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const calls: unknown[][] = [];
const text = '# Titre\n\n- premier point\n- second point\n';
const draw = (over: Partial<VibeView> = {}, mark: 'ok' | 'ko' | null = null) => act(() => {
  const view = { lang: 'fr', flow: 'review', actions: [{ id: 'comment' }], outputs: {}, questions: [], draft: [], pr: null,
    note: { id: 'n', path: 'docs/tickets/x.md', text, before: null, locked: null, mustNot: [], mark }, agent: { model: 'fable' }, ...over } as unknown as VibeView;
  const props = { view, step: { id: 'note', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
    answers: {}, onAnswer: () => {}, code: null, drafts: [{}, () => {}], questions: {},
    act: { run: async (...a: unknown[]) => { calls.push(['run', ...a]); return true; }, mark: (...a: unknown[]) => { calls.push(['mark', ...a]); },
      set: () => {}, prefill: (...a: unknown[]) => { calls.push(['prefill', ...a]); }, open: () => {}, openLink: () => {},
      follow: () => {}, save: async () => true, draft: (...a: unknown[]) => { calls.push(['draft', ...a]); } } } as unknown as StepProps;
  root.render(createElement(NoteView, props));
});
const items = () => [...page.querySelectorAll<HTMLElement>('.vc-md li')].filter((li) => li.textContent?.includes('point') && !li.closest('.vc-draft-list'));
const button = (label: string, within: ParentNode = page) => [...within.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label || b.getAttribute('aria-label') === label);

it('une remarque envoyée sur un passage : visible sous lui, grisée, pas sous les autres', async () => {
  await draw({ draft: [{ id: 4, target: 'note: premier point', text: 'trop vague' }] } as never);
  const [first, second] = items();
  const list = first.querySelector('.vc-remarks-muted');
  expect(list?.textContent).toBe('trop vague');
  expect(second.querySelector('.vc-remarks-muted')).toBeNull();
  expect(page.querySelectorAll('.vc-remarks-muted')).toHaveLength(1);
});

it('Poser une question : le passage cité dans le champ, rien d\'envoyé', async () => {
  await draw();
  calls.length = 0;
  await act(() => button('Poser une question à l\'agent', items()[1])!.click());
  expect(calls).toEqual([['prefill', 'comment', 'second point']]);
  await draw({ actions: [] });
  expect(button('Poser une question à l\'agent')).toBeUndefined();
});

it('À revoir : le bouton de remarque, aucune remarque ajoutée ; la zone ne s\'ouvre que par lui', async () => {
  await draw({}, null);
  calls.length = 0;
  await act(() => button('À revoir')!.click());
  expect(calls).toEqual([['mark', 'note', 'ko']]);
  await draw({}, 'ko');
  expect(page.querySelector('textarea')).toBeNull();
  await act(() => button('Ajouter une remarque au brouillon')!.click());
  expect(page.querySelector('textarea')).not.toBeNull();
  expect(calls.filter((c) => c[0] === 'draft')).toEqual([]);
});

it('cas trouvé : une remarque sur un bloc hors liste (titre) : sous lui, grisée, sans cible au-dessus', async () => {
  await draw({ draft: [{ id: 7, target: 'note: Titre', text: 'à préciser' }] } as never);
  expect(page.querySelector('.vc-block .vc-remarks-muted')!.textContent).toBe('à préciser');
  expect(page.querySelector('.vc-draft-target')).toBeNull();
});

it('cas trouvé : Poser une question sur un titre cite le titre', async () => {
  await draw();
  calls.length = 0;
  await act(() => button('Poser une question à l\'agent', page.querySelector<HTMLElement>('.vc-block')!)!.click());
  expect(calls).toEqual([['prefill', 'comment', 'Titre']]);
});
