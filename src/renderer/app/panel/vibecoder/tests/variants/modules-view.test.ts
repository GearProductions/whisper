// @vitest-environment happy-dom
// ModulesView (modules-view.tsx), note 0.16.0-ecran-essentiel : en créateur, une seule ligne d'état, un seul arbre et son
// diff depuis la base, en lecture seule et sans bouton ; « modifiée depuis la validation » bascule le diff, et retour ;
// Ouvrir dans l'éditeur, une icône sur le fichier affiché. Note 0.16.0-revue-essentielle : plus de vue du relecteur ni de
// carte de commit.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { getOriginalDoc } from '@codemirror/merge';
import { EditorView } from '@codemirror/view';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { ModulesView } from '../../modules-view';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);

const steps = [{ id: 'modules', status: 'current', facts: '' }];
const module = (path: string, o: Record<string, unknown> = {}) => ({ path, paths: [path], contract: 'Fait `x` · ne connaît pas : y', file: { id: path, path }, touched: true,
  commits: ['abc1234'], files: [{ id: `${path}/0`, path: `${path}/a.ts` }], ...o });
const two = [module('src/touche'), module('src/autre', { touched: false, commits: [], files: undefined })];
const ACTIONS = ['module', 'review-diff', 'prove', 'commit-modules', 'modules', 'commit-prepare', 'commit', 'comment']
  .map((id) => ({ id, hidden: false, who: '', hint: '', primary: false, step: 'modules', label: id }));

const followed: unknown[] = [];
const opened: unknown[] = [];
const saved: unknown[] = [];
const sets: unknown[] = [];
const marks: unknown[] = [];
type Over = { view?: Record<string, unknown>; step?: Record<string, unknown>; code?: unknown };
const draw = async (o: Over = {}) => {
  await act(() => root.render(null));   // l'état tenu par la vue repart de zéro
  await act(() => {
    const step = { ...steps[0], open: true, ...o.step };
    const view = { lang: 'fr', flow: 'create', actions: ACTIONS, commits: [], outputs: {}, modules: two, invariants: [], steps: [step], ...o.view } as unknown as VibeView;
    const props = { view, step, t: t('fr'), busy: false, text: '', setText: () => {}, code: o.code ?? null, drafts: [{}, () => {}],
      act: { run: async () => true, prefill: () => {}, open: (id: unknown) => { opened.push(id); }, openLink: () => {}, follow: (id: unknown) => { followed.push(id); },
        save: async (...a: unknown[]) => { saved.push(a); return true; }, set: (x: unknown) => { sets.push(x); }, mark: (...a: unknown[]) => { marks.push(a); } } } as unknown as StepProps;
    root.render(createElement(ModulesView, props));
  });
};
const sixteen = Array.from({ length: 16 }, (_, i) => module(`src/m${i}`));
const labels = () => [...page.querySelectorAll('button')].map((b) => b.textContent);
const side = () => [...page.querySelectorAll('.vc-ide-side .vc-tree-row:not([aria-expanded])')].map((e) => e.textContent);
const beforeOf = () => {
  const first = EditorView.findFromDOM(page.querySelector('.cm-editor') as HTMLElement)!;
  return page.querySelector('.vc-mdiff')!.getAttribute('data-mode') === 'split' ? first.state.doc.toString() : getOriginalDoc(first.state).toString();
};
const code = (id: string, at: Record<string, unknown>, text: string | null = 'a\nc') => ({ id, text, time: 1, at });

it('créateur, seize modules commités : une seule ligne d\'état, un seul arbre', async () => {
  await draw({ view: { modules: sixteen } });
  expect(page.querySelectorAll('.vc-card-title')).toHaveLength(1);
  expect(page.querySelector('.vc-card-title')!.textContent).toBe('16 modules écrits · commités');
  expect(page.querySelectorAll('.vc-ide-side')).toHaveLength(1);
  expect(page.querySelectorAll('.vc-ide')).toHaveLength(1);
  expect(page.querySelector('details.vc-mod-main')).toBeNull();   // ni accordéon
});

it('créateur, la ligne d\'état dit ce qui manque : des modules pas écrits, pas commités ; un seul module, au singulier', async () => {
  await draw({ view: { modules: [module('src/a'), module('src/b', { touched: false, commits: [], files: undefined })] } });
  expect(page.querySelector('.vc-card-title')!.textContent).toBe('1 sur 2 modules écrits · 1 commité');
  await draw({ view: { modules: [module('src/a', { commits: [], uncommitted: true })] } });
  expect(page.querySelector('.vc-card-title')!.textContent).toBe('1 module écrit · pas commité');
  await draw({ view: { modules: [module('src/a')] } });
  expect(page.querySelector('.vc-card-title')!.textContent).toBe('1 module écrit · commité');
  await draw({ view: { modules: [module('src/a', { touched: false, commits: [], files: undefined })] } });
  expect(page.querySelector('.vc-card-title')!.textContent).toBe('0 sur 1 module écrit');
});

it('créateur : aucun bouton (Générer, Relire le diff, Prouver, Valider, Commiter), ni légende, ni compte par état', async () => {
  await draw({ view: { modules: [{ ...module('src/touche'), uncommitted: true }, module('src/autre', { touched: false, commits: [], files: undefined })], proof: { state: 'none', lines: [] } },
    step: { check: { state: null, now: 'h1' } } });
  const all = labels().join('|');
  for (const word of ['Générer', 'Relire', 'Prouver', 'Valider', 'Commiter', 'Ouvrir', 'Relancer']) expect(all).not.toContain(word);
  expect(page.querySelector('.vc-card-acts')).toBeNull();
  expect(page.querySelector('.vc-run, .vc-vmark, .vc-mod-acts, .vc-step-acts')).toBeNull();
  expect(page.querySelector('.vc-mod-legend, .vc-mod-noproof')).toBeNull();
  expect(page.querySelector('.vc-modules')!.textContent).not.toMatch(/en cours|à faire|rien à prouver/);
});

it('créateur : ni menu de diff, ni En ligne · Côte à côte, ni Vue IDE · Vue liste ; le réglage de vue n\'est ni lu ni envoyé', async () => {
  sets.length = 0;
  const at = { base: 'a\nb', head: 'a\nb', validations: {} };
  for (const modulesView of ['list', 'ide']) {
    await draw({ view: { modulesView, modules: two }, code: code('src/touche/0', at) });
    expect(page.querySelector('select')).toBeNull();
    expect(page.querySelector('.vc-seg, .vc-ide-bar, .vc-diff-picker')).toBeNull();
    expect(page.textContent).not.toMatch(/En ligne|Côte à côte|Vue IDE|Vue liste|Depuis le dernier commit/);
    expect(page.querySelector('.vc-ide')).not.toBeNull();   // « list » : toujours l'arbre
    expect(page.querySelector('details.vc-mod-main')).toBeNull();
  }
  expect(sets).toEqual([]);
});

it('créateur, un fichier choisi : son diff depuis la base, en ligne', async () => {
  await draw({ code: code('src/touche/0', { base: 'a\nb', head: 'a\nz' }) });
  expect(page.querySelector('.vc-mdiff')!.getAttribute('data-mode')).toBe('inline');
  expect(beforeOf()).toBe('a\nb');   // la base, pas le dernier commit
  expect(followed.at(-1)).toBe('src/touche/0');
});

it('créateur : aucun éditeur, aucun Enregistrer, rien n\'est enregistré', async () => {
  saved.length = 0;
  await draw({ code: code('src/touche/0', { base: 'a\nb', head: 'a\nb' }) });
  const editors = [...page.querySelectorAll('.cm-editor')].map((e) => EditorView.findFromDOM(e as HTMLElement)!);
  expect(editors.length).toBeGreaterThan(0);
  expect(editors.every((e) => e.state.readOnly)).toBe(true);
  expect(labels()).not.toContain('Enregistrer');
  expect(labels()).not.toContain('Abandonner');
  expect(page.querySelector('.vc-mod-code-foot')).toBeNull();
  // un fichier sans base : toujours le diff (tout ajouté), jamais l'éditeur
  await draw({ code: code('src/touche/0', { base: null, head: null }) });
  expect(page.querySelector('.vc-mdiff')).not.toBeNull();
  expect(beforeOf()).toBe('');
  expect(saved).toEqual([]);
});

it('créateur, la preuve au relevé : pas de carte ici (ni review.md ni commit.md)', async () => {
  await draw({ view: { outputs: { 'preuve.md': { text: '## [prouvé] « une règle »\n\nle mutant\n', time: 0 }, 'review.md': { text: 'y', time: 0 }, 'commit.md': { text: 'feat : x', time: 0 } } } });
  expect(page.querySelector('.vc-proof, .vc-diff-review, .vc-proposed')).toBeNull();
  expect(page.textContent).not.toMatch(/Preuve des invariants|le mutant|feat : x/);
});

const diffs = { head: [], validated: { modules: [{ path: 'src/touche/a.ts' }] } };
const changed = { check: { state: 'changed', now: 'h2' }, head: 'modifiée depuis la validation' };
const since = () => page.querySelector<HTMLButtonElement>('.vc-step-head .vc-since')!;

it('créateur, l\'étape modifiée depuis la validation : un clic sur l\'en-tête montre ce qui a changé depuis le ✓, un second revient à la base', async () => {
  const at = { base: 'a\nb', head: 'a\nb', validations: { modules: 'a\nb\nc' } };
  await draw({ view: { diffs, files: [{ id: 'f9', path: 'src/zzz.ts' }] }, step: changed, code: code('src/touche/0', at, 'a\nz') });
  expect(side().join('|')).toMatch(/a\.ts.*zzz/);
  expect(beforeOf()).toBe('a\nb');
  await act(() => since().click());
  expect(side()).toHaveLength(1);
  expect(side()[0]).toContain('a.ts');
  expect(beforeOf()).toBe('a\nb\nc');
  expect(page.querySelector('select')).toBeNull();
  await act(() => since().click());
  expect(side().join('|')).toMatch(/a\.ts.*zzz/);
  expect(beforeOf()).toBe('a\nb');
});

it('créateur, rien de modifié depuis la validation : le dit, à la place de l\'arbre', async () => {
  await draw({ view: { diffs: { head: [], validated: { modules: [] } } }, step: changed });
  await act(() => since().click());
  expect(page.querySelector('.vc-ide-side .vc-empty')!.textContent).toBe('Rien de modifié depuis la validation');
});

it('créateur, une étape sans validation : pas de bascule', async () => {
  await draw({ view: { diffs }, step: { check: { state: null, now: 'h1' }, head: 'modifiée depuis la validation' } });
  expect(page.querySelector('.vc-since')).toBeNull();
  await draw({ view: { diffs } });
  expect(page.querySelector('.vc-since')).toBeNull();
  expect(side().length).toBeGreaterThan(1);
});

it('créateur, un fichier supprimé : tout en retraits (depuis la base, puis depuis la validation)', async () => {
  const gone = module('src/old', { files: [{ id: 'm0/0', path: 'src/old/gone.ts', deleted: true }] });
  await draw({ view: { modules: [gone] }, code: code('m0/0', { base: 'x\ny', head: 'x\ny' }, null) });
  expect(page.querySelector('.vc-mdiff')).not.toBeNull();
  expect(beforeOf()).toBe('x\ny');
  expect(page.querySelector('.cm-deletedChunk')?.textContent).toContain('x');
  // supprimé depuis la validation : une ligne de l'arbre qui n'est pas dans les fichiers, suivie par son r<i>
  followed.length = 0;
  const d = { head: [], validated: { modules: [{ path: 'src/old.ts', id: 'r0', deleted: true }] } };
  await draw({ view: { diffs: d }, step: changed, code: code('r0', { base: null, head: null, validations: { modules: 'x\ny' } }, null) });
  await act(() => since().click());
  expect(side()).toHaveLength(1);
  expect(side()[0]).toContain('old.ts');
  expect(followed.at(-1)).toBe('r0');
  expect(page.querySelector('.cm-deletedChunk')?.textContent).toContain('x');
});

it('créateur, Ouvrir dans l\'éditeur : l\'icône ouvre le fichier affiché', async () => {
  opened.length = 0;
  await draw({ code: code('src/touche/0', { base: 'a', head: 'a' }) });
  const open = page.querySelector<HTMLButtonElement>('button[aria-label="Ouvrir dans l\'éditeur"]')!;
  expect(open.classList.contains('vc-tool')).toBe(true);
  expect(open.querySelector('svg')).not.toBeNull();
  expect(open.textContent).toBe('');   // une icône, pas un bouton à texte
  expect(page.querySelectorAll('button[aria-label="Ouvrir dans l\'éditeur"]')).toHaveLength(1);
  await act(() => open.click());
  expect(opened).toEqual(['src/touche/0']);
});

it('créateur, un fichier de module pas touché : pas de code, pas d\'icône, plus aucun fichier suivi', async () => {
  followed.length = 0;
  await draw({ view: { modules: [module('src/autre', { touched: false, commits: [], files: undefined })] } });
  expect(page.querySelector('.vc-mdiff, .cm-editor')).toBeNull();
  expect(page.querySelector('button[aria-label="Ouvrir dans l\'éditeur"]')).toBeNull();
  expect(followed.at(-1)).toBeNull();
});

it('créateur, sans module : les fichiers de la branche, sans interrupteur ni bouton ; sans fichier : une phrase', async () => {
  await draw({ view: { modules: [], files: [{ id: 'f0', path: 'src/x/b.ts' }] } });
  expect(page.querySelector('.vc-ide-side')!.textContent).toContain('b.ts');
  expect(page.querySelector('.vc-seg, .vc-mod-acts')).toBeNull();
  expect(page.querySelector('.vc-card-title')!.textContent).toBe('Fichiers de la branche');
  await draw({ view: { modules: [] } });
  expect(page.querySelector('.vc-ide')).toBeNull();
  expect(page.textContent).toContain('La Forme ne liste aucun module');
});

it('créateur : « modifiée depuis la validation » ne valide ni ne retire rien (aucune marque envoyée)', async () => {
  marks.length = 0;
  await draw({ view: { diffs }, step: changed });
  await act(() => since().click());
  expect(marks).toEqual([]);
});

// La revue essentielle : plus aucune carte de commit ni Relire les commits, dans aucun rôle ; le relecteur, s'il voit
// l'étape, a la vue du créateur (la ligne d'état, l'arbre, le diff en lecture seule), sans interrupteur ni accordéon.
const commits = [{ hash: 'abc1234def', subject: 'un commit', files: [{ path: 'src/touche/a.ts', status: 'M' }] }];

  it('relecteur : ni carte de commit, ni Relire les commits, ni puce de commit', async () => {
  await draw({ view: { flow: 'review', draft: [], commits, pr: { number: 7 }, outputs: { 'pr-7-commits.md': { text: '## abc1234 un commit\n- x', time: 1 } } } });
  expect(page.querySelector('.vc-commit-list, .vc-commit-review, .vc-chip, .vc-commit-files')).toBeNull();
  expect(page.textContent).not.toMatch(/Relire les commits|Validé|À revoir|un commit|abc1234/);
});

it('relecteur : la vue du créateur — ligne d\'état, un arbre, diff en lecture seule ; ni accordéon, ni Vue IDE · Vue liste', async () => {
  sets.length = 0;
  await draw({ view: { flow: 'review', modulesView: 'list', modules: sixteen }, code: code('src/m0/0', { base: 'a\nb', head: 'a\nz' }) });
  expect(page.querySelector('.vc-card-title')!.textContent).toBe('16 modules écrits · commités');
  expect(page.querySelectorAll('.vc-ide-side')).toHaveLength(1);
  expect(page.querySelector('details.vc-mod-main, .vc-seg, .vc-mod-list')).toBeNull();
  expect(page.querySelector('.vc-mdiff')!.getAttribute('data-mode')).toBe('inline');
  expect([...page.querySelectorAll('.cm-editor')].every((e) => EditorView.findFromDOM(e as HTMLElement)!.state.readOnly)).toBe(true);
  expect(sets).toEqual([]);
});
