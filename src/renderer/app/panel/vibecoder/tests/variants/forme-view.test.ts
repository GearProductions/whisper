// @vitest-environment happy-dom
// FormeView (forme-view.tsx) : les outils d'une ligne en IconButton (comment → act.prefill, open → act.open,
// libellé en title et aria-label), l'état « touché » avec Icon ok, plus de glyphes 💬 ni ✓.
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
  { path: 'src/a.ts', contract: 'a', file: { id: 'm0', path: 'src/a.ts' }, touched: true, commits: [] },
  { path: 'src/b.ts', contract: 'b', file: null, touched: false, commits: [] },
];
const draw = (actions: { id: string }[]) => act(() => {
  const view = { lang: 'fr', flow: 'create', actions, outputs: {}, modules, commits: [], note: { formeMark: null },
    agent: { model: 'fable' } } as unknown as VibeView;
  const props = { view, step: { id: 'forme', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
    act: { run: async () => true, mark: () => {}, set: () => {}, prefill: (...a: unknown[]) => { calls.push(['prefill', ...a]); },
      open: (id: string) => { calls.push(['open', id]); }, openLink: () => {} } } as unknown as StepProps;
  root.render(createElement(FormeView, props));
});
const tool = (label: string) => page.querySelectorAll<HTMLButtonElement>(`.vc-ftools button[aria-label="${label}"]`);

it('les outils en IconButton, même action ; Icon ok devant « touché » ; sans glyphes', async () => {
  await draw([{ id: 'comment' }]);
  expect(page.textContent).not.toMatch(/[💬✓]/u);
  expect(tool('Citer ce module dans le champ')).toHaveLength(2);
  expect(tool('Ouvrir dans l\'éditeur')).toHaveLength(1); // seul a.ts existe
  for (const b of page.querySelectorAll('.vc-ftools button')) {
    expect(b.className).toBe('vc-tool');
    expect(b.getAttribute('title')).toBe(b.getAttribute('aria-label'));
    expect(b.querySelector('svg')).not.toBeNull();
  }
  tool('Citer ce module dans le champ')[1].click();
  tool('Ouvrir dans l\'éditeur')[0].click();
  expect(calls).toEqual([['prefill', 'comment', 'src/b.ts'], ['open', 'm0']]);
  const touched = page.querySelector('.vc-fstate[data-state="touched"]')!;
  expect(touched.textContent).toBe('touché');
  expect(touched.querySelector('svg')).not.toBeNull();
  await draw([]);
  expect(tool('Citer ce module dans le champ')).toHaveLength(0);
});
