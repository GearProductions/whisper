// @vitest-environment happy-dom
// useIdeDiff (ide-diff.tsx) : par défaut la base (tous les fichiers) ; head, validated : ceux de view.diffs, aucun →
// le texte « Rien de modifié depuis … » ; validated seulement si l'étape a une validation (sinon retombe sur la base) ;
// Fichier garde le filtre de la dernière référence ; gardé par agent et par étape.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { createKept, scoped } from 'core/vibecoder/kept';
import type { IdeFile } from 'core/vibecoder';
import type { VibeDiffs, VibeView } from 'technicals/bridge';
import { KeptScope } from '../../kept-scope';
import { useCreatorDiff, useIdeDiff, type CreatorDiff, type IdeDiff } from '../../ide-diff';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const file = (path: string): IdeFile => ({ path, rank: null, state: null, mark: null, code: null });
const files = ['a.ts', 'b.ts', 'c.ts'].map(file);

const diffs: VibeDiffs = {
  head: [{ path: 'b.ts' }, { path: 'old.ts', deleted: true, id: 'r3' }],
  validated: { forme: [{ path: 'c.ts' }] },
};
const viewOf = (validated: boolean, d: VibeDiffs | undefined = diffs, commits: unknown[] = [{ hash: 'h1' }]): VibeView => ({
  lang: 'fr', diffs: d, commits,
  steps: [{ id: 'forme', status: 'current', facts: '', check: { state: validated ? 'ok' : null, now: null } }],
}) as unknown as VibeView;

let got: IdeDiff;
const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const draw = (view: VibeView, kept = createKept(), agent = 'a') => act(() => {
  const Probe = () => { got = useIdeDiff(view, 'forme'); return got.bar; };
  root.render(createElement(KeptScope.Provider, { value: scoped(kept, agent, 'forme') }, createElement(Probe)));
});
const select = () => page.querySelector('select.vc-mod-shown') as HTMLSelectElement;
const pick = (v: string) => act(() => { select().value = v; select().dispatchEvent(new Event('change', { bubbles: true })); });
const paths = () => got.filter(files).map((f) => f.path);

it('par défaut : base, tous les fichiers, En ligne · Côte à côte offerts', async () => {
  await draw(viewOf(false));
  expect([got.shown, got.ref, got.mode]).toEqual(['base', 'base', 'inline']);
  expect(paths()).toEqual(['a.ts', 'b.ts', 'c.ts']);
  expect([...select().options].map((o) => [o.value, o.textContent])).toEqual(
    [['file', 'Fichier'], ['base', 'Depuis la base de la branche'], ['head', 'Depuis le dernier commit']]);
  expect(page.querySelector('.vc-seg')).not.toBeNull();
});

it('aucun commit sur la branche : Depuis le dernier commit grisé, la référence gardée retombe sur la base', async () => {
  const kept = createKept();
  await draw(viewOf(false), kept);
  await pick('head');
  expect(got.ref).toBe('head');
  await draw(viewOf(false, diffs, []), kept);
  const head = [...select().options].find((o) => o.value === 'head')!;
  expect([head.disabled, head.textContent]).toEqual([true, 'Depuis le dernier commit (pas encore de commit)']);
  expect([got.ref, got.shown]).toEqual(['base', 'base']);
});

it('head choisi : seuls les modifiés (un supprimé en plus) ; rien ne diffère du dernier commit : grisé, retour à la base', async () => {
  const kept = createKept();
  await draw(viewOf(false), kept);
  await pick('head');
  expect(paths()).toEqual(['b.ts', 'old.ts']);
  expect(got.filter(files)[1].gone).toBe('r3');
  await draw(viewOf(false, { head: [], validated: {} }), kept);
  const head = [...select().options].find((o) => o.value === 'head')!;
  expect([head.disabled, head.textContent]).toEqual([true, 'Depuis le dernier commit (rien de modifié)']);
  expect([got.ref, got.shown]).toEqual(['base', 'base']);
});

it('sans validation : pas d\'option validated, showValidated ne change rien ; avec : l\'option, showValidated la choisit', async () => {
  await draw(viewOf(false));
  act(() => got.showValidated());
  expect(got.ref).toBe('base');
  await draw(viewOf(true));
  expect([...select().options].map((o) => o.value)).toEqual(['file', 'base', 'head', 'validated']);
  await act(async () => got.showValidated());
  expect([got.shown, got.ref, paths()]).toEqual(['validated', 'validated', ['c.ts']]);
  expect(got.empty).toBe('Rien de modifié depuis la validation');
});

it('Fichier : le filtre de la dernière référence reste, plus de choix du mode ; le retour au diff', async () => {
  await draw(viewOf(false));
  await pick('head');
  await pick('file');
  expect([got.shown, got.ref, paths()]).toEqual(['file', 'head', ['b.ts', 'old.ts']]);
  expect(page.querySelector('.vc-seg')).toBeNull();
  await pick('base');
  expect([got.shown, got.ref, paths().length]).toEqual(['base', 'base', 3]);
});

it('le mode : un clic sur Côte à côte', async () => {
  await draw(viewOf(false));
  await act(() => { (page.querySelectorAll('.vc-seg button')[1] as HTMLButtonElement).click(); });
  expect(got.mode).toBe('split');
});

it('validated gardé, la validation disparaît : retombe sur la base', async () => {
  const kept = createKept();
  await draw(viewOf(true), kept);
  await pick('validated');
  await pick('file');   // ref validated gardée, shown file
  await draw(viewOf(false), kept);
  expect([got.shown, got.ref, paths().length]).toEqual(['file', 'base', 3]);
  await draw(viewOf(true), kept);
  await pick('validated');
  await draw(viewOf(false), kept);
  expect([got.shown, got.ref]).toEqual(['base', 'base']);
});

it('gardé par agent : retrouvé après un autre agent, la base pour l\'autre', async () => {
  const kept = createKept();
  await draw(viewOf(false), kept, 'a');
  await pick('head');
  await draw(viewOf(false), kept, 'b');
  expect(got.ref).toBe('base');
  await draw(viewOf(false), kept, 'a');
  expect(got.ref).toBe('head');
});

// useCreatorDiff (note 0.16.0-ecran-essentiel) : la base de la branche, ou la validation de l'étape ; ni menu, ni mode, ni head.
let creator: CreatorDiff;
const drawCreator = (view: VibeView, kept = createKept(), agent = 'a') => act(() => {
  const Probe = () => { creator = useCreatorDiff(view, 'forme'); return null; };
  root.render(createElement(KeptScope.Provider, { value: scoped(kept, agent, 'forme') }, createElement(Probe)));
});
const creatorPaths = () => creator.filter(files).map((f) => f.path);

it('créateur : par défaut la base, tous les fichiers, rien d\'autre qu\'un filtre (ni bar, ni mode, ni head)', async () => {
  await drawCreator(viewOf(false));
  expect(creator.shown).toBe('base');
  expect(creatorPaths()).toEqual(['a.ts', 'b.ts', 'c.ts']);
  expect(creator.empty).toBe('Rien de modifié depuis la base de la branche');
  expect(Object.keys(creator).sort()).toEqual(['empty', 'filter', 'shown', 'toggleValidated']);
});

it('créateur, sans validation : toggleValidated ne change rien, ni shown ni le filtre', async () => {
  await drawCreator(viewOf(false));
  await act(async () => creator.toggleValidated());
  expect([creator.shown, creatorPaths().length]).toEqual(['base', 3]);
});

it('créateur, avec validation : toggleValidated passe sur la validation (ses fichiers, son texte), puis revient à la base', async () => {
  await drawCreator(viewOf(true));
  expect(creator.shown).toBe('base');
  await act(async () => creator.toggleValidated());
  expect([creator.shown, creatorPaths(), creator.empty]).toEqual(['validated', ['c.ts'], 'Rien de modifié depuis la validation']);
  await act(async () => creator.toggleValidated());
  expect([creator.shown, creatorPaths().length]).toEqual(['base', 3]);
});

it('créateur : pas de view.diffs (référence absente) : la base garde tout, la validation ne montre rien, sans erreur', async () => {
  const kept = createKept();
  await drawCreator(viewOf(true, null as unknown as undefined), kept);
  expect(creatorPaths()).toHaveLength(3);
  await act(async () => creator.toggleValidated());
  expect([creator.shown, creatorPaths()]).toEqual(['validated', []]);
});

it('créateur : la validation disparaît pendant qu\'on la regarde : retour à la base, et rendue, on ne la retrouve pas d\'elle-même', async () => {
  const kept = createKept();
  await drawCreator(viewOf(true), kept);
  await act(async () => creator.toggleValidated());
  expect(creator.shown).toBe('validated');
  await drawCreator(viewOf(false), kept);
  expect(creator.shown).toBe('base');
  await act(async () => creator.toggleValidated());   // sans validation : rien, et ce qui était gardé est défait
  await drawCreator(viewOf(true), kept);
  expect(creator.shown).toBe('base');
});

it('créateur : un fichier supprimé depuis la validation : sa ligne « supprimé » (gone) dans l\'arborescence', async () => {
  const d: VibeDiffs = { head: [], validated: { forme: [{ path: 'old.ts', deleted: true, id: 'r1' }] } };
  await drawCreator(viewOf(true, d));
  await act(async () => creator.toggleValidated());
  const [gone] = creator.filter(files);
  expect([gone.path, gone.gone, gone.mark]).toEqual(['old.ts', 'r1', 'deleted']);
});

it('créateur : gardé par agent et par étape', async () => {
  const kept = createKept();
  await drawCreator(viewOf(true), kept, 'a');
  await act(async () => creator.toggleValidated());
  await drawCreator(viewOf(true), kept, 'b');
  expect(creator.shown).toBe('base');
  await drawCreator(viewOf(true), kept, 'a');
  expect(creator.shown).toBe('validated');
});
