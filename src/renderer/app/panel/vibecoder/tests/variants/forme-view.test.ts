// @vitest-environment happy-dom
// FormeView (forme-view.tsx), en vue IDE : l'arborescence liste les modules ; Structure montre le contrat,
// Code montre ModuleCode ou « ne change pas ce module » ; les outils en IconButton (comment → act.prefill,
// open → act.open), l'état « touché » avec Icon ok ; hors du code act.follow(null) ; sans note : l'Invite,
// puis les fichiers de la branche.
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
  { path: 'src/a.ts', contract: 'le contrat de a', file: { id: 'm0', path: 'src/a.ts' }, touched: true, commits: [],
    files: [{ id: 'm0/0', path: 'src/a.ts' }] },
  { path: 'src/b.ts', contract: 'le contrat de b', file: null, touched: false, commits: [] },
];
const draw = (over: Partial<VibeView> & { actions?: { id: string }[] } = {}) => act(() => {
  const view = { lang: 'fr', flow: 'create', actions: [], outputs: {}, modules, commits: [], note: { formeMark: null },
    agent: { model: 'fable' }, ...over } as unknown as VibeView;
  const props = { view, step: { id: 'forme', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
    code: null, drafts: [{}, () => {}],
    act: { run: async () => true, mark: () => {}, set: () => {}, prefill: (...a: unknown[]) => { calls.push(['prefill', ...a]); },
      open: (id: string) => { calls.push(['open', id]); }, openLink: () => {}, follow: (id: unknown) => { calls.push(['follow', id]); },
      save: async () => true, draft: () => {} } } as unknown as StepProps;
  root.render(createElement(FormeView, props));
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
