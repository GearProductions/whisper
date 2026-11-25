// @vitest-environment happy-dom
// InvariantsView (invariants-view.tsx) : Voir le fichier d'un test : le diff entier en lecture seule depuis la
// référence du menu de la vue IDE (Relire : de f.base à f.source ; Créer : au texte de l'éditeur ; Fichier :
// l'éditeur) ; Lire en pseudo-code dans les outils de l'en-tête, même action ;
// 💬 et Ouvrir en IconButton (nommés, 💬 pressé pendant la saisie en Relire), l'état et Tout valider : une icône et leur texte ;
// vue IDE : les tests et les fichiers de la Forme à gauche (nom coloré d'après leur base), le premier choisi d'emblée, un clic montre ses cartes seules (en-tête et boutons
// intacts) et referme le fichier ouvert de l'autre ;
// un fichier de la Forme : son code en lecture seule (touché) ou son contrat ; sous Garantit, ce que garde le cas (lien vers la note) ;
// le verdict d'un cas : deux badges écrits dans son en-tête, celui donné pressé ; À revoir, selon le flux : cite le cas ou ouvre la zone de commentaire ;
// le menu de diff de la vue IDE (arborescence filtrée, un fichier supprimé en retraits, « modifiée depuis la validation »).
// note 0.16.0-ecran-essentiel : le créateur n'a que l'en-tête de l'étape et ses règles (RulesView) : ni cartes par cas, ni verdicts,
// ni Tout valider, Lire en pseudo-code, Voir le fichier, Invariants seuls, Rien à écrire, ni éditeur ; le relecteur : inchangé.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { beforeEach, expect, it } from 'vitest';
import { scoped, t } from 'core/vibecoder';
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

it('pas lu : Lire en pseudo-code dans les outils de l\'en-tête, plus sous les cartes ; même action', async () => {
  await draw(test(), 'review');
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

it('À revoir sur une carte (relecteur) : marque seulement, ne cite rien dans le champ (le bouton de remarque ouvre la zone)', async () => {
  const ko = () => page.querySelector<HTMLButtonElement>('.vc-case-head .vc-verdict button:last-child')!;
  await draw(test({ cases: ['a'], lines: [1] }), 'review');
  await act(async () => ko().click());
  expect(marks).toEqual([['case:tests/invariants/a.test.ts:a', 'ko']]);
  expect(prefills).toEqual([]);
  expect(page.querySelector('.vc-case textarea')).toBeNull();
});

const two = [test({ id: 't0', path: 'tests/invariants/a.test.ts', cases: ['a1'], lines: [1] }),
  test({ id: 't1', path: 'tests/invariants/b.test.ts', cases: ['b1', 'b2'], lines: [1, 2], marks: { b1: 'ok' } })];
const row = (key: string) => [...page.querySelectorAll<HTMLElement>('.vc-tree-row')].find((r) => r.dataset.key === key)!;
const titles = () => [...page.querySelectorAll('.vc-case-title')].map((e) => e.textContent);

it('vue IDE : les tests à gauche, sans numéro et colorés selon leur base ; le premier montre ses cartes seules', async () => {
  await draw([{ ...two[0], base: two[0].source }, { ...two[1], base: null }], 'review');   // a : la même qu'à la base ; b : absente de la base
  expect(row('tests/invariants/a.test.ts').getAttribute('aria-selected')).toBe('true');
  expect(row('tests/invariants/b.test.ts').dataset.mark).toBe('new');
  expect(row('tests/invariants/a.test.ts').dataset.mark).toBeUndefined();
  expect(row('tests/invariants/b.test.ts').querySelector('.vc-tree-rank')).toBeNull();
  expect(titles()).toEqual(['a1']);
  expect(page.querySelectorAll('.vc-ide-main .vc-ifile')).toHaveLength(1);
});

it('vue IDE : choisir un test montre ses cartes, avec Tout valider, Relire / Lire, Ouvrir, Voir le fichier, verdicts et 💬', async () => {
  await draw(two, 'review');
  await act(async () => row('tests/invariants/b.test.ts').click());
  expect(titles()).toEqual(['b1', 'b2']);
  const main = page.querySelector('.vc-ide-main')!;
  expect([...main.querySelectorAll('.vc-ifile-tools button')].map((b) => b.textContent!.slice(0, 19) || b.getAttribute('aria-label')))
    .toEqual(['Tout valider', 'Lire en pseudo-code', 'Ouvrir dans l\'éditeur']);
  expect(main.querySelector('details.vc-ifile-src > summary')!.textContent).toBe('Voir le fichier');
  expect(main.querySelectorAll('.vc-case-head .vc-verdict button')).toHaveLength(4);
  expect(main.querySelectorAll('.vc-case-head .vc-case-tools .vc-tool')).toHaveLength(6);   // 💬, Poser une question, Ouvrir, par cas
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

it('Poser une question sur un cas : son titre cité dans le champ, rien d\'envoyé ni ajouté', async () => {
  await draw(noted, 'review');
  await act(async () => ask()!.click());
  expect(prefills).toEqual([['comment', 'a']]);
  expect(drafts).toEqual([]);
  expect(runs).toEqual([]);
});

it('un cas À revoir : le bouton de remarque, qui ouvre la zone sans rien ajouter ; Validé : aucun', async () => {
  await draw(test({ cases: ['a', 'b', 'c'], lines: [1, 2, 3], marks: { a: 'ko', b: 'ok' } }), 'review');
  expect([0, 1, 2].map((i) => remarkBtn(i)?.textContent ?? null)).toEqual(['Ajouter une remarque au brouillon', null, null]);
  expect(page.querySelector('.vc-case textarea')).toBeNull();
  await act(async () => remarkBtn(0)!.click());
  expect(page.querySelector('.vc-case textarea')).not.toBeNull();
  expect(drafts).toEqual([]);
});

// ---- La Forme à côté des tests, ce que garde chaque cas ---------------------------------------------------------
const mod = (path: string, more: Partial<VibeModule> = {}): VibeModule => ({ path, paths: [path], contract: `expose : ${path} · ne connaît pas : le disque`, file: null,
  touched: false, commits: [], ...more });
const touched = mod('src/a.ts', { touched: true, file: { id: 'm0', path: 'src/a.ts' }, files: [{ id: 'm0/0', path: 'src/a.ts' }] });
const forme = [touched, mod('src/b.ts')];
const mustNot = (...texts: string[]) => ({ text: '', mark: 'nothing', mustNot: texts.map((text) => ({ text, mark: 'invariant' })) }) as unknown as VibeView['note'];

it('la Forme et les tests dans une arborescence : les fichiers de la Forme numérotés, en retrait ; sans Forme, les tests seuls', async () => {
  extra = { modules: forme };
  await draw(two, 'review');
  await showAll();
  expect([...page.querySelectorAll<HTMLElement>('.vc-tree-row[data-key$=".ts"]')].map((r) => r.dataset.key))
    .toEqual(['src/a.ts', 'src/b.ts', 'tests/invariants/a.test.ts', 'tests/invariants/b.test.ts']);
  expect(row('src/b.ts').querySelector('.vc-tree-rank')!.textContent).toBe('2');
  expect(row('tests/invariants/a.test.ts').querySelector('.vc-tree-rank')).toBeNull();
  extra = {};
  await draw(two, 'review');
  expect(page.querySelector('.vc-tree-row[data-key="src/a.ts"]')).toBeNull();
});

it('sans test : l\'invitation, pas d\'arborescence, même avec une Forme', async () => {
  extra = { modules: forme };
  await draw([], 'review');
  expect(page.querySelector('.vc-ide')).toBeNull();
  expect(page.querySelector('.vc-invite')).not.toBeNull();
});

it('un fichier de la Forme touché : suivi par son id, son code poussé, verrouillé, sans Enregistrer ni Abandonner ; quitté : plus suivi ; pas touché : son contrat', async () => {
  extra = { modules: forme };
  pushed = { id: 'm0/0', text: 'const forme = 1;\n', time: 0 };
  await draw(two, 'review');
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
  await draw(two, 'review');
  await showAll();
  await act(async () => row('src/b.ts').click());
  await act(async () => row('tests/invariants/b.test.ts').click());
  expect(titles()).toEqual(['b1', 'b2']);
});

const link = test({ cases: ['a', 'b', 'c'], lines: [1, 2, 3], reading: [
  { title: 'a', pseudo: '', edges: [], guarantees: 'Garantit « Ne jamais écrire » et « Ne jamais lire »', warning: null },
  { title: 'b', pseudo: '', edges: [], guarantees: 'Garantit I-12 et I-3', warning: null },
  { title: 'c', pseudo: '', edges: [], guarantees: 'Garantit autre chose', warning: null },
] });
const keeps = () => [...page.querySelectorAll('.vc-case')].map((c) => c.querySelector('.vc-case-keeps'));

it('un cas à la ligne citée : son lien appelle goToNote(texte) ; un I-12 : le numéro, pas de lien ; rien : non rattaché', async () => {
  extra = { note: mustNot('Ne jamais écrire → invariant', 'Ne jamais lire → invariant') };
  await draw(link, 'review');
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
  await draw(test({ cases: ['a'], lines: [1] }), 'review');
  expect(keeps()[0]!.textContent).toContain('non rattaché');
  extra = { note: mustNot('Ne jamais écrire → invariant') };
  await draw(test({ cases: ['a'], lines: [1], reading: [link.reading![0]], stale: true, staleCases: ['a'] }), 'review');
  expect(keeps()[0]!.getAttribute('data-stale')).toBe('true');
  await draw(test({ cases: ['a'], lines: [1], reading: [link.reading![0]] }), 'review');
  expect(keeps()[0]!.hasAttribute('data-stale')).toBe(false);
});

it('lecture périmée : Validé, À revoir et Tout valider grisés (relire d\'abord) ; à jour, ou sans lecture : actifs', async () => {
  const verdicts = () => [...page.querySelectorAll<HTMLButtonElement>('.vc-verdict button')];
  const all = () => [...page.querySelectorAll<HTMLButtonElement>('.vc-ifile-tools button')].find((b) => b.textContent === 'Tout valider');
  await draw(test({ cases: ['a'], lines: [1], reading: [link.reading![0]], stale: true, staleCases: ['a'] }), 'review');
  expect(verdicts().length).toBeGreaterThan(0);
  expect(verdicts().every((b) => b.disabled && b.title.includes('Lecture périmée'))).toBe(true);
  if (all()) expect(all()!.disabled).toBe(true);
  await draw(test({ cases: ['a'], lines: [1], reading: [link.reading![0]] }), 'review');
  expect(verdicts().some((b) => b.disabled)).toBe(false);
  await draw(test({ cases: ['a'], lines: [1] }), 'review');
  expect(verdicts().some((b) => b.disabled)).toBe(false);
});

// ---- Note 0.15.0-invariants-par-cas : les cas un par un --------------------------------------------------------------
const caseVerdicts = (i: number) => [...[...page.querySelectorAll('.vc-case')][i].querySelectorAll<HTMLButtonElement>('.vc-verdict button')];

it('un cas à la lecture périmée : ses boutons grisés, ceux de l\'autre non ; Tout valider grisé, Relire en accent', async () => {
  await draw(test({ cases: ['a', 'b'], lines: [1, 2], reading: [link.reading![0], { ...link.reading![0], title: 'b' }], stale: true, staleCases: ['a'] }), 'review');
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
  await draw(dup, 'review');
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

const stats = () => [...page.querySelectorAll('.vc-isum-stat')].map((e) => e.textContent);

it('le résumé : fichiers, cas, validés, à lire (l\'en-tête d\'étape ne les répète plus)', async () => {
  await draw(two, 'review');   // 2 fichiers, 3 cas, b1 validé, aucune lecture
  expect(stats()).toEqual(['2fichiers', '3cas', '1validé', '3à lire']);
});

it('le résumé : un seul fichier, au singulier ; en anglais', async () => {
  await draw(two[0], 'review');
  expect(stats()).toEqual(['1fichier', '1cas', '0validé', '1à lire']);
  extra = { lang: 'en' };
  await draw(two[0], 'review');
  expect(stats()).toEqual(['1file', '1case', '0approved', '1to read']);
  await draw(two, 'review');
  expect(stats()).toEqual(['2files', '3cases', '1approved', '3to read']);
});

it('le résumé : aucun fichier, pas de résumé', async () => {
  await draw([], 'review');
  expect(page.querySelector('.vc-isum')).toBeNull();
});

// ---- Le code d'un cas, en lecture seule (relecteur) -------------------------------------------------------------------
const DISK = ["it('a', () => {", '  expect(1).toBe(1);', '});', '', "it('b', () => {", '  expect(2).toBe(2);', '});', ''].join('\n');
const split = test({ cases: ['a', 'b'], lines: [1, 5], source: DISK });
const codeBtn = (i: number) => [...page.querySelectorAll('.vc-case')][i].querySelectorAll<HTMLButtonElement>('.vc-case-view button')[1];
const footBtn = (label: string) => [...page.querySelectorAll<HTMLButtonElement>('.vc-mod-code-foot button')].find((b) => b.textContent === label);

it('Relecteur : le code d\'un cas en lecture seule, sans éditeur ni pied', async () => {
  await draw(split, 'review');
  await act(async () => codeBtn(1).click());
  expect(footBtn('Enregistrer')).toBeUndefined();
  expect(EditorView.findFromDOM(page.querySelector('.vc-case .cm-editor') as HTMLElement)!.state.readOnly).toBe(true);
});

const gt = (path: string, id = 't0') => test({ id, path, cases: ['a'], lines: [1] });
const three = [gt('tests/invariants/a.test.ts'), gt('tests/invariants/b.test.ts', 't1'), gt('tests/invariants/c.test.ts', 't2')];
const rows = () => [...page.querySelectorAll<HTMLElement>('.vc-tree-row[data-key$=".ts"]')].map((r) => r.dataset.key);

it('Depuis le dernier commit : l\'arborescence ne liste que les fichiers de view.diffs.head ; aucun : grisé, retour à la base', async () => {
  extra = { diffs: { head: [{ path: 'tests/invariants/b.test.ts' }], validated: {} } };
  await draw(three, 'review');
  expect(rows()).toEqual(['tests/invariants/a.test.ts', 'tests/invariants/b.test.ts', 'tests/invariants/c.test.ts']);   // la base d'abord
  await pick('head');
  expect(rows()).toEqual(['tests/invariants/b.test.ts']);
  expect(titles()).toEqual(['a']);
  extra = { diffs: { head: [], validated: {} } };
  await draw(three, 'review');
  expect(rows()).toEqual(['tests/invariants/a.test.ts', 'tests/invariants/b.test.ts', 'tests/invariants/c.test.ts']);
  expect(page.textContent).toContain('Depuis le dernier commit (rien de modifié)');
});

it('« modifiée depuis la validation » cliqué : Depuis la validation, l\'arborescence filtrée ; sans validation : pas de l\'option', async () => {
  extra = { steps: step({ state: 'changed', now: 'n' }, 'modifiée depuis la validation'), diffs: { head: [], validated: { invariants: [{ path: 'tests/invariants/c.test.ts' }] } } };
  await draw(three, 'review');
  await act(async () => page.querySelector<HTMLButtonElement>('.vc-since')!.click());
  expect((page.querySelector('select.vc-mod-shown') as HTMLSelectElement).value).toBe('validated');
  expect(rows()).toEqual(['tests/invariants/c.test.ts']);
  extra = { steps: step({ state: null, now: 'n' }) };
  await draw(three, 'review');
  expect([...(page.querySelector('select.vc-mod-shown') as HTMLSelectElement).options].map((o) => o.value)).not.toContain('validated');
});

it('Invariants seuls, coché par défaut : les seuls tests d\'invariants ; décoché : la Forme aussi, en retrait', async () => {
  extra = { modules: forme };
  await draw(two, 'review');
  expect(page.querySelector<HTMLInputElement>('.vc-only-inv input')!.checked).toBe(true);
  expect(rows()).toEqual(['tests/invariants/a.test.ts', 'tests/invariants/b.test.ts']);
  await showAll();
  expect(rows()).toEqual(['src/a.ts', 'src/b.ts', 'tests/invariants/a.test.ts', 'tests/invariants/b.test.ts']);
  expect(row('src/a.ts').dataset.dim).toBe('');
});

it('un fichier supprimé depuis la référence : listé, suivi par son id, son diff tout en retraits ; Voir le fichier : le diff depuis la validation', async () => {
  extra = { diffs: { head: [{ path: 'tests/invariants/old.test.ts', id: 'r0', deleted: true }], validated: {} } };
  pushed = { id: 'r0', text: null, time: 1, at: { base: 'old\n', head: 'old\n' } };
  await draw(three, 'review');
  await pick('head');
  expect(rows()).toEqual(['tests/invariants/old.test.ts']);
  expect(row('tests/invariants/old.test.ts').dataset.mark).toBe('deleted');
  await act(async () => row('tests/invariants/old.test.ts').click());
  expect(follows).toContainEqual(['r0']);
  expect(page.querySelector('.vc-ide-main .vc-ifile')).toBeNull();
  expect(page.querySelector('.vc-ide-main .vc-mdiff')).not.toBeNull();
});

// ---- 0.16.0 : les invariants validés par le système (docs/tickets/feat/0.16.0-controle-en-trois-points.md) ----
const step = (check: VibeStep['check'], head?: string): VibeStep[] => [{ id: 'invariants', status: 'current', facts: '', head, check }];

const withCases = (marks: VibeTestFile['marks'] = {}) => test({ cases: ['a', 'b'], lines: [1, 5], marks });

it('relecteur : le verdict de chaque cas et « n cas à valider », comme avant ; aucune validation d\'étape', async () => {
  extra = { steps: step(undefined) };
  await draw(withCases({ a: 'ok' }), 'review');
  expect(page.textContent).toContain('1 cas à valider');
  expect(page.querySelectorAll('.vc-case .vc-verdict button')).toHaveLength(4);
  expect(page.querySelector('.vc-step-head .vc-vmark')).toBeNull();
});

// ---- 0.16.0 : l'écran de l'essentiel (docs/tickets/feat/0.16.0-ecran-essentiel.md) : le créateur, les règles et rien d'autre ----
const rulesNote = () => ({ note: mustNot('Ne jamais écrire → invariant', 'Ne jamais lire → invariant') });
const gone = ['Tout valider', 'Lire en pseudo-code', 'Voir le fichier', 'Invariants seuls', 'Rien à écrire', 'Écrire les invariants', 'Valider les invariants'];

it('créateur : les règles, aucune carte par cas ; le verdict de chaque test (Validé / À revoir), rien d\'autre de l\'ancien écran', async () => {
  extra = rulesNote();
  await draw(link, 'create');
  expect([...page.querySelectorAll('.vc-rule-line')].map((e) => e.textContent)).toEqual(['Ne jamais écrire → invariant', 'Ne jamais lire → invariant']);
  expect(page.querySelectorAll('.vc-rule-case')).toHaveLength(4);   // a sous chacune des deux lignes, puis b et c : autres tests
  for (const sel of ['.vc-case', '.vc-ifile', '.vc-ide', '.vc-isum', '.vc-ibar', '.vc-ihelp']) expect(page.querySelector(sel), sel).toBeNull();
  // un verdict par test affiché (après l'essai : les notes de l'utilisateur), sans le bouton de remarque du relecteur
  expect(page.querySelectorAll('.vc-rule-case .vc-verdict')).toHaveLength(4);
  expect([...page.querySelectorAll('.vc-verdict button')].map((b) => b.textContent)).toEqual(Array(4).fill(['Validé', 'À revoir']).flat());
});

it('créateur : ni Tout valider, ni Lire en pseudo-code, ni Voir le fichier, ni Invariants seuls, ni Rien à écrire', async () => {
  const seen = () => [...page.querySelectorAll('button, summary, label, .vc-invite')].map((e) => e.textContent).join('|');
  extra = rulesNote();
  await draw(link, 'create');
  for (const g of gone) expect(seen()).not.toContain(g);
  expect(page.querySelector('.vc-run')).toBeNull();
  expect(page.querySelector('.vc-step-head .vc-vmark')).toBeNull();
  extra = { ...rulesNote(), steps: step({ state: 'ok', now: 'n', by: 'system' }) };   // même validée, offerte : rien de plus
  await draw(link, 'create');
  expect(page.querySelector('.vc-vmark button')).toBeNull();
  extra = { lang: 'en' };   // sans test ni ligne : la phrase seule, dans les deux langues
  await draw([], 'create');
  expect(page.querySelector('.vc-rules-none')!.textContent).toBe('The note asks for no invariant.');
  expect(page.querySelector('.vc-invite')).toBeNull();
  extra = {};
  await draw([], 'create');
  expect(page.querySelector('.vc-rules-none')!.textContent).toBe('La note ne demande aucun invariant.');
  expect(page.querySelector('.vc-invite')).toBeNull();
  expect(page.textContent).not.toContain('Écrire les invariants');
});

it('créateur : aucun test ne s\'édite, aucun fichier n\'est suivi', async () => {
  pushed = { id: 't0', text: 'const a = 2;\n', time: 1 };
  extra = { ...rulesNote(), modules: forme };
  await draw(link, 'create');
  expect(page.querySelector('.cm-editor')).toBeNull();
  expect(page.querySelector('details')).toBeNull();
  expect(page.querySelector('textarea')).toBeNull();
  expect([...page.querySelectorAll('button')].map((b) => b.textContent)).not.toContain('Enregistrer');
  expect(follows).toEqual([]);
  expect(saves).toEqual([]);
  // un test sans lien avec la note, sans règle : rien non plus
  extra = {};
  await draw(two, 'create');
  expect(page.querySelector('.cm-editor')).toBeNull();
  expect(follows).toEqual([]);
  expect(saves).toEqual([]);
});

it('créateur : la ligne citée dans le champ (l\'action 💬 au relevé), Ouvrir à la ligne du cas ; rien d\'envoyé', async () => {
  extra = { ...rulesNote(), actions: [read, { id: 'comment' }] } as unknown as Partial<VibeView>;
  await draw(link, 'create');
  await act(async () => page.querySelector<HTMLButtonElement>('.vc-rule-head button[aria-label="Citer cette règle dans le champ"]')!.click());
  expect(prefills).toEqual([['comment', 'Ne jamais écrire → invariant']]);
  await act(async () => page.querySelector<HTMLButtonElement>('.vc-rule-case button[aria-label="Ouvrir dans l\'éditeur"]')!.click());
  expect(runs).toEqual([['open', 't0', 1]]);
  expect(marks).toEqual([]);
});

it('relecteur : ses cartes, Validé et À revoir, ses remarques, comme avant ; aucune règle', async () => {
  extra = { ...rulesNote(), steps: step(undefined) };
  await draw(withCases({ a: 'ok' }), 'review', [], [{ id: 1, target: key, text: 'un' }]);
  expect(page.querySelectorAll('.vc-case')).toHaveLength(2);
  expect([...page.querySelectorAll('.vc-case')].map((c) => c.querySelectorAll('.vc-verdict button[aria-pressed]').length)).toEqual([2, 2]);
  expect(page.querySelector('.vc-draft-list li')!.textContent).toBe('un');
  expect(page.querySelector('.vc-rules')).toBeNull();
  expect(page.querySelector('.vc-ifile-src > summary')!.textContent).toBe('Voir le fichier');
  expect(page.querySelector('.vc-only-inv')).not.toBeNull();
  expect(page.querySelector('.vc-ifile .vc-run')).not.toBeNull();
});

it('relecteur sans test : l\'invitation du relecteur, sans bouton d\'écriture', async () => {
  await draw([], 'review');
  expect(page.querySelector('.vc-invite')!.textContent).toContain('Aucun test d\'invariant dans cette PR');
  expect(page.querySelector('.vc-invite button')).toBeNull();
  expect(page.querySelector('.vc-rules')).toBeNull();
});
