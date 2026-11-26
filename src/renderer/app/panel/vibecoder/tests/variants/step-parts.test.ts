// @vitest-environment happy-dom
// step-parts (step-parts.tsx) : les icônes à la place des caractères — ⏹ d'une course (IconButton stop, même
// rappel StopRun), la conversation qui travaille (direct.elsewhere : le bouton direct reste actif, « via » grisé), l'en-tête
// d'une étape (step.head, jamais facts ; ni champ, ni Joindre, ni micro, ni Envoyer ; aucune rangée d'actions, pour aucun rôle), un bouton sans
// choix de modèle, le dernier résultat d'une action directe (Icon ok / ko), Ouvrir la PR (IconButton external).
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeAction, VibePr } from 'technicals/bridge';
import { PrCard, Run, StepHead, StopRun } from '../../step-parts';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const act_ = act;   // `act` : aussi le nom des rappels du pont dans les cas ci-dessous

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

const head = (step: { id: 'note' | 'forme' | 'invariants'; head?: string; facts?: string }, acts: VibeAction[] = [], flow = 'review') => render(createElement(StepHead, { p: {
  view: { lang: 'fr', flow, actions: acts }, step: { status: 'current', facts: '', ...step }, t: t('fr'), busy: false, act: { run: () => {} },
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

it('relecteur, une étape avec des actions au relevé : aucun bouton d\'action, ni champ ; le badge sans clic ni ✓', async () => {
  for (const id of ['note', 'forme', 'invariants'] as const) {
    const acts = [action({ id: `${id}-a`, label: 'Faire', step: id, usesText: true, primary: true, needs: 'text' }), action({ id: `${id}-b`, label: 'Autre', step: id, usesText: true })];
    await head({ id }, acts);
    expect(page.querySelector('textarea, .vc-step-field, .vc-attach, .vc-mic, .vc-send, .vc-step-acts, .vc-run')).toBeNull();
    expect(page.querySelector('button.vc-badge')).toBeNull();
  }
});

// L'écran de l'essentiel : en créateur, le badge d'état porte le ✓ et se clique pour le retirer ou le rendre.
const create = async (id: 'note' | 'forme' | 'invariants' | 'modules', check: unknown, over: { flow?: string; onSince?: () => void; head?: string; prevOk?: boolean } = {}) => {
  const act = { run: vi.fn(), mark: vi.fn() };
  await render(createElement('i'));   // démonté d'abord : rien ne passe d'un cas au suivant
  await render(createElement(StepHead, { onSince: over.onSince, p: {
    // les étapes d'avant : validées, sauf prevOk false (celle d'avant n'est pas validée)
    view: { lang: 'fr', flow: over.flow ?? 'create', steps: ['note', 'forme', 'invariants', 'modules'].map((s) => ({ id: s, check: { state: over.prevOk === false ? null : 'ok' } })), actions: [action({ id: 'x', step: id, primary: true }), action({ id: 'y', step: id })] },
    step: { id, status: 'done', facts: '', head: over.head ?? '', check }, t: t('fr'), busy: false, act,
  } as unknown as StepProps }));
  return act;
};
const badge = () => page.querySelector<HTMLElement>('.vc-badge')!;

it('créateur, une étape avec des actions au relevé : aucun bouton d\'action', async () => {
  for (const id of ['forme', 'invariants', 'modules'] as const) {
    await create(id, { state: 'ok', now: 'h' });
    expect(page.querySelector('.vc-step-acts, .vc-run')).toBeNull();
  }
});

it('créateur, la Forme validée : « faite ✓ », un clic retire le ✓ de la Forme, rien d\'autre n\'est appelé', async () => {
  for (const id of ['forme', 'invariants', 'modules'] as const) {
    const act = await create(id, { state: 'ok', now: 'h' });
    expect(badge().tagName).toBe('BUTTON');
    expect(badge().textContent).toBe('faite ✓');
    await act_(() => { badge().click(); });
    expect(act.mark.mock.calls).toEqual([[id, null]]);
    expect(act.run).not.toHaveBeenCalled();
  }
});

it('créateur, le ✓ retiré : « faite · ✓ retiré », un clic le rend', async () => {
  const act = await create('forme', { state: null, now: 'h', withdrawn: true });
  expect(badge().textContent).toBe('faite · ✓ retiré');
  await act_(() => { badge().click(); });
  expect(act.mark.mock.calls).toEqual([['forme', 'ok']]);
  expect(act.run).not.toHaveBeenCalled();
});

it('créateur, le ✓ retiré mais l\'étape d\'avant pas validée : « faite · ✓ retiré », sans clic (validateStep refuserait)', async () => {
  const act = await create('modules', { state: null, now: null, withdrawn: true }, { prevOk: false });
  expect(badge().tagName).toBe('SPAN');
  expect(badge().textContent).toBe('faite · ✓ retiré');
  await act_(() => { badge().click(); });
  expect(act.mark).not.toHaveBeenCalled();
});

it('créateur, une étape faite pas validée (jamais, modifiée, à revoir) : le badge sans ✓, pas un bouton', async () => {
  for (const check of [undefined, { state: null, now: 'h' }, { state: 'changed', now: 'n' }, { state: 'cascade', cause: 'note', now: null }]) {
    const act = await create('modules', check);
    expect(badge().tagName).toBe('SPAN');
    expect(badge().textContent).toBe('faite');
    await act_(() => { badge().click(); });
    expect(act.mark).not.toHaveBeenCalled();
    expect(act.run).not.toHaveBeenCalled();
  }
});

it('créateur, la note : le badge sans clic ni ✓, même validée ; un clic ne valide rien', async () => {
  const act = await create('note', { state: 'ok', now: 'h' });
  expect(badge().tagName).toBe('SPAN');
  expect(badge().textContent).toBe('faite');
  await act_(() => { badge().click(); });
  expect(act.mark).not.toHaveBeenCalled();
  expect(act.run).not.toHaveBeenCalled();
});

it('relecteur : le nom de son arrêt (Règles, Essai, Publier), le créateur celui de l\'étape', async () => {
  for (const [flow, names] of [['review', ['Règles', 'Essai', 'Publier']], ['create', ['Invariants', 'Revue', 'PR']]] as const) {
    for (const [i, id] of (['invariants', 'revue', 'pr'] as const).entries()) {
      await render(createElement('i'));
      await render(createElement(StepHead, { p: {
        view: { lang: 'fr', flow, steps: [], actions: [] }, step: { id, status: 'current', facts: '' }, t: t('fr'), busy: false, act: { run: () => {} },
      } as unknown as StepProps }));
      expect(page.querySelector('h2')!.textContent).toBe(names[i]);
    }
  }
});

it('relecteur : son badge sans clic ni ✓, même validé, aucun bouton d\'action', async () => {
  const act = await create('forme', { state: 'ok', now: 'h' }, { flow: 'review' });
  expect(page.querySelector('.vc-step-acts, .vc-run')).toBeNull();
  expect(badge().tagName).toBe('SPAN');
  expect(badge().textContent).toBe('faite');
  await act_(() => { badge().click(); });
  expect(act.mark).not.toHaveBeenCalled();
});

it('créateur, aux Modules : « modifiée depuis la validation » reste un bouton onSince, le badge sans ✓ ; sans onSince, un texte', async () => {
  const since = vi.fn();
  const act = await create('modules', { state: 'changed', now: 'n' }, { onSince: since, head: 'modifiée depuis la validation' });
  expect(badge().tagName).toBe('SPAN');
  await act_(() => { page.querySelector<HTMLButtonElement>('.vc-since')!.click(); });
  expect(since).toHaveBeenCalledOnce();
  expect(act.mark).not.toHaveBeenCalled();
});

const run = (a: Partial<VibeAction>, busy = false) => render(createElement(Run, { a: action(a), busy, onRun: () => {} }));

it('une action par l\'agent : pas de modèle sur le bouton, ni liste de modèle ou d\'effort ; « — sonnet » dans son title', async () => {
  await run({ who: 'sonnet', hint: 'Écrit les modules', models: ['opus', 'sonnet'], model: 'sonnet', efforts: ['low'] });
  expect(page.querySelector('.vc-run-who')).toBeNull();
  expect(page.querySelector('select')).toBeNull();
  expect(page.querySelector('.vc-run')!.textContent).toBe('Commiter');
  expect(page.querySelector<HTMLButtonElement>('.vc-run')!.title).toBe('Écrit les modules\n— sonnet');
});

it('le title : hint, puis « — qui », puis la raison du grisé ; qui absent : sans ; hint vide : sans ligne vide', async () => {
  await run({ who: 'opus · élevé', hint: 'Écrit', disabled: 'rien à faire' });
  expect(page.querySelector<HTMLButtonElement>('.vc-run')!.title).toBe('Écrit\n— opus · élevé\n— rien à faire');
  await run({ who: '', hint: 'Écrit', disabled: 'rien à faire' });
  expect(page.querySelector<HTMLButtonElement>('.vc-run')!.title).toBe('Écrit\n— rien à faire');
  await run({ who: '', hint: 'Écrit' });
  expect(page.querySelector<HTMLButtonElement>('.vc-run')!.title).toBe('Écrit');
  await run({ who: 'sonnet', hint: '' });
  expect(page.querySelector<HTMLButtonElement>('.vc-run')!.title).toBe('— sonnet');
});

it('une action directe : « direct » reste, « via » sans modèle, son title le donne', async () => {
  await run({ who: 'sonnet', hint: 'Fait', direct: { running: false, last: null } });
  expect(page.querySelector('.vc-run .vc-run-who')!.textContent).toBe('direct');
  const via = page.querySelector<HTMLButtonElement>('.vc-via')!;
  expect(via.textContent).toBe('via');
  expect(via.querySelector('.vc-run-who')).toBeNull();
  expect(via.title).toBe('Fait\n— sonnet');
  expect(page.querySelector<HTMLButtonElement>('.vc-run')!.title).toBe('Fait');
});

it('grisé : la raison reste ; en cours : « en cours » et ⏹ restent', async () => {
  await run({ who: 'sonnet', disabled: 'pas de note' });
  expect(page.querySelector('.vc-run-why')!.textContent).toBe('pas de note');
  expect(page.querySelector('.vc-run-who')).toBeNull();
  await render(createElement(StopRun.Provider, { value: { stop: () => {}, state: () => 'running' as const } },
    createElement(Run, { a: action({ who: 'sonnet' }), busy: false, onRun: () => {} })));
  expect(page.querySelector('.vc-run-on')!.textContent).toContain(t('fr').runState.running);
  expect(page.querySelector('.vc-run-on .vc-tool')).not.toBeNull();
  expect(page.querySelector('.vc-run-who')).toBeNull();
});

const checked = async (check: unknown, head: string, onSince?: () => void) => {
  await render(createElement('i'));   // démonté d'abord : rien ne passe d'un cas au suivant
  await render(createElement(StepHead, { onSince, p: {
    view: { lang: 'fr', actions: [] }, step: { id: 'forme', status: 'done', facts: '', head, check },
    t: t('fr'), busy: false, act: { run: () => {} },
  } as unknown as StepProps }));
};

it('check changed : son libellé en bouton à côté du titre, un clic appelle onSince ; sans onSince, un texte', async () => {
  const since = vi.fn();
  await checked({ state: 'changed', now: 'n' }, 'modifiée depuis la validation', since);
  const label = page.querySelector<HTMLButtonElement>('.vc-since')!;
  expect(label.textContent).toBe('modifiée depuis la validation');
  expect(page.textContent?.match(/modifiée depuis la validation/g)).toHaveLength(1);
  await act(() => { label.click(); });
  expect(since).toHaveBeenCalledOnce();
  await checked({ state: 'changed', now: 'n' }, 'modifiée depuis la validation');
  expect(page.querySelector('.vc-since')).toBeNull();
  expect(page.querySelector('.vc-facts')!.textContent).toBe('modifiée depuis la validation');
});

it('check cascade : « à revoir : <étape> a changé » en texte, jamais en bouton', async () => {
  await checked({ state: 'cascade', cause: 'note', now: null }, 'à revoir : la note a changé', () => {});
  expect(page.querySelector('.vc-facts')!.textContent).toBe('à revoir : la note a changé');
  expect(page.querySelector('.vc-since, .vc-stale, .vc-revalidate, .vc-stale-diff')).toBeNull();
});

it('check ok, null ou absent : head comme avant, ni bouton ni Revalider', async () => {
  for (const check of [{ state: 'ok', now: 'n' }, { state: null, now: null }, undefined]) {
    await checked(check, 'trois modules', () => {});
    expect(page.querySelector('.vc-facts')!.textContent).toBe('trois modules');
    expect(page.querySelector('.vc-since, .vc-stale, .vc-revalidate, .vc-stale-diff')).toBeNull();
  }
});
