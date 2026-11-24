// @vitest-environment happy-dom
// NoteView (note-view.tsx), en relecteur (T-21 à T-23) : une remarque envoyée sur un passage s'affiche sous lui,
// grisée ; *Poser une question à l'agent* cite le passage dans le champ (prefill) sans rien envoyer ; « À revoir »
// ne pose aucune remarque et n'ouvre pas la zone : le bouton de remarque l'ouvre. Créer : venue d'un cas (noteFocus),
// la note défile à la ligne et la met en évidence (rien si le texte est parti ou si le diff est affiché), puis goToNote(null) ;
// la vérification de conception en cours ou en file ; le libellé du liseré.
import fs from 'node:fs';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { NoteView } from '../../note-view';
import type { StepProps } from '../../step-views';

// Les `at` que reçoit DraftEditor (Brut) : le vrai éditeur, observé.
const ats: (number | undefined)[] = [];
vi.mock('../../file-draft', async (original) => {
  const m = await original<typeof import('../../file-draft')>();
  return { ...m, DraftEditor: (p: Parameters<typeof m.DraftEditor>[0]) => { ats.push(p.at); return m.DraftEditor(p); } };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const calls: unknown[][] = [];
const text = '# Titre\n\n- premier point\n- second point\n';
const draw = (over: Partial<VibeView> = {}, mark: 'ok' | 'ko' | null = null, extra: Partial<StepProps> = {}) => act(() => {
  const view = { lang: 'fr', flow: 'review', actions: [{ id: 'comment' }], outputs: {}, questions: [], draft: [], pr: null,
    note: { id: 'n', path: 'docs/tickets/x.md', text, before: null, locked: null, mustNot: [], mark }, agent: { model: 'fable' }, ...over } as unknown as VibeView;
  const props = { view, step: { id: 'note', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
    answers: {}, onAnswer: () => {}, code: null, drafts: [{}, () => {}], questions: {},
    act: { run: async (...a: unknown[]) => { calls.push(['run', ...a]); return true; }, mark: (...a: unknown[]) => { calls.push(['mark', ...a]); },
      set: () => {}, prefill: (...a: unknown[]) => { calls.push(['prefill', ...a]); }, open: () => {}, openLink: () => {},
      follow: () => {}, save: async (...a: unknown[]) => { calls.push(['save', ...a]); return true; }, draft: (...a: unknown[]) => { calls.push(['draft', ...a]); },
      runOp: (...a: unknown[]) => { calls.push(['runOp', ...a]); } }, ...extra } as unknown as StepProps;
  root.render(createElement(NoteView, props));
});
const items = () => [...page.querySelectorAll<HTMLElement>('.vc-md li')].filter((li) => li.textContent?.includes('point') && !li.closest('.vc-draft-list'));
const button = (label: string, within: ParentNode = page) => [...within.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent === label || b.getAttribute('aria-label') === label);

it('une remarque envoyée sur un passage : visible sous lui, grisée, pas sous les autres', async () => {
  await draw({ draft: [{ id: 4, target: 'note: premier point', text: 'trop vague' }] } as never);
  const [first, second] = items();
  const list = first.querySelector('.vc-remarks-muted');
  expect(list?.textContent).toBe('trop vague');
  expect(second.querySelector('.vc-remarks-muted')).toBeNull();
  expect(page.querySelectorAll('.vc-remarks-muted')).toHaveLength(1);
});

it('Poser une question : le passage cité dans le champ, rien d\'envoyé', async () => {
  await draw();
  calls.length = 0;
  await act(() => button('Poser une question à l\'agent', items()[1])!.click());
  expect(calls).toEqual([['prefill', 'comment', 'second point']]);
  await draw({ actions: [] });
  expect(button('Poser une question à l\'agent')).toBeUndefined();
});

it('À revoir : le bouton de remarque, aucune remarque ajoutée ; la zone ne s\'ouvre que par lui', async () => {
  await draw({}, null);
  calls.length = 0;
  await act(() => button('À revoir')!.click());
  expect(calls).toEqual([['mark', 'note', 'ko']]);
  await draw({}, 'ko');
  expect(page.querySelector('textarea')).toBeNull();
  await act(() => button('Ajouter une remarque au brouillon')!.click());
  expect(page.querySelector('textarea')).not.toBeNull();
  expect(calls.filter((c) => c[0] === 'draft')).toEqual([]);
});

it('cas trouvé : une remarque sur un bloc hors liste (titre) : sous lui, grisée, sans cible au-dessus', async () => {
  await draw({ draft: [{ id: 7, target: 'note: Titre', text: 'à préciser' }] } as never);
  expect(page.querySelector('.vc-block .vc-remarks-muted')!.textContent).toBe('à préciser');
  expect(page.querySelector('.vc-draft-target')).toBeNull();
});

it('cas trouvé : Poser une question sur un titre cite le titre', async () => {
  await draw();
  calls.length = 0;
  await act(() => button('Poser une question à l\'agent', page.querySelector<HTMLElement>('.vc-block')!)!.click());
  expect(calls).toEqual([['prefill', 'comment', 'Titre']]);
});

// Créer, une note qui a une rubrique « Ce que ça ne doit pas faire » : le second point est à la ligne 6 (depuis 0).
const must = '# Titre\n\n## Ce que ça ne doit pas faire\n\n- premier point\n- second point\n';
const create = (over: Partial<VibeView> = {}, extra: Partial<StepProps> = {}) =>
  draw({ flow: 'create', note: { id: 'n', path: 'docs/tickets/x.md', text: must, before: null, locked: null, mustNot: [], mark: null, checked: true }, ...over } as never, null, extra);

it('noteFocus d\'une ligne présente : mise en évidence à sa ligne, puis goToNote(null)', async () => {
  const go: unknown[] = [];
  await create({}, { noteFocus: 'second point', goToNote: (l) => { go.push(l); } });
  const focused = [...page.querySelectorAll('[data-focus]')];
  expect(focused).toHaveLength(1);
  expect(focused[0].textContent).toContain('second point');
  expect(go).toEqual([null]);
});

it('noteFocus d\'une ligne modifiée depuis : rien de mis en évidence, puis goToNote(null)', async () => {
  const go: unknown[] = [];
  await create({}, { noteFocus: 'ligne partie', goToNote: (l) => { go.push(l); } });
  expect(page.querySelector('[data-focus]')).toBeNull();
  expect(go).toEqual([null]);
});

it('noteFocus avec le diff affiché : rien de mis en évidence, puis goToNote(null)', async () => {
  const go: unknown[] = [];
  const note = { id: 'n', path: 'docs/tickets/x.md', text: must, before: '# Titre\n', locked: null, mustNot: [], mark: null, checked: true };
  await draw({ flow: 'create', note } as never, null, { goToNote: (l) => { go.push(l); } });
  await act(() => button('Voir les modifications')!.click());
  await draw({ flow: 'create', note } as never, null, { noteFocus: 'second point', goToNote: (l) => { go.push(l); } });
  expect(page.querySelector('[data-focus]')).toBeNull();
  expect(go).toEqual([null]);
});

it('noteFocus en Brut : l\'éditeur défile à la ligne du cas, comptée depuis 1 comme son affichage', async () => {
  const code = { id: 'n', text: must, time: 1 };
  await create({}, { code, noteFocus: 'second point', goToNote: () => {} } as never);
  await act(() => button('Modifier')!.click());
  await act(() => button('Brut')!.click());
  ats.length = 0;
  await create({}, { code, noteFocus: 'second point', goToNote: () => {} } as never);
  expect(ats.length).toBeGreaterThan(0);
  expect(must.split('\n')[ats.at(-1)! - 1]).toBe('- second point');
});

it('la ligne mise en évidence de la note rendue a sa feuille de style, comme celle de l\'éditeur', () => {
  const css = fs.readFileSync('src/renderer/app/panel/vibecoder/note-view.css', 'utf8');
  const rule = /\.vc-md\s+\[data-focus\]\s*\{([^}]*)\}/.exec(css);
  expect(rule?.[1]).toMatch(/box-shadow:\s*inset 3px 0 var\(--vc-accent\)/);
  expect(rule?.[1]).toMatch(/background:\s*var\(--vc-active-bg\)/);
});

it('design-check en cours : « en cours » et ⏹ ; en file : « en attente », sans ⏹', async () => {
  calls.length = 0;
  await create({ runs: [{ id: 'design-check', state: 'running' }] } as never);
  expect(page.querySelector('.vc-run-on')?.textContent).toContain('en cours');
  await act(() => page.querySelector<HTMLButtonElement>('.vc-run-on button')!.click());
  expect(calls).toEqual([['runOp', 'design-check', 'stop']]);
  await create({ queued: ['design-check'] } as never);
  expect(page.querySelector('.vc-run-on')?.textContent).toBe('en attente');
  expect(page.querySelector('.vc-run-on button')).toBeNull();
  await create({ runs: [{ id: 'design-check', state: 'done' }] } as never);
  expect(page.querySelector('.vc-run-on')).toBeNull();
});

it('le libellé du liseré, en français et en anglais', async () => {
  const note = { id: 'n', path: 'docs/tickets/x.md', text: must, before: '# Titre\n', locked: null, mustNot: [], mark: null, checked: true };
  await draw({ flow: 'create', note } as never);
  expect(page.querySelector('.vc-note-what')?.textContent).toContain('Changée depuis votre dernière relecture');
  await draw({ flow: 'create', lang: 'en', note } as never);
  expect(page.querySelector('.vc-note-what')?.textContent).toContain('Changed since your last review');
});

// Les retraits depuis la référence (note.before) : rendus à leur place, barrés, lecture seule, en mode rendu seulement.
const old = '# Titre\n\n- premier point\n- ancien point\n- second point\n';
const now = '# Titre\n\n- premier point\n- second point\n- nouveau point\n';
const changedNote = (over: object = {}) => ({ id: 'n', path: 'docs/tickets/x.md', text: now, before: old, locked: null, mustNot: [], mark: null, checked: true, ...over });
// Le composant garde son état (Modifier, diff affiché) d'un cas à l'autre : on repart d'un montage neuf.
const fresh = () => act(() => root.render(null));
const removedIn = () => [...page.querySelectorAll<HTMLElement>('.vc-removed')];

it('note changée depuis la référence : ajouts en vert, retraits barrés à leur place', async () => {
  await fresh();
  await draw({ flow: 'create', note: changedNote() } as never);
  const [gone] = removedIn();
  expect(removedIn()).toHaveLength(1);
  expect(gone.tagName).toBe('LI');
  expect(gone.textContent).toBe('ancien point');
  expect(gone.nextElementSibling?.textContent).toContain('second point'); // à sa place : devant ce qui le suit
  expect([...page.querySelectorAll('[data-changed]')].map((e) => e.textContent)).toEqual(['nouveau point']);
});

it('sans référence, ou rien de changé (après Vu ou la validation) : aucun retrait', async () => {
  await fresh();
  await draw({ flow: 'create', note: changedNote({ before: null }) } as never);
  expect(removedIn()).toHaveLength(0);
  await draw({ flow: 'create', note: changedNote({ before: now }) } as never);
  expect(removedIn()).toHaveLength(0);
  expect(page.querySelector('.vc-note-changes')).toBeNull();
});

it('Modifier, Brut : aucun retrait ; Voir les modifications : le diff brut, inchangé', async () => {
  await fresh();
  const code = { id: 'n', text: now, time: 1 };
  await draw({ flow: 'create', note: changedNote() } as never, null, { code } as never);
  await act(() => button('Modifier')!.click());
  expect(page.querySelector('.cm-editor')).not.toBeNull();
  expect(removedIn()).toHaveLength(0);
  await act(() => button('Brut')!.click());
  expect(removedIn()).toHaveLength(0);
  await act(() => button('Modifier')?.click() ?? button('Fermer')!.click());
  await act(() => button('Voir les modifications')!.click());
  expect(removedIn()).toHaveLength(0);
  expect(page.textContent).toContain('ancien point');
  expect(page.querySelector('.vc-rawdiff')).not.toBeNull();
});

it('Relire : ni 💬, ni question, ni pastille, ni remarque sur un retrait', async () => {
  await fresh();
  await draw({ flow: 'review', note: changedNote(), draft: [{ id: 4, target: 'note: ancien point', text: 'remarque' }] } as never);
  const [gone] = removedIn();
  expect(gone.textContent).toBe('ancien point');
  expect(gone.querySelector('button, textarea, .vc-mn, .vc-draft-list, .vc-remarks-muted')).toBeNull();
});

// 0.16.0, l'écran de l'essentiel (docs/tickets/feat/0.16.0-ecran-essentiel.md) : en créateur, la note sans bouton d'action.
const act2 = (id: string, extra: object = {}) => ({ id, label: id, hint: '', who: 'agent', models: [], model: null, kind: 'send', needs: 'none', disabled: null, hidden: false, step: 'note', ...extra });

it('créateur, pas de note : une phrase qui renvoie à l\'agent, aucun bouton (Rédiger la note, Nouvelle demande restent lançables par la CLI)', async () => {
  await fresh();
  const actions = [act2('note', { label: 'Rédiger la note', primary: true }), act2('new-request', { label: 'Nouvelle demande', step: null }), act2('comment', { kind: 'prefill' })];
  await draw({ flow: 'create', note: null, actions } as never);
  expect(page.textContent).toContain('Demandez la note à l\'agent, dans la conversation');
  expect(page.querySelector('.vc-invite')).not.toBeNull();
  expect(page.querySelector('button')).toBeNull();
  expect(page.textContent).not.toMatch(/Rédiger la note|Nouvelle demande/);
  await draw({ flow: 'create', lang: 'en', note: null, actions } as never);
  expect(page.textContent).toContain('Ask the agent for the note, in the conversation');
  expect(page.querySelector('button')).toBeNull();
});

it('relecteur, pas de note : l\'aide de la PR, aucun bouton, comme avant', async () => {
  await fresh();
  await draw({ flow: 'review', note: null, actions: [act2('note', { label: 'Rédiger la note' })] } as never);
  expect(page.textContent).toContain('Pas de note de ticket dans cette PR');
  expect(page.querySelector('button')).toBeNull();
});

it('créateur, une note : Modifier reste ; Enregistrer enregistre la note modifiée', async () => {
  await fresh();
  const code = { id: 'n', text: now, time: 1 };
  const drafts = [{ 'docs/tickets/x.md': { text: `${now}- ajouté\n`, base: 1 } }, () => {}];
  await draw({ flow: 'create', note: changedNote({ before: null }) } as never, null, { code, drafts } as never);
  expect(button('Modifier')).toBeDefined();
  await act(() => button('Modifier')!.click());
  calls.length = 0;
  await act(() => button('Enregistrer')!.click());
  expect(calls).toEqual([['save', 'n', `${now}- ajouté\n`]]);
});

it('créateur : Vérifier et Valider la note restent, avec des actions de l\'écran en plus', async () => {
  await fresh();
  const actions = [act2('note'), act2('comment', { kind: 'prefill' })];
  await draw({ flow: 'create', actions, note: changedNote({ before: null, verified: 'clean' }) } as never);
  expect([...page.querySelectorAll('.vc-note-mark button')].map((b) => b.textContent)).toEqual(['Vérifier', 'Valider la note']);
});

it('créateur, des questions : le questionnaire reste, avec ou sans note', async () => {
  await fresh();
  const questions = [{ n: 1, text: 'Q1 ?', options: ['oui'] }, { n: 2, text: 'Q2 ?', options: [] }];
  await draw({ flow: 'create', note: changedNote({ before: null }), questions } as never);
  expect(page.querySelectorAll('.vc-q')).toHaveLength(2);
  await draw({ flow: 'create', note: null, questions } as never);
  expect(page.querySelectorAll('.vc-q')).toHaveLength(2);
});

it('créateur, la bulle sur une ligne de la note : elle la cite dans le champ de la conversation', async () => {
  await fresh();
  await draw({ flow: 'create', note: changedNote({ before: null }) } as never);
  calls.length = 0;
  await act(() => button('Citer dans le champ', items()[0])!.click());
  expect(calls).toEqual([['prefill', 'comment', 'premier point']]);
});

it('le retrait a sa feuille de style : rouge, barré', () => {
  const css = fs.readFileSync('src/renderer/app/panel/vibecoder/note-view.css', 'utf8');
  const rule = /\.vc-removed\s*\{([^}]*)\}/.exec(css);
  expect(rule?.[1]).toMatch(/line-through/);
  expect(rule?.[1]).toMatch(/var\(--vc-ko/);
});

it('un élément de liste retiré n\'a qu\'une puce, sans retrait de plus', () => {
  const css = fs.readFileSync('src/renderer/app/panel/vibecoder/note-view.css', 'utf8');
  expect(/li\.vc-removed\s*\{[^}]*list-style:\s*none/.exec(css)).not.toBeNull();
  expect(/li\.vc-removed\s*>\s*:is\(ul,\s*ol\)\s*\{[^}]*padding-left:\s*0/.exec(css)).not.toBeNull();
});

// 0.16.0 : vérifier, puis valider la note (docs/tickets/feat/0.16.0-controle-en-trois-points.md).
it('créateur : Vérifier appelle design-check et rien d\'autre ; Valider la note (montré si la vérification n\'a rien trouvé) ne marque que la note', async () => {
  await fresh();
  const head = () => page.querySelector<HTMLElement>('.vc-note-mark')!;
  const labels = () => [...head().querySelectorAll('button')].map((b) => b.textContent);
  for (const lang of ['fr', 'en'] as const) {
    await draw({ flow: 'create', lang, note: changedNote({ before: null, verified: null }) } as never);
    expect(labels()).toEqual([lang === 'fr' ? 'Vérifier' : 'Check']);
    calls.length = 0;
    await act(() => head().querySelector('button')!.click());
    expect(calls).toEqual([['run', 'design-check']]);
    await draw({ flow: 'create', lang, note: changedNote({ before: null, verified: 'clean' }) } as never);
    expect(labels()).toEqual(lang === 'fr' ? ['Vérifier', 'Valider la note'] : ['Check', 'Approve the note']);
    calls.length = 0;
    await act(() => head().querySelectorAll('button')[1].click());
    expect(calls).toEqual([['mark', 'note', 'ok']]);
  }
  await draw({ flow: 'create', note: changedNote({ before: null, verified: 'edited' }) } as never);
  expect(head().textContent).toContain('Modifiée depuis la vérification');
  expect(page.textContent).not.toMatch(/Revérifier|Check again/);
});

it('créateur : la note modifiée depuis sa validation et vérifiée : Revalider, le même geste ; non vérifiée : Vérifier seul', async () => {
  await fresh();
  await draw({ flow: 'create', note: changedNote({ before: null, mark: 'changed' }) } as never);
  expect([...page.querySelectorAll('.vc-note-mark button')].map((b) => b.textContent)).toEqual(['Vérifier']);
  await draw({ flow: 'create', note: changedNote({ before: null, mark: 'changed', verified: 'clean' }) } as never);
  const b = page.querySelectorAll<HTMLButtonElement>('.vc-note-mark button')[1];
  expect(b.textContent).toBe('Revalider');
  calls.length = 0;
  await act(() => b.click());
  expect(calls).toEqual([['mark', 'note', 'ok']]);
});

it('relecteur : Valider la note et À revoir, comme avant', async () => {
  await fresh();
  await draw({ flow: 'review', note: changedNote({ before: null }) } as never);
  expect([...page.querySelectorAll('.vc-note-mark button')].map((b) => b.textContent)).toEqual(['Valider la note', 'À revoir']);
});
