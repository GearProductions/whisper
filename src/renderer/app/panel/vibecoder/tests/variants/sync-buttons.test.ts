// @vitest-environment happy-dom
// SyncButtons (sync-buttons.tsx) : Pull, Rebase, Pousser d'après le relevé (masqués absents, grisés avec
// leur raison), la pastille de Rebase quand origin/<base> a avancé, ▾ → { onto }, le dernier échec en infobulle.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import type { VibeAction, VibeArgs, VibeView } from 'technicals/bridge';
import { SyncButtons } from '../../sync-buttons';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
const root = createRoot(page);
const a = (id: string, more: Partial<VibeAction> = {}) =>
  ({ id, label: id, hint: '', kind: 'send', step: null, hidden: false, disabled: null, direct: { running: false, last: null, only: true }, ...more }) as unknown as VibeAction;
const runs: [string, VibeArgs | undefined][] = [];
const draw = (actions: VibeAction[], sync: VibeView['sync'] = { behind: 2, baseAhead: 0 }) => act(() => {
  const view = { lang: 'fr', actions, repo: { branch: 'feat/x', base: 'master', changed: 0 }, branches: ['master', 'feat/x', 'dev'], sync } as unknown as VibeView;
  root.render(createElement(SyncButtons, { view, onRun: (id: string, args?: VibeArgs) => { runs.push([id, args]); } }));
});
const buttons = () => [...page.querySelectorAll('button')];
const button = (id: string) => buttons().find((b) => b.getAttribute('aria-label') === id)!;

it('SyncButtons : Pull en retard actif, Pousser masqué absent, rien sans les actions', async () => {
  await draw([a('pull'), a('rebase'), a('push', { hidden: true }), a('ask')]);
  expect(buttons().map((b) => b.getAttribute('aria-label'))).toEqual(['pull', 'rebase']);
  expect(buttons().map((b) => [b.querySelector('svg') !== null, b.textContent])).toEqual([[true, ''], [true, '']]);   // des icônes, plus de ⇣ ⤴
  button('pull').click();
  expect(runs.at(-1)).toEqual(['pull', { direct: true }]);
  await draw([a('ask')]);
  expect(page.innerHTML).toBe('');
});

it('SyncButtons : Pull à jour grisé avec sa raison, Pousser montré, son échec en infobulle', async () => {
  await draw([a('pull', { disabled: 'Déjà à jour' }), a('rebase'),
    a('push', { direct: { running: false, last: { ok: false, line: 'push refusé', detail: '', time: 0 } } })]);
  expect(button('pull').disabled).toBe(true);
  expect(button('pull').title).toContain('Déjà à jour');
  expect(button('push').title).toContain('push refusé');
  expect(button('push').hasAttribute('data-ko')).toBe(true);
});

it('SyncButtons : la pastille de Rebase seulement quand origin/<base> a avancé', async () => {
  await draw([a('pull'), a('rebase')], { behind: 0, baseAhead: 0 });
  expect(page.querySelector('.vc-sync-dot')).toBeNull();
  await draw([a('pull'), a('rebase')], { behind: 0, baseAhead: 3 });
  expect(page.querySelector('.vc-sync-dot')?.textContent).toBe('3');
  expect(button('rebase').title).toContain('origin/master a avancé de 3 commits');
});

it('SyncButtons : Rebase sur origin/<base> par défaut, ▾ une branche locale → { onto }', async () => {
  await draw([a('rebase')]);
  const select = page.querySelector('select')!;
  expect([...select.options].map((o) => o.textContent)).toEqual(['origin/master', 'master', 'dev']);
  button('rebase').click();
  expect(runs.at(-1)).toEqual(['rebase', { direct: true }]);
  await act(() => { select.value = 'dev'; select.dispatchEvent(new Event('change', { bubbles: true })); });
  button('rebase').click();
  expect(runs.at(-1)).toEqual(['rebase', { direct: true, onto: 'dev' }]);
});
