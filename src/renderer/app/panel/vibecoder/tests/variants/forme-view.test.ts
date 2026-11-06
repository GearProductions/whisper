// @vitest-environment happy-dom
// FormeView (forme-view.tsx), en vue IDE : l'arborescence liste les modules ; Structure montre le contrat,
// Code montre ModuleCode ou « ne change pas ce module » ; les outils en IconButton (comment → act.prefill,
// open → act.open), l'état « touché » avec Icon ok ; hors du code act.follow(null) ; sans note : l'Invite,
// puis les fichiers de la branche ; le commit proposé (ProposedCommit) sous l'en-tête.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { createKept, scoped, t } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { FormeView } from '../../forme-view';
import { KeptScope } from '../../kept-scope';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const calls: unknown[][] = [];
let scope: ReturnType<typeof scoped> | null = null; // l'état retenu de l'agent affiché (aucun : un état ordinaire)
const modules = [
  { path: 'src/a.ts', contract: 'le contrat de a', file: { id: 'm0', path: 'src/a.ts' }, touched: true, commits: [],
    files: [{ id: 'm0/0', path: 'src/a.ts' }] },
  { path: 'src/b.ts', contract: 'le contrat de b', file: null, touched: false, commits: [] },
];
const draw = (over: Partial<VibeView> & { actions?: { id: string }[] } = {}) => act(() => {
  const view = { lang: 'fr', flow: 'create', actions: [], outputs: {}, modules, commits: [], draft: [], note: { formeMark: null },
    agent: { model: 'fable' }, ...over } as unknown as VibeView;
  const props = { view, step: { id: 'forme', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
    code: null, drafts: [{}, () => {}],
    act: { run: async (...a: unknown[]) => { calls.push(['run', ...a]); return true; }, mark: () => {}, set: () => {}, prefill: (...a: unknown[]) => { calls.push(['prefill', ...a]); },
      open: (id: string) => { calls.push(['open', id]); }, openLink: () => {}, follow: (id: unknown) => { calls.push(['follow', id]); },
      save: async () => true, draft: (op: unknown) => { calls.push(['draft', op]); } } } as unknown as StepProps;
  root.render(createElement(KeptScope.Provider, { value: scope }, createElement(FormeView, props)));
});
const tool = (label: string) => page.querySelectorAll<HTMLButtonElement>(`.vc-ftools button[aria-label="${label}"]`);
const rows = () => [...page.querySelectorAll('.vc-ide-side [role="treeitem"], .vc-ide-side li')].map((e) => e.textContent);
const choose = (name: string) => act(() => {
  [...page.querySelectorAll<HTMLElement>('.vc-ide-side button, .vc-ide-side [role="treeitem"]')].find((e) => e.textContent?.includes(name))!.click();
});
const swap = (label: string) => act(() => {
  [...page.querySelectorAll<HTMLButtonElement>('.vc-seg button')].find((b) => b.textContent === label)!.click();
});

it('l\'arborescence liste les modules ; le premier est choisi, Structure montre son contrat', async () => {
  await draw();
  expect(rows().join('|')).toMatch(/a\.ts/);
  expect(rows().join('|')).toMatch(/b\.ts/);
  expect(page.querySelector('.vc-fcontract')!.textContent).toContain('le contrat de a');
  await choose('b.ts');
  expect(page.querySelector('.vc-fcontract')!.textContent).toContain('le contrat de b');
  expect(page.querySelector('.vc-fstate')!.textContent).toBe('à créer');
});

it('les outils en IconButton, même action ; Icon ok devant « touché » ; sans glyphes', async () => {
  await choose('a.ts');
  await draw({ actions: [{ id: 'comment' }] as never });
  expect(page.textContent).not.toMatch(/[💬✓]/u);
  expect(tool('Citer ce module dans le champ')).toHaveLength(1);
  expect(tool('Ouvrir dans l\'éditeur')).toHaveLength(1);
  for (const b of page.querySelectorAll('.vc-ftools button')) {
    expect(b.className).toBe('vc-tool');
    expect(b.getAttribute('title')).toBe(b.getAttribute('aria-label'));
    expect(b.querySelector('svg')).not.toBeNull();
  }
  calls.length = 0;
  tool('Citer ce module dans le champ')[0].click();
  tool('Ouvrir dans l\'éditeur')[0].click();
  expect(calls).toEqual([['prefill', 'comment', 'src/a.ts'], ['open', 'm0']]);
  const touched = page.querySelector('.vc-fstate[data-state="touched"]')!;
  expect(touched.textContent).toBe('touché');
  expect(touched.querySelector('svg')).not.toBeNull();
  await draw();
  expect(tool('Citer ce module dans le champ')).toHaveLength(0);
});

it('Code : ModuleCode d\'un module touché, « ne change pas » sinon ; hors du code, follow(null)', async () => {
  await choose('a.ts');
  calls.length = 0;
  await swap('Code');
  expect(page.querySelector('.vc-fcontract')).toBeNull();
  expect(calls).toContainEqual(['follow', 'm0/0']);
  await swap('Structure');
  expect(calls.at(-1)).toEqual(['follow', null]);
  await choose('b.ts');
  await swap('Code');
  expect(page.textContent).toContain('la branche ne change pas ce module');
});

it('sans note : l\'Invite, puis les fichiers de la branche et leur code', async () => {
  calls.length = 0;
  await draw({ note: null, modules: [], files: [{ id: 'f0', path: 'src/x.ts' }] } as never);
  expect(page.textContent).toContain('Pas encore de note');
  expect(page.querySelector('.vc-fcontract')).toBeNull();
  expect(rows().join('|')).toMatch(/x\.ts/);
  expect(calls).toContainEqual(['follow', 'f0']);
  await draw({ note: null, modules: [], files: [] } as never);
  expect(page.querySelector('.vc-ide')).toBeNull();
});

it('le commit proposé (un fixup de la note) : sa carte sous l\'en-tête, ✓ Commiter dans la carte, pas dans l\'en-tête ; aucune carte sans commit.md', async () => {
  const actions = [{ id: 'commit', label: '✓ Commiter' }, { id: 'commit-prepare', label: 'Préparer le commit' }]
    .map((a) => ({ hidden: false, who: '', hint: '', primary: false, step: 'modules', models: [], kind: 'send', ...a }));
  await draw({ actions, outputs: { 'commit.md': { text: 'fixup! 0.13.0 : note\n', time: 1 } } } as unknown as Partial<VibeView>);
  expect(page.querySelector('.vc-proposed .vc-commit-msg')?.textContent).toBe('fixup! 0.13.0 : note');
  expect(page.querySelector('.vc-proposed .vc-commit-foot .vc-run-label')?.textContent).toBe('✓ Commiter');
  expect(page.querySelector('.vc-step-acts')).toBeNull();
  await draw({ actions } as unknown as Partial<VibeView>);
  expect(page.querySelector('.vc-proposed')).toBeNull();
});

const remarks = [{ id: 7, target: 'forme: src/a.ts', text: 'ce contrat est flou' }, { id: 8, target: 'forme: src/b.ts', text: 'pour b' }];

it('une remarque sur un module : sous lui, grisée, modifiable sur place ; pas en créateur', async () => {
  calls.length = 0;
  await draw({ flow: 'review', draft: remarks } as never);
  await choose('a.ts');
  await swap('Structure');
  const list = page.querySelector('.vc-fmain .vc-draft-list')!;
  expect(list.classList.contains('vc-remarks-muted')).toBe(true);
  expect([...list.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['ce contrat est flou']);
  expect(page.querySelector('.vc-fcontract')!.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await act(() => page.querySelector<HTMLButtonElement>('.vc-draft-list button[aria-label="Modifier cette remarque"]')!.click());
  const ta = page.querySelector<HTMLTextAreaElement>('.vc-fmain textarea')!;
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(ta, 'plus net');
  await act(async () => { ta.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(() => [...page.querySelectorAll<HTMLButtonElement>('button.vc-run')].find((b) => b.textContent === 'Enregistrer')!.click());
  expect(calls).toContainEqual(['draft', { edit: { id: 7, text: 'plus net' } }]);
  await act(() => page.querySelector<HTMLButtonElement>('.vc-draft-list button[aria-label="Retirer du brouillon"]')!.click());
  expect(calls).toContainEqual(['draft', { remove: 7 }]);
  await draw({ draft: remarks } as never);
  expect(page.querySelector('.vc-draft-list')).toBeNull();
});

it('Poser une question sur un module : son chemin cité dans le champ, rien d\'envoyé ; absent en créateur', async () => {
  calls.length = 0;
  await draw({ flow: 'review' } as never);
  const ask = tool('Poser une question à l\'agent');
  expect(ask).toHaveLength(1);
  await act(() => ask[0].click());
  expect(calls).toEqual([['prefill', 'comment', 'src/a.ts']]);
  expect(tool('Commenter ce module (brouillon de revue)')).toHaveLength(1);
  await draw();
  expect(tool('Poser une question à l\'agent')).toHaveLength(0);
});

it('l\'onglet choisi, la vue recréée sous le même agent : le même ; un autre agent : Structure', async () => {
  const kept = createKept();
  const pressed = () => page.querySelector('.vc-seg [aria-pressed="true"]')!.textContent;
  scope = scoped(kept, 'a1', 'forme');
  await act(() => root.render(null));
  await draw();
  await swap('Code');
  await act(() => root.render(null));
  await draw();
  expect(pressed()).toBe('Code');
  scope = scoped(kept, 'a2', 'forme');
  await act(() => root.render(null));
  await draw();
  expect(pressed()).toBe('Structure');
  scope = null;
});
