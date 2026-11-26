// @vitest-environment happy-dom
// Breadcrumb (breadcrumb.tsx) : les étapes en une ligne, toutes cliquables (même à venir), état, faits et raccourci en
// title ; en créateur (0.16.0-ecran-essentiel) une ligne sous le fil dit où on en est (statusLine), le bouton du moteur à
// côté, l'interrupteur Express au bout du fil, ni compte ni liste des commits ; le relecteur (0.16.0-revue-essentielle) :
// ses quatre arrêts (Note, Règles, Essai, Publier), la même ligne, et à côté Préparer la revue (son rappel au clic, grisé
// avec sa raison quand il n'y a rien à lancer, absent sans PR chargée), ni moteur, ni Express, ni « N commits ».
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { statusLine, t } from 'core/vibecoder';
import type { VibeAction, VibeCommit, VibeStepId, VibeView } from 'technicals/bridge';
import { Breadcrumb } from '../../breadcrumb';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const s = t('fr');

type Vibe = { a: VibeAction; on: boolean } | null;
const calls: string[] = [];
async function mount(view: VibeView, picked: string[] = [], _opened: string[] = [], vibe: Vibe = null, onExpress?: (on: boolean) => void, more: { selected?: VibeStepId; onPrepare?: () => void } = {}) {
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  await act(() => root.render(createElement(Breadcrumb, { view, t: s, selected: more.selected ?? 'note', onPrepare: more.onPrepare, vibe, onVibe: () => { calls.push('vibe'); }, onExpress, onStopVibe: () => { calls.push('stop'); }, onPick: (id: string) => { picked.push(id); } })));
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
const commit = (i: number, over: Partial<VibeCommit> = {}) => ({ hash: `${i}`.padStart(7, 'a') + '1', subject: `commit ${i}`, fixup: false, files: [`src/f${i}.ts`], ...over }) as unknown as VibeCommit;
const runs = (page: HTMLElement) => [...page.querySelectorAll<HTMLButtonElement>('.vc-run:not(.vc-prepare)')];
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
  const green = { state: 'OPEN', ci: { state: 'ok', failed: [] } };   // la CI d'après gh (pr.ci), jamais ci.md
  for (const view of [
    creator({ steps: done as never, pr: green as never }),
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
  let m = await mount(creator({ steps: pending as never, pr: green as never }), [], [], { a: act1(), on: false }, () => {});
  expect(runs(m.page).map((b) => b.textContent)).toEqual([act1().label]);
  await m.unmount();
  m = await mount(creator({ steps: done as never, pr: green as never, vibe: true }), [], [], { a: act1(), on: true }, () => {});
  expect(runs(m.page).map((b) => b.textContent)).toEqual([s.vibeStop]);
  await m.unmount();
});

it('la CI pas verte (en cours, en échec, inconnue) ou un ci.md ✓ sans pr.ci, chaque étape faite : Reprendre reste', async () => {
  const done = ['note', 'forme', 'invariants', 'modules', 'revue', 'pr'].map((id) => ({ id, status: 'done', facts: '' }));
  const prs = [{ ci: { state: 'pending', failed: [] } }, { ci: { state: 'ko', failed: ['lint'] } }, {}, { ci: null }];
  for (const p of prs) {
    const m = await mount(creator({ steps: done as never, pr: { state: 'OPEN', ...p } as never, outputs: { 'ci.md': { text: '✓ 3/3\n', time: 1 } } as never }), [], [], { a: act1(), on: false }, () => {});
    expect(runs(m.page).map((b) => b.textContent)).toEqual([act1().label]);
    await m.unmount();
  }
});

it('la note revalidée, pas commitée (note.git \'modified\') : « reprenez pour que le système l\'applique » et Reprendre ; la pause \'note\' : pas de Reprendre', async () => {
  let m = await mount(creator({ note: { filled: true, mark: 'ok', git: 'modified' } as never }), [], [], { a: act1(), on: false }, () => {});
  expect(lines(m.page).map((p) => p.textContent)).toEqual([s.statusLine.applyNote]);
  expect(runs(m.page).map((b) => b.textContent)).toEqual([act1().label]);
  await m.unmount();
  m = await mount(creator({ pause: 'note', note: { filled: true, mark: 'changed' } as never }), [], [], { a: act1(), on: false }, () => {});
  expect(lines(m.page).map((p) => p.textContent)).toEqual([s.pause.note]);
  expect(runs(m.page)).toHaveLength(0);
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

const REVIEW_IDS = ['note', 'invariants', 'revue', 'pr'] as const;
const PR = { number: 7, head: 'feat/x', state: 'OPEN' } as never;
// Un relecteur : ses quatre arrêts, la PR chargée, des lectures à lancer.
const reviewer = (over: Partial<VibeView> = {}) => ({
  lang: 'fr', flow: 'review', steps: REVIEW_IDS.map((id, i) => ({ id, status: i ? 'todo' : 'current', facts: '' })), commits: [], questions: [], invariants: [],
  outputs: {}, runs: [], note: null, pr: PR, prepare: ['review-note'], ...over,
}) as unknown as VibeView;
const prepareBtn = (page: HTMLElement) => [...page.querySelectorAll<HTMLButtonElement>('.vc-crumbs button:not(.vc-jstep)')];
const prepare = () => { calls.push('prepare'); };

it('relecteur : quatre arrêts, « Note », « Règles », « Essai », « Publier », leur raccourci en infobulle, cliquables', async () => {
  const picked: string[] = [];
  const m = await mount(reviewer(), picked, [], null, undefined, { onPrepare: prepare });
  const steps = [...m.page.querySelectorAll<HTMLButtonElement>('.vc-jstep')];
  expect(steps.map((b) => b.textContent)).toEqual(['Note', 'Règles', 'Essai', 'Publier']);
  expect(steps.map((b) => b.title)).toEqual(['Note', 'Règles', 'Essai', 'Publier'].map((n, i) => `${n} — ${s.stepStatus[i ? 'todo' : 'current']} (${s.shortcut(i + 1)})`));
  for (const b of steps) await act(() => b.click());
  expect(picked).toEqual([...REVIEW_IDS]);
  await m.unmount();
});

it('relecteur : la ligne sous le fil, une seule, celle de statusLine, Préparer la revue à côté', async () => {
  const views = [reviewer(), reviewer({ prepare: [] }), reviewer({ runs: [{ id: 'r', label: 'align', state: 'running' }] as never, prepare: [] }), reviewer({ pr: null, prepare: [] })];
  for (const view of views) {
    const m = await mount(view, [], [], null, undefined, { onPrepare: prepare });
    const expected = statusLine(view)!;
    expect(lines(m.page).map((p) => [p.textContent, p.dataset.yours])).toEqual([[expected.text, String(expected.yours)]]);
    await m.unmount();
  }
  const m = await mount(reviewer({ error: 'boom' as never }), [], [], null, undefined, { onPrepare: prepare });
  expect(lines(m.page)).toHaveLength(0);
  await m.unmount();
});

it('relecteur, une PR chargée : Préparer la revue à côté de la ligne, actif, à chacun des quatre arrêts', async () => {
  for (const selected of REVIEW_IDS) {
    const m = await mount(reviewer(), [], [], null, undefined, { selected, onPrepare: prepare });
    const [b, ...others] = prepareBtn(m.page);
    expect(others).toHaveLength(0);
    expect([b.textContent, b.title, b.disabled, b.parentElement === lines(m.page)[0].parentElement]).toEqual([s.essentialReview.prepare.label, s.essentialReview.prepare.title, false, true]);
    await m.unmount();
  }
});

it('un clic sur Préparer la revue : son rappel, une fois, rien d\'autre ; rien au montage ni à la mise à jour', async () => {
  calls.length = 0;
  const picked: string[] = [];
  const opened: string[] = [];
  const m = await mount(reviewer(), picked, opened, null, spy, { onPrepare: prepare });
  expect(calls).toEqual([]);
  await act(() => prepareBtn(m.page)[0].click());
  expect(calls).toEqual(['prepare']);
  expect([picked, opened]).toEqual([[], []]);
  await m.unmount();
});

it('rien à lancer : le bouton grisé, sa raison en infobulle (tout lu, des lectures en cours, ou le dossier sur une autre branche) ; un clic ne fait rien', async () => {
  calls.length = 0;
  const running = [{ id: 'r', label: 'align', state: 'running' }] as never;
  const elsewhere = { branch: 'autre', base: 'master', changed: 0 } as never;
  for (const [over, why] of [[{ prepare: [] }, s.essentialReview.prepare.ready], [{ prepare: undefined }, s.essentialReview.prepare.ready], [{ prepare: [], runs: running }, s.essentialReview.prepare.running],
    [{ prepare: [], repo: elsewhere }, s.essentialReview.statusLine.switchBranch]] as [Partial<VibeView>, string][]) {
    const m = await mount(reviewer(over), [], [], null, undefined, { onPrepare: prepare });
    const b = prepareBtn(m.page)[0];
    expect([b.disabled, b.title.includes(why)]).toEqual([true, true]);
    await act(() => b.click());
    await m.unmount();
  }
  expect(calls).toEqual([]);
});

it('pas de PR chargée, ou pas de rappel : pas de bouton', async () => {
  let m = await mount(reviewer({ pr: null, prepare: [] }), [], [], null, undefined, { onPrepare: prepare });
  expect(prepareBtn(m.page)).toHaveLength(0);
  await m.unmount();
  m = await mount(reviewer());
  expect(prepareBtn(m.page)).toHaveLength(0);
  await m.unmount();
});

it('relecteur : ni « N commits », ni liste, ni Express, ni Arrêter, ni Reprendre, même avec des commits ou un moteur passés', async () => {
  for (const on of [true, false]) {
    const m = await mount(reviewer({ commits: [commit(1), commit(2)] }), [], [], { a: act1(), on }, undefined, { onPrepare: prepare });
    expect(m.page.querySelector('.vc-ccount, .vc-commits, .vc-jcommit')).toBeNull();
    expect(m.page.textContent).not.toMatch(/commit/i);
    expect(runs(m.page)).toHaveLength(0);
    expect(express(m.page)).toBeNull();
    expect(prepareBtn(m.page).map((b) => b.textContent)).toEqual([s.essentialReview.prepare.label]);
    await m.unmount();
  }
});
