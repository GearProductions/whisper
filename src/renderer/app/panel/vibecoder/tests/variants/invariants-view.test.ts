// @vitest-environment happy-dom
// InvariantsView (invariants-view.tsx) : Voir le fichier d'un test : le diff entier en lecture seule depuis la
// référence du menu de la vue IDE (Relire : de f.base à f.source ; Créer : au texte de l'éditeur ; Fichier :
// l'éditeur) ; Lire en pseudo-code dans les outils de l'en-tête, même action ;
// 💬 et Ouvrir en IconButton (nommés, 💬 pressé pendant la saisie en Relire), l'état et Tout valider : une icône et leur texte ;
// vue IDE : les tests et les fichiers de la Forme à gauche (nom coloré d'après leur base), le premier choisi d'emblée, un clic montre ses cartes seules (en-tête et boutons
// intacts) et referme le fichier ouvert de l'autre ;
// un fichier de la Forme : son code en lecture seule (touché) ou son contrat ; sous Garantit, ce que garde le cas (lien vers la note) ;
// le verdict d'un cas : deux badges écrits dans son en-tête, celui donné pressé ; À revoir, selon le flux : cite le cas ou ouvre la zone de commentaire ;
// note 0.15.0-ecran-statuts : Code d'un cas (créateur) : le bloc seul, enregistré le fichier dont seul le bloc change, grisé s'il est verrouillé ;
// le menu de diff de la vue IDE (arborescence filtrée, un fichier supprimé en retraits, « modifiée depuis la validation »)
// et Valider les invariants (MarkControl, offert si step.check.now) ; relecteur : pas de validation.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { beforeEach, expect, it } from 'vitest';
import { createKept, scoped, t } from 'core/vibecoder';
import type { VibeAction, VibeModule, VibeStep, VibeTestFile, VibeView } from 'technicals/bridge';
import type { Drafts } from '../../file-draft';
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
let goes: unknown[] = [];
let follows: unknown[][] = [];
let saves: unknown[][] = [];
let stored: Drafts = {};   // les modifications gardées au-dessus de l'étape
let pushed: unknown = null;   // le texte poussé par le principal (props.code)
let extra: Partial<VibeView> = {};   // ce que la vue a de plus (modules, note)
beforeEach(() => { runs = []; marks = []; prefills = []; drafts = []; goes = []; follows = []; saves = []; stored = {}; pushed = null; extra = {}; act(() => root.render(null)); });
const draw = (f: VibeTestFile | VibeTestFile[], flow: 'create' | 'review', files: unknown[] = [], draft: unknown[] = [], kept?: ReturnType<typeof scoped>) => act(() => {
  const view = { lang: 'fr', flow, actions: [read], invariants: [f].flat(), files, outputs: {}, note: null, steps: [], modules: [], questions: [], checklist: [], commits: [{ hash: 'h1', subject: 's', files: [] }], draft, ...extra } as unknown as VibeView;
  const props = { view, step: { id: 'invariants', status: 'current', facts: '', open: true, ...extra.steps?.[0] }, t: t('fr'), busy: false, text: '', setText: () => {},
    code: pushed, drafts: [stored, () => {}], goToNote: (l: unknown) => goes.push(l), act: { run: (...a: unknown[]) => runs.push(a), follow: (...a: unknown[]) => follows.push(a), mark: (...a: unknown[]) => marks.push(a), prefill: (...a: unknown[]) => prefills.push(a),
      draft: (...a: unknown[]) => drafts.push(a), open: (...a: unknown[]) => runs.push(['open', ...a]), openLink: () => {}, save: async (...a: unknown[]) => { saves.push(a); return true; } } } as unknown as StepProps;
  root.render(kept ? createElement(KeptScope.Provider, { value: kept }, createElement(InvariantsView, props)) : createElement(InvariantsView, props));
});
const src = () => page.querySelector('details.vc-ifile-src') as HTMLDetailsElement;
const showAll = () => act(() => page.querySelector<HTMLInputElement>('.vc-only-inv input')!.click());
const pick = (v: string) => act(() => {
  const s = page.querySelector('select.vc-mod-shown') as HTMLSelectElement;
  s.value = v;
  s.dispatchEvent(new Event('change', { bubbles: true }));
});
const docs = () => [...page.querySelectorAll('.vc-mdiff .cm-editor')].map((e) => EditorView.findFromDOM(e as HTMLElement)!.state.doc.toString());

it('Voir le fichier : le diff depuis la base, entier, en lecture seule (Relire : de f.base à f.source) ; En ligne · Côte à côte', async () => {
  await draw(test({ base: 'const a = 1;\n' }), 'review');
  const s = page.querySelector('select.vc-mod-shown') as HTMLSelectElement;
  expect([...s.options].map((o) => o.textContent)).toEqual(['Fichier', 'Depuis la base de la branche', 'Depuis le dernier commit (rien de modifié)']);
  expect(docs()).toEqual(['const a = 2;\n']);
  await act(async () => [...page.querySelectorAll<HTMLButtonElement>('.vc-seg button')].find((b) => b.textContent === 'Côte à côte')!.click());
  expect(docs()).toEqual(['const a = 1;\n', 'const a = 2;\n']);
  await pick('file');
  expect(page.querySelector('.vc-mdiff')).toBeNull();
});

it('un test ajouté (base null) : tout en ajouts ; base inconnue (absente) : le fichier', async () => {
  await draw(test({ base: null }), 'review');
  expect(docs()).toEqual(['const a = 2;\n']);
  await draw(test(), 'review');
  expect(page.querySelector('.vc-mdiff')).toBeNull();
});

it('Créer : ouvert, le diff en lecture seule jusqu\'au texte de l\'éditeur ; Fichier : l\'éditeur modifiable', async () => {
  pushed = { id: 't0', text: 'const a = 2;\n', time: 1 };
  await draw(test({ base: 'const a = 1;\n' }), 'create');
  expect(page.querySelector('.vc-mdiff')).toBeNull();   // fermé : rien de suivi
  await act(async () => { src().open = true; src().dispatchEvent(new Event('toggle')); });
  expect(docs()).toEqual(['const a = 2;\n']);
  expect(EditorView.findFromDOM(page.querySelector('.vc-mdiff .cm-editor') as HTMLElement)!.state.readOnly).toBe(true);
  await pick('file');
  expect(page.querySelector('.vc-mdiff')).toBeNull();
  expect(EditorView.findFromDOM(src().querySelector('.cm-editor') as HTMLElement)!.state.readOnly).toBe(false);
});

it('Créer : Depuis le dernier commit, de at.head (poussé par le suivi) au texte de l\'éditeur', async () => {
  pushed = { id: 't0', text: 'const a = 2;\n', time: 1, at: { base: null, head: 'const a = 0;\n' } };
  extra = { diffs: { head: [{ path: 'tests/invariants/a.test.ts' }], validated: {} } };
  await draw(test({ base: 'const a = 1;\n' }), 'create');
  await act(async () => { src().open = true; src().dispatchEvent(new Event('toggle')); });
  await pick('head');
  await act(async () => [...page.querySelectorAll<HTMLButtonElement>('.vc-seg button')].find((b) => b.textContent === 'Côte à côte')!.click());
  expect(docs()).toEqual(['const a = 0;\n', 'const a = 2;\n']);
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

it('vue IDE : les tests à gauche, sans numéro et colorés selon leur base ; le premier montre ses cartes seules', async () => {
  await draw([{ ...two[0], base: two[0].source }, { ...two[1], base: null }], 'create');   // a : la même qu'à la base ; b : absente de la base
  expect(row('tests/invariants/a.test.ts').getAttribute('aria-selected')).toBe('true');
  expect(row('tests/invariants/b.test.ts').dataset.mark).toBe('new');
  expect(row('tests/invariants/a.test.ts').dataset.mark).toBeUndefined();
  expect(row('tests/invariants/b.test.ts').querySelector('.vc-tree-rank')).toBeNull();
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

// ---- La Forme à côté des tests, ce que garde chaque cas ---------------------------------------------------------
const mod = (path: string, more: Partial<VibeModule> = {}): VibeModule => ({ path, paths: [path], contract: `expose : ${path} · ne connaît pas : le disque`, file: null,
  touched: false, commits: [], ...more });
const touched = mod('src/a.ts', { touched: true, file: { id: 'm0', path: 'src/a.ts' }, files: [{ id: 'm0/0', path: 'src/a.ts' }] });
const forme = [touched, mod('src/b.ts')];
const mustNot = (...texts: string[]) => ({ text: '', mark: 'nothing', mustNot: texts.map((text) => ({ text, mark: 'invariant' })) }) as unknown as VibeView['note'];

it('la Forme et les tests dans une arborescence : les fichiers de la Forme numérotés, en retrait ; sans Forme, les tests seuls', async () => {
  extra = { modules: forme };
  await draw(two, 'create');
  await showAll();
  expect([...page.querySelectorAll<HTMLElement>('.vc-tree-row[data-key$=".ts"]')].map((r) => r.dataset.key))
    .toEqual(['src/a.ts', 'src/b.ts', 'tests/invariants/a.test.ts', 'tests/invariants/b.test.ts']);
  expect(row('src/b.ts').querySelector('.vc-tree-rank')!.textContent).toBe('2');
  expect(row('tests/invariants/a.test.ts').querySelector('.vc-tree-rank')).toBeNull();
  extra = {};
  await draw(two, 'create');
  expect(page.querySelector('.vc-tree-row[data-key="src/a.ts"]')).toBeNull();
});

it('sans test : l\'invitation, pas d\'arborescence, même avec une Forme', async () => {
  extra = { modules: forme };
  await draw([], 'create');
  expect(page.querySelector('.vc-ide')).toBeNull();
  expect(page.querySelector('.vc-invite')).not.toBeNull();
});

it('un fichier de la Forme touché : suivi par son id, son code poussé, verrouillé, sans Enregistrer ni Abandonner ; quitté : plus suivi ; pas touché : son contrat', async () => {
  extra = { modules: forme };
  pushed = { id: 'm0/0', text: 'const forme = 1;\n', time: 0 };
  await draw(two, 'create');
  await showAll();
  await act(async () => row('src/a.ts').click());
  expect(follows).toContainEqual(['m0/0']);
  expect(page.querySelector('.vc-ide-main .vc-ifile')).toBeNull();
  const main = page.querySelector('.vc-ide-main')!;
  const v = EditorView.findFromDOM(main.querySelector('.cm-editor') as HTMLElement)!;
  expect(v.state.doc.toString()).toBe('const forme = 1;\n');
  expect(v.state.readOnly).toBe(true);
  const labels = [...main.querySelectorAll('button')].map((b) => b.textContent);
  expect(labels).not.toContain('Enregistrer');
  expect(labels).not.toContain('Abandonner');
  await act(async () => row('src/b.ts').click());
  expect(follows.at(-1)).toEqual([null]);
  expect(page.querySelector('.vc-ide-main .vc-fcontract')!.textContent).toContain('src/b.ts');
  expect(page.querySelector('.vc-ide-main .vc-mod-head')).toBeNull();
});

it('un test choisi : ses cartes, comme avant, après un fichier de la Forme', async () => {
  extra = { modules: forme };
  await draw(two, 'create');
  await showAll();
  await act(async () => row('src/b.ts').click());
  await act(async () => row('tests/invariants/b.test.ts').click());
  expect(titles()).toEqual(['b1', 'b2']);
  await act(async () => { src().open = true; src().dispatchEvent(new Event('toggle')); });
  expect(follows.at(-1)).toEqual(['t1']);   // il suit toujours son propre fichier
});

const link = test({ cases: ['a', 'b', 'c'], lines: [1, 2, 3], reading: [
  { title: 'a', pseudo: '', edges: [], guarantees: 'Garantit « Ne jamais écrire » et « Ne jamais lire »', warning: null },
  { title: 'b', pseudo: '', edges: [], guarantees: 'Garantit I-12 et I-3', warning: null },
  { title: 'c', pseudo: '', edges: [], guarantees: 'Garantit autre chose', warning: null },
] });
const keeps = () => [...page.querySelectorAll('.vc-case')].map((c) => c.querySelector('.vc-case-keeps'));

it('un cas à la ligne citée : son lien appelle goToNote(texte) ; un I-12 : le numéro, pas de lien ; rien : non rattaché', async () => {
  extra = { note: mustNot('Ne jamais écrire → invariant', 'Ne jamais lire → invariant') };
  await draw(link, 'create');
  const [a, b, c] = keeps();
  const buttons = [...a!.querySelectorAll('button')];
  expect(buttons.map((x) => x.textContent)).toEqual(['Ne jamais écrire → invariant', 'Ne jamais lire → invariant']);
  buttons[1].click();
  expect(goes).toEqual(['Ne jamais lire → invariant']);
  expect(b!.textContent).toContain('I-12');
  expect(b!.textContent).toContain('I-3');
  expect(b!.querySelector('button')).toBeNull();
  expect(c!.textContent).toContain('non rattaché');
});

it('pas lu : non rattaché ; lecture périmée : le rattachement est marqué périmé', async () => {
  await draw(test({ cases: ['a'], lines: [1] }), 'create');
  expect(keeps()[0]!.textContent).toContain('non rattaché');
  extra = { note: mustNot('Ne jamais écrire → invariant') };
  await draw(test({ cases: ['a'], lines: [1], reading: [link.reading![0]], stale: true, staleCases: ['a'] }), 'create');
  expect(keeps()[0]!.getAttribute('data-stale')).toBe('true');
  await draw(test({ cases: ['a'], lines: [1], reading: [link.reading![0]] }), 'create');
  expect(keeps()[0]!.hasAttribute('data-stale')).toBe(false);
});

it('lecture périmée : Validé, À revoir et Tout valider grisés (relire d\'abord) ; à jour, ou sans lecture : actifs', async () => {
  const verdicts = () => [...page.querySelectorAll<HTMLButtonElement>('.vc-verdict button')];
  const all = () => [...page.querySelectorAll<HTMLButtonElement>('.vc-ifile-tools button')].find((b) => b.textContent === 'Tout valider');
  await draw(test({ cases: ['a'], lines: [1], reading: [link.reading![0]], stale: true, staleCases: ['a'] }), 'create');
  expect(verdicts().length).toBeGreaterThan(0);
  expect(verdicts().every((b) => b.disabled && b.title.includes('Lecture périmée'))).toBe(true);
  if (all()) expect(all()!.disabled).toBe(true);
  await draw(test({ cases: ['a'], lines: [1], reading: [link.reading![0]] }), 'create');
  expect(verdicts().some((b) => b.disabled)).toBe(false);
  await draw(test({ cases: ['a'], lines: [1] }), 'create');
  expect(verdicts().some((b) => b.disabled)).toBe(false);
});

// ---- Note 0.15.0-invariants-par-cas : les cas un par un --------------------------------------------------------------
const caseVerdicts = (i: number) => [...[...page.querySelectorAll('.vc-case')][i].querySelectorAll<HTMLButtonElement>('.vc-verdict button')];

it('un cas à la lecture périmée : ses boutons grisés, ceux de l\'autre non ; Tout valider grisé, Relire en accent', async () => {
  await draw(test({ cases: ['a', 'b'], lines: [1, 2], reading: [link.reading![0], { ...link.reading![0], title: 'b' }], stale: true, staleCases: ['a'] }), 'create');
  expect(caseVerdicts(0).every((b) => b.disabled)).toBe(true);
  expect(caseVerdicts(1).some((b) => b.disabled)).toBe(false);
  const tools = [...page.querySelectorAll<HTMLButtonElement>('.vc-ifile-tools button')];
  expect(tools.find((b) => b.textContent === 'Tout valider')!.disabled).toBe(true);
  expect(tools.find((b) => b.textContent?.includes('Relire'))!.dataset.tone).toBe('accent');
  expect(page.querySelector('.vc-ifile-read')!.textContent).toBe('lecture périmée');
});

it('une validation tombée sur le code commun : son texte, pas « Modifié depuis la validation » ; sinon l\'ancien', async () => {
  await draw(test({ cases: ['a', 'b'], lines: [1, 2], marks: { a: 'changed', b: 'changed' }, commonChanged: ['a'] }), 'review');
  const states = [...page.querySelectorAll('.vc-case-state')].map((e) => e.textContent);
  expect(states).toEqual(['Le code commun du fichier a changé', 'Modifié depuis la validation']);
  extra = { lang: 'en' };
  await draw(test({ cases: ['a'], lines: [1], marks: { a: 'changed' }, commonChanged: ['a'] }), 'review');
  expect(page.querySelector('.vc-case-state')!.textContent).toBe('The file\'s common code changed');
});

it('deux cas de même titre : deux cibles distinctes (la clé), pour le verdict et pour Tout valider ; les remarques suivent leur cible', async () => {
  const dup = test({ cases: ['a', 'a'], lines: [1, 2] });
  await draw(dup, 'create');
  await act(async () => caseVerdicts(1)[0].click());
  expect(marks).toEqual([['case:tests/invariants/a.test.ts:a n° 2', 'ok']]);
  marks = [];
  await act(async () => [...page.querySelectorAll<HTMLButtonElement>('.vc-ifile-tools button')].find((b) => b.textContent === 'Tout valider')!.click());
  expect(marks).toEqual([['case:tests/invariants/a.test.ts:a', 'ok'], ['case:tests/invariants/a.test.ts:a n° 2', 'ok']]);
  await draw(dup, 'review', [], [{ id: 1, target: 'case:tests/invariants/a.test.ts:a n° 2', text: 'le second' }]);
  const cards = [...page.querySelectorAll('.vc-case')];
  expect(cards[0].querySelector('.vc-draft-list')).toBeNull();
  expect(cards[1].querySelector('.vc-draft-list')!.textContent).toContain('le second');
});

it('sans test : le texte cite le bouton, en français et en anglais, sans « puis vérifier l\'alignement »', async () => {
  await draw([], 'create');
  expect(page.textContent).toContain('« Écrire les invariants (rouges) » les écrit');
  expect(page.textContent).not.toContain('vérifier l\'alignement');
  extra = { lang: 'en' };
  await draw([], 'create');
  expect(page.textContent).toContain('« Write the invariants (red) » writes them');
});

it('sans test : le texte d\'aide ne cite plus de champ, en français et en anglais', async () => {
  await draw([], 'create');
  expect(page.textContent).not.toContain('dans le champ');
  expect(page.textContent).not.toContain('dictez');
  extra = { lang: 'en' };
  await draw([], 'create');
  expect(page.textContent).not.toContain('in the field');
  expect(page.textContent).not.toContain('dictate');
});

const stats = () => [...page.querySelectorAll('.vc-isum-stat')].map((e) => e.textContent);

it('le résumé : fichiers, cas, validés, à lire (l\'en-tête d\'étape ne les répète plus)', async () => {
  await draw(two, 'create');   // 2 fichiers, 3 cas, b1 validé, aucune lecture
  expect(stats()).toEqual(['2fichiers', '3cas', '1validé', '3à lire']);
});

it('le résumé : un seul fichier, au singulier ; en anglais', async () => {
  await draw(two[0], 'create');
  expect(stats()).toEqual(['1fichier', '1cas', '0validé', '1à lire']);
  extra = { lang: 'en' };
  await draw(two[0], 'create');
  expect(stats()).toEqual(['1file', '1case', '0approved', '1to read']);
  await draw(two, 'create');
  expect(stats()).toEqual(['2files', '3cases', '1approved', '3to read']);
});

it('le résumé : aucun fichier, pas de résumé', async () => {
  await draw([], 'create');
  expect(page.querySelector('.vc-isum')).toBeNull();
});

// ---- Note 0.15.0-ecran-statuts : le bloc d'un cas, les validations --------------------------------------------------
const DISK = ["it('a', () => {", '  expect(1).toBe(1);', '});', '', "it('b', () => {", '  expect(2).toBe(2);', '});', ''].join('\n');
const BLOCK_B = ["it('b', () => {", '  expect(2).toBe(2);', '});'].join('\n');
const EDITED = BLOCK_B.replaceAll('2', '3');   // le bloc modifié
const split = test({ cases: ['a', 'b'], lines: [1, 5], source: DISK });
const codeBtn = (i: number) => [...page.querySelectorAll('.vc-case')][i].querySelectorAll<HTMLButtonElement>('.vc-case-view button')[1];
const editorDocs = () => [...page.querySelectorAll('.vc-case .cm-editor, .vc-ifile-src .cm-editor')].map((e) => EditorView.findFromDOM(e as HTMLElement)!.state.doc.toString());
const footBtn = (label: string) => [...page.querySelectorAll<HTMLButtonElement>('.vc-mod-code-foot button')].find((b) => b.textContent === label);

it('Code d\'un cas (créateur) : le bloc seul, pas le fichier ; Voir le fichier : le fichier entier', async () => {
  pushed = { id: 't0', text: DISK, time: 1 };
  await draw(split, 'create');
  await act(async () => codeBtn(1).click());
  expect(editorDocs()).toEqual([BLOCK_B]);
  await act(async () => { src().open = true; src().dispatchEvent(new Event('toggle')); });
  expect(editorDocs()).toEqual([DISK]);   // un seul à la fois : Voir le fichier a pris la place du bloc
});

it('Code d\'un cas enregistré : saveCode reçoit le fichier du disque dont seul le bloc change', async () => {
  pushed = { id: 't0', text: DISK, time: 1 };
  stored = { [`${split.path}#b`]: { text: EDITED, base: 1 } };
  await draw(split, 'create');
  await act(async () => codeBtn(1).click());
  expect(editorDocs()).toEqual([EDITED]);
  await act(async () => footBtn('Enregistrer')!.click());
  expect(saves).toEqual([['t0', DISK.replace(BLOCK_B, EDITED)]]);
});

it('Code d\'un cas : grisé si le test est verrouillé (rien d\'enregistré)', async () => {
  pushed = { id: 't0', text: DISK, time: 1 };
  stored = { [`${split.path}#b`]: { text: EDITED, base: 1 } };
  await draw({ ...split, locked: 'Un agent écrit' }, 'create');
  await act(async () => codeBtn(1).click());
  expect(footBtn('Enregistrer')!.disabled).toBe(true);
  expect(saves).toEqual([]);
});

// Deux cas de même titre : Code du second ouvre le second bloc, et sa modification, gardée sous la clé « a n° 2 », ne
// remplace que lui dans le fichier.
const DUP = ["it('a', () => {", '  expect(1).toBe(1);', '});', '', "it('a', () => {", '  expect(2).toBe(2);', '});', ''].join('\n');
const SECOND = ["it('a', () => {", '  expect(2).toBe(2);', '});'].join('\n');
const dup = test({ cases: ['a', 'a'], lines: [1, 5], source: DUP });

it('Code d\'un cas de titre en double : le bloc du second, pas du premier', async () => {
  pushed = { id: 't0', text: DUP, time: 1 };
  await draw(dup, 'create');
  await act(async () => codeBtn(1).click());
  expect(editorDocs()).toEqual([SECOND]);
});

it('Code d\'un cas de titre en double enregistré : seul le bloc du second change dans le fichier', async () => {
  pushed = { id: 't0', text: DUP, time: 1 };
  stored = { [`${dup.path}#a n° 2`]: { text: SECOND.replaceAll('2', '3'), base: 1 } };
  await draw(dup, 'create');
  await act(async () => codeBtn(1).click());
  expect(editorDocs()).toEqual([SECOND.replaceAll('2', '3')]);
  await act(async () => footBtn('Enregistrer')!.click());
  expect(saves).toEqual([['t0', DUP.replace(SECOND, SECOND.replaceAll('2', '3'))]]);
});

it('Relecteur : le code d\'un cas en lecture seule, sans éditeur ni pied', async () => {
  await draw(split, 'review');
  await act(async () => codeBtn(1).click());
  expect(footBtn('Enregistrer')).toBeUndefined();
  expect(EditorView.findFromDOM(page.querySelector('.vc-case .cm-editor') as HTMLElement)!.state.readOnly).toBe(true);
});

// ---- Valider les invariants, le menu de diff de la vue IDE ------------------------------------------------------------
const step = (check: VibeStep['check'], head?: string): VibeStep[] => [{ id: 'invariants', status: 'current', facts: '', head, check }];
const validate = (label: string) => [...page.querySelectorAll<HTMLButtonElement>('.vc-step-head .vc-vmark button')].find((b) => b.textContent?.includes(label));

it('Valider les invariants : offert (now) envoie \'invariants\' ok ; sans now, ni validation : absent ; relecteur : absent', async () => {
  extra = { steps: step({ state: null, now: 'n' }) };
  await draw(split, 'create');
  await act(async () => validate('Valider les invariants')!.click());
  expect(marks).toEqual([['invariants', 'ok']]);
  extra = { steps: step({ state: null, now: null }) };   // un cas sans ✓ : le principal ne l'offre pas
  await draw(split, 'create');
  expect(validate('Valider les invariants')).toBeUndefined();
  extra = { steps: step({ state: null, now: 'n' }) };
  await draw(split, 'review');
  expect(page.querySelector('.vc-step-head .vc-vmark')).toBeNull();
});

it('Valider les invariants : validé, Annuler (même sans now) ; modifié ou en cascade, Revalider', async () => {
  extra = { steps: step({ state: 'ok', now: null }) };
  await draw(split, 'create');
  await act(async () => validate('Annuler')!.click());
  expect(marks).toEqual([['invariants', null]]);
  for (const state of ['changed', 'cascade'] as const) {
    extra = { steps: step({ state, now: 'n' }) };
    await draw(split, 'create');
    expect(validate('Revalider')).toBeDefined();
  }
});

const gt = (path: string, id = 't0') => test({ id, path, cases: ['a'], lines: [1] });
const three = [gt('tests/invariants/a.test.ts'), gt('tests/invariants/b.test.ts', 't1'), gt('tests/invariants/c.test.ts', 't2')];
const rows = () => [...page.querySelectorAll<HTMLElement>('.vc-tree-row[data-key$=".ts"]')].map((r) => r.dataset.key);

it('Depuis le dernier commit : l\'arborescence ne liste que les fichiers de view.diffs.head ; aucun : grisé, retour à la base', async () => {
  extra = { diffs: { head: [{ path: 'tests/invariants/b.test.ts' }], validated: {} } };
  await draw(three, 'create');
  expect(rows()).toEqual(['tests/invariants/a.test.ts', 'tests/invariants/b.test.ts', 'tests/invariants/c.test.ts']);   // la base d'abord
  await pick('head');
  expect(rows()).toEqual(['tests/invariants/b.test.ts']);
  expect(titles()).toEqual(['a']);
  extra = { diffs: { head: [], validated: {} } };
  await draw(three, 'create');
  expect(rows()).toEqual(['tests/invariants/a.test.ts', 'tests/invariants/b.test.ts', 'tests/invariants/c.test.ts']);
  expect(page.textContent).toContain('Depuis le dernier commit (rien de modifié)');
});

it('« modifiée depuis la validation » cliqué : Depuis la validation, l\'arborescence filtrée ; sans validation : pas de l\'option', async () => {
  extra = { steps: step({ state: 'changed', now: 'n' }, 'modifiée depuis la validation'), diffs: { head: [], validated: { invariants: [{ path: 'tests/invariants/c.test.ts' }] } } };
  await draw(three, 'create');
  await act(async () => page.querySelector<HTMLButtonElement>('.vc-since')!.click());
  expect((page.querySelector('select.vc-mod-shown') as HTMLSelectElement).value).toBe('validated');
  expect(rows()).toEqual(['tests/invariants/c.test.ts']);
  extra = { steps: step({ state: null, now: 'n' }) };
  await draw(three, 'create');
  expect([...(page.querySelector('select.vc-mod-shown') as HTMLSelectElement).options].map((o) => o.value)).not.toContain('validated');
});

it('Invariants seuls, coché par défaut : les seuls tests d\'invariants ; décoché : la Forme aussi, en retrait', async () => {
  extra = { modules: forme };
  await draw(two, 'create');
  expect(page.querySelector<HTMLInputElement>('.vc-only-inv input')!.checked).toBe(true);
  expect(rows()).toEqual(['tests/invariants/a.test.ts', 'tests/invariants/b.test.ts']);
  await showAll();
  expect(rows()).toEqual(['src/a.ts', 'src/b.ts', 'tests/invariants/a.test.ts', 'tests/invariants/b.test.ts']);
  expect(row('src/a.ts').dataset.dim).toBe('');
});

it('un fichier supprimé depuis la référence : listé, suivi par son id, son diff tout en retraits ; Voir le fichier : le diff depuis la validation', async () => {
  extra = { diffs: { head: [{ path: 'tests/invariants/old.test.ts', id: 'r0', deleted: true }], validated: {} } };
  pushed = { id: 'r0', text: null, time: 1, at: { base: 'old\n', head: 'old\n' } };
  await draw(three, 'create');
  await pick('head');
  expect(rows()).toEqual(['tests/invariants/old.test.ts']);
  expect(row('tests/invariants/old.test.ts').dataset.mark).toBe('deleted');
  await act(async () => row('tests/invariants/old.test.ts').click());
  expect(follows).toContainEqual(['r0']);
  expect(page.querySelector('.vc-ide-main .vc-ifile')).toBeNull();
  expect(page.querySelector('.vc-ide-main .vc-mdiff')).not.toBeNull();
});

// ---- 0.16.0 : les invariants validés par le système (docs/tickets/feat/0.16.0-controle-en-trois-points.md) ----
const withCases = (marks: VibeTestFile['marks'] = {}) => test({ cases: ['a', 'b'], lines: [1, 5], marks });

it('créateur, validés par le système : la validation dite avec son contrôle ; le ✓ de chaque cas et Lire en pseudo-code là ; aucun « cas à valider »', async () => {
  extra = { steps: step({ state: 'ok', now: null, by: 'system' }) };
  await draw(withCases(), 'create');
  expect(page.querySelector('.vc-step-head .vc-vstate')!.textContent).toBe('validée par le système');
  expect(page.querySelector('.vc-step-head .vc-vby')!.textContent).toBe('alignement avec la note');
  expect(page.querySelectorAll('.vc-case .vc-verdict button')).toHaveLength(4);   // Validé et À revoir, par cas
  expect([...page.querySelectorAll('button.vc-run')].some((b) => b.textContent?.includes('Lire en pseudo-code'))).toBe(true);
  expect(page.textContent).not.toMatch(/cas à valider|cases? to approve/);
  extra = { steps: step({ state: null, now: null }) };   // pas validés, aucun ✓ : rien n'attend non plus
  await draw(withCases(), 'create');
  expect(page.textContent).not.toMatch(/cas à valider/);
});

it('créateur, pas validés : Valider les invariants en discret (sans vert ni coche), jamais grisé, même si la Forme attend', async () => {
  extra = { steps: [{ id: 'forme', status: 'done', facts: '', check: { state: null, now: null } }, ...step({ state: null, now: 'n' })] };
  await draw(withCases(), 'create');
  const b = validate('Valider les invariants')!;
  expect([b.disabled, b.getAttribute('data-v'), b.querySelector('svg')]).toEqual([false, null, null]);
  expect(page.querySelector('.vc-vstate[data-state="waiting"]')).toBeNull();
});

it('relecteur : le verdict de chaque cas et « n cas à valider », comme avant ; aucune validation d\'étape', async () => {
  extra = { steps: step(undefined) };
  await draw(withCases({ a: 'ok' }), 'review');
  expect(page.textContent).toContain('1 cas à valider');
  expect(page.querySelectorAll('.vc-case .vc-verdict button')).toHaveLength(4);
  expect(page.querySelector('.vc-step-head .vc-vmark')).toBeNull();
});
