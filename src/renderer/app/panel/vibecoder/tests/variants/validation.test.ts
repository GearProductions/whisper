// @vitest-environment happy-dom
// validation (validation.tsx) : CaseVerdict, deux badges écrits (Validé, À revoir), celui donné pressé,
// un second clic l'annule ; MarkControl, l'icône devant le texte, sans glyphe Unicode.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { CaseVerdict, MarkControl } from '../../validation';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const buttons = () => [...page.querySelectorAll('button')];

it('CaseVerdict : libellés, pressé = le verdict donné, un second clic annule', async () => {
  const marks: unknown[] = [];
  const draw = (state: 'ok' | 'ko' | null) => act(() => root.render(createElement(CaseVerdict,
    { state, lang: 'fr', onMark: (v) => { marks.push(v); } })));
  await draw(null);
  expect(buttons().map((b) => [b.textContent, b.title, b.getAttribute('aria-pressed'), b.className]))
    .toEqual([['Validé', 'Valider', 'false', 'vc-verdict-ok'], ['À revoir', 'À revoir', 'false', 'vc-verdict-ko']]);
  buttons()[0].click();
  buttons()[1].click();
  await draw('ok');
  expect(buttons().map((b) => b.getAttribute('aria-pressed'))).toEqual(['true', 'false']);
  expect(buttons().map((b) => b.title)).toEqual(['Validé — Cliquer de nouveau pour annuler', 'À revoir']);
  buttons()[0].click();
  buttons()[1].click();
  await draw('ko');
  buttons()[1].click();
  expect(marks).toEqual(['ok', 'ko', null, 'ko', null]);
});

it('MarkControl : l\'icône devant le texte, même texte, mêmes actions', async () => {
  const marks: unknown[] = [];
  const draw = (state: 'ok' | 'ko' | 'changed' | null, review = false) => act(() => root.render(createElement(MarkControl,
    { what: 'note', state, review, lang: 'fr', onMark: (v) => { marks.push(v); } })));
  await draw(null, true);
  expect(buttons().map((b) => [b.textContent, b.querySelector('svg') !== null])).toEqual([['Valider la note', true], ['À revoir', true]]);
  buttons()[0].click();
  buttons()[1].click();
  await draw('changed');
  expect(page.textContent).toBe('Modifiée depuis la validationRevalider');
  expect(page.querySelectorAll('svg')).toHaveLength(2);
  await draw('ko');
  expect(page.querySelector('.vc-vstate')!.textContent).toBe('Note refusée');
  buttons()[0].click();
  expect(marks).toEqual(['ok', 'ko', null]);
  expect(page.textContent).not.toMatch(/[✓✗⚠]/);
});

it('onRemark : sur un « À revoir », le bouton, cliqué → onRemark, rien d\'autre (CaseVerdict et MarkControl)', async () => {
  const log: unknown[] = [];
  const onRemark = () => { log.push('remark'); };
  const onMark = (v: unknown) => { log.push(v); };
  const remark = () => buttons().filter((b) => b.textContent === 'Ajouter une remarque au brouillon');
  await act(() => root.render(createElement(CaseVerdict, { state: 'ko', lang: 'fr', onMark, onRemark })));
  expect(remark()).toHaveLength(1);
  remark()[0].click();
  await act(() => root.render(createElement(MarkControl, { what: 'note', state: 'ko', review: true, lang: 'fr', onMark, onRemark })));
  expect(remark()).toHaveLength(1);
  remark()[0].click();
  expect(log).toEqual(['remark', 'remark']);
  await act(() => root.render(createElement(MarkControl, { what: 'note', state: 'ko', review: true, lang: 'en', onMark, onRemark })));
  expect(buttons().map((b) => b.textContent)).toContain('Add a remark to the draft');
});

it('Validé, ou sans onRemark : pas de bouton', async () => {
  const onRemark = () => {};
  const none = () => buttons().filter((b) => b.textContent === 'Ajouter une remarque au brouillon');
  for (const state of ['ok', null, 'changed'] as const) {
    await act(() => root.render(createElement(MarkControl, { what: 'note', state, review: true, lang: 'fr', onMark: () => {}, onRemark })));
    expect(none()).toHaveLength(0);
  }
  await act(() => root.render(createElement(MarkControl, { what: 'note', state: 'ko', review: true, lang: 'fr', onMark: () => {} })));
  expect(none()).toHaveLength(0);
  for (const state of ['ok', null] as const) {
    await act(() => root.render(createElement(CaseVerdict, { state, lang: 'fr', onMark: () => {}, onRemark })));
    expect(none()).toHaveLength(0);
  }
  await act(() => root.render(createElement(CaseVerdict, { state: 'ko', lang: 'fr', onMark: () => {} })));
  expect(none()).toHaveLength(0);
  expect(buttons()).toHaveLength(2);
});
