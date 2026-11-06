// @vitest-environment happy-dom
// InvariantsView (invariants-view.tsx) : Voir le fichier d'un test modifié (f.base) → Fichier · Diff depuis la
// base de la branche, le diff entier en lecture seule (Relire : de f.base à f.source ; Créer : au texte de
// l'éditeur) ; un test ajouté, pas de sélecteur ; Lire en pseudo-code dans les outils de l'en-tête, même action ;
// 💬 et Ouvrir en IconButton (nommés, 💬 pressé pendant la saisie en Relire), l'état et Tout valider : une icône et leur texte ;
// vue IDE : les tests à gauche (nom coloré par leur état git), le premier choisi d'emblée, un clic montre ses cartes seules (en-tête et boutons
// intacts) et referme le fichier ouvert de l'autre ;
// le verdict d'un cas : deux badges écrits dans son en-tête, celui donné pressé ; À revoir, selon le flux : cite le cas ou ouvre la zone de commentaire.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { beforeEach, expect, it } from 'vitest';
import { createKept, scoped, t } from 'core/vibecoder';
import type { VibeAction, VibeTestFile, VibeView } from 'technicals/bridge';
import { InvariantsView } from '../../invariants-view';
import { KeptScope } from '../../kept-scope';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const read = { id: 'read-invariants', label: 'Lire en pseudo-code', hint: '', kind: 'send', step: 'invariants', who: 'haiku',
  models: [], hidden: false, disabled: null, primary: false } as unknown as VibeAction;
const test = (more: Partial<VibeTestFile> = {}): VibeTestFile => ({ id: 't0', path: 'tests/invariants/a.test.ts', blob: 'b',
  cases: [], lines: [], source: 'const a = 2;\n', reading: null, marks: {}, ...more });
let runs: unknown[][] = [];
let marks: unknown[][] = [];
let prefills: unknown[][] = [];
let drafts: unknown[][] = [];
beforeEach(() => { runs = []; marks = []; prefills = []; drafts = []; act(() => root.render(null)); });
const draw = (f: VibeTestFile | VibeTestFile[], flow: 'create' | 'review', files: unknown[] = [], draft: unknown[] = [], kept?: ReturnType<typeof scoped>) => act(() => {
  const view = { lang: 'fr', flow, actions: [read], invariants: [f].flat(), files, outputs: {}, note: null, steps: [], modules: [], questions: [], checklist: [], draft } as unknown as VibeView;
  const props = { view, step: { id: 'invariants', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
    code: null, drafts: [{}, () => {}], act: { run: (...a: unknown[]) => runs.push(a), follow: () => {}, mark: (...a: unknown[]) => marks.push(a), prefill: (...a: unknown[]) => prefills.push(a),
      draft: (...a: unknown[]) => drafts.push(a), open: (...a: unknown[]) => runs.push(['open', ...a]), openLink: () => {}, save: async () => true } } as unknown as StepProps;
  root.render(kept ? createElement(KeptScope.Provider, { value: kept }, createElement(InvariantsView, props)) : createElement(InvariantsView, props));
});
const src = () => page.querySelector('details.vc-ifile-src') as HTMLDetailsElement;
const pick = (v: string) => act(() => {
  const s = page.querySelector('select.vc-mod-shown') as HTMLSelectElement;
  s.value = v;
  s.dispatchEvent(new Event('change', { bubbles: true }));
});
const docs = () => [...page.querySelectorAll('.vc-mdiff .cm-editor')].map((e) => EditorView.findFromDOM(e as HTMLElement)!.state.doc.toString());

it('Relire : un test modifié, Fichier · Diff depuis la base ; le diff de f.base à f.source', async () => {
  await draw(test({ base: 'const a = 1;\n' }), 'review');
  const s = page.querySelector('select.vc-mod-shown') as HTMLSelectElement;
  expect([...s.options].map((o) => o.textContent)).toEqual(['Fichier', 'Diff depuis la base de la branche']);
  expect(page.querySelector('.vc-mdiff')).toBeNull();
  await pick('base');
  expect(docs()).toEqual(['const a = 2;\n']);
  await act(async () => [...page.querySelectorAll<HTMLButtonElement>('.vc-seg button')].find((b) => b.textContent === 'Côte à côte')!.click());
  expect(docs()).toEqual(['const a = 1;\n', 'const a = 2;\n']);
});

it('un test ajouté (base null ou absente) : pas de sélecteur', async () => {
  await draw(test({ base: null }), 'review');
  expect(page.querySelector('select.vc-mod-shown')).toBeNull();
  await draw(test(), 'create');
  await act(async () => { src().open = true; src().dispatchEvent(new Event('toggle')); });
  expect(page.querySelector('select.vc-mod-shown')).toBeNull();
});

it('Créer : ouvert, Fichier modifiable ; le diff, en lecture seule, jusqu\'au texte de l\'éditeur (le disque absent : f.source)', async () => {
  await draw(test({ base: 'const a = 1;\n' }), 'create');
  expect(page.querySelector('select.vc-mod-shown')).toBeNull();   // fermé
  await act(async () => { src().open = true; src().dispatchEvent(new Event('toggle')); });
  expect(page.querySelector('select.vc-mod-shown')).not.toBeNull();
  await pick('base');
  expect(docs()).toEqual(['const a = 2;\n']);
  const v = EditorView.findFromDOM(page.querySelector('.vc-mdiff .cm-editor') as HTMLElement)!;
  expect(v.state.readOnly).toBe(true);
});

it('pas lu : Lire en pseudo-code dans les outils de l\'en-tête, plus sous les cartes ; même action', async () => {
  await draw(test(), 'create');
  const tools = page.querySelector('.vc-ifile-tools')!;
  const b = [...tools.querySelectorAll('button.vc-run')].find((x) => x.textContent?.includes('Lire en pseudo-code')) as HTMLButtonElement;
  expect(b.dataset.tone).toBe('plain');
  expect([...page.querySelectorAll('.vc-ifile > .vc-run')]).toEqual([]);
  b.click();
  expect(runs).toEqual([['read-invariants']]);
});

it('icônes : 💬 et Ouvrir nommés, mêmes actions ; l\'état et Tout valider, icône et texte', async () => {
  await draw(test({ cases: ['a', 'b'], lines: [1, 2], marks: { a: 'changed' } }), 'review');
  const named = (l: string) => [...page.querySelectorAll<HTMLButtonElement>('button.vc-tool')].filter((b) => b.getAttribute('aria-label') === l);
  expect(named('Ouvrir dans l\'éditeur').every((b) => b.title === 'Ouvrir dans l\'éditeur' && b.querySelector('svg'))).toBe(true);
  expect(named('Ouvrir dans l\'éditeur')).toHaveLength(3);   // le fichier, puis chaque cas
  named('Ouvrir dans l\'éditeur')[2].click();
  expect(runs).toEqual([['open', 't0', 2]]);   // à la ligne du cas b
  const quote = named('Une remarque sur ce cas, au brouillon de revue')[0];
  expect(quote.getAttribute('aria-pressed')).toBe('false');
  await act(async () => quote.click());
  expect(quote.getAttribute('aria-pressed')).toBe('true');
  expect(page.querySelector('.vc-case textarea')).not.toBeNull();
  const state = page.querySelector('.vc-case-state')!;
  expect(state.querySelector('svg')).not.toBeNull();
  expect(state.textContent).toBe('Modifié depuis la validation');
  const all = [...page.querySelectorAll('.vc-ifile-tools button')].find((b) => b.textContent === 'Tout valider')!;
  expect(all.querySelector('svg')).not.toBeNull();
});

it('le verdict et les deux outils d\'un cas sont dans son en-tête ; le badge donné est pressé, le pied a disparu', async () => {
  await draw(test({ cases: ['a', 'b', 'c'], lines: [1, 2, 3], marks: { a: 'ok', b: 'ko' } }), 'review');
  const pressed = [...page.querySelectorAll('.vc-case')].map((c) => [...c.querySelectorAll('.vc-case-head .vc-verdict button[aria-pressed]')].map((b) => b.getAttribute('aria-pressed')));
  expect(pressed).toEqual([['true', 'false'], ['false', 'true'], ['false', 'false']]);
  expect(page.querySelectorAll('.vc-case-head .vc-case-tools .vc-tool')).toHaveLength(9);   // 💬, Poser une question, Ouvrir
  expect(page.querySelector('.vc-case-foot')).toBeNull();
  expect(page.querySelector('.vc-case-state')).toBeNull();
});

it('À revoir sur une carte : Créer, marque le cas et le cite dans le champ ; Relire, marque seulement (le bouton de remarque ouvre la zone)', async () => {
  const f = test({ cases: ['a'], lines: [1] });
  const ko = () => page.querySelector<HTMLButtonElement>('.vc-case-head .vc-verdict button:last-child')!;
  await draw(f, 'create');
  await act(async () => ko().click());
  expect(marks).toEqual([['case:tests/invariants/a.test.ts:a', 'ko']]);
  expect(prefills).toEqual([['case-ko', 'a']]);
  expect(page.querySelector('.vc-case textarea')).toBeNull();
  await draw(f, 'review');
  await act(async () => ko().click());
  expect(marks).toHaveLength(2);
  expect(prefills).toHaveLength(1);
  expect(page.querySelector('.vc-case textarea')).toBeNull();
});

const two = [test({ id: 't0', path: 'tests/invariants/a.test.ts', cases: ['a1'], lines: [1] }),
  test({ id: 't1', path: 'tests/invariants/b.test.ts', cases: ['b1', 'b2'], lines: [1, 2], marks: { b1: 'ok' } })];
const row = (key: string) => [...page.querySelectorAll<HTMLElement>('.vc-tree-row')].find((r) => r.dataset.key === key)!;
const titles = () => [...page.querySelectorAll('.vc-case-title')].map((e) => e.textContent);

it('vue IDE : les tests à gauche, numérotés et colorés par leur état git ; le premier montre ses cartes seules', async () => {
  await draw(two, 'create', [{ path: 'tests/invariants/b.test.ts', git: 'new' }]);
  expect(row('tests/invariants/a.test.ts').getAttribute('aria-selected')).toBe('true');
  expect(row('tests/invariants/b.test.ts').dataset.mark).toBe('new');
  expect(row('tests/invariants/a.test.ts').dataset.mark).toBeUndefined();
  expect(row('tests/invariants/b.test.ts').querySelector('.vc-tree-rank')!.textContent).toBe('2');
  expect(titles()).toEqual(['a1']);
  expect(page.querySelectorAll('.vc-ide-main .vc-ifile')).toHaveLength(1);
});

it('vue IDE : choisir un test montre ses cartes, avec Tout valider, Relire / Lire, Ouvrir, Voir le fichier, verdicts et 💬', async () => {
  await draw(two, 'create');
  await act(async () => row('tests/invariants/b.test.ts').click());
  expect(titles()).toEqual(['b1', 'b2']);
  const main = page.querySelector('.vc-ide-main')!;
  expect([...main.querySelectorAll('.vc-ifile-tools button')].map((b) => b.textContent!.slice(0, 19) || b.getAttribute('aria-label')))
    .toEqual(['Tout valider', 'Lire en pseudo-code', 'Ouvrir dans l\'éditeur']);
  expect(main.querySelector('details.vc-ifile-src > summary')!.textContent).toBe('Voir le fichier');
  expect(main.querySelectorAll('.vc-case-head .vc-verdict button')).toHaveLength(4);
  expect(main.querySelectorAll('.vc-case-head .vc-case-tools .vc-tool')).toHaveLength(4);
});

it('vue IDE : changer de test referme le fichier ouvert ', async () => {
  await draw(two, 'create');
  await act(async () => { src().open = true; src().dispatchEvent(new Event('toggle')); });
  expect(src().open).toBe(true);
  await act(async () => row('tests/invariants/b.test.ts').click());
  expect(src().open).toBe(false);
  await act(async () => row('tests/invariants/a.test.ts').click());
  expect(src().open).toBe(false);
});

const key = 'case:tests/invariants/a.test.ts:a';
const noted = test({ cases: ['a', 'b'], lines: [1, 2] });
const ask = () => page.querySelector<HTMLButtonElement>('.vc-case-tools button[aria-label="Poser une question à l\'agent"]');
const remarkBtn = (i = 0) => [...page.querySelectorAll('.vc-case')][i].querySelector<HTMLButtonElement>('.vc-verdict button:nth-child(3)');

it('Relire : deux remarques sur un cas, empilées sous lui ; l\'autre cas n\'en a pas ; croix → le brouillon', async () => {
  await draw(noted, 'review', [], [{ id: 1, target: key, text: 'un' }, { id: 2, target: key, text: 'deux' }, { id: 3, target: 'note', text: 'ailleurs' }]);
  const cards = [...page.querySelectorAll('.vc-case')];
  expect([...cards[0].querySelectorAll('.vc-draft-list li')].map((li) => li.textContent)).toEqual(['un', 'deux']);
  expect(cards[1].querySelector('.vc-draft-list')).toBeNull();
  await act(async () => cards[0].querySelectorAll<HTMLButtonElement>('.vc-draft-remove')[1].click());
  expect(drafts).toEqual([[{ remove: 2 }]]);
});

it('Créer : les remarques du brouillon ne sont pas sous les cas', async () => {
  await draw(noted, 'create', [], [{ id: 1, target: key, text: 'un' }]);
  expect(page.querySelector('.vc-draft-list')).toBeNull();
});

it('Poser une question sur un cas : son titre cité dans le champ, rien d\'envoyé ni ajouté ; absent en Créer', async () => {
  await draw(noted, 'review');
  await act(async () => ask()!.click());
  expect(prefills).toEqual([['comment', 'a']]);
  expect(drafts).toEqual([]);
  expect(runs).toEqual([]);
  await draw(noted, 'create');
  expect(ask()).toBeNull();
});

it('un cas À revoir : le bouton de remarque, qui ouvre la zone sans rien ajouter ; Validé : aucun ; Créer : aucun', async () => {
  await draw(test({ cases: ['a', 'b', 'c'], lines: [1, 2, 3], marks: { a: 'ko', b: 'ok' } }), 'review');
  expect([0, 1, 2].map((i) => remarkBtn(i)?.textContent ?? null)).toEqual(['Ajouter une remarque au brouillon', null, null]);
  expect(page.querySelector('.vc-case textarea')).toBeNull();
  await act(async () => remarkBtn(0)!.click());
  expect(page.querySelector('.vc-case textarea')).not.toBeNull();
  expect(drafts).toEqual([]);
  await draw(test({ cases: ['a'], lines: [1], marks: { a: 'ko' } }), 'create');
  expect(remarkBtn(0)).toBeNull();
});

it('le fichier ouvert gardé : la vue recréée sous le même agent le montre encore ouvert, un autre agent non', async () => {
  const kept = createKept();
  await draw(test(), 'create', [], [], scoped(kept, 'a1', 'invariants'));
  await act(async () => { src().open = true; src().dispatchEvent(new Event('toggle')); });
  await act(async () => root.render(null));
  await draw(test(), 'create', [], [], scoped(kept, 'a1', 'invariants'));
  expect(src().open).toBe(true);
  await act(async () => root.render(null));
  await draw(test(), 'create', [], [], scoped(kept, 'a2', 'invariants'));
  expect(src().open).toBe(false);
});
