// @vitest-environment happy-dom
// InvariantsView (invariants-view.tsx) : l'en-tête de l'étape puis RulesView, pour les deux rôles, rien d'autre.
// note 0.16.0-ecran-essentiel : le créateur n'a que l'en-tête de l'étape et ses règles : ni cartes par cas, ni Tout valider,
// Lire en pseudo-code, Voir le fichier, Invariants seuls, Rien à écrire, ni éditeur.
// note 0.16.0-revue-essentielle : le relecteur a la même vue : les règles, ses tests en pseudo-code, Validé / À revoir ;
// ni cartes par cas, Tout valider, résumé, barre, arbre, Invariants seuls, Voir le fichier, menu de diff, ni bouton de lecture ;
// aucun fichier suivi.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
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
const two = [test({ id: 't0', path: 'tests/invariants/a.test.ts', cases: ['a1'], lines: [1] }),
  test({ id: 't1', path: 'tests/invariants/b.test.ts', cases: ['b1', 'b2'], lines: [1, 2], marks: { b1: 'ok' } })];
const mod = (path: string, more: Partial<VibeModule> = {}): VibeModule => ({ path, paths: [path], contract: `expose : ${path} · ne connaît pas : le disque`, file: null,
  touched: false, commits: [], ...more });
const touched = mod('src/a.ts', { touched: true, file: { id: 'm0', path: 'src/a.ts' }, files: [{ id: 'm0/0', path: 'src/a.ts' }] });
const forme = [touched, mod('src/b.ts')];
const mustNot = (...texts: string[]) => ({ text: '', mark: 'nothing', mustNot: texts.map((text) => ({ text, mark: 'invariant' })) }) as unknown as VibeView['note'];
const link = test({ cases: ['a', 'b', 'c'], lines: [1, 2, 3], reading: [
  { title: 'a', pseudo: '', edges: [], guarantees: 'Garantit « Ne jamais écrire » et « Ne jamais lire »', warning: null },
  { title: 'b', pseudo: '', edges: [], guarantees: 'Garantit I-12 et I-3', warning: null },
  { title: 'c', pseudo: '', edges: [], guarantees: 'Garantit autre chose', warning: null },
] });
const step = (check: VibeStep['check'], head?: string): VibeStep[] => [{ id: 'invariants', status: 'current', facts: '', head, check }];
const rulesNote = () => ({ note: mustNot('Ne jamais écrire → invariant', 'Ne jamais lire → invariant') });
const key = 'case:tests/invariants/a.test.ts:a';
const gone = ['Tout valider', 'Lire en pseudo-code', 'Relire', 'Tout relire', 'Voir le fichier', 'Invariants seuls', 'Rien à écrire', 'Écrire les invariants', 'Valider les invariants',
  'Depuis la base', 'non rattaché', 'cas à valider'];
const seen = () => [...page.querySelectorAll('button, summary, label, option, .vc-invite, p')].map((e) => e.textContent).join('|');

// ---- 0.16.0 : la revue essentielle (docs/tickets/feat/0.16.0-revue-essentielle.md) : le relecteur, les règles et rien d'autre ----
it('relecteur : l\'en-tête de l\'étape puis les règles, aucune carte par cas', async () => {
  extra = { ...rulesNote(), steps: step(undefined) };
  await draw(link, 'review', [], [{ id: 1, target: key, text: 'un' }]);
  expect(page.querySelector('.vc-step-head')).not.toBeNull();
  expect([...page.querySelectorAll('.vc-rule-line')].map((e) => e.textContent)).toEqual(['Ne jamais écrire → invariant', 'Ne jamais lire → invariant']);
  expect(page.querySelectorAll('.vc-rule-case')).toHaveLength(4);   // a sous chacune des deux lignes, puis b et c : autres tests
  for (const sel of ['.vc-case', '.vc-ifile']) expect(page.querySelector(sel), sel).toBeNull();
  expect([...page.querySelectorAll('.vc-rule-case:first-of-type .vc-verdict button')].map((b) => b.textContent)).toContain('Validé');   // la note de l\'utilisateur sur le test reste
  expect(page.querySelector('.vc-draft-list li')!.textContent).toBe('un');   // le brouillon, sous le test qu\'il vise
});

it('relecteur : ni Tout valider, ni résumé, ni barre, ni arbre, ni Invariants seuls, ni Voir le fichier, ni menu de diff', async () => {
  extra = { ...rulesNote(), modules: forme, outputs: { 'align.md': { text: '- [toi] un écart', time: 1 } } } as unknown as Partial<VibeView>;
  await draw(two, 'review');
  for (const g of gone) expect(seen(), g).not.toContain(g);
  for (const sel of ['.vc-isum', '.vc-ibar', '.vc-ihelp', '.vc-ialign', '.vc-ide', '.vc-tree-row', '[role="tree"]', '.vc-only-inv', 'select.vc-mod-shown', '.vc-seg', '.vc-ifile-src', '.vc-case-keeps']) {
    expect(page.querySelector(sel), sel).toBeNull();
  }
  expect(page.querySelector('.vc-rules')).not.toBeNull();
  extra = {};
  await draw([], 'review');   // sans test ni ligne : la phrase des règles, pas l\'invitation du relecteur
  expect(page.querySelector('.vc-invite')).toBeNull();
  expect(page.querySelector('.vc-rules-none')).not.toBeNull();
});

it('relecteur : aucun bouton de lecture, aucun fichier suivi, rien de lancé à l\'affichage', async () => {
  pushed = { id: 't0', text: 'const a = 2;\n', time: 1 };
  extra = { ...rulesNote(), modules: forme };
  await draw(link, 'review');   // lecture périmée comprise : rien ne la relance
  await draw(test({ cases: ['a'], lines: [1], reading: [link.reading![0]], stale: true, staleCases: ['a'] }), 'review');
  expect(page.querySelector('.vc-run')).toBeNull();
  expect([...page.querySelectorAll('button')].map((b) => b.textContent).filter((x) => /Lire|Relire|Enregistrer/.test(x ?? ''))).toEqual([]);
  expect(page.querySelector('.cm-editor')).toBeNull();
  expect(page.querySelector('details')).toBeNull();
  expect(runs).toEqual([]);
  expect(follows).toEqual([]);
  expect(saves).toEqual([]);
});

// ---- 0.16.0 : l'écran de l'essentiel (docs/tickets/feat/0.16.0-ecran-essentiel.md) : le créateur, les règles et rien d'autre ----

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
