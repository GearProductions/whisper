// @vitest-environment happy-dom
// DraftView (draft-view.tsx) : ses boutons-icônes (IconButton) gardent leur action — edit ouvre la zone de
// commentaire, close retire la remarque (act.draft remove), external ouvre le lien de la revue publiée.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { DraftView } from '../../draft-view';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const drafts: unknown[] = [];
const links: string[] = [];
const url = 'https://github.com/o/r/pull/7#pullrequestreview-1';

it('edit, close, external : vc-tool nommés, même action', async () => {
  const view = { lang: 'fr', flow: 'review', actions: [], pr: { number: 7 }, draft: [{ id: 3, target: 'note', text: 'bof' }],
    outputs: { 'pr-7-review.json': { text: JSON.stringify({ state: 'APPROVED', url }), time: 0 } } } as unknown as VibeView;
  const props = { view, step: { id: 'revue', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, verdict: 'comment',
    onVerdict: () => {}, act: { run: async () => true, draft: (op: unknown) => { drafts.push(op); }, openLink: (u: string) => { links.push(u); } } } as unknown as StepProps;
  await act(() => root.render(createElement(DraftView, props)));
  const tool = (label: string) => page.querySelector<HTMLButtonElement>(`button.vc-tool[aria-label^="${label}"]`)!;
  for (const b of page.querySelectorAll('button.vc-tool')) {
    expect(b.getAttribute('title')).toBe(b.getAttribute('aria-label'));
    expect(b.querySelector('svg')).not.toBeNull();
  }
  await act(() => tool('Voir la revue sur GitHub').click());
  expect(links).toEqual([url]);
  await act(() => tool('Retirer du brouillon').click());
  expect(drafts).toEqual([{ remove: 3 }]);
  await act(() => tool('Modifier cette remarque').click());
  expect(page.querySelector('textarea')).not.toBeNull();
});
