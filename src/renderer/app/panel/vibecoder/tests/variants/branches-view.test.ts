// @vitest-environment happy-dom
// BranchesView (branches-view.tsx) : les listes à l'ouverture, une PR suivie et chargée, une branche locale, les choix
// de la PR chargée d'après le relevé, Rester sur la branche, Créer une branche ({ branch, start }), Actualiser.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeAction, VibePr, VibeView } from 'technicals/bridge';
import { BranchesView } from '../../branches-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
const root = createRoot(page);
const a = (id: string, hidden = false, disabled: string | null = null) => ({
  id, label: id, hint: '', kind: 'send', step: null, models: [], hidden, disabled, direct: { running: false, last: null, only: true },
}) as unknown as VibeAction;
const pr: VibePr = { number: 7, title: 'T', url: '', author: '', base: 'master', head: 'feat', body: '', state: 'OPEN' };
const item = (number: number) => ({ number, title: `PR ${number}`, author: '', url: '' });

let sets: unknown[] = [];
let runs: unknown[] = [];
beforeEach(() => { sets = []; runs = []; });
const draw = (actions: VibeAction[], loaded: VibePr | null = pr) => act(() => {
  const view = {
    lang: 'fr', flow: 'create', actions, loaded, worktree: null, repo: { branch: 'feat', base: 'master', changed: 0 },
    prs: { mine: [item(1)], review: [item(2)], all: [item(1), item(2)] }, branches: ['master', 'feat'],
  } as unknown as VibeView;
  const acts = { set: (p: unknown) => sets.push(p), run: async (id: string, x: unknown) => { runs.push([id, x]); return true; }, openLink: () => {} };
  root.render(createElement(BranchesView, { view, t: t('fr'), act: acts, busy: false }));
});
const labels = () => [...page.querySelectorAll('button')].map((b) => b.textContent ?? '');
const button = (text: string) => [...page.querySelectorAll('button')].find((b) => b.textContent?.startsWith(text))!;
const type = (el: HTMLInputElement, value: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(el, value);
  el.dispatchEvent(new Event('input', { bubbles: true }));
});

it('BranchesView : les listes demandées à l\'ouverture ; un clic sur une PR la suit et la charge', async () => {
  await draw([a('load-pr')]);
  expect(sets[0]).toEqual({ prs: true });
  button('À relire').click();
  await act(async () => {});
  button('#2').click();
  expect(sets.at(-1)).toEqual({ pr: 2 });
  expect(runs.at(-1)).toEqual(['load-pr', { direct: true, pr: 2 }]);
});

it('BranchesView : Branches locales, l\'active marquée et pas cliquable, une autre → switch-branch', async () => {
  await draw([a('switch-branch')]);
  button('Branches locales').click();
  await act(async () => {});
  expect(button('feat').disabled).toBe(true);
  expect(page.querySelector('li[aria-current] .vc-pr-item-title')?.textContent).toBe('feat');
  button('master').click();
  expect(runs.at(-1)).toEqual(['switch-branch', { direct: true, branch: 'master' }]);
});

it('BranchesView : dossier propre, Changer de branche et Revenir, rien de masqué ni Rester', async () => {
  await draw([a('load-pr'), a('pr-here'), a('pr-worktree', true), a('stash', true), a('unload-pr')]);
  const l = labels();
  expect(l.some((x) => x.startsWith('pr-here'))).toBe(true);
  expect(l.some((x) => x.startsWith('pr-worktree') || x.startsWith('stash'))).toBe(false);
  expect(l).not.toContain('Rester sur la branche');
  button('unload-pr').click();
  expect(runs.at(-1)).toEqual(['unload-pr', { direct: true }]);
});

it('BranchesView : des modifications, Changer de branche grisé, stash, Rester sur la branche', async () => {
  await draw([a('pr-here', false, 'Des modifications en cours'), a('pr-worktree'), a('stash'), a('unload-pr', false, 'Des modifications en cours')]);
  expect(button('pr-here').disabled).toBe(true);
  button('stash').click();
  expect(runs.at(-1)).toEqual(['stash', { direct: true }]);
  button('Rester sur la branche').click();
  expect(sets.at(-1)).toEqual({ pr: null });
});

it('BranchesView : sans PR chargée, Revenir sur la branche principale sans Rester', async () => {
  await draw([a('unload-pr'), a('stash')], null);
  expect(labels().some((x) => x.startsWith('unload-pr'))).toBe(true);
  expect(labels()).not.toContain('Rester sur la branche');
});

it('BranchesView : Créer une branche, grisé sans nom, puis { branch } (origin/<base>, le défaut du principal) ou { branch, start } (une locale)', async () => {
  await draw([a('new-here'), a('new-worktree')], null);
  expect(button('new-here').disabled).toBe(true);
  await type(page.querySelector('.vc-br-new input')!, ' feat/x ');
  button('new-here').click();
  expect(runs.at(-1)).toEqual(['new-here', { direct: true, branch: 'feat/x' }]);
  await type(page.querySelector('.vc-br-new input')!, 'feat/y');
  await act(() => {
    const sel = page.querySelector('select')!;
    sel.value = 'feat';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
  });
  button('new-worktree').click();
  expect(runs.at(-1)).toEqual(['new-worktree', { direct: true, branch: 'feat/y', start: 'feat' }]);
});

it('BranchesView : Actualiser et Retirer le worktree, directs ; absents si masqués', async () => {
  await draw([a('fetch'), a('remove-worktree', true)], null);
  expect(labels().some((x) => x.startsWith('remove-worktree'))).toBe(false);
  button('fetch').click();
  expect(runs.at(-1)).toEqual(['fetch', { direct: true }]);
});

it('BranchesView : la recherche filtre l\'onglet ouvert ; rien : « Aucun résultat. »', async () => {
  await draw([a('load-pr'), a('switch-branch')]);
  button('Toutes les PR').click();
  await act(async () => {});
  await type(page.querySelector('.vc-br-search')!, 'pr 2');
  expect([...page.querySelectorAll('.vc-pr-item-number')].map((e) => e.textContent)).toEqual(['#2']);
  await type(page.querySelector('.vc-br-search')!, 'zz');
  expect(page.textContent).toContain('Aucun résultat.');
  button('Branches locales').click();
  await type(page.querySelector('.vc-br-search')!, 'mas');
  expect([...page.querySelectorAll('.vc-pr-item-title')].map((e) => e.textContent)).toEqual(['master']);
  await type(page.querySelector('.vc-br-search')!, '');   // la page est gardée d'un cas à l'autre
});

it('BranchesView : Me demander en relecture, dans Toutes les PR, sur une PR ni des miennes ni à relire', async () => {
  const draw3 = (last: { ok: boolean; line: string } | null) => act(() => {
    const ask = { ...a('request-review'), label: 'Me demander en relecture', direct: { running: false, last, only: true } } as unknown as VibeAction;
    const view = {
      lang: 'fr', flow: 'create', actions: [a('load-pr'), ask], loaded: null, worktree: null, repo: { branch: 'feat', base: 'master', changed: 0 },
      prs: { mine: [item(1)], review: [item(2)], all: [item(1), item(2), item(3)] }, branches: [],
    } as unknown as VibeView;
    const acts = { set: (p: unknown) => sets.push(p), run: async (id: string, x: unknown) => { runs.push([id, x]); return true; }, openLink: () => {} };
    root.render(createElement(BranchesView, { view, t: t('fr'), act: acts, busy: false }));
  });
  await draw3(null);
  expect(labels().filter((l) => l === 'Me demander en relecture')).toEqual([]);   // pas dans Mes PR
  button('Toutes les PR').click();
  await act(async () => {});
  expect(labels().filter((l) => l === 'Me demander en relecture').length).toBe(1);   // la #3 seulement
  button('Me demander en relecture').click();
  expect(runs.at(-1)).toEqual(['request-review', { direct: true, pr: 3 }]);
  await draw3({ ok: false, line: 'Review cannot be requested from pull request author.' });
  expect(page.textContent).toContain('✗ Review cannot be requested from pull request author.');
});

it('BranchesView : dans un worktree (view.child), Actualiser et Retirer le worktree seulement', async () => {
  await act(() => {
    const view = {
      lang: 'fr', flow: 'review', child: true, loaded: pr, worktree: { state: 'robot', temp: true, dir: '/w' },
      actions: [a('fetch'), a('remove-worktree'), a('load-pr'), a('switch-branch'), a('new-here'), a('stash')],
      repo: { branch: 'pr-7', base: 'master', changed: 0 }, prs: { mine: [item(1)], review: [], all: [item(1)] }, branches: ['master', 'pr-7'],
    } as unknown as VibeView;
    const acts = { set: (p: unknown) => sets.push(p), run: async (id: string, x: unknown) => { runs.push([id, x]); return true; }, openLink: () => {} };
    root.render(createElement(BranchesView, { view, t: t('fr'), act: acts, busy: false }));
  });
  expect(labels().filter((l) => !l.startsWith('fetch') && !l.startsWith('remove-worktree'))).toEqual([]);
  expect([page.querySelector('.vc-seg'), page.querySelector('.vc-br-new'), page.querySelector('.vc-br-search')]).toEqual([null, null, null]);
  expect(page.textContent).toContain('Un worktree reste sur sa branche');
});
