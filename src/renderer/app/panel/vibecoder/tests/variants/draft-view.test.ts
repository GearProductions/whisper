// @vitest-environment happy-dom
// DraftView (draft-view.tsx) : ses boutons-icônes (IconButton) gardent leur action — edit ouvre la zone de
// commentaire, close retire la remarque (act.draft remove), external ouvre le lien de la revue publiée.
// Revue publiée et brouillon identiques (reviewSent) : Publier grisé (« déjà publiée »), la carte grisée et résumée ;
// sinon Publier comme avant ; un verdict proposé n'est jamais publié sans le clic.
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

// ---- La revue publiée : Publier grisé tant qu'elle est celle du brouillon (T-21, T-23, T-24) ----
const remark = { id: 3, target: 'note', text: 'bof' };
const body = '- [note] bof';
const runs: unknown[][] = [];
const publish = { id: 'publish', kind: 'send', label: 'Publier', hint: 'Publier la revue', who: 'x', step: 'revue' };

async function show(review: Record<string, unknown>, draft: unknown[], verdict: string) {
  runs.length = 0;
  const view = { lang: 'fr', flow: 'review', actions: [publish], pr: { number: 7 }, draft,
    outputs: { 'pr-7-review.json': { text: JSON.stringify(review), time: 0 } } } as unknown as VibeView;
  const props = { view, step: { id: 'revue', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, verdict,
    onVerdict: () => {}, act: { run: async (...a: unknown[]) => { runs.push(a); return true; }, draft: () => {}, openLink: () => {} } } as unknown as StepProps;
  await act(() => root.render(createElement(DraftView, props)));
  return page.querySelector<HTMLButtonElement>('.vc-publish button.vc-run')!;
}
const sent = { state: 'APPROVED', url, verdict: 'approve', body, at: '2026-11-06T10:00:00Z' };

it('une revue publiée, brouillon et verdict inchangés : Publier grisé, le résumé', async () => {
  const b = await show(sent, [remark], 'approve');
  expect(b.disabled).toBe(true);
  expect(b.textContent).toContain('déjà publiée');
  const card = page.querySelector('.vc-published')!;
  expect(card.classList.contains('vc-sent')).toBe(true);
  expect(card.textContent).toContain('Approuvée');
  expect(card.textContent).toContain('1 remarque');
  expect(card.textContent).toContain(new Date('2026-11-06T10:00:00Z').toLocaleString('fr'));
  expect(card.querySelector('button.vc-tool[aria-label^="Voir la revue sur GitHub"]')).not.toBeNull();
});

it('un autre verdict seul : Publier possible', async () => {
  const b = await show(sent, [remark], 'comment');
  expect(b.disabled).toBe(false);
  expect(page.querySelector('.vc-published')!.classList.contains('vc-sent')).toBe(false);
  await act(() => b.click());
  expect(runs).toEqual([['publish', { verdict: 'comment' }]]);
});

it('une remarque de plus : Publier possible', async () => {
  const b = await show(sent, [remark, { id: 4, target: 'commit', text: 'ko' }], 'approve');
  expect(b.disabled).toBe(false);
});

it('une revue d\'avant (state et url seuls) : Publier possible, comme aujourd\'hui', async () => {
  const b = await show({ state: 'APPROVED', url }, [remark], 'approve');
  expect(b.disabled).toBe(false);
  expect(page.querySelector('.vc-published')!.classList.contains('vc-sent')).toBe(false);
});

it('un À revoir quelque part : Demander des changements proposé, rien ne part', async () => {
  const b = await show({ state: 'APPROVED', url }, [remark], 'request-changes');
  expect(page.querySelector('button[data-verdict="request-changes"]')!.getAttribute('aria-pressed')).toBe('true');
  expect(runs).toEqual([]);
  await act(() => b.click());
  expect(runs).toEqual([['publish', { verdict: 'request-changes' }]]);
});
