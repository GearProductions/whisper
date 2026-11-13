// @vitest-environment happy-dom
// step-parts (step-parts.tsx) : les icônes à la place des caractères — ⏹ d'une course (IconButton stop, même
// rappel StopRun), la conversation qui travaille (direct.elsewhere : le bouton direct reste actif, « via » grisé), l'en-tête
// d'une étape (step.head, jamais facts ; ni champ, ni Joindre, ni micro, ni Envoyer ; ses actions restent), un bouton sans
// choix de modèle, le dernier résultat d'une action directe (Icon ok / ko), Ouvrir la PR (IconButton external).
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeAction, VibePr } from 'technicals/bridge';
import { PrCard, Run, StepHead, StopRun } from '../../step-parts';
import type { StepProps } from '../../step-views';

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

const head = (step: { id: 'note' | 'forme' | 'invariants'; head?: string; facts?: string }, acts: VibeAction[] = []) => render(createElement(StepHead, { p: {
  view: { lang: 'fr', actions: acts }, step: { status: 'current', facts: '', ...step }, t: t('fr'), busy: false, act: { run: () => {} },
} as unknown as StepProps }));

it('un en-tête montre step.head, jamais step.facts ; head vide ou absent : rien', async () => {
  await head({ id: 'note', head: 'cinq faits', facts: 'tous les faits' });
  expect(page.querySelector('.vc-facts')!.textContent).toBe('cinq faits');
  expect(page.textContent).not.toContain('tous les faits');
  for (const h of [{ head: '' }, {}]) {
    await head({ id: 'note', facts: 'tous les faits', ...h });
    expect(page.querySelector('.vc-facts')).toBeNull();
    expect(page.textContent).not.toContain('tous les faits');
  }
});

it('Note, Forme, Invariants : ni champ, ni Joindre, ni micro, ni Envoyer ; leurs boutons d\'action restent', async () => {
  for (const id of ['note', 'forme', 'invariants'] as const) {
    const acts = [action({ id: `${id}-a`, label: 'Faire', step: id, usesText: true, primary: true, needs: 'text' }), action({ id: `${id}-b`, label: 'Autre', step: id, usesText: true })];
    await head({ id }, acts);
    expect(page.querySelector('textarea, .vc-step-field, .vc-attach, .vc-mic, .vc-send')).toBeNull();
    expect([...page.querySelectorAll('.vc-step-acts .vc-run-label')].map((e) => e.textContent)).toEqual(['Faire', 'Autre']);
  }
});

it('une action d\'envoi montre qui travaille, sans liste de modèle ni d\'effort', async () => {
  await render(createElement(Run, { a: action({ who: 'agent', models: ['opus', 'sonnet'], model: 'opus', efforts: ['low'] }), busy: false, onRun: () => {} }));
  expect(page.querySelector('.vc-run-who')!.textContent).toBe('agent');
  expect(page.querySelector('select')).toBeNull();
});
