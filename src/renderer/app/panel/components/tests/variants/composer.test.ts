// @vitest-environment happy-dom
// Variant du champ (note 0.13.0, « Épurer encore ») : la pièce jointe et Envoyer
// en icônes gardent leur nom (aria-label, title), leur rappel, l'état désactivé
// et Entrée.
import { act, createElement, createRef } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { Composer } from 'app/panel/components';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

async function shown(busy: boolean) {
  const calls: string[] = [];
  const page = document.body.appendChild(document.createElement('div'));
  await act(async () => {
    createRoot(page).render(createElement(Composer, {
      draft: { text: 'salut', pieces: [] }, setText() {}, removePiece() {}, live: true, name: 'Agent', busy, sending: false,
      status: '', setStatus() {}, dir: '/d', commands: new Map(), probe: async () => ({ commands: [] }),
      onSend: () => calls.push('send'), onAttach: () => calls.push('attach'), onFiles() {}, onLayout() {},
      ref: createRef<HTMLElement>(), input: createRef<HTMLTextAreaElement>(),
    }));
  });
  return { page, calls };
}

it('les deux icônes : nommées, leurs rappels, Entrée envoie, désactivé pendant le travail', async () => {
  const { page, calls } = await shown(false);
  const attach = page.querySelector<HTMLButtonElement>('#attach')!;
  const send = page.querySelector<HTMLButtonElement>('#send')!;
  expect([attach.getAttribute('aria-label'), send.getAttribute('aria-label')]).toEqual(['Joindre…', 'Envoyer']);
  expect(attach.title && send.title).toBeTruthy();
  expect(page.querySelector('#composer-row')!.firstElementChild).toBe(attach);
  expect(page.querySelector('#composer-row')!.lastElementChild).toBe(send);
  attach.click();
  send.click();
  page.querySelector('#message')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  expect(calls).toEqual(['attach', 'send', 'send']);
  expect(send.disabled).toBe(false);
  expect((await shown(true)).page.querySelector<HTMLButtonElement>('#send')!.disabled).toBe(true);
});

// Variant du « @ » (note 0.13.0, sujet 8) : la liste s'ouvre sur un mot qui commence
// par « @ », Entrée choisit, mais pas au milieu d'un mot, ni sans correspondance,
// et les commandes « / » restent à elles.
async function typed(text: string, artifacts?: { id: string; name: string }[], artifactsDir = '/art') {
  const texts: string[] = [];
  const calls: string[] = [];
  const page = document.body.appendChild(document.createElement('div'));
  const input = createRef<HTMLTextAreaElement>();
  await act(async () => {
    createRoot(page).render(createElement(Composer, {
      draft: { text: text.slice(0, -1), pieces: [] }, setText: (t: string) => texts.push(t), removePiece() {}, live: true, name: 'Agent', busy: false, sending: false,
      status: '', setStatus() {}, dir: '/d', commands: new Map([['/d', [{ name: 'help', description: '' }]]]), probe: async () => ({ commands: [] }),
      onSend: () => calls.push('send'), onAttach() {}, onFiles() {}, onLayout() {},
      ref: createRef<HTMLElement>(), input, artifacts, artifactsDir,
    } as never));
  });
  const el = input.current!;
  // Dernière lettre tapée : React ne voit un changement que si la valeur diffère de celle qu'il connaît.
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(el, text);
  el.setSelectionRange(text.length, text.length);
  await act(async () => { el.dispatchEvent(new Event('input', { bubbles: true })); });
  const before = { mention: page.querySelector('.mention .slash-item')?.textContent, mentionOpen: !!page.querySelector('.mention'), slashOpen: !page.querySelector('#slash')!.hasAttribute('hidden') };
  const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  await act(async () => { el.dispatchEvent(enter); });
  return { before, texts, calls, enter };
}
const ARTS = [{ id: '1', name: 'plan.pdf' }, { id: '2', name: 'maquette.png' }];

it('« @ » : la liste s\'ouvre, Entrée choisit et n\'envoie pas', async () => {
  const r = await typed('voir @pl', ARTS);
  expect(r.before.mention).toBe('plan.pdf');
  expect(r.texts.at(-1)).toBe('voir /art/plan.pdf ');
  expect(r.calls).toEqual([]);
});

it('« @ » : rien ne correspond, au milieu d\'un mot, sans dossier ou sans props : Entrée envoie', async () => {
  for (const r of [await typed('@types/node', ARTS), await typed('a@pl', ARTS), await typed('@pl', ARTS, ''), await typed('@pl')]) {
    expect(r.before.mentionOpen).toBe(false);
    expect(r.calls).toEqual(['send']);
  }
});

it('« / » : les commandes gardent la main, pas de liste d\'artefacts', async () => {
  const r = await typed('/he', ARTS);
  expect(r.before).toMatchObject({ slashOpen: true, mentionOpen: false });
});
