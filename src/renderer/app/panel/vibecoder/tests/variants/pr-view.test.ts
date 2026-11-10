// @vitest-environment happy-dom
// PrView (pr-view.tsx) : ci.md étiquetée ([toi] / [agent]) : ses badges, data-tag sur la ligne ; sans étiquette, comme avant.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { PrView } from '../../pr-view';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);

it('ci.md étiquetée : ses badges, data-tag sur chaque point, plus de crochets ; un point sans étiquette : comme avant', async () => {
  const view = { lang: 'fr', flow: 'create', actions: [], commits: [], pr: { number: 7, title: 'x', url: 'https://github.com/o/r/pull/7' },
    outputs: { 'ci.md': { text: '- [agent] le lint échoue\n- [toi] un test change le contrat\n- rien', time: 0 } } } as unknown as VibeView;
  const props = { view, step: { id: 'pr', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
    code: null, drafts: [{}, () => {}], act: { run: async () => true, prefill: () => {}, open: () => {}, openLink: () => {} } } as unknown as StepProps;
  await act(() => root.render(createElement(PrView, props)));
  const items = [...page.querySelectorAll<HTMLElement>('.vc-md li')];
  expect(items.map((li) => li.getAttribute('data-tag'))).toEqual(['agent', 'toi', null]);
  expect([...page.querySelectorAll('.vc-md .vc-tag-badge')].map((b) => b.textContent)).toEqual(['pour l\'agent', 'pour toi']);
  expect(page.querySelector('.vc-md')!.textContent).not.toContain('[');
});
