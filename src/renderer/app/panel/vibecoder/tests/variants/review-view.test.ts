// @vitest-environment happy-dom
// ReviewView (review-view.tsx), finitions : Relancer une vérification → IconButton refresh (libellé en title et
// aria-label), même action (checks, son rang), même état grisé, son clic ne replie pas le détail ; une remarque
// appliquée et le bandeau « Appliquée » → Icon ok (plus de ✓ en texte) ; Appliquer garde son texte.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeAction, VibeView } from 'technicals/bridge';
import { ReviewView } from '../../review-view';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const action = (id: string) => ({ id, label: id, hint: '', kind: 'run', step: 'revue', who: 'haiku', models: [],
  hidden: false, disabled: null, primary: false }) as unknown as VibeAction;
const checks = JSON.stringify({ items: [{ name: 'tsc', ok: false, detail: 'erreur\nligne 2' }, { name: 'lint', ok: true }] });
const out = (text: string, time = 1) => ({ text, time });
const runs: unknown[][] = [];
const draw = (ponytail: string, applied: string[], busy = false) => act(() => {
  const view = { lang: 'fr', flow: 'create', actions: [action('checks'), action('apply')], checklist: [], commits: [], steps: [], draft: [],
    outputs: { 'checks.json': out(checks), 'ponytail.md': out(ponytail), 'ponytail-applied.json': out(JSON.stringify({ applied }), 2) } } as unknown as VibeView;
  const props = { view, step: { id: 'revue', status: 'current', facts: '', open: true }, t: t('fr'), busy, text: '', setText: () => {},
    code: null, drafts: [{}, () => {}], act: { run: (...a: unknown[]) => runs.push(a), follow: () => {}, mark: () => {}, prefill: () => {},
      draft: () => {}, open: () => {}, openLink: () => {}, save: async () => true } } as unknown as StepProps;
  root.render(createElement(ReviewView, props));
});
const again = () => [...page.querySelectorAll<HTMLButtonElement>('.vc-check-again button')];

it('Relancer une vérification : IconButton nommé, checks avec son rang, sans replier le détail, grisé pendant busy', async () => {
  await draw('- une remarque', []);
  const [first, second] = again();
  expect(again()).toHaveLength(2);
  for (const b of [first, second]) {
    expect(b.classList.contains('vc-tool')).toBe(true);
    expect(b.getAttribute('aria-label')).toBe('Relancer cette vérification seule');
    expect(b.getAttribute('title')).toBe('Relancer cette vérification seule');
    expect(b.querySelector('svg')).not.toBeNull();
  }
  const click = new MouseEvent('click', { bubbles: true, cancelable: true });
  await act(() => { second.dispatchEvent(click); });
  expect(runs.at(-1)).toEqual(['checks', { check: 1 }]);
  expect(click.defaultPrevented).toBe(true);   // dans un <summary>, le clic ne replie pas le détail
  await draw('- une remarque', [], true);
  expect(again().every((b) => b.disabled)).toBe(true);
});

it('une remarque appliquée : Icon ok nommée ; Appliquer garde son texte ; toutes : le bandeau, Icon ok + texte', async () => {
  await draw('- a.ts:L1 faite\n- b.ts:L2 à faire', ['a.ts:L1']);
  const mark = page.querySelector('.vc-remark-applied')!;
  expect(mark.getAttribute('aria-label')).toBe('Appliquée');
  expect(mark.querySelector('svg')).not.toBeNull();
  expect(mark.textContent).toBe('');
  expect(page.querySelector('.vc-apply-one')!.textContent).toBe('Appliquer');
  expect(page.querySelector('.vc-applied-banner')).toBeNull();
  await draw('- a.ts:L1 faite', ['a.ts:L1']);
  const banner = page.querySelector('.vc-applied-banner')!;
  expect(banner.querySelector('svg')).not.toBeNull();
  expect(banner.textContent).toBe('Appliquée');
});
