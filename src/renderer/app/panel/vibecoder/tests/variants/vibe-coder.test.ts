// @vitest-environment happy-dom
// VibeCoder (vibe-coder.tsx) : l'en-tête (les robots des agents, Chercher, ⚙ Réglages en icône ; ni langue ni ↻ ;
// plus de retour à la conversation ni de fermer), l'onglet Conversation (🕘 : l'historique à la place du fil),
// Vibe dans le fil d'Ariane (créateur seulement), ↻ dans la barre d'état, et les pièces jointes d'un champ : tenues
// avec lui, parties avec son action seule (rien d'autre : ni modèle ni effort), libérées ensuite ; le trombone
// donne son choix au champ qui l'a ouvert.
import { act, createElement, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { createKept, t } from 'core/vibecoder';
import type { Thread, VibeView } from 'technicals/bridge';
import { VibeCoder } from '../../vibe-coder';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
const root = createRoot(page);
const fr = t('fr');
const view = { lang: 'fr', agentId: 'a1', steps: [], actions: [], runs: [], processes: [], commits: [], invariants: [], agent: {}, time: 0, flow: 'create' } as unknown as VibeView;
const thread = { name: 'whisper', status: 'idle', tasks: [] } as unknown as Thread;
const noop = () => {};
const acts = { follow: noop, set: noop, refresh: noop } as never;
const sent: unknown[][] = [];
const calls: string[] = [];
const kept = createKept();
const draw = (more: { historyOpen?: boolean; tasksOpen?: boolean; others?: ReactNode; view?: VibeView; acts?: unknown } = {}) => act(() => {
  root.render(createElement(VibeCoder, {
    view: more.view ?? view, thread, act: (more.acts ?? acts) as never, tasks: 'TASKS' as ReactNode, tasksOpen: more.tasksOpen ?? false, contextOpen: false, onGauge: noop, onTasks: noop,
    others: more.others, onSearch: () => { calls.push('palette:all'); },
    onSettings: () => { calls.push('settings'); }, historyOpen: more.historyOpen ?? false, onHistory: () => { calls.push('history'); },
    history: createElement('p', { className: 'the-history' }, 'HISTORIQUE'),
    side: { open: true, width: 400 }, onSide: noop, kept, code: null,
    children: createElement('p', { className: 'the-thread' }, 'FIL'),
  }));
});
const top = () => page.querySelector('.vc-top') as HTMLElement;
const byText = (s: string) => [...page.querySelectorAll('button')].find((b) => b.textContent === s);

it('VibeCoder : l\'en-tête de la vue C — les robots (others) à gauche, puis la branche une seule fois ; Chercher à droite', async () => {
  await draw({ others: createElement('div', { className: 'the-robots' }) });
  const ident = top().querySelector('.vc-ident')!;
  expect(ident.firstElementChild?.className).toBe('the-robots');
  expect(top().querySelector('.vc-name')).toBeNull();
  expect(top().querySelectorAll('.vc-branch')).toHaveLength(0); // pas de dépôt dans ce relevé
  expect(top().querySelector('.vc-tools .vc-search')?.textContent).toBe(`${fr.search}${fr.searchKeys}`);
  expect(ident.querySelector('.vc-search')).toBeNull();
});

it('VibeCoder : sans relevé des agents, le nom de l\'agent comme avant, sans sélecteur', async () => {
  await draw();
  expect(top().querySelector('.the-robots')).toBeNull();
  expect(top().querySelector('.vc-name')?.textContent).toBe('whisper');
});

it('VibeCoder : Chercher → palette « Tout », ⚙ Réglages → onSettings, plus de retour ni de fermer', async () => {
  calls.length = 0;
  await draw();
  await act(() => { (top().querySelector('.vc-search') as HTMLButtonElement).click(); });
  const gear = top().querySelector(`[aria-label="${fr.settingsTitle}"]`) as HTMLButtonElement;
  expect(gear.textContent).toBe('');
  expect(gear.querySelector('svg')).not.toBeNull();
  await act(() => { gear.click(); });
  expect(calls).toEqual(['palette:all', 'settings']);
  expect(top().querySelector('.vc-seg')).toBeNull();      // la langue est dans la page des réglages
  expect(top().querySelector('.vc-refresh')).toBeNull();  // ↻ est dans la barre d'état
  expect(top().querySelector(`[aria-label="${fr.close}"]`)).toBeNull();
});

it('VibeCoder : 🕘 bascule l\'historique ; ouvert, il prend la place du fil, avec « ← Conversation en cours »', async () => {
  calls.length = 0;
  await draw();
  expect(page.querySelector('.the-thread')).not.toBeNull();
  expect(page.querySelector('.the-history')).toBeNull();
  await act(() => { (page.querySelector('.vc-side-tabs .vc-history') as HTMLButtonElement).click(); });
  await draw({ historyOpen: true });
  expect(page.querySelector('.the-thread')).toBeNull();
  expect(page.querySelector('.the-history')?.textContent).toBe('HISTORIQUE');
  await act(() => { (byText(fr.historyBack) as HTMLButtonElement).click(); });
  expect(calls).toEqual(['history', 'history']);
});

// Un relevé à l'étape Note : un champ (l'action « note » emporte son texte), Vibe, et Envoyer les réponses.
const act1 = (a: object) => ({ id: 'x', step: null, label: 'X', hint: '', who: 'agent', models: [], model: null, kind: 'send', needs: 'none', usesText: false, primary: false, disabled: null, hidden: false, ...a });
const noteView = (over: object = {}) => ({
  ...view, steps: [{ id: 'note', status: 'current' }], outputs: {}, files: [], questions: [], invariants: [], artifacts: [], modules: [],
  actions: [act1({ id: 'note', step: 'note', label: 'Écrire la note', needs: 'text', usesText: true, primary: true }), act1({ id: 'vibe', label: 'Vibe', hint: 'tout' })],
  ...over,
}) as unknown as VibeView;
const type = async (ta: HTMLTextAreaElement, value: string) => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(ta, value);
  await act(() => { ta.dispatchEvent(new Event('input', { bubbles: true })); });
};
const field = () => page.querySelector<HTMLTextAreaElement>('[data-field="note"]')!;
const pieces = () => [...page.querySelectorAll('.vc-step-field .piece')].map((p) => p.textContent);

it('Vibe : dans le fil d\'Ariane, créateur seulement ; pendant Vibe, Arrêter Vibe (set vibe false) ; plus de bannière', async () => {
  const run = vi.fn(async () => true), set = vi.fn();
  const a = { follow: noop, refresh: noop, run, set };
  await draw({ view: noteView(), acts: a });
  const vibe = page.querySelector<HTMLButtonElement>('.vc-crumbs [data-tone="vibe"]')!;
  expect(vibe.textContent).toBe('Vibe');
  expect(page.querySelectorAll('.vc-step-acts [data-tone="vibe"]')).toHaveLength(0);
  await act(() => { vibe.click(); });
  expect(run).toHaveBeenCalledWith('vibe', {});          // sans texte ni pièces : Vibe n'emporte aucun champ
  await draw({ view: noteView({ vibe: true }), acts: a });
  await act(() => { (byText(fr.vibeStop) as HTMLButtonElement).click(); });
  expect(set).toHaveBeenCalledWith({ vibe: false });
  expect(page.querySelector('.vc-vibe-banner')).toBeNull();
  await draw({ view: noteView({ flow: 'review' }), acts: a });
  expect(page.querySelector('.vc-crumbs [data-tone="vibe"]')).toBeNull();
});

it('↻ de la barre d\'état : relève (act.refresh)', async () => {
  const refresh = vi.fn();
  await draw({ view: noteView(), acts: { follow: noop, set: noop, refresh } });
  await act(() => { (page.querySelector('.vc-status .vc-refresh') as HTMLButtonElement).click(); });
  expect(refresh).toHaveBeenCalledTimes(1);
});

it('les pièces d\'un champ : le trombone donne son choix à ce champ, déposer joint ; elles partent avec son action (texte, pièces, rien d\'autre) puis sont libérées', async () => {
  sent.length = 0;
  let into: ((w: { files?: string[] }) => void) | undefined;
  const a = {
    follow: noop, set: noop, refresh: noop,
    run: async (...args: unknown[]) => { sent.push(args); return true; },
    attach: (f: typeof into) => { into = f; },
    pieces: async (files: File[]) => files.map((f) => ({ kind: 'file' as const, name: f.name, path: `/tmp/${f.name}` })),
  };
  await draw({ view: noteView(), acts: a });
  await type(field(), 'bonjour');
  await act(() => { (page.querySelector('.vc-step-field .vc-attach') as HTMLButtonElement).click(); });
  await act(async () => { into!({ files: ['/p/plan.md'] }); });
  const drop = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(drop, 'dataTransfer', { value: { files: [new File(['x'], 'a.txt')] } });
  await act(async () => { page.querySelector('.vc-step-field .vc-prompt')!.dispatchEvent(drop); });
  expect(pieces()).toHaveLength(2);
  expect(pieces()[0]).toContain('plan.md');
  expect(pieces()[1]).toContain('a.txt');
  await act(async () => { (page.querySelector('.vc-step-field .vc-send') as HTMLButtonElement).click(); });
  expect(sent).toEqual([['note', { text: 'bonjour', pieces: { images: [], files: ['/p/plan.md', '/tmp/a.txt'], selection: '' } }]]);
  expect(pieces()).toEqual([]);
  expect(field().value).toBe('');
});

it('retirer une pièce (×) : elle ne part pas ; sans pièce, aucun « pieces » dans les arguments', async () => {
  sent.length = 0;
  let into: ((w: { files?: string[] }) => void) | undefined;
  const a = { follow: noop, set: noop, refresh: noop, run: async (...args: unknown[]) => { sent.push(args); return true; }, attach: (f: typeof into) => { into = f; }, pieces: async () => [] };
  await draw({ view: noteView(), acts: a });
  await type(field(), 'salut');
  await act(() => { (page.querySelector('.vc-step-field .vc-attach') as HTMLButtonElement).click(); });
  await act(async () => { into!({ files: ['/p/plan.md'] }); });
  await act(() => { (page.querySelector('.vc-step-field .piece .remove') as HTMLButtonElement).click(); });
  await act(async () => { (page.querySelector('.vc-step-field .vc-send') as HTMLButtonElement).click(); });
  expect(sent).toEqual([['note', { text: 'salut' }]]);
});

it('le questionnaire a ses pièces, qui partent avec « Envoyer les réponses » seulement ; celles du champ de la note restent', async () => {
  sent.length = 0;
  let into: ((w: { files?: string[] }) => void) | undefined;
  const a = { follow: noop, set: noop, refresh: noop, run: async (...args: unknown[]) => { sent.push(args); return true; }, attach: (f: typeof into) => { into = f; }, pieces: async () => [] };
  const v = noteView({
    questions: [{ n: 1, text: 'Quoi ?', options: ['a'] }],
    actions: [...noteView().actions, act1({ id: 'answers', step: 'note', label: 'Envoyer les réponses' })],
  });
  await draw({ view: v, acts: a });
  await act(() => { (page.querySelector('.vc-step-field .vc-attach') as HTMLButtonElement).click(); });
  await act(async () => { into!({ files: ['/p/champ.md'] }); });
  await act(() => { (page.querySelector('.vc-q .vc-attach') as HTMLButtonElement).click(); });
  await act(async () => { into!({ files: ['/p/reponse.md'] }); });
  expect(page.querySelectorAll('.vc-q .piece')).toHaveLength(1);
  await act(() => { (page.querySelector('.vc-q .vc-q-opt') as HTMLButtonElement).click(); });
  await act(async () => { page.querySelector<HTMLButtonElement>('.vc-q-send .vc-run')!.click(); });
  expect(sent).toEqual([['answers', { answers: ['a'], pieces: { images: [], files: ['/p/reponse.md'], selection: '' } }]]);
  expect(page.querySelectorAll('.vc-q .piece')).toHaveLength(0);
  expect(pieces()).toHaveLength(1);   // le champ de la note garde les siennes
});

// ---- L'état retenu, par agent et par étape (T-20) ; le verdict proposé (T-23) ----
const two = (agentId: string) => noteView({ agentId, steps: [{ id: 'note', status: 'current' }, { id: 'forme', status: 'upcoming' }] });
const stepBox = () => page.querySelector<HTMLElement>('.vc-step')!;
const scrollTo = (top: number) => act(() => { stepBox().scrollTop = top; stepBox().dispatchEvent(new Event('scroll')); });
const crumb = (i: number) => page.querySelectorAll<HTMLButtonElement>('.vc-jstep')[i];
const leave = () => act(() => root.render(null)); // le panneau recrée l'écran à chaque changement d'agent

it('l\'état d\'un agent n\'apparaît pas chez un autre (étape choisie, défilement) et revient avec lui', async () => {
  await draw({ view: two('iso1') });
  await act(() => crumb(1).click());
  await scrollTo(120);
  await leave();
  await draw({ view: two('iso2') });
  expect(stepBox().scrollTop).toBe(0);
  expect(crumb(0).getAttribute('aria-current')).toBe('step');   // l'étape en cours, pas la forme choisie chez iso1
  await leave();
  await draw({ view: two('iso1') });
  expect(crumb(1).getAttribute('aria-current')).toBe('step');
  expect(stepBox().scrollTop).toBe(120);
});

it('même agent, deux étapes : chacune son défilement', async () => {
  await leave();
  await draw({ view: two('steps1') });
  await scrollTo(80);
  await act(() => crumb(1).click());
  expect(stepBox().scrollTop).toBe(0);
  await scrollTo(30);
  await act(() => crumb(0).click());
  expect(stepBox().scrollTop).toBe(80);
  await act(() => crumb(1).click());
  expect(stepBox().scrollTop).toBe(30);
});

it('un verdict choisi l\'emporte sur le verdict proposé ; proposé, il est pressé sans rien publier ; sans marque, Commenter', async () => {
  const run = vi.fn(async () => true);
  const review = (agentId: string, mark: string | null) => ({
    ...view, agentId, flow: 'review', steps: [{ id: 'pr', status: 'current' }], outputs: {}, files: [], questions: [], invariants: [], artifacts: [], modules: [], draft: [],
    note: mark ? { mark } : undefined, actions: [act1({ id: 'publish', step: 'revue', label: 'Publier' })],
  }) as unknown as VibeView;
  const pressed = () => page.querySelector('.vc-verdicts [aria-pressed="true"]')?.getAttribute('data-verdict');
  const a = { follow: noop, set: noop, refresh: noop, run };
  await leave();
  await draw({ view: review('v1', 'ko'), acts: a });
  expect(pressed()).toBe('request-changes');
  expect(run).not.toHaveBeenCalled();
  await act(() => { page.querySelector<HTMLButtonElement>('[data-verdict="approve"]')!.click(); });
  expect(pressed()).toBe('approve');
  await draw({ view: review('v1', 'ko'), acts: a });
  expect(pressed()).toBe('approve');            // le choix tient quand le relevé change
  await leave();
  await draw({ view: review('v2', null), acts: a });
  expect(pressed()).toBe('comment');
});
