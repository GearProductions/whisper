// @vitest-environment happy-dom
// Breadcrumb (breadcrumb.tsx) : les étapes en une ligne, toutes cliquables (même à venir), état, faits et raccourci en
// title ; en créateur (0.16.0-ecran-essentiel) une ligne sous le fil dit où on en est (statusLine), le bouton du moteur à
// côté, l'interrupteur Express au bout du fil, ni compte ni liste des commits ; le relecteur : ni ligne ni bouton,
// « N commits » déplie la liste, re-clic la replie ; aucun commit : le texte, sans bouton ; un commit déplié : diff et
// GitHub en IconButton, mêmes ids (c<rang>, gh:c<rang>), ses fichiers en texte simple.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { statusLine, t } from 'core/vibecoder';
import type { VibeAction, VibeCommit, VibeView } from 'technicals/bridge';
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

const act1 = (over: Partial<VibeAction> = {}) => ({ id: 'vibe', label: 'Reprendre', hint: 'reprendre le parcours', disabled: undefined, hidden: false, ...over }) as unknown as VibeAction;
// Un créateur, la note validée ; on surcharge ce qu'un cas change.
// L'étape Note est faite quand la note a son ✓ (la ligne d'état lit l'étape du relevé, pas la marque).
const creator = (over: Partial<VibeView> = {}) => {
  const note = over.note ?? { filled: true, mark: 'ok' };
  return {
    lang: 'fr', flow: 'create', steps: note.mark === 'ok' ? [{ id: 'note', status: 'done', facts: '' }] : [], commits: [], questions: [], invariants: [], outputs: {}, runs: [], note, ...over,
  } as unknown as VibeView;
};
const reviewer = (over: Partial<VibeView> = {}) => creator({ flow: 'review', ...over });
const commit = (i: number, over: Partial<VibeCommit> = {}) => ({ hash: `${i}`.padStart(7, 'a') + '1', subject: `commit ${i}`, fixup: false, files: [`src/f${i}.ts`], ...over }) as unknown as VibeCommit;
const runs = (page: HTMLElement) => [...page.querySelectorAll<HTMLButtonElement>('.vc-run')];
const lines = (page: HTMLElement) => [...page.querySelectorAll<HTMLElement>('.vc-line [role="status"]')];
const express = (page: HTMLElement) => page.querySelector<HTMLInputElement>('.vc-express input');
const spy = (v: boolean) => { calls.push(`express:${v}`); };

// --- Les étapes ---

it('étapes : une ligne, toutes cliquables, choisie en aria-current, état et faits en title', async () => {
  const picked: string[] = [];
  const view = creator({ steps: [
    { id: 'note', status: 'done', facts: '3 sections' },
    { id: 'forme', status: 'todo', facts: '' },
  ] as never });
  const { page, unmount } = await mount(view, picked);
  expect(page.querySelector('nav')!.getAttribute('aria-label')).toBe(s.journey);
  const steps = [...page.querySelectorAll<HTMLButtonElement>('.vc-jstep')];
  expect(steps.map((b) => [b.textContent, b.disabled, b.getAttribute('aria-current'), b.title])).toEqual([
    [s.steps.note, false, 'step', `${s.steps.note} — ${s.stepStatus.done} · 3 sections (${s.shortcut(1)})`],
    [s.steps.forme, false, null, `${s.steps.forme} — ${s.stepStatus.todo} (${s.shortcut(2)})`],
  ]);
  for (const b of steps) await act(() => b.click());
  expect(picked).toEqual(['note', 'forme']);
  await unmount();
});

// --- La ligne, en créateur ---

it('créateur : la ligne est toujours là, une seule, celle de statusLine, en alerte quand elle attend l\'utilisateur', async () => {
  const views = [
    creator({ note: null as never }),                                           // pas de note
    creator({ questions: [{}] as never }),                                      // une question
    creator({ note: { filled: true, mark: 'none' } as never }),                 // la note sans ✓
    creator({ vibe: true }),                                                    // le système travaille
    creator({ pause: 'invariants' }),                                           // une pause
    creator({ pr: { state: 'MERGED' } as never }),                              // fusionnée
    creator({}),                                                                // arrêté hors d'une pause
  ];
  for (const view of views) {
    const m = await mount(view, [], [], { a: act1(), on: !!view.vibe }, () => {});
    const expected = statusLine(view)!;
    expect(lines(m.page).map((p) => [p.textContent, p.dataset.yours])).toEqual([[expected.text, String(expected.yours)]]);
    await m.unmount();
  }
});

it('créateur : une erreur du relevé : aucune ligne (le bandeau d\'erreur parle), le fil reste', async () => {
  const m = await mount(creator({ error: 'boom' as never, steps: [{ id: 'note', status: 'current', facts: '' }] as never }), [], [], { a: act1(), on: false }, () => {});
  expect(lines(m.page)).toHaveLength(0);
  expect(runs(m.page)).toHaveLength(0);
  expect(m.page.querySelectorAll('.vc-jstep')).toHaveLength(1);
  await m.unmount();
});

// --- Le bouton du moteur ---

it('une erreur du relevé, le moteur en route : pas de ligne, mais Arrêter reste ; un clic → onStopVibe', async () => {
  calls.length = 0;
  const m = await mount(creator({ error: 'boom' as never, vibe: true }), [], [], { a: act1(), on: true }, () => {});
  expect(lines(m.page)).toHaveLength(0);
  expect(runs(m.page).map((b) => b.textContent)).toEqual([s.vibeStop]);
  await act(() => runs(m.page)[0].click());
  expect(calls).toEqual(['stop']);
  await m.unmount();
});

it('le moteur en route : Arrêter à côté de la ligne, un clic → onStopVibe ; même l\'action masquée (« déjà en cours »)', async () => {
  calls.length = 0;
  let m = await mount(creator({ vibe: true }), [], [], { a: act1(), on: true }, () => {});
  expect(runs(m.page).map((b) => [b.textContent, b.title, b.parentElement === lines(m.page)[0].parentElement])).toEqual([[s.vibeStop, s.vibeStopTitle, true]]);
  await act(() => runs(m.page)[0].click());
  expect(calls).toEqual(['stop']);
  await m.unmount();
  m = await mount(creator({ vibe: true }), [], [], { a: act1({ hidden: true }), on: true }, () => {});
  expect(runs(m.page).map((b) => b.textContent)).toEqual([s.vibeStop]);
  await m.unmount();
});

it('une pause après les invariants, après les modules : Reprendre à côté de la ligne ; un clic → onVibe', async () => {
  for (const pause of ['invariants', 'modules'] as const) {
    calls.length = 0;
    const m = await mount(creator({ pause }), [], [], { a: act1(), on: false }, () => {});
    const b = m.page.querySelector<HTMLButtonElement>('.vc-run')!;
    expect([b.textContent, b.title, b.dataset.tone, b.disabled, b.parentElement === lines(m.page)[0].parentElement]).toEqual([act1().label, act1().hint, 'vibe', false, true]);
    expect(lines(m.page)[0].textContent).toBe(s.statusLine.pause[pause]);
    await act(() => b.click());
    expect(calls).toEqual(['vibe']);
    await m.unmount();
  }
});

it('arrêté hors d\'une pause (à la main, l\'appli relancée) : la ligne « arrêté » et Reprendre ; un clic → onVibe', async () => {
  calls.length = 0;
  const m = await mount(creator(), [], [], { a: act1(), on: false }, () => {});
  expect(lines(m.page).map((p) => p.textContent)).toEqual([s.statusLine.stopped]);
  await act(() => runs(m.page)[0].click());
  expect(calls).toEqual(['vibe']);
  await m.unmount();
});

it('un ✓ d\'étape retiré, la note sans son ✓ : la ligne, sans bouton (l\'action est masquée)', async () => {
  for (const pause of ['withdrawn:forme', 'withdrawn:invariants', 'withdrawn:modules'] as const) {
    const m = await mount(creator({ pause }), [], [], { a: act1({ hidden: true }), on: false }, () => {});
    expect(lines(m.page).map((p) => p.textContent)).toEqual([s.pause[pause]]);
    expect(runs(m.page)).toHaveLength(0);
    await m.unmount();
  }
  // la note sans ✓, même commitée (pause 'note') : pas de bouton même si l'action n'était pas masquée
  for (const view of [creator({ note: { filled: true, mark: 'none' } as never }), creator({ pause: 'note', note: { filled: true, mark: 'none' } as never })]) {
    const m = await mount(view, [], [], { a: act1(), on: false }, () => {});
    expect(lines(m.page)).toHaveLength(1);
    expect(runs(m.page).length).toBe(view.pause === 'note' ? 0 : 1);
    await m.unmount();
  }
});

it('l\'action grisée : Reprendre grisé, sa raison en title ; masquée (note pas validée) ou null : pas de bouton, la ligne reste', async () => {
  let m = await mount(creator({ pause: 'modules' }), [], [], { a: act1({ disabled: 'occupé' }), on: false }, () => {});
  const b = m.page.querySelector<HTMLButtonElement>('.vc-run')!;
  expect([b.textContent, b.disabled, b.title]).toEqual([act1().label, true, `${act1().hint}\n— occupé`]);
  await m.unmount();
  for (const vibe of [{ a: act1({ hidden: true }), on: false }, null]) {
    m = await mount(creator({ pause: 'modules' }), [], [], vibe, () => {});
    expect(runs(m.page)).toHaveLength(0);
    expect(lines(m.page)).toHaveLength(1);
    await m.unmount();
  }
});

it('le parcours fini (la PR verte et chaque étape faite, fusionnée, fermée) : la ligne, sans Reprendre ; le moteur en route : Arrêter reste', async () => {
  const done = ['note', 'forme', 'invariants', 'modules', 'revue', 'pr'].map((id) => ({ id, status: 'done', facts: '' }));
  const green = { 'ci.md': { text: '✓ 3/3\n', time: 1 } };
  for (const view of [
    creator({ steps: done as never, pr: { state: 'OPEN' } as never, outputs: green as never }),
    creator({ pr: { state: 'MERGED' } as never }),
    creator({ pr: { state: 'CLOSED' } as never }),
  ]) {
    const m = await mount(view, [], [], { a: act1(), on: false }, () => {});
    expect(lines(m.page).map((p) => p.textContent)).toEqual([statusLine(view)!.text]);
    expect(runs(m.page)).toHaveLength(0);
    await m.unmount();
  }
  // la PR verte mais une étape pas faite (une correction en cours) : Reprendre garde son sens
  const pending = done.map((x) => (x.id === 'modules' ? { ...x, status: 'current' } : x));
  let m = await mount(creator({ steps: pending as never, pr: { state: 'OPEN' } as never, outputs: green as never }), [], [], { a: act1(), on: false }, () => {});
  expect(runs(m.page).map((b) => b.textContent)).toEqual([act1().label]);
  await m.unmount();
  m = await mount(creator({ steps: done as never, pr: { state: 'OPEN' } as never, outputs: green as never, vibe: true }), [], [], { a: act1(), on: true }, () => {});
  expect(runs(m.page).map((b) => b.textContent)).toEqual([s.vibeStop]);
  await m.unmount();
});

it('cette pause levée, l\'action de nouveau au relevé : Reprendre', async () => {
  const m = await mount(creator({ pause: null }), [], [], { a: act1(), on: false }, () => {});
  expect(runs(m.page).map((b) => b.textContent)).toEqual([act1().label]);
  await m.unmount();
});

it('aucun bouton, aucune infobulle ne dit « Vibe » (arrêté, en pause, en route, grisé)', async () => {
  const cases: [Partial<VibeView>, Vibe][] = [
    [{}, { a: act1(), on: false }], [{ pause: 'invariants' }, { a: act1(), on: false }], [{ vibe: true }, { a: act1(), on: true }],
    [{}, { a: act1({ disabled: 'occupé' }), on: false }],
  ];
  for (const [over, vibe] of cases) {
    const m = await mount(creator(over), [], [], vibe, () => {});
    expect(runs(m.page).length).toBeGreaterThan(0);
    for (const b of runs(m.page)) expect(`${b.textContent} ${b.title}`).not.toMatch(/vibe/i);
    await m.unmount();
  }
});

// --- L'interrupteur Express ---

it('l\'interrupteur Express : éteint par défaut, allumé en express ; un clic appelle onExpress avec l\'autre état', async () => {
  calls.length = 0;
  let m = await mount(creator(), [], [], { a: act1(), on: false }, spy);
  expect(m.page.querySelector('.vc-express')!.textContent).toBe('Express');
  expect(m.page.querySelector('.vc-express')!.getAttribute('title')).toBe(s.expressTitle);
  expect(m.page.querySelector('.vc-express')!.closest('.vc-line')).toBeNull(); // au bout du fil, pas dans la ligne
  expect(express(m.page)!.checked).toBe(false);
  await act(() => express(m.page)!.click());
  expect(calls).toEqual(['express:true']);
  await m.unmount();
  m = await mount(creator({ express: true }), [], [], { a: act1(), on: false }, spy);
  expect(express(m.page)!.checked).toBe(true);
  calls.length = 0;
  await act(() => express(m.page)!.click());
  expect(calls).toEqual(['express:false']);
  await m.unmount();
});

it('l\'interrupteur est là note pas validée, pendant que le système enchaîne, action grisée ou absente', async () => {
  for (const vibe of [{ a: act1(), on: true }, { a: act1({ hidden: true }), on: false }, { a: act1({ disabled: 'x' }), on: false }, null]) {
    const m = await mount(creator({ steps: [{ id: 'note', status: 'current', facts: '' }] as never, vibe: vibe?.on, note: { filled: true, mark: 'none' } as never }), [], [], vibe, () => {});
    expect(express(m.page)).not.toBeNull();
    await m.unmount();
  }
});

// --- Créateur : ni compte ni liste des commits ---

it('créateur, vingt-quatre commits : ni compte ni liste, ni dans la ligne', async () => {
  const commits = Array.from({ length: 24 }, (_, i) => commit(i));
  const m = await mount(creator({ commits }), [], [], { a: act1(), on: false }, () => {});
  expect(m.page.querySelector('.vc-ccount')).toBeNull();
  expect(m.page.querySelector('.vc-commits')).toBeNull();
  expect(m.page.textContent).not.toMatch(/commit/i);
  await m.unmount();
});

// --- Relecteur ---

it('le relecteur : ni ligne, ni bouton du moteur, ni interrupteur (pas de onExpress) ; ses commits comme avant', async () => {
  const m = await mount(reviewer({ commits: [commit(1)] }), [], [], null);
  expect(m.page.querySelector('.vc-line')).toBeNull();
  expect(m.page.querySelector('[role="status"]')).toBeNull();
  expect(runs(m.page)).toHaveLength(0);
  expect(express(m.page)).toBeNull();
  expect(m.page.querySelector('button.vc-ccount')!.textContent).toBe(s.commitsOf(1));
  await m.unmount();
});

it('le relecteur, même avec un vibe qu\'on lui passerait : pas de bouton du moteur', async () => {
  const m = await mount(reviewer(), [], [], { a: act1(), on: true });
  expect(runs(m.page)).toHaveLength(0);
  await m.unmount();
});

it('relecteur, aucun commit : le texte, sans bouton', async () => {
  const m = await mount(reviewer());
  expect(m.page.querySelector('.vc-ccount')!.tagName).toBe('SPAN');
  expect(m.page.querySelector('.vc-ccount')!.textContent).toBe(s.commitsOf(0));
  await m.unmount();
});

it('relecteur, commits : N commits déplie, re-clic replie ; un commit déplié : diff et GitHub en icônes, mêmes ids, fichiers en texte', async () => {
  const opened: string[] = [];
  const view = reviewer({ commits: [commit(1, { hash: 'aaaaaaa1', subject: 'un' }), commit(2, { hash: 'bbbbbbb2', subject: 'fixup! un', fixup: true, files: ['src/b.ts'] })] });
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

it('relecteur, liste ouverte : Échap (n\'atteint pas les autres Échap) ou un clic dehors la ferme, un clic dedans non ; écouteurs retirés', async () => {
  const { page, unmount } = await mount(reviewer({ commits: [commit(1, { hash: 'aaaaaaa1', files: [] })] }));
  const count = page.querySelector<HTMLButtonElement>('button.vc-ccount')!;
  const other: string[] = [];
  const keys = (e: KeyboardEvent) => other.push(e.key);
  document.addEventListener('keydown', keys);
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
  document.removeEventListener('keydown', keys);
  await unmount();
});
