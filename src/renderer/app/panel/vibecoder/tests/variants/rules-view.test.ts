// @vitest-environment happy-dom
// RulesView (rules-view.tsx) : l'étape Invariants du créateur rangée par ligne « → invariant » de la note (note
// 0.16.0-ecran-essentiel) : le texte de la ligne et son état, ce que la preuve en dit (le mutant ; la raison d'une ligne
// non prouvée, toujours visible), les tests qui la gardent en pseudo-code, « aucun test », « Autres tests », la lecture en
// cours, le point d'attention, l'alignement en tête (par FeedbackView), 💬 sur une règle, Ouvrir en icône ; aucun bouton
// d'action, aucune validation, aucun chiffre, aucun éditeur. Puis, en relecteur, la même vue sans preuve, avec le brouillon de revue.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { ReadingCase, VibeProof, VibeTestFile, VibeView } from 'technicals/bridge';
import { RulesView } from '../../rules-view';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);

const A = 'ne jamais effacer le disque', B = 'ne rien envoyer à la page';
const lineA = `${A} → invariant`, lineB = `${B} → invariant`;
const inv = (text: string) => ({ text: `${text} → invariant`, mark: 'invariant' as const });
const reading = (title: string, guarantees: string, over: Partial<ReadingCase> = {}): ReadingCase =>
  ({ title, pseudo: `test "${title}":\n  expect(x).toBe(1)`, edges: [], guarantees, warning: null, ...over });
const file = (id: string, cases: string[], r: ReadingCase[] | null, over: Partial<VibeTestFile> = {}): VibeTestFile =>
  ({ id, path: `tests/invariants/${id}.test.ts`, blob: 'b', cases, lines: cases.map((_, i) => 10 + i), source: '', reading: r, marks: {}, ...over });

let prefills: unknown[][] = [];
let opens: unknown[][] = [];
let links: string[] = [];
let marks: unknown[][] = [];
beforeEach(() => { prefills = []; opens = []; links = []; marks = []; act(() => root.render(null)); });
type Setup = { mustNot?: { text: string; mark: 'invariant' | 'variant' | null }[] | null; invariants?: VibeTestFile[]; proof?: VibeProof; align?: string; liens?: string; lang?: 'fr' | 'en'; comment?: boolean };
const draw = (o: Setup = {}) => act(() => {
  const lang = o.lang ?? 'fr';
  const view = { lang, flow: 'create', actions: o.comment === false ? [] : [{ id: 'comment' }], invariants: o.invariants ?? [], proof: o.proof,
    outputs: { ...(o.align === undefined ? {} : { 'align.md': { text: o.align, time: 1 } }), ...(o.liens === undefined ? {} : { 'liens.md': { text: o.liens, time: 1 } }) },
    note: o.mustNot === null ? null : { mustNot: o.mustNot ?? [] }, steps: [], modules: [], files: [] } as unknown as VibeView;
  const props = { view, step: { id: 'invariants', status: 'current', facts: '', open: true }, t: t(lang), busy: false,
    act: { prefill: (...a: unknown[]) => prefills.push(a), open: (...a: unknown[]) => opens.push(a), openLink: (u: string) => links.push(u), mark: (...a: unknown[]) => marks.push(a) } } as unknown as StepProps;
  root.render(createElement(RulesView, props));
});
const rules = () => [...page.querySelectorAll<HTMLElement>('.vc-rule')];
const ruleText = (i: number) => rules()[i].textContent ?? '';
const named = (label: string, within: ParentNode = page) => [...within.querySelectorAll<HTMLButtonElement>('button.vc-tool')].filter((b) => b.getAttribute('aria-label') === label);

it('deux lignes « → invariant » : deux règles, leur texte tel qu\'écrit, dans l\'ordre de la note', async () => {
  await draw({ mustNot: [inv(B), { text: 'autre → variant suffit', mark: 'variant' }, inv(A)] });
  expect(rules().map((r) => r.querySelector('.vc-rule-line')?.textContent)).toEqual([lineB, lineA]);
});

it('une ligne prouvée : « prouvée », un bouton ; le détail de la preuve replié, un clic l\'ouvre mis en forme (Markdown), un second le replie', async () => {
  await draw({ mustNot: [inv(A)], proof: { state: 'ok', lines: [{ line: lineA, proved: true, detail: '- **Mutant** : effacer sans vérifier\n- **Test** : le cas passe au rouge' }] } });
  expect(rules()[0].dataset.state).toBe('proved');
  const badge = rules()[0].querySelector<HTMLButtonElement>('button.vc-rule-state')!;
  expect([badge.textContent, badge.getAttribute('aria-expanded')]).toEqual(['prouvée', 'false']);
  expect(rules()[0].querySelector('.vc-rule-proof')).toBeNull();
  await act(() => badge.click());
  const proof = rules()[0].querySelector('.vc-rule-proof')!;
  expect(badge.getAttribute('aria-expanded')).toBe('true');
  expect(proof.querySelectorAll('li')).toHaveLength(2);
  expect(proof.textContent).toContain('Mutant : effacer sans vérifier');
  expect(proof.textContent).not.toContain('**');
  await act(() => badge.click());
  expect(rules()[0].querySelector('.vc-rule-proof')).toBeNull();
});

it('une ligne prouvée sans détail : « prouvée », pas un bouton', async () => {
  await draw({ mustNot: [inv(A)], proof: { state: 'ok', lines: [{ line: lineA, proved: true, detail: '' }] } });
  expect(rules()[0].querySelector('button.vc-rule-state')).toBeNull();
  expect(rules()[0].querySelector('.vc-rule-state')?.textContent).toBe('prouvée');
});

it('une ligne non prouvée : « non prouvée », sa raison, toujours visible (hors de tout repli)', async () => {
  await draw({ mustNot: [inv(A)], proof: { state: 'blocked', lines: [{ line: lineA, proved: false, detail: 'aucun mutant ne tient' }] } });
  expect(rules()[0].dataset.state).toBe('unproved');
  expect(rules()[0].querySelector('.vc-rule-state')?.textContent).toBe('non prouvée');
  expect(rules()[0].querySelector('.vc-rule-proof')?.textContent).toBe('aucun mutant ne tient');
  expect(rules()[0].querySelector('details')).toBeNull();
  expect(rules()[0].querySelector('button.vc-rule-state')).toBeNull();   // rien à déplier : ce qui attend l'utilisateur ne se replie pas
});

it('une ligne sans preuve : « écrite », rien dessous', async () => {
  await draw({ mustNot: [inv(A)] });
  expect(rules()[0].dataset.state).toBe('written');
  expect(rules()[0].querySelector('.vc-rule-state')?.textContent).toBe('écrite');
  expect(rules()[0].querySelector('.vc-rule-proof')).toBeNull();
});

it('une ligne sans test : affichée, « aucun test »', async () => {
  await draw({ mustNot: [inv(A), inv(B)], invariants: [file('a', ['x'], [reading('x', A)])] });
  expect(rules()).toHaveLength(2);
  expect(ruleText(0)).not.toContain('aucun test');
  expect(ruleText(1)).toContain(lineB);
  expect(ruleText(1)).toContain('aucun test');
});

it('un test qui ne garde aucune ligne : dans « Autres tests », pas sous une règle', async () => {
  await draw({ mustNot: [inv(A)], invariants: [file('a', ['gardé', 'orphelin'], [reading('gardé', A), reading('orphelin', 'rien')])] });
  expect(ruleText(0)).toContain('gardé');
  expect(ruleText(0)).not.toContain('orphelin');
  const others = page.querySelector('.vc-rules-others')!;
  expect(others.querySelector('h3')?.textContent).toBe('Autres tests');
  expect(others.textContent).toContain('orphelin');
  expect(others.textContent).not.toContain('gardé');
});

it('pas d\'« Autres tests » quand chaque test garde une ligne', async () => {
  await draw({ mustNot: [inv(A)], invariants: [file('a', ['x'], [reading('x', A)])] });
  expect(page.querySelector('.vc-rules-others')).toBeNull();
});

it('un test lu : son pseudo-code coloré ; pas lu : son titre et « lecture en cours »', async () => {
  await draw({ mustNot: [inv(A)], invariants: [file('a', ['lu', 'pas lu'], [reading('lu', A, { pseudo: 'test "lu":\n  expect(a).toBe(2)' })])] });
  const lu = rules()[0].querySelector('.vc-rule-case')!;
  expect(lu.querySelector('.vc-pseudo')?.textContent).toContain('expect(a).toBe(2)');
  expect(lu.querySelector('.vc-tk-keyword, .vc-tk-string')).not.toBeNull();
  expect(lu.textContent).not.toContain('lecture en cours');
  // pas lu : aucune phrase Garantit, donc dans « Autres tests »
  const other = page.querySelector('.vc-rules-others .vc-rule-case')!;
  expect(other.textContent).toContain('pas lu');
  expect(other.textContent).toContain('lecture en cours');
  expect(other.querySelector('.vc-pseudo')).toBeNull();
});

it('un point d\'attention d\'une lecture : visible', async () => {
  await draw({ mustNot: [inv(A)], invariants: [file('a', ['x'], [reading('x', A, { warning: 'un mock remplace le disque' })])] });
  expect(rules()[0].querySelector('.vc-attention')?.textContent).toContain('un mock remplace le disque');
  expect(rules()[0].querySelector('details')).toBeNull();
});

it('un écart [toi] de l\'alignement : en avant ; tout aligné : rien', async () => {
  await draw({ align: '- [toi] La ligne B n\'a aucun test ?\n- [agent] a1', mustNot: [inv(A)] });
  expect(page.querySelector('.vc-feedback')?.textContent).toContain('La ligne B n\'a aucun test ?');
  expect(page.querySelector('.vc-feedback details')?.textContent).toContain('a1');
  await draw({ align: 'Aligné.', mustNot: [inv(A)] });
  expect(page.querySelector('.vc-feedback')).toBeNull();
  await draw({ mustNot: [inv(A)] });
  expect(page.querySelector('.vc-feedback')).toBeNull();
});

it('l\'alignement vient en tête, avant les règles', async () => {
  await draw({ align: '- [toi] q', mustNot: [inv(A)] });
  const all = [...page.querySelectorAll('.vc-feedback, .vc-rule')];
  expect(all[0].className).toBe('vc-feedback');
});

it('la bulle sur une règle : elle cite la ligne dans le champ', async () => {
  await draw({ mustNot: [inv(A), inv(B)] });
  named('Citer cette règle dans le champ', rules()[1])[0].click();
  expect(prefills).toEqual([['comment', lineB]]);
});

it('Ouvrir dans l\'éditeur : une icône par test, à la ligne du cas', async () => {
  await draw({ mustNot: [inv(A)], invariants: [file('a', ['x', 'y'], [reading('x', 'rien'), reading('y', A)])] });
  const open = named('Ouvrir dans l\'éditeur');
  expect(open).toHaveLength(2);   // « y » sous la règle, « x » dans les autres
  expect(open.every((b) => b.querySelector('svg'))).toBe(true);
  named('Ouvrir dans l\'éditeur', rules()[0])[0].click();
  expect(opens).toEqual([['a', 11]]);
});

it('un test qui garde deux lignes : sous chacune', async () => {
  await draw({ mustNot: [inv(A), inv(B)], invariants: [file('a', ['x'], [reading('x', `${A} et ${B}`)])] });
  expect(ruleText(0)).toContain('x');
  expect(ruleText(1)).toContain('x');
});

it('aucun bouton d\'action, aucune validation, aucun chiffre en tête, ni « non rattaché », ni « Pas de lecture »', async () => {
  await draw({ mustNot: [inv(A), inv(B)], proof: { state: 'blocked', lines: [{ line: lineA, proved: true, detail: 'm' }, { line: lineB, proved: false, detail: 'r' }] },
    invariants: [file('a', ['lu', 'pas lu', 'autre'], [reading('lu', A), reading('autre', 'rien')])], align: '- [toi] q' });
  expect(page.querySelector('button.vc-run, .vc-vbtn, .vc-mark, .vc-seg, .vc-isum, .vc-ibar, input, textarea, select')).toBeNull();
  // des boutons-icônes (💬, Ouvrir, le 💬 d'un bloc de l'alignement), le verdict d'un test (Validé / À revoir) et le badge
  // « prouvée » qui déplie sa preuve, rien d'autre
  expect([...page.querySelectorAll('button')].every((b) => b.classList.contains('vc-tool') || b.classList.contains('vc-quote') || b.classList.contains('vc-rule-state') || !!b.closest('.vc-verdict'))).toBe(true);
  const text = page.textContent ?? '';
  for (const bad of ['non rattaché', 'Pas de lecture pour ce cas', 'Valider', 'Relire', 'Enregistrer', 'Lire en pseudo-code', 'Voir le fichier']) expect(text).not.toContain(bad);
  expect(page.firstElementChild?.textContent).not.toMatch(/^\d/);
});

it('aucun éditeur, aucun Enregistrer', async () => {
  await draw({ mustNot: [inv(A)], invariants: [file('a', ['x'], [reading('x', A)], { source: 'const a = 1;\n' })] });
  expect(page.querySelector('.cm-editor, .cm-content, textarea')).toBeNull();
  expect(page.textContent).not.toContain('Enregistrer');
  expect(page.textContent).not.toContain('const a = 1');
});

it('la note sans ligne « → invariant » : une phrase', async () => {
  await draw({ mustNot: [{ text: 'autre → variant suffit', mark: 'variant' }] });
  expect(rules()).toHaveLength(0);
  expect(page.textContent).toBe('La note ne demande aucun invariant.');
  await draw({ mustNot: null });
  expect(page.textContent).toBe('La note ne demande aucun invariant.');
});

it('sans ligne « → invariant » mais des tests : la phrase, et leurs tests dans « Autres tests »', async () => {
  await draw({ mustNot: [], invariants: [file('a', ['x'], [reading('x', A)])] });
  expect(page.textContent).toContain('La note ne demande aucun invariant.');
  expect(page.querySelector('.vc-rules-others')?.textContent).toContain('x');
});

it('le texte d\'une ligne n\'est jamais du HTML', async () => {
  await draw({ mustNot: [{ text: '<img src=x onerror=alert(1)> → invariant', mark: 'invariant' }] });
  expect(page.querySelector('img')).toBeNull();
  expect(rules()[0].querySelector('.vc-rule-line')?.textContent).toBe('<img src=x onerror=alert(1)> → invariant');
});

it('un lien d\'un point d\'attention passe par openLink', async () => {
  await draw({ mustNot: [inv(A)], invariants: [file('a', ['x'], [reading('x', A, { warning: 'voir [la doc](https://x.test/a)' })])] });
  page.querySelector<HTMLAnchorElement>('.vc-attention a')!.click();
  expect(links).toEqual(['https://x.test/a']);
});

it('en anglais : états et libellés traduits', async () => {
  await draw({ lang: 'en', mustNot: [inv(A), inv(B)], proof: { state: 'blocked', lines: [{ line: lineA, proved: true, detail: 'm' }, { line: lineB, proved: false, detail: 'r' }] },
    invariants: [file('a', ['x', 'y'], [reading('x', A), reading('y', 'rien')])] });
  expect(rules().map((r) => r.querySelector('.vc-rule-state')?.textContent)).toEqual(['proved', 'unproved']);
  expect(page.querySelector('.vc-rules-others h3')?.textContent).toBe('Other tests');
  expect(page.textContent).toContain('no test');
  await draw({ lang: 'en', mustNot: [] });
  expect(page.textContent).toBe('The note asks for no invariant.');
});

// Après l'essai : le rattachement vient de l'alignement (liens.md), et chaque test a sa bulle.
it('un test que l\'alignement range sous une ligne (liens.md), pas encore lu : sous sa règle, plus « aucun test »', async () => {
  const liens = `## ${A}\n- tests/invariants/a.test.ts :: x\n`;
  await draw({ mustNot: [inv(A)], invariants: [file('a', ['x', 'y'], null)], liens });
  expect(rules()[0].querySelector('.vc-rule-notest')).toBeNull();
  expect([...rules()[0].querySelectorAll('.vc-rule-case h4')].map((h) => h.textContent)).toEqual(['x']);
  expect(page.querySelector('.vc-rules-others')?.textContent).toContain('y');
  // témoin : sans liens.md, les deux tests sont dans les autres et la règle dit « aucun test »
  await draw({ mustNot: [inv(A)], invariants: [file('a', ['x', 'y'], null)] });
  expect(rules()[0].querySelector('.vc-rule-notest')?.textContent).toBe('aucun test');
});

it('💬 sur un test, sous une règle comme dans les autres tests : son titre cité dans le champ', async () => {
  await draw({ mustNot: [inv(A)], invariants: [file('a', ['x', 'y'], [reading('x', A), reading('y', 'rien')])] });
  named('Citer ce test dans le champ', rules()[0])[0].click();
  named('Citer ce test dans le champ', page.querySelector('.vc-rules-others')!)[0].click();
  expect(prefills).toEqual([['comment', 'x'], ['comment', 'y']]);
});

it('sans l\'action 💬 au relevé : aucune bulle sur une règle non plus', async () => {
  await draw({ mustNot: [inv(A)], comment: false });
  expect(named('Citer cette règle dans le champ')).toEqual([]);
});

it('une lecture périmée (stale) : ni l\'ancien pseudo-code ni l\'ancien point d\'attention, « lecture périmée », Validé et À revoir grisés', async () => {
  const f = file('a', ['x'], [reading('x', A, { pseudo: 'test "x":\n  expect(vieux).toBe(1)', warning: 'ancien mock' })], { staleCases: ['x'] });
  await draw({ mustNot: [inv(A)], invariants: [f] });
  const c = rules()[0].querySelector('.vc-rule-case')!;
  expect(c.querySelector('.vc-pseudo')).toBeNull();
  expect(c.querySelector('.vc-attention')).toBeNull();
  expect(c.textContent).toContain('lecture périmée');
  expect(verdicts(c).every((b) => b.disabled)).toBe(true);
  // témoin : sans staleCases, la même lecture s'affiche, les verdicts sont actifs
  await draw({ mustNot: [inv(A)], invariants: [file('a', ['x'], f.reading)] });
  expect(rules()[0].querySelector('.vc-pseudo')).not.toBeNull();
  expect(verdicts(rules()[0]).some((b) => b.disabled)).toBe(false);
  await draw({ lang: 'en', mustNot: [inv(A)], invariants: [f] });
  expect(rules()[0].textContent).toContain('outdated reading');
});

it('sans l\'action 💬 au relevé : aucune bulle sur un test', async () => {
  await draw({ mustNot: [inv(A)], invariants: [file('a', ['x'], [reading('x', A)])], comment: false });
  expect(named('Citer ce test dans le champ')).toEqual([]);
});

it('une ligne que garde un test d\'avant la branche (liens.md le nomme, il n\'est pas au relevé) : nommé sous elle, pas « aucun test »', async () => {
  const liens = `## ${A}\n- tests/invariants/ancien.test.ts :: déjà là\n`;
  await draw({ mustNot: [inv(A)], invariants: [], liens });
  expect(rules()[0].querySelector('.vc-rule-notest')).toBeNull();
  expect(rules()[0].querySelector('.vc-rule-elsewhere')?.textContent).toBe('tests/invariants/ancien.test.ts · déjà là');
});

// Après l'essai : Validé / À revoir sur chaque test, les notes de l'utilisateur (ce qu'il a lu, ce qu'il conteste).
const verdicts = (within: ParentNode) => [...within.querySelectorAll<HTMLButtonElement>('.vc-verdict button')];

it('chaque test a Validé et À revoir : un clic pose le verdict du cas (sa cible), un second l\'annule', async () => {
  await draw({ mustNot: [inv(A)], invariants: [file('a', ['x', 'y'], [reading('x', A), reading('y', 'rien')], { marks: { y: 'ko' } })] });
  const [okX, koX] = verdicts(rules()[0]);
  expect([okX.textContent, koX.textContent, okX.getAttribute('aria-pressed'), koX.getAttribute('aria-pressed')]).toEqual(['Validé', 'À revoir', 'false', 'false']);
  okX.click();
  koX.click();
  // y, dans les autres tests, déjà « À revoir » : pressé, un clic l'annule
  const [, koY] = verdicts(page.querySelector('.vc-rules-others')!);
  expect(koY.getAttribute('aria-pressed')).toBe('true');
  koY.click();
  expect(marks).toEqual([
    ['case:tests/invariants/a.test.ts:x', 'ok'], ['case:tests/invariants/a.test.ts:x', 'ko'], ['case:tests/invariants/a.test.ts:y', null],
  ]);
});

it('en tête, où l\'on en est de sa lecture : tests, validés, à revoir, à lire ; sans test : rien', async () => {
  const marked = { marks: { x: 'ok', y: 'ko' } } as Partial<VibeTestFile>;
  await draw({ mustNot: [inv(A)], invariants: [file('a', ['x', 'y', 'z'], [reading('x', A), reading('y', A), reading('z', A)], marked)] });
  expect(page.querySelector('.vc-rules-count')?.textContent).toBe('3 tests · 1 validé · 1 à revoir · 1 à lire');
  await draw({ mustNot: [inv(A)], invariants: [file('a', ['x'], [reading('x', A)])] });
  expect(page.querySelector('.vc-rules-count')?.textContent).toBe('1 test · 0 validé · 0 à revoir · 1 à lire');
  await draw({ mustNot: [inv(A)] });
  expect(page.querySelector('.vc-rules-count')).toBeNull();
  await draw({ lang: 'en', mustNot: [inv(A)], invariants: [file('a', ['x', 'y'], [reading('x', A), reading('y', A)], { marks: { x: 'ok' } })] });
  expect(page.querySelector('.vc-rules-count')?.textContent).toBe('2 tests · 1 approved · 0 to review · 1 to read');
});

// La revue essentielle (note 0.16.0-revue-essentielle) : le relecteur a la même vue, sans preuve, avec le brouillon de revue.
type Review = Setup & { draft?: { id: number; text: string; target: string }[]; proof?: VibeProof };
let drafts: unknown[][] = [];
const drawR = (o: Review = {}) => act(() => {
  const lang = o.lang ?? 'fr';
  const view = { lang, flow: 'review', actions: [{ id: 'comment' }], invariants: o.invariants ?? [], proof: o.proof, draft: o.draft ?? [],
    outputs: { ...(o.align === undefined ? {} : { 'align.md': { text: o.align, time: 1 } }), ...(o.liens === undefined ? {} : { 'liens.md': { text: o.liens, time: 1 } }) },
    note: o.mustNot === null ? null : { mustNot: o.mustNot ?? [] }, steps: [], modules: [], files: [] } as unknown as VibeView;
  const props = { view, step: { id: 'invariants', status: 'current', facts: '', open: true }, t: t(lang), busy: false,
    act: { prefill: (...a: unknown[]) => prefills.push(a), open: (...a: unknown[]) => opens.push(a), openLink: (u: string) => links.push(u),
      mark: (...a: unknown[]) => marks.push(a), draft: (...a: unknown[]) => drafts.push(a) } } as unknown as StepProps;
  root.render(createElement(RulesView, props));
});
beforeEach(() => { drafts = []; });
const bubble = (label: string, within: ParentNode = page) => named(label, within)[0];
const boxes = () => [...page.querySelectorAll<HTMLTextAreaElement>('.vc-cbox textarea')];
const typeIn = async (value: string) => {
  const ta = boxes()[0];
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(ta, value);
  await act(async () => { ta.dispatchEvent(new Event('input', { bubbles: true })); });
};
const footBtn = (tone: 'accent' | 'ghost') => page.querySelector<HTMLButtonElement>(`.vc-cbox .vc-run[data-tone="${tone}"]`)!;
const REMARK_RULE = 'Une remarque sur cette règle, au brouillon de revue', REMARK_TEST = 'Une remarque sur ce test, au brouillon de revue';
const PATH = 'tests/invariants/a.test.ts';

it('relecteur, deux lignes « → invariant » : deux règles, leurs tests en pseudo-code', async () => {
  await drawR({ mustNot: [inv(B), inv(A)], invariants: [file('a', ['x', 'y'], [reading('x', A), reading('y', B, { pseudo: 'test "y":\n  expect(b).toBe(2)' })])] });
  expect(rules().map((r) => r.querySelector('.vc-rule-line')?.textContent)).toEqual([lineB, lineA]);
  expect(rules()[0].querySelector('.vc-pseudo')?.textContent).toContain('expect(b).toBe(2)');
  expect(rules()[1].querySelector('.vc-pseudo')?.textContent).toContain('expect(x).toBe(1)');
});

it('relecteur : ni « écrite », ni « prouvée », ni « non prouvée », aucun détail de preuve', async () => {
  const proof: VibeProof = { state: 'blocked', lines: [{ line: lineA, proved: true, detail: 'le mutant' }, { line: lineB, proved: false, detail: 'la raison' }] };
  await drawR({ mustNot: [inv(A), inv(B)], proof });
  for (const bad of ['écrite', 'prouvée', 'le mutant', 'la raison']) expect(page.textContent).not.toContain(bad);
  expect(page.querySelector('.vc-rule-state, .vc-rule-proof, [data-state]')).toBeNull();
  await drawR({ lang: 'en', mustNot: [inv(A)], proof });
  for (const bad of ['written', 'proved', 'unproved']) expect(page.textContent).not.toContain(bad);
});

it('relecteur : une ligne sans test : « aucun test » ; un test sans ligne : « Autres tests »', async () => {
  await drawR({ mustNot: [inv(A), inv(B)], invariants: [file('a', ['x', 'orphelin'], [reading('x', A), reading('orphelin', 'rien')])] });
  expect(ruleText(1)).toContain('aucun test');
  expect(page.querySelector('.vc-rules-others h3')?.textContent).toBe('Autres tests');
  expect(page.querySelector('.vc-rules-others')?.textContent).toContain('orphelin');
});

it('relecteur : un écart de l\'alignement (sans étiquette) : en tête, tel quel, rien de replié', async () => {
  await drawR({ align: '- La ligne B n\'a aucun test\n- autre écart', mustNot: [inv(A)] });
  expect(page.querySelector('.vc-rules')?.firstElementChild?.className).toBe('vc-feedback');
  expect(page.querySelector('.vc-feedback')?.textContent).toContain('La ligne B n\'a aucun test');
  expect(page.querySelector('.vc-feedback')?.textContent).toContain('autre écart');
  expect(page.querySelector('.vc-feedback details')).toBeNull();
  await drawR({ align: 'Aligné.', mustNot: [inv(A)] });
  expect(page.querySelector('.vc-feedback')).toBeNull();
});

it('relecteur : le point d\'attention d\'un test : visible', async () => {
  await drawR({ mustNot: [inv(A)], invariants: [file('a', ['x'], [reading('x', A, { warning: 'un mock remplace le disque' })])] });
  expect(rules()[0].querySelector('.vc-attention')?.textContent).toContain('un mock remplace le disque');
});

it('relecteur : un test protégé que la PR modifie : « modifié par la PR », sur ce test seulement', async () => {
  const f = file('a', ['x', 'y'], [reading('x', A), reading('y', A)], { changedFromBase: ['y'] });
  await drawR({ mustNot: [inv(A)], invariants: [f] });
  const [x, y] = [...rules()[0].querySelectorAll('.vc-rule-case')];
  expect(x.textContent).not.toContain('modifié par la PR');
  expect(y.textContent).toContain('modifié par la PR');
  await drawR({ lang: 'en', mustNot: [inv(A)], invariants: [f] });
  expect(page.textContent).toContain('changed by the PR');
  // le créateur ne le voit jamais, même avec la clé
  await draw({ mustNot: [inv(A)], invariants: [f] });
  expect(page.textContent).not.toContain('modifié par la PR');
});

it('relecteur : Validé, À revoir sur un test : sa marque, un second clic l\'annule', async () => {
  await drawR({ mustNot: [inv(A)], invariants: [file('a', ['x', 'y'], [reading('x', A), reading('y', A)], { marks: { y: 'ko' } })] });
  const [x, y] = [...rules()[0].querySelectorAll('.vc-rule-case')];
  const [okX, koX] = verdicts(x), [, koY] = verdicts(y);
  expect(koY.getAttribute('aria-pressed')).toBe('true');
  okX.click(); koX.click(); koY.click();
  expect(marks).toEqual([[`case:${PATH}:x`, 'ok'], [`case:${PATH}:x`, 'ko'], [`case:${PATH}:y`, null]]);
});

it('relecteur : À revoir propose d\'ajouter une remarque ; rien n\'est ajouté sans le clic', async () => {
  await drawR({ mustNot: [inv(A)], invariants: [file('a', ['x', 'y'], [reading('x', A), reading('y', A)], { marks: { x: 'ko' } })] });
  const [x, y] = [...rules()[0].querySelectorAll('.vc-rule-case')];
  expect(x.textContent).toContain('Ajouter une remarque au brouillon');
  expect(y.textContent).not.toContain('Ajouter une remarque au brouillon');
  expect(boxes()).toHaveLength(0);
  const add = [...x.querySelectorAll('button')].find((b) => b.textContent === 'Ajouter une remarque au brouillon')!;
  await act(() => add.click());
  expect(boxes()).toHaveLength(1);
  expect(x.querySelector('.vc-cbox')).not.toBeNull();
  expect(drafts).toEqual([]);
  expect(marks).toEqual([]);
});

it('relecteur : la bulle d\'une règle, d\'un test : une zone de remarque ; Ajouter : au brouillon, sur sa cible ; Annuler : rien', async () => {
  await drawR({ mustNot: [inv(A)], invariants: [file('a', ['x', 'y'], [reading('x', A), reading('y', 'rien')])] });
  await act(() => bubble(REMARK_RULE, rules()[0]).click());
  expect(rules()[0].querySelector('.vc-rule-head + .vc-cbox, .vc-rule > .vc-cbox')).not.toBeNull();
  await typeIn('une règle trop large');
  await act(() => footBtn('accent').click());
  expect(drafts).toEqual([[{ add: { target: `rule: ${lineA}`, text: 'une règle trop large' } }]]);
  expect(boxes()).toHaveLength(0);
  // un test, sous une règle
  await act(() => bubble(REMARK_TEST, rules()[0]).click());
  await typeIn('  ce test est faible  ');
  await act(() => footBtn('accent').click());
  // un test des autres
  await act(() => bubble(REMARK_TEST, page.querySelector('.vc-rules-others')!).click());
  await typeIn('hors règle');
  await act(() => footBtn('accent').click());
  expect(drafts.slice(1)).toEqual([[{ add: { target: `case:${PATH}:x`, text: 'ce test est faible' } }], [{ add: { target: `case:${PATH}:y`, text: 'hors règle' } }]]);
  // Annuler : rien
  drafts = [];
  await act(() => bubble(REMARK_RULE, rules()[0]).click());
  await typeIn('abandonné');
  await act(() => footBtn('ghost').click());
  expect(boxes()).toHaveLength(0);
  expect(drafts).toEqual([]);
});

it('relecteur : une zone vide n\'ajoute rien ; la bulle d\'une zone ouverte la referme', async () => {
  await drawR({ mustNot: [inv(A)] });
  await act(() => bubble(REMARK_RULE).click());
  expect(footBtn('accent').disabled).toBe(true);
  await act(() => bubble(REMARK_RULE).click());
  expect(boxes()).toHaveLength(0);
  expect(drafts).toEqual([]);
});

it('relecteur : la bulle du point d\'attention : la zone déjà remplie avec lui, sans rien effacer ; rien au brouillon', async () => {
  await drawR({ mustNot: [inv(A)], invariants: [file('a', ['x'], [reading('x', A, { warning: 'un mock remplace le disque' })])] });
  const attention = 'Reprendre ce point d\'attention dans une remarque, au brouillon de revue';
  await act(() => bubble(attention).click());
  expect(boxes()[0].value).toBe('un mock remplace le disque');
  await typeIn('mon avis');
  await act(() => bubble(attention).click());
  expect(boxes()[0].value).toBe('mon avis\n\nun mock remplace le disque');
  await act(() => bubble(attention).click());   // un second clic n'ajoute rien de plus
  expect(boxes()[0].value).toBe('mon avis\n\nun mock remplace le disque');
  expect(drafts).toEqual([]);
});

it('relecteur : une remarque du brouillon sur un test, sur une règle : sous eux ; une autre cible : nulle part', async () => {
  const draft = [
    { id: 1, target: `case:${PATH}:x`, text: 'trop faible' },
    { id: 2, target: `rule: ${lineA}`, text: 'à reformuler' },
    { id: 3, target: `case:${PATH}:y`, text: 'ailleurs' },
  ];
  await drawR({ mustNot: [inv(A)], draft, invariants: [file('a', ['x'], [reading('x', A)])] });
  expect(rules()[0].querySelector('.vc-rule-case')?.textContent).toContain('trop faible');
  expect(rules()[0].textContent).toContain('à reformuler');
  expect(page.textContent).not.toContain('ailleurs');
  // modifier, retirer : par act.draft
  await act(() => named('Retirer du brouillon', rules()[0].querySelector('.vc-rule-case')!)[0].click());
  expect(drafts).toEqual([[{ remove: 1 }]]);
});

it('relecteur : un test qui garde deux règles : une seule zone s\'ouvre, sous celle du clic', async () => {
  await drawR({ mustNot: [inv(A), inv(B)], invariants: [file('a', ['x'], [reading('x', `${A} et ${B}`)])] });
  await act(() => bubble(REMARK_TEST, rules()[1]).click());
  expect(boxes()).toHaveLength(1);
  expect(rules()[1].querySelector('.vc-cbox')).not.toBeNull();
  expect(rules()[0].querySelector('.vc-cbox')).toBeNull();
});

it('relecteur : la bulle de l\'alignement ouvre une zone de remarque ; Ajouter : au brouillon, sur la ligne de l\'alignement', async () => {
  await drawR({ align: 'La ligne B n\'a aucun test', mustNot: [inv(A)] });
  await act(() => page.querySelector<HTMLButtonElement>('.vc-feedback .vc-quote')!.click());
  expect(prefills).toEqual([]);
  await typeIn('à tester');
  await act(() => footBtn('accent').click());
  expect(drafts).toEqual([[{ add: { target: 'align: La ligne B n\'a aucun test', text: 'à tester' } }]]);
  expect(boxes()).toHaveLength(0);
});

it('relecteur : aucune bulle ne cite dans la conversation', async () => {
  await drawR({ align: 'écart', mustNot: [inv(A)], invariants: [file('a', ['x'], [reading('x', A, { warning: 'w' })])] });
  expect(named('Citer cette règle dans le champ')).toEqual([]);
  expect(named('Citer ce test dans le champ')).toEqual([]);
  for (const b of [...page.querySelectorAll<HTMLButtonElement>('button.vc-tool, button.vc-quote')]) await act(() => b.click());
  expect(prefills).toEqual([]);
});

it('relecteur : aucun bouton de lecture, ni Tout valider, ni Voir le fichier, ni état d\'un fichier', async () => {
  await drawR({ mustNot: [inv(A)], invariants: [file('a', ['x', 'y'], [reading('x', A)], { source: 'const a = 1;\n' })], align: 'écart' });
  const text = page.textContent ?? '';
  for (const bad of ['Lire en pseudo-code', 'Relire', 'Tout relire', 'Vérifier l\'alignement', 'Tout valider', 'Voir le fichier', 'const a = 1']) expect(text).not.toContain(bad);
  expect(page.querySelector('button.vc-run, .vc-vbtn, .vc-seg, details.vc-ifile-src, .cm-editor')).toBeNull();
});

it('relecteur : le compte en tête, la note sans règle', async () => {
  await drawR({ mustNot: [inv(A)], invariants: [file('a', ['x'], [reading('x', A)], { marks: { x: 'ok' } })] });
  expect(page.querySelector('.vc-rules-count')?.textContent).toBe('1 test · 1 validé · 0 à revoir · 0 à lire');
  await drawR({ mustNot: [] });
  expect(page.textContent).toBe('La note ne demande aucun invariant.');
});

it('créateur : ses états de preuve, sa bulle qui cite, comme avant ; aucune zone de remarque', async () => {
  await draw({ mustNot: [inv(A)], proof: { state: 'ok', lines: [{ line: lineA, proved: true, detail: 'm' }] }, invariants: [file('a', ['x'], [reading('x', A)], { changedFromBase: ['x'] })] });
  expect(rules()[0].querySelector('.vc-rule-state')?.textContent).toBe('prouvée');
  named('Citer cette règle dans le champ', rules()[0])[0].click();
  expect(prefills).toEqual([['comment', lineA]]);
  expect(named(REMARK_RULE)).toEqual([]);
  expect(boxes()).toHaveLength(0);
  expect(verdicts(rules()[0])).toHaveLength(2);
  expect(page.textContent).not.toContain('Ajouter une remarque');
});
