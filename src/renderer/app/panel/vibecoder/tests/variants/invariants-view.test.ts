// @vitest-environment happy-dom
// InvariantsView (invariants-view.tsx) : Voir le fichier d'un test modifié (f.base) → Fichier · Diff depuis la
// base de la branche, le diff entier en lecture seule (Relire : de f.base à f.source ; Créer : au texte de
// l'éditeur) ; un test ajouté, pas de sélecteur ; Lire en pseudo-code dans les outils de l'en-tête, même action ;
// 💬 et Ouvrir en IconButton (nommés, 💬 pressé pendant la saisie en Relire), l'état et Tout valider : une icône et leur texte ;
// un cas validé : l'icône seule, « Validé » en title et aria-label.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { beforeEach, expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeAction, VibeTestFile, VibeView } from 'technicals/bridge';
import { InvariantsView } from '../../invariants-view';
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
beforeEach(() => { runs = []; act(() => root.render(null)); });
const draw = (f: VibeTestFile, flow: 'create' | 'review') => act(() => {
  const view = { lang: 'fr', flow, actions: [read], invariants: [f], outputs: {}, note: null, steps: [], modules: [], questions: [], checklist: [], draft: [] } as unknown as VibeView;
  const props = { view, step: { id: 'invariants', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
    code: null, drafts: [{}, () => {}], act: { run: (...a: unknown[]) => runs.push(a), follow: () => {}, mark: () => {}, prefill: () => {},
      draft: () => {}, open: (...a: unknown[]) => runs.push(['open', ...a]), openLink: () => {}, save: async () => true } } as unknown as StepProps;
  root.render(createElement(InvariantsView, props));
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

it('un cas validé : son état, l\'icône seule, « Validé » en title et aria-label ; Refusé garde son texte', async () => {
  await draw(test({ cases: ['a', 'b'], lines: [1, 2], marks: { a: 'ok', b: 'ko' } }), 'review');
  const [ok, ko] = [...page.querySelectorAll<HTMLElement>('.vc-case-state')];
  expect(ok.dataset.state).toBe('ok');
  expect(ok.querySelector('svg')).not.toBeNull();
  expect(ok.textContent).toBe('');
  expect([ok.title, ok.getAttribute('aria-label')]).toEqual(['Validé', 'Validé']);
  expect(ko.textContent).toBe('Refusé');
});
