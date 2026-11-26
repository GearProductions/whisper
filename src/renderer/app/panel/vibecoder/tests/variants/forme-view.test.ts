// @vitest-environment happy-dom
// FormeView (forme-view.tsx), notes 0.16.0-ecran-essentiel et 0.16.0-revue-essentielle : la liste des modules, une ligne chacun
// (chemin, phrase), ni code, ni arbre, ni diff, ni badge, ni commit, ni icône, ni validation, aucun fichier suivi ; sans
// Forme : une phrase. Le relecteur voit la même vue (la Forme n'est plus un de ses arrêts).
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { FormeView } from '../../forme-view';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const calls: unknown[][] = [];
const modules = [
  { path: 'src/a.ts', paths: ['src/a.ts'], contract: 'le contrat de a', file: { id: 'm0', path: 'src/a.ts' }, touched: true, commits: [],
    files: [{ id: 'm0/0', path: 'src/a.ts' }] },
  { path: 'src/b.ts', paths: ['src/b.ts'], contract: 'le contrat de b', file: null, touched: false, commits: [] },
];
const plain = { id: 'forme', status: 'current', facts: '', open: true };
const draw = (over: Partial<VibeView> & { actions?: { id: string }[] } = {}, step: Record<string, unknown> = plain, code: unknown = null) => act(() => {
  const view = { lang: 'fr', flow: 'create', actions: [], outputs: {}, modules, commits: [{ hash: 'h1', subject: 's', files: [] }], draft: [], note: { formeMark: null },
    agent: { model: 'fable' }, steps: [step], ...over } as unknown as VibeView;
  const props = { view, step, t: t('fr'), busy: false, text: '', setText: () => {},
    code, drafts: [{}, () => {}],
    act: { run: async (...a: unknown[]) => { calls.push(['run', ...a]); return true; }, mark: (...a: unknown[]) => { calls.push(['mark', ...a]); }, set: () => {}, prefill: (...a: unknown[]) => { calls.push(['prefill', ...a]); },
      open: (id: string) => { calls.push(['open', id]); }, openLink: () => {}, follow: (id: unknown) => { calls.push(['follow', id]); },
      save: async () => true, draft: (op: unknown) => { calls.push(['draft', op]); } } } as unknown as StepProps;
  root.render(createElement(FormeView, props));
});
const lines = [
  { path: 'src/core/a.ts', paths: ['src/core/a.ts'], contract: 'lit la note en une phrase\nne connaît pas : le DOM\nvariants : a.test.ts\n- un cas', file: { id: 'm0', path: 'src/core/a.ts' }, touched: true, commits: ['abcdef1234'],
    files: [{ id: 'm0/0', path: 'src/core/a.ts' }] },
  { path: 'src/core/b.ts', paths: ['src/core/b.ts'], contract: 'écrit b · utilisé par : a', file: null, touched: false, commits: [] },
  { path: 'src/c.ts', paths: ['src/c.ts'], contract: 'ne connaît pas : rien', file: null, touched: false, commits: [] },
];

it('créateur, trois modules : trois lignes, chemin (dossier, nom) et phrase', async () => {
  await draw({ modules: lines } as never);
  const items = [...page.querySelectorAll('.vc-forme-list li')];
  expect(items).toHaveLength(3);
  expect(items.map((li) => li.querySelector('b')!.textContent)).toEqual(['a.ts', 'b.ts', 'c.ts']);
  expect(items.map((li) => li.querySelector('.vc-fdir')!.textContent)).toEqual(['src/core/', 'src/core/', 'src/']);
  expect(items.map((li) => li.querySelector('.vc-fsay')?.textContent ?? null)).toEqual(['lit la note en une phrase', 'écrit b', null]);
});

it('créateur : ni arbre, ni diff, ni Structure · Code, ni « touché », ni « 1 commit », ni icône', async () => {
  await draw({ modules: lines } as never);
  expect(page.querySelector('.vc-ide, .vc-ide-side, [role="tree"]')).toBeNull();
  expect(page.querySelector('.vc-seg, select, .cm-editor, .vc-fcontract')).toBeNull();
  expect(page.textContent).not.toMatch(/Structure|Code|touché|commit|dernier|validation/);
  expect(page.querySelector('svg, button')).toBeNull();
});

it('créateur : ni Poser la forme, ni Valider la forme, ni commit proposé', async () => {
  const actions = [{ id: 'forme' }, { id: 'commit' }, { id: 'commit-prepare' }]
    .map((a) => ({ hidden: false, who: '', hint: '', primary: true, step: 'forme', models: [], kind: 'send', label: a.id, ...a }));
  await draw({ modules: lines, actions, outputs: { 'commit.md': { text: 'fixup! 0.13.0 : note\n', time: 1 } } } as never, { ...plain, check: { state: null, now: 'h1' } });
  expect(page.textContent).not.toMatch(/Poser la forme|Valider la forme|fixup|Commiter/);
  expect(page.querySelector('.vc-proposed, .vc-vmark, .vc-step-acts, button')).toBeNull();
});

it('créateur : aucun fichier n\'est suivi', async () => {
  calls.length = 0;
  await draw({ modules: lines, files: [{ id: 'f0', path: 'src/x.ts' }] } as never);
  await draw({ note: null, modules: [], files: [{ id: 'f0', path: 'src/x.ts' }] } as never);
  expect(calls.filter((c) => c[0] === 'follow' && c[1] !== null)).toEqual([]);
  expect(page.textContent).not.toContain('x.ts');
});

it('créateur, pas de Forme : une phrase, sans bouton, en français et en anglais ; pas de note : une phrase aussi', async () => {
  await draw({ modules: [], files: [] } as never);
  expect(page.textContent).toContain('Pas encore de forme');
  expect(page.textContent).not.toMatch(/Poser la forme|champ/);
  expect(page.querySelector('button, .vc-forme-list')).toBeNull();
  await draw({ modules: [], files: [], lang: 'en' } as never);
  expect(page.textContent).toContain('No shape yet');
  expect(page.textContent).not.toMatch(/Lay down the shape|field/);
  await draw({ note: null, modules: [] } as never);
  expect(page.textContent).toContain('Pas encore de note');
  expect(page.querySelector('button')).toBeNull();
});

it('créateur : un module sans phrase garde sa ligne (chemin seul) ; un chemin sans dossier', async () => {
  await draw({ modules: [{ ...modules[1], path: 'lone.ts', contract: '' }] } as never);
  expect(page.querySelectorAll('.vc-forme-list li')).toHaveLength(1);
  expect(page.querySelector('.vc-forme-list b')!.textContent).toBe('lone.ts');
  expect(page.querySelector('.vc-fsay')).toBeNull();
});

// La revue essentielle : la Forme n'est plus un arrêt du relecteur ; s'il la voit, c'est la vue du créateur, la liste.
it('relecteur : la même liste que le créateur, ni arbre, ni Structure · Code, ni remarque, ni outil', async () => {
  await draw({ flow: 'review', modules: lines, draft: [{ id: 7, target: 'forme: src/core/a.ts', text: 'ce contrat est flou' }] } as never);
  expect(page.querySelectorAll('.vc-forme-list li')).toHaveLength(3);
  expect(page.querySelector('.vc-ide, .vc-ide-side, [role="tree"], .vc-seg, .vc-fcontract, .vc-draft-list, .vc-ftools')).toBeNull();
  expect(page.querySelector('svg, button')).toBeNull();
  expect(page.textContent).not.toMatch(/Structure|touché|ce contrat est flou/);
});

it('relecteur, pas de Forme : une phrase, sans bouton ni fichier de la branche', async () => {
  await draw({ flow: 'review', modules: [], files: [{ id: 'f0', path: 'src/x.ts' }] } as never);
  expect(page.textContent).toContain('Pas encore de forme');
  expect(page.querySelector('button, .vc-ide')).toBeNull();
  expect(page.textContent).not.toContain('x.ts');
});
