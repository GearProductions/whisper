// @vitest-environment happy-dom
// SettingsView (settings-view.tsx) : les catégories et le changement, chaque sorte rendue, onSet en quittant le champ
// ou par Entrée (pas à la frappe), onRun, onMic, Échap et un clic dehors : onClose.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { SettingsView as View } from 'technicals/bridge';
import { SettingsView } from '../../settings-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const view: View = { categories: [
  { id: 'dictation', items: [
    { kind: 'choice', key: 'lang', value: 'fr', choices: [['fr', 'Français'], ['en', 'English']] },
    { kind: 'toggle', key: 'sound', value: true },
    { kind: 'text', key: 'vocabulary', value: 'gear', max: 300 },
    { kind: 'mic', value: 'b' },
  ] },
  { id: 'speech', items: [
    { kind: 'number', key: 'speakVolume', value: 0.5 },
    { kind: 'run', key: 'installTts', disabled: true },
    { kind: 'run', key: 'whisperDir', disabled: false },
  ] },
  { id: 'actions', items: [{ kind: 'choice', key: 'model:review', value: 'opus', choices: [['opus', 'Opus']], label: 'Relire' }] },
  { id: 'general', items: [
    { kind: 'info', key: 'version', value: '0.14.0' },
    { kind: 'info', key: 'editor', value: '' },
  ] },
] };

let calls: unknown[] = [];
beforeEach(() => {
  act(() => root.render(null));
  calls = [];
  act(() => root.render(createElement(SettingsView, {
    view, t: t('fr'), mics: [{ deviceId: 'a', label: 'Micro A' }, { deviceId: 'b', label: '' }],
    onSet: (k, v) => calls.push(['set', k, v]), onRun: (c) => calls.push(['run', c]),
    onMic: (id, label) => calls.push(['mic', id, label]), onClose: () => calls.push('close'),
  })));
});
const q = <T extends Element>(sel: string) => page.querySelector<T>(sel)!;
const goTo = (name: string) => act(() => { [...page.querySelectorAll('.vc-set-nav button')].find((b) => b.textContent === name)!.dispatchEvent(new MouseEvent('click', { bubbles: true })); });
const setValue = (el: HTMLInputElement | HTMLSelectElement, v: string) => act(() => {
  Object.getOwnPropertyDescriptor(el.constructor.prototype, 'value')!.set!.call(el, v);
  el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
});
const blur = (el: HTMLElement) => act(() => { el.focus(); el.blur(); });

it('les catégories dans la langue de l\'interface, la première choisie ; changer de catégorie', () => {
  expect([...page.querySelectorAll('.vc-set-nav button')].map((b) => b.textContent)).toEqual(['Dictée', 'Lecture à voix haute', 'Actions', 'Général']);
  expect(q('[data-on]').textContent).toBe('Dictée');
  expect(page.textContent).toContain('Langue de dictée');
  goTo('Actions');
  expect(q('[data-on]').textContent).toBe('Actions');
  expect(page.textContent).not.toContain('Langue de dictée');
});

it('une liste, une case, un champ et un micro (celui sans nom, le choisi) ; changer une liste ou une case écrit', () => {
  expect(q<HTMLSelectElement>('select').value).toBe('fr');
  setValue(q<HTMLSelectElement>('select'), 'en');
  act(() => q('input[type=checkbox]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(calls).toEqual([['set', 'lang', 'en'], ['set', 'sound', false]]);
  const mic = page.querySelectorAll<HTMLSelectElement>('select')[1];
  expect([...mic.options].map((o) => o.textContent)).toEqual(['Micro par défaut du système', 'Micro A', 'Micro sans nom']);
  expect(mic.value).toBe('b');
  setValue(mic, 'a');
  setValue(mic, '');
  expect(calls.slice(2)).toEqual([['mic', 'a', 'Micro A'], ['mic', '', '']]);
});

it('un champ s\'écrit en le quittant ou par Entrée, pas à la frappe, ni sans changement', () => {
  const input = q<HTMLInputElement>('input[type=text]');
  expect(input.value).toBe('gear');
  expect(input.maxLength).toBe(300);
  blur(input);
  setValue(input, 'gear, claude');
  expect(calls).toEqual([]);
  blur(input);
  expect(calls).toEqual([['set', 'vocabulary', 'gear, claude']]);
  act(() => { input.focus(); input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })); });
  expect(calls).toEqual([['set', 'vocabulary', 'gear, claude'], ['set', 'vocabulary', 'gear, claude']]);
});

it('un nombre s\'écrit en le quittant, en nombre ; un champ vidé n\'écrit rien ; un bouton, désactivé ou non', () => {
  goTo('Lecture à voix haute');
  const n = q<HTMLInputElement>('input[type=number]');
  expect(n.value).toBe('0.5');
  setValue(n, '0.8');
  expect(calls).toEqual([]);
  blur(n);
  expect(calls).toEqual([['set', 'speakVolume', 0.8]]);
  setValue(n, '');
  blur(n);
  expect(calls).toHaveLength(1);
  const [off, on] = [...page.querySelectorAll<HTMLButtonElement>('.vc-set-run')];
  expect([off.disabled, on.disabled]).toEqual([true, false]);
  act(() => on.dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(calls.slice(1)).toEqual([['run', 'whisperDir']]);
});

it('le réglage d\'une action : « libellé · Modèle » ; les infos, une vide dit pourquoi', () => {
  goTo('Actions');
  expect(q('.vc-set-row span').textContent).toBe('Relire · Modèle');
  goTo('Général');
  expect([...page.querySelectorAll('.vc-set-row')].map((r) => r.textContent)).toEqual(['Version0.14.0', 'ÉditeurAucun éditeur trouvé']);
});

it('Échap, un clic dehors et la croix ferment ; un clic dedans non', () => {
  act(() => q('.vc-set').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  expect(calls).toEqual(['close']);
  act(() => q('.vc-set').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  expect(calls).toEqual(['close']);
  act(() => q('.vc-set-back').dispatchEvent(new MouseEvent('mousedown', { bubbles: true })));
  act(() => q('.vc-set-close').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  expect(calls).toEqual(['close', 'close', 'close']);
});
