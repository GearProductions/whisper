// @vitest-environment happy-dom
// ModulesView (modules-view.tsx) : le 💬 du commit proposé devenu IconButton comment, même action (cite la
// première ligne du message), absent sans l'action comment.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { ModulesView } from '../../modules-view';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const prefills: unknown[][] = [];
const draw = (actions: { id: string }[]) => act(() => {
  const view = { lang: 'fr', flow: 'create', actions, modules: [], commits: [],
    outputs: { 'commit.md': { text: 'feat : sujet\n\ncorps\n', time: 0 } } } as unknown as VibeView;
  const props = { view, step: { id: 'modules', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
    code: null, drafts: [{}, () => {}], act: { run: async () => true, prefill: (...a: unknown[]) => { prefills.push(a); }, open: () => {},
      openLink: () => {}, follow: () => {}, save: async () => true } } as unknown as StepProps;
  root.render(createElement(ModulesView, props));
});
const quote = () => page.querySelector<HTMLButtonElement>('button[aria-label="Citer le message dans le champ"]');

it('commit proposé : IconButton comment, cite le sujet ; absent sans l\'action', async () => {
  await draw([{ id: 'comment' }]);
  expect(page.textContent).not.toContain('💬');
  expect(quote()!.className).toBe('vc-tool');
  expect(quote()!.title).toBe('Citer le message dans le champ');
  expect(quote()!.querySelector('svg')).not.toBeNull();
  quote()!.click();
  expect(prefills).toEqual([['comment', 'feat : sujet']]);
  await draw([]);
  expect(quote()).toBeNull();
});

// Le module : un accordéon ; replié, sa ligne seule ; déplié, ses outils sur sa ligne et son contrat par rubrique.
const module = (path: string, touched: boolean) => ({ path, contract: 'Fait `x` · ne connaît pas : y', file: { id: path, path }, touched, commits: [],
  ...(touched ? { files: [{ id: `${path}/0`, path: `${path}/a.ts` }] } : {}) });
const followed: unknown[] = [];
const drawModules = () => act(() => {
  const view = { lang: 'fr', flow: 'create', actions: [{ id: 'module' }], commits: [], outputs: {},
    modules: [module('src/touche', true), module('src/autre', false)] } as unknown as VibeView;
  const props = { view, step: { id: 'modules', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
    code: null, drafts: [{}, () => {}], act: { run: async () => true, prefill: () => {}, open: () => {}, openLink: () => {},
      follow: (id: unknown) => { followed.push(id); }, save: async () => true } } as unknown as StepProps;
  root.render(createElement(ModulesView, props));
});
const row = (i: number) => page.querySelectorAll<HTMLDetailsElement>('details.vc-mod-main')[i];
const toggle = (i: number, open: boolean) => act(async () => { row(i).open = open; });

it('un module : replié, sans outils ni fichiers ; déplié, outils sur sa ligne, contrat par rubrique, le fichier suivi ; un seul déplié, sans code ou replié : plus aucun fichier suivi', async () => {
  await drawModules();
  expect(row(0).open).toBe(false);
  expect(row(0).querySelector('.vc-mod-acts')).toBeNull();
  await toggle(0, true);
  expect(row(0).querySelector('summary .vc-mod-acts button')?.textContent).toBe('Générer');
  expect(row(0).querySelector('.vc-fcontract code')?.textContent).toBe('x');
  expect(row(0).querySelector('.vc-mod-tree')).not.toBeNull();
  expect(followed).toEqual(['src/touche/0']);
  // un seul déplié ; déplier un module sans code, ou replier : plus aucun fichier suivi
  await toggle(1, true);
  expect([row(0).open, row(1).open]).toEqual([false, true]);
  expect(row(1).querySelector('.vc-mod-tree')).toBeNull();
  expect(followed).toEqual(['src/touche/0', null]);
  await toggle(1, false);
  expect(followed).toEqual(['src/touche/0', null, null]);
});
