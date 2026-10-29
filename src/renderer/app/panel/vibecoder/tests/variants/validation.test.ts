// @vitest-environment happy-dom
// validation (validation.tsx) : CaseVerdict, deux boutons-icônes (Valider, À revoir), celui donné pressé,
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
  expect(buttons().map((b) => [b.getAttribute('aria-label'), b.title, b.getAttribute('aria-pressed'), b.className]))
    .toEqual([['Valider', 'Valider', 'false', 'vc-tool vc-verdict-ok'], ['À revoir', 'À revoir', 'false', 'vc-tool vc-verdict-ko']]);
  expect(page.querySelectorAll('svg')).toHaveLength(2);
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
