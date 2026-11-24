// @vitest-environment happy-dom
// Breadcrumb (breadcrumb.tsx) : les étapes en une ligne, toutes cliquables (même à venir), état, faits
// et raccourci en title ; « N commits » déplie la liste, re-clic la replie ; aucun
// commit : le texte, sans bouton ; un commit déplié : diff et GitHub en IconButton, mêmes ids
// (c<rang>, gh:c<rang>), ses fichiers en texte simple.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeAction, VibeView } from 'technicals/bridge';
import { Breadcrumb } from '../../breadcrumb';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const s = t('fr');

type Vibe = { a: VibeAction; on: boolean } | null;
const calls: string[] = [];
async function mount(view: VibeView, picked: string[] = [], opened: string[] = [], vibe: Vibe = null, onExpress?: (on: boolean) => void) {
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  await act(() => root.render(createElement(Breadcrumb, { view, t: s, selected: 'note', vibe, onVibe: () => { calls.push('vibe'); }, onExpress, onStopVibe: () => { calls.push('stop'); }, onPick: (id: string) => { picked.push(id); }, onOpen: (id: string) => { opened.push(id); } })));
  return { page, unmount: () => act(() => root.unmount()) };
}

it('étapes : une ligne, toutes cliquables, choisie en aria-current, état et faits en title', async () => {
  const picked: string[] = [];
  const view = { steps: [
    { id: 'note', status: 'done', facts: '3 sections' },
    { id: 'forme', status: 'todo', facts: '' },
  ], commits: [] } as unknown as VibeView;
  const { page, unmount } = await mount(view, picked);
  expect(page.querySelector('nav')!.getAttribute('aria-label')).toBe(s.journey);
  const steps = [...page.querySelectorAll<HTMLButtonElement>('.vc-jstep')];
  expect(steps.map((b) => [b.textContent, b.disabled, b.getAttribute('aria-current'), b.title])).toEqual([
    [s.steps.note, false, 'step', `${s.steps.note} — ${s.stepStatus.done} · 3 sections (${s.shortcut(1)})`],
    [s.steps.forme, false, null, `${s.steps.forme} — ${s.stepStatus.todo} (${s.shortcut(2)})`],
  ]);
  for (const b of steps) await act(() => b.click());
  expect(picked).toEqual(['note', 'forme']);
  expect(page.querySelector('.vc-ccount')!.tagName).toBe('SPAN');
  expect(page.querySelector('.vc-ccount')!.textContent).toBe(s.commitsOf(0));
  await unmount();
});

it('commits : N commits déplie, re-clic replie ; un commit déplié : diff et GitHub en icônes, mêmes ids, fichiers en texte', async () => {
  const opened: string[] = [];
  const view = { steps: [], commits: [{ hash: 'aaaaaaa1', subject: 'un', fixup: false, files: ['src/a.ts'] },
    { hash: 'bbbbbbb2', subject: 'fixup! un', fixup: true, files: ['src/b.ts'] }] } as unknown as VibeView;
  const { page, unmount } = await mount(view, [], opened);
  const count = page.querySelector<HTMLButtonElement>('button.vc-ccount')!;
  expect([count.textContent, count.getAttribute('aria-expanded')]).toEqual([s.commitsOf(2), 'false']);
  expect(page.querySelector('.vc-commits')).toBeNull();
  await act(() => count.click());
  expect(count.getAttribute('aria-expanded')).toBe('true');
  expect([...page.querySelectorAll('.vc-commits li.fixup code')].map((c) => c.textContent)).toEqual(['bbbbbbb']);
  await act(() => (page.querySelectorAll('.vc-jcommit')[1] as HTMLButtonElement).click());
  const tools = [...page.querySelectorAll<HTMLButtonElement>('.vc-jcommit-links button')];
  expect(tools.map((b) => [b.className, b.title, b.getAttribute('aria-label'), !!b.querySelector('svg')]))
    .toEqual([['vc-tool', s.diffTitle, s.diffTitle, true], ['vc-tool', s.githubTitle, s.githubTitle, true]]);
  for (const b of tools) await act(() => b.click());
  expect([...page.querySelectorAll('.vc-jfiles li')].map((li) => [li.textContent, !!li.querySelector('button')])).toEqual([['src/b.ts', false]]);
  expect(opened).toEqual(['c1', 'gh:c1']);
  await act(() => count.click());
  expect(page.querySelector('.vc-commits')).toBeNull();
  await unmount();
});

it('liste ouverte : Échap (n\'atteint pas les autres Échap) ou un clic dehors la ferme, un clic dedans non ; écouteurs retirés', async () => {
  const view = { steps: [], commits: [{ hash: 'aaaaaaa1', subject: 'un', fixup: false, files: [] }] } as unknown as VibeView;
  const { page, unmount } = await mount(view);
  const count = page.querySelector<HTMLButtonElement>('button.vc-ccount')!;
  const other: string[] = [];
  const spy = (e: KeyboardEvent) => other.push(e.key);
  document.addEventListener('keydown', spy);
  const esc = () => act(() => { document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
  await esc();
  expect(other).toEqual(['Escape']); // fermée : l'Échap passe
  await act(() => count.click());
  await act(() => { page.querySelector('.vc-commits')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
  expect(page.querySelector('.vc-commits')).not.toBeNull();
  await act(() => { count.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
  expect(page.querySelector('.vc-commits')).not.toBeNull();
  await esc();
  expect(page.querySelector('.vc-commits')).toBeNull();
  expect(other).toEqual(['Escape']); // ouverte : capturé
  await act(() => count.click());
  await act(() => { document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true })); });
  expect(page.querySelector('.vc-commits')).toBeNull();
  await esc();
  expect(other).toEqual(['Escape', 'Escape']); // écouteurs retirés
  document.removeEventListener('keydown', spy);
  await unmount();
});

const act1 = (over: Partial<VibeAction> = {}) => ({ id: 'vibe', label: 'Reprendre', hint: 'reprendre le parcours', disabled: undefined, hidden: false, ...over }) as unknown as VibeAction;
const empty = { steps: [], commits: [] } as unknown as VibeView;
const runs = (page: HTMLElement) => [...page.querySelectorAll<HTMLButtonElement>('.vc-run')];

// 0.16.0 : un seul bouton pour le moteur (docs/tickets/feat/0.16.0-controle-en-trois-points.md).
it('arrêté hors d\'une pause (à la main, l\'appli relancée) : Reprendre à côté de « N commits », sans ligne ; un clic → onVibe', async () => {
  calls.length = 0;
  const { page, unmount } = await mount(empty, [], [], { a: act1(), on: false });
  const b = page.querySelector<HTMLButtonElement>('.vc-run')!;
  expect([b.textContent, b.title, b.dataset.tone, b.disabled, b.previousElementSibling?.className]).toEqual([act1().label, act1().hint, 'vibe', false, 'vc-ccount']);
  expect(page.querySelector('.vc-pause')).toBeNull();
  await act(() => b.click());
  expect(calls).toEqual(['vibe']);
  await unmount();
});

it('l\'action grisée : Reprendre grisé, sa raison en title ; masquée (note pas validée) ou null (relecteur) : rien', async () => {
  let m = await mount(empty, [], [], { a: act1({ disabled: 'rien à faire' }), on: false });
  const b = m.page.querySelector<HTMLButtonElement>('.vc-run')!;
  expect([b.textContent, b.disabled, b.title]).toEqual([act1().label, true, `${act1().hint}\n— rien à faire`]);
  await m.unmount();
  m = await mount(empty, [], [], { a: act1({ hidden: true }), on: false });
  expect(m.page.querySelector('.vc-run')).toBeNull();
  await m.unmount();
  m = await mount(empty, [], [], null);
  expect(m.page.querySelector('.vc-run')).toBeNull();
  await m.unmount();
});

it('le système enchaîne : Arrêter, un clic → onStopVibe ; même l\'action masquée (« déjà en cours »)', async () => {
  calls.length = 0;
  let m = await mount(empty, [], [], { a: act1(), on: true });
  expect(runs(m.page).map((b) => [b.textContent, b.title])).toEqual([[s.vibeStop, s.vibeStopTitle]]);
  await act(() => runs(m.page)[0].click());
  expect(calls).toEqual(['stop']);
  await m.unmount();
  m = await mount(empty, [], [], { a: act1({ hidden: true }), on: true });
  expect(runs(m.page).map((b) => b.textContent)).toEqual([s.vibeStop]);
  await m.unmount();
});

// 0.16.0 : les deux rythmes.
const rhythm = (over: Partial<VibeView> = {}) => ({ steps: [], commits: [], ...over }) as unknown as VibeView;
const express = (page: HTMLElement) => page.querySelector<HTMLInputElement>('.vc-express input');
const spy = (v: boolean) => { calls.push(`express:${v}`); };

it('créateur : l\'interrupteur Express, éteint par défaut, allumé en express ; un clic appelle onExpress avec l\'autre état', async () => {
  calls.length = 0;
  let m = await mount(rhythm(), [], [], { a: act1(), on: false }, spy);
  expect(m.page.querySelector('.vc-express')!.textContent).toBe('Express');
  expect(m.page.querySelector('.vc-express')!.getAttribute('title')).toBe(s.expressTitle);
  expect(express(m.page)!.checked).toBe(false);
  await act(() => express(m.page)!.click());
  expect(calls).toEqual(['express:true']);
  await m.unmount();
  m = await mount(rhythm({ express: true }), [], [], { a: act1(), on: false }, spy);
  expect(express(m.page)!.checked).toBe(true);
  calls.length = 0;
  await act(() => express(m.page)!.click());
  expect(calls).toEqual(['express:false']);
  await m.unmount();
});

it('l\'interrupteur est là note pas validée, et pendant que le système enchaîne', async () => {
  for (const vibe of [{ a: act1(), on: true }, { a: act1({ hidden: true }), on: false }, { a: act1({ disabled: 'x' }), on: false }, null]) {
    const m = await mount(rhythm({ steps: [{ id: 'note', status: 'current', facts: '' }] as never, vibe: vibe?.on }), [], [], vibe, () => {});
    expect(express(m.page)).not.toBeNull();
    await m.unmount();
  }
});

it('le relecteur : ni bouton ni interrupteur (pas de onExpress)', async () => {
  const m = await mount(rhythm({ flow: 'review' }), [], [], null);
  expect(m.page.querySelector('.vc-express')).toBeNull();
  expect(m.page.querySelector('.vc-run')).toBeNull();
  await m.unmount();
});

it('pause après les invariants, après les modules : Reprendre et sa ligne ; un clic → onVibe', async () => {
  for (const pause of ['invariants', 'modules'] as const) {
    calls.length = 0;
    const m = await mount(rhythm({ pause }), [], [], { a: act1(), on: false }, () => {});
    const b = m.page.querySelector<HTMLButtonElement>('.vc-run')!;
    expect([b.textContent, b.title, b.dataset.tone, b.disabled]).toEqual([act1().label, act1().hint, 'vibe', false]);
    expect(m.page.querySelector('.vc-pause')!.textContent).toBe(s.pause[pause]);
    await act(() => b.click());
    expect(calls).toEqual(['vibe']);
    await m.unmount();
  }
});

it('la note sans ✓ : sa ligne, pas de bouton', async () => {
  const m = await mount(rhythm({ pause: 'note' }), [], [], { a: act1(), on: false }, () => {});
  expect(m.page.querySelector('.vc-pause')!.textContent).toBe(s.pause.note);
  expect(runs(m.page)).toHaveLength(0);
  await m.unmount();
});

it('pas de ligne hors d\'une pause (absente, null) ni pendant que le système enchaîne', async () => {
  for (const pause of [undefined, null]) {
    const m = await mount(rhythm({ pause }), [], [], { a: act1(), on: false }, () => {});
    expect(m.page.querySelector('.vc-pause')).toBeNull();
    await m.unmount();
  }
  const m = await mount(rhythm({ pause: 'modules' }), [], [], { a: act1(), on: true }, () => {});
  expect(runs(m.page).map((b) => b.textContent)).toEqual([s.vibeStop]);
  expect(m.page.querySelector('.vc-pause')).toBeNull();
  await m.unmount();
});

it('une pause, l\'action grisée : Reprendre grisé avec sa raison ; masquée : pas de bouton, la ligne reste', async () => {
  let m = await mount(rhythm({ pause: 'modules' }), [], [], { a: act1({ disabled: 'occupé' }), on: false }, () => {});
  const b = m.page.querySelector<HTMLButtonElement>('.vc-run')!;
  expect([b.textContent, b.disabled, b.title]).toEqual([act1().label, true, `${act1().hint}\n— occupé`]);
  await m.unmount();
  m = await mount(rhythm({ pause: 'modules' }), [], [], { a: act1({ hidden: true }), on: false }, () => {});
  expect(m.page.querySelector('.vc-run')).toBeNull();
  expect(m.page.querySelector('.vc-pause')).not.toBeNull();
  await m.unmount();
});

it('la pause d\'un ✓ d\'étape retiré à la main, l\'action masquée : la ligne de cette étape, pas de bouton ; le système enchaîne encore : Arrêter, sans ligne', async () => {
  for (const pause of ['withdrawn:forme', 'withdrawn:invariants', 'withdrawn:modules'] as const) {
    let m = await mount(rhythm({ pause }), [], [], { a: act1({ hidden: true }), on: false }, () => {});
    expect(m.page.querySelector('.vc-pause')!.textContent).toBe(s.pause[pause]);
    expect(runs(m.page)).toHaveLength(0);
    await m.unmount();
    m = await mount(rhythm({ pause }), [], [], { a: act1({ hidden: true }), on: true }, () => {});
    expect(runs(m.page).map((b) => b.textContent)).toEqual([s.vibeStop]);
    expect(m.page.querySelector('.vc-pause')).toBeNull();
    await m.unmount();
  }
});

it('cette pause levée, l\'action de nouveau au relevé : Reprendre, sans ligne', async () => {
  const m = await mount(rhythm({ pause: null }), [], [], { a: act1(), on: false }, () => {});
  expect(runs(m.page).map((b) => b.textContent)).toEqual([act1().label]);
  expect(m.page.querySelector('.vc-pause')).toBeNull();
  await m.unmount();
});

it('aucun bouton, aucune infobulle ne dit « Vibe » (arrêté, en pause, en route, grisé)', async () => {
  const cases: [Partial<VibeView>, Vibe][] = [
    [{}, { a: act1(), on: false }], [{ pause: 'invariants' }, { a: act1(), on: false }], [{}, { a: act1(), on: true }],
    [{}, { a: act1({ disabled: 'occupé' }), on: false }],
  ];
  for (const [over, vibe] of cases) {
    const m = await mount(rhythm(over), [], [], vibe, () => {});
    for (const b of runs(m.page)) expect(`${b.textContent} ${b.title}`).not.toMatch(/vibe/i);
    await m.unmount();
  }
});
