// @vitest-environment happy-dom
// step-parts (step-parts.tsx) : les icônes à la place des caractères — ⏹ d'une course (IconButton stop, même
// rappel StopRun), la conversation qui travaille (direct.elsewhere : le bouton direct reste actif, « via » grisé), le « @ » du champ
// d'une étape, le dernier résultat d'une action directe (Icon ok / ko), Ouvrir la PR (IconButton external).
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeAction, VibeArtifact, VibePr } from 'technicals/bridge';
import { PrCard, Run, StepField, StopRun } from '../../step-parts';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
const root = createRoot(page);
const render = (el: ReturnType<typeof createElement>) => act(() => { root.render(el); });
const action = (a: Partial<VibeAction> = {}): VibeAction => ({
  id: 'commit', step: 'modules', label: 'Commiter', hint: '', who: 'agent', models: [], model: null, kind: 'send',
  needs: 'none', usesText: false, primary: false, disabled: null, hidden: false, ...a,
});
const GLYPHS = /[⏹✓✗↗]/;

it('⏹ d\'une course : IconButton stop, libellé en title et aria-label, le même rappel', async () => {
  const stop = vi.fn();
  await render(createElement(StopRun.Provider, { value: { stop, state: () => 'running' as const } },
    createElement(Run, { a: action(), busy: false, onRun: () => {} })));
  const button = page.querySelector<HTMLButtonElement>('.vc-run-on .vc-tool')!;
  expect(button.getAttribute('aria-label')).toBe(t('fr').runStopTitle);
  expect(button.title).toBe(t('fr').runStopTitle);
  expect(button.querySelector('svg')).not.toBeNull();
  expect(page.textContent).not.toMatch(GLYPHS);
  await act(() => { button.click(); });
  expect(stop).toHaveBeenCalledWith('commit');
});

it('le dernier résultat d\'une action directe : Icon ok / ko devant sa ligne', async () => {
  for (const ok of [true, false]) {
    await render(createElement(Run, { a: action({ direct: { running: false, last: { ok, line: 'fait', detail: '', time: 1 } } }), busy: false, onRun: () => {} }));
    const res = page.querySelector(`.vc-direct-res[data-state="${ok ? 'ok' : 'ko'}"]`)!;
    expect(res.querySelector('.vc-direct-mark svg')).not.toBeNull();
    expect(res.textContent).toContain('fait');
    expect(res.textContent).not.toMatch(GLYPHS);
  }
});

it('Ouvrir la PR : IconButton external, l\'adresse dans le libellé, le même rappel', async () => {
  const open = vi.fn();
  const pr: VibePr = { number: 3, title: 'Titre', url: 'https://github.com/o/r/pull/3', author: '', base: '', head: '', body: '', state: 'OPEN' };
  await render(createElement(PrCard, { pr, lang: 'fr', onOpenLink: open }));
  const button = page.querySelector<HTMLButtonElement>('.vc-pr-head .vc-tool')!;
  expect(button.getAttribute('aria-label')).toContain('Ouvrir la PR dans le navigateur');
  expect(button.title).toContain(pr.url);
  expect(page.textContent).not.toMatch(GLYPHS);
  await act(() => { button.click(); });
  expect(open).toHaveBeenCalledWith(pr.url);
});

it('conversation qui travaille : direct.elsewhere dégrise le bouton direct, « via » reste grisé ; sinon les deux sont grisés', async () => {
  for (const elsewhere of [true, false]) {
    const direct = { running: false, last: null, ...(elsewhere ? { elsewhere: true as const } : {}) };
    await render(createElement(Run, { a: action({ id: 'pr-worktree', step: null, direct }), busy: true, onRun: () => {} }));
    expect(page.querySelector<HTMLButtonElement>('.vc-run')!.disabled).toBe(!elsewhere);
    expect(page.querySelector<HTMLButtonElement>('.vc-via')!.disabled).toBe(true);
  }
});

it('le champ d\'une étape : « @ » propose les artefacts, Entrée met le chemin ; « @types/node » part sans rien retenir', async () => {
  const art = { id: 'a0', name: 'plan.md', kind: 'markdown', size: 1, time: 1, url: null, truncated: false } as VibeArtifact;
  function Host() {
    const [text, setText] = useState('');
    return createElement(StepField, { name: 'note', text, setText, hint: 'h', artifacts: [art], artifactsDir: '/p/artifacts' });
  }
  await render(createElement(Host));
  const ta = page.querySelector('textarea')!;
  const type = async (value: string) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(ta, value);
    ta.setSelectionRange(value.length, value.length);
    await act(() => { ta.dispatchEvent(new Event('input', { bubbles: true })); });
  };
  const enter = async () => {
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
    await act(() => { ta.dispatchEvent(ev); });
    return ev.defaultPrevented;
  };
  await type('voir @pl');
  expect(page.querySelector('.mention .slash-item')?.textContent).toBe('plan.md');
  expect(await enter()).toBe(true);
  expect(ta.value).toBe('voir /p/artifacts/plan.md ');
  await type('@types/node');
  expect(page.querySelector('.mention')).toBeNull();
  expect(await enter()).toBe(false);
});
