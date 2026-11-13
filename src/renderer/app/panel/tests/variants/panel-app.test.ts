// @vitest-environment happy-dom
// PanelApp (panel-app.tsx), la dictée : insérée dans la zone de texte qui a le clavier (son onChange
// suit), rien au-delà de sa longueur ; aucune zone, un <input> ou un éditeur CodeMirror : au champ
// de la conversation (le micro donne le clavier à son champ à l'appui : la zone le reprend avant la fin
// de la transcription) ; le trombone : son choix va au champ qui l'a ouvert, sinon à la conversation.
import { EditorView } from '@codemirror/view';
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it, vi } from 'vitest';
import { DRAFT_MAX } from 'core/vibecoder';
import type { ConvApi } from 'technicals/bridge';
import { PanelApp } from '../../panel-app';

// Le micro et le bip : un flux et un enregistrement factices, assez longs et forts pour être transcrits.
vi.mock('technicals/audio', async (orig) => ({
  ...(await orig<typeof import('technicals/audio')>()),
  openMic: async () => ({ getTracks: () => [] }),
  record: () => ({ chunks: [new Float32Array(16000).fill(0.5)], length: 16000, peak: 0.5, release() {} }),
  beep: () => {},
}));

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// Le pont : chaque on…(cb) retient son rappel ; le reste ne fait rien.
const on: Record<string, (v: unknown) => void> = {};
const own: Record<string, unknown> = {}; // les méthodes qu'un test remplace
const conv = new Proxy({}, {
  get: (_, k: string) => k in own ? own[k] : (cb: (v: unknown) => void) => { if (k.startsWith('on')) on[k] = cb; return Promise.resolve(null); },
}) as unknown as ConvApi;

// happy-dom n'a pas execCommand : insérer à la place de la sélection, comme Chromium.
const inserted: string[] = [];
document.execCommand = (_cmd: string, _ui?: boolean, text = '') => {
  const f = document.activeElement as HTMLTextAreaElement;
  inserted.push(text);
  f.setRangeText(text, f.selectionStart, f.selectionEnd, 'end');
  f.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
};

const page = document.body.appendChild(document.createElement('div'));
await act(() => { createRoot(page).render(createElement(PanelApp, { conv })); });
// VibeCoder, seul écran : la conversation de a1 et son relevé arrivent, le champ est monté.
await act(() => {
  on.onThread({ key: 'a1', live: true, name: 'A', color: '#fff', title: 't', status: 'idle', messages: [] });
  on.onVibe({ lang: 'fr', agentId: 'a1', steps: [], actions: [], runs: [], processes: [], commits: [], agent: {}, time: 0, flow: 'create', repo: { branch: 'master', base: 'master', changed: 0 } });
});
const input = page.querySelector<HTMLTextAreaElement>('#message')!;
// Une dictée de bout en bout : le micro (#mic) maintenu puis relâché, whisper rend `text`.
const dictate = async (text: string, keyboard?: HTMLElement) => {
  own.getConfig = () => Promise.resolve({});
  own.transcribe = () => Promise.resolve({ ok: true, text });
  const mic = page.querySelector('#mic')!;
  await act(async () => { mic.dispatchEvent(new Event('pointerdown', { bubbles: true })); });
  keyboard?.focus();
  await act(async () => { mic.dispatchEvent(new Event('pointerup', { bubbles: true })); });
};
const area = (value = '', maxLength?: number) => {
  const f = document.body.appendChild(document.createElement('textarea'));
  f.value = value;
  if (maxLength !== undefined) f.maxLength = maxLength;
  f.focus();
  f.setSelectionRange(value.length, value.length);
  return f;
};

it('aucune zone de texte n\'a le clavier : la dictée va au champ de la conversation', async () => {
  (document.activeElement as HTMLElement | null)?.blur();
  await dictate('bonjour');
  expect(input.value).toBe('bonjour');
});

it('une zone de texte a le clavier : la dictée s\'y insère, son onChange suit', async () => {
  const f = area('Salut');
  let changed = '';
  f.addEventListener('input', () => { changed = f.value; });
  await dictate('toi', f);
  expect(f.value).toBe('Salut toi');
  expect(changed).toBe('Salut toi');
  expect(input.value).toBe('bonjour');
  f.remove();
});

it('une zone de commentaire à sa limite : rien au-delà de DRAFT_MAX, rien perdu ailleurs', async () => {
  const f = area('x'.repeat(DRAFT_MAX), DRAFT_MAX);
  inserted.length = 0;
  await dictate('encore', f);
  expect(inserted).toEqual([]);
  expect(f.value).toHaveLength(DRAFT_MAX);
  expect(input.value).toBe('bonjour');
  f.value = 'x'.repeat(DRAFT_MAX - 3);
  f.setSelectionRange(f.value.length, f.value.length);
  await dictate('encore', f);
  expect(f.value).toHaveLength(DRAFT_MAX);
  f.remove();
});

it('un <input> ou un éditeur CodeMirror a le clavier : la dictée va au champ de la conversation', async () => {
  const one = document.body.appendChild(document.createElement('input'));
  one.focus();
  expect(document.activeElement).toBe(one);
  await dictate('un', one);
  expect(one.value).toBe('');
  const cm = new EditorView({ doc: 'note', parent: document.body.appendChild(document.createElement('div')) });
  cm.contentDOM.focus();
  expect(document.activeElement).toBe(cm.contentDOM);
  await dictate('deux', cm.contentDOM);
  expect(cm.state.doc.toString()).toBe('note');
  expect(input.value).toBe('bonjour un deux');
});

// Le dépôt sur la page : un fichier extérieur rejoint la conversation (le pont lit son chemin),
// sauf sous [data-own-drop] ; un glisser interne de l'arborescence (aucun File) ne joint rien.
const dropOn = (target: Element, files: File[]) => act(async () => {
  const e = new Event('drop', { bubbles: true, cancelable: true });
  Object.defineProperty(e, 'dataTransfer', { value: { files } });
  target.dispatchEvent(e);
});

it('un fichier lâché hors de l\'arborescence est joint ; sous [data-own-drop] ou en glisser interne, rien', async () => {
  const asked: File[] = [];
  own.pathFor = (f: File) => { asked.push(f); return `/tmp/${f.name}`; };
  await act(() => {
    on.onThread({ key: 'a1', live: true, name: 'A', color: '#fff', title: 't', status: 'idle', messages: [] });
  });
  const tree = page.appendChild(document.createElement('div'));
  tree.setAttribute('data-own-drop', '');
  const row = tree.appendChild(document.createElement('span'));
  const file = new File(['x'], 'a.md');

  await dropOn(row, [file]);
  expect(asked).toEqual([]);
  await dropOn(row, []);   // un artefact glissé dans l'arborescence
  await dropOn(document.body, []);   // le même, lâché hors de l'arborescence
  expect(asked).toEqual([]);
  await dropOn(document.body, [file]);
  expect(asked).toEqual([file]);
  tree.remove();
});

it('la conversation d\'un autre agent avant son relevé : l\'écran d\'avant reste (pas de page vide), rien ne plante', async () => {
  await act(() => { on.onThread({ key: 'a2', live: true, name: 'B', color: '#fff', title: 't', status: 'idle', messages: [] }); });
  expect(page.querySelector('.vc')).not.toBeNull();
  await act(() => { (on.onFocusInput as () => void)(); });   // le focus du champ, demandé avant que l'écran soit là
});

// Le trombone : le choix du dialogue va au champ qui l'a ouvert (le dernier 📎 cliqué : le questionnaire), sinon à la conversation.
it('le trombone du questionnaire : son choix va à ce champ, pas à la conversation ; celui de la conversation, à la conversation', async () => {
  const attached: string[] = [];
  own.attach = () => { attached.push('attach'); };
  const act1 = { id: 'note', step: 'note', label: 'Écrire la note', hint: '', who: 'agent', models: [], model: null, kind: 'send', needs: 'text', usesText: true, primary: true, disabled: null, hidden: false };
  await act(() => {
    on.onThread({ key: 'a1', live: true, name: 'A', color: '#fff', title: 't', status: 'idle', messages: [] });
    on.onVibe({ lang: 'fr', agentId: 'a1', steps: [{ id: 'note', status: 'current' }], actions: [act1], runs: [], processes: [], commits: [], agent: {}, time: 0, flow: 'create',
      outputs: {}, files: [], questions: [{ n: 1, text: 'Quoi ?', options: ['a'] }], invariants: [], artifacts: [], modules: [], repo: { branch: 'master', base: 'master', changed: 0 } });
  });
  const pieces = (sel: string) => [...page.querySelectorAll(`${sel} .piece`)].map((p) => p.textContent ?? '');
  await act(() => { page.querySelector<HTMLButtonElement>('.vc-q .vc-attach')!.click(); });
  await act(() => { (on.onAttached as (v: unknown) => void)({ files: ['/p/reponse.md'] }); });
  expect(attached).toEqual(['attach']);
  expect(pieces('.vc-q')).toHaveLength(1);
  expect(pieces('#composer').join()).not.toContain('reponse.md');
  await act(() => { page.querySelector<HTMLButtonElement>('#attach')!.click(); });
  await act(() => { (on.onAttached as (v: unknown) => void)({ files: ['/p/conv.md'] }); });
  expect(pieces('.vc-q')).toHaveLength(1);
  expect(pieces('#composer').join()).toContain('conv.md');
  expect(pieces('.vc-q').join()).not.toContain('conv.md');
});

// Les actions qui prennent la demande dans le champ de la conversation (takesConversation : Rédiger la note,
// Nouvelle demande) : le texte et les pièces jointes du champ partent, le champ se vide ; vide : on le demande.
// Poser la forme et Écrire les invariants partent sans texte, le brouillon reste.
const action = (a: object) => ({ id: 'x', step: null, label: 'X', hint: '', who: 'agent', models: [], model: null, kind: 'send', needs: 'none', usesText: false, primary: false, disabled: null, hidden: false, ...a });
const actions = [
  action({ id: 'note', step: 'note', label: 'Rédiger la note', needs: 'text', usesText: true, primary: true }),
  action({ id: 'forme', step: 'forme', label: 'Poser la forme', usesText: true }),
  action({ id: 'invariants', step: 'invariants', label: 'Écrire les invariants (rouges)', usesText: true }),
  action({ id: 'new-request', label: 'Nouvelle demande', needs: 'text', usesText: true }),
];
const showStep = (step: string, branch = 'feat/x') => act(() => {
  on.onVibe({ lang: 'fr', agentId: 'a1', steps: [{ id: step, status: 'current' }], actions, runs: [], processes: [], commits: [], agent: {}, time: 0, flow: 'create',
    outputs: {}, files: [], questions: [], invariants: [], artifacts: [], modules: [], repo: { branch, base: 'master', changed: 0 } });
});
const click = (label: string) => act(async () => {
  [...page.querySelectorAll<HTMLButtonElement>('.vc-step .vc-run')].find((b) => b.textContent?.includes(label))!.click();
});
const type = (value: string) => act(() => {
  Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const NEED = 'Dictez ou écrivez d\'abord votre demande dans le champ, puis cliquez.';
const composerPieces = () => page.querySelectorAll('#composer .piece').length;
const attachPiece = (path: string) => act(async () => { (on.onAttached as (v: unknown) => void)({ files: [path] }); });
const run = vi.fn(async (..._a: unknown[]) => ({ ok: true }));
own.vibeRun = run;
const clearAll = async () => { while (page.querySelector<HTMLButtonElement>('#composer .piece .remove')) await act(async () => { page.querySelector<HTMLButtonElement>('#composer .piece .remove')!.click(); }); await type(''); run.mockClear(); };

it('Rédiger la note, un texte et une pièce jointe dans le champ : les deux partent, le champ se vide', async () => {
  await showStep('note');
  await clearAll();
  await type('une demande');
  await attachPiece('/p/a.md');
  await click('Rédiger la note');
  expect(run).toHaveBeenCalledWith('note', { text: 'une demande', pieces: { images: [], files: ['/p/a.md'], selection: '' } });
  expect(input.value).toBe('');
  expect(composerPieces()).toBe(0);
});

it('Rédiger la note, champ vide : « Dictez ou écrivez d\'abord… », le champ a le clavier, rien ne part', async () => {
  await showStep('note');
  await clearAll();
  await attachPiece('/p/b.md');   // des pièces sans texte ne suffisent pas
  (document.activeElement as HTMLElement | null)?.blur();
  await click('Rédiger la note');
  expect(run).not.toHaveBeenCalled();
  expect(page.textContent).toContain(NEED);
  expect(document.activeElement).toBe(input);
  expect(composerPieces()).toBe(1);
});

// Sur la branche principale, le même bouton lance la nouvelle demande (le principal redirige 'note' vers new-request) :
// la page envoie la même chose.
it('sur la branche principale : de même, le bouton Rédiger la note emporte le champ et ses pièces', async () => {
  await showStep('note', 'master');
  await clearAll();
  (document.activeElement as HTMLElement | null)?.blur();
  await click('Rédiger la note');
  expect(run).not.toHaveBeenCalled();
  expect(page.textContent).toContain(NEED);
  expect(document.activeElement).toBe(input);
  await type('autre chose');
  await attachPiece('/p/c.md');
  await click('Rédiger la note');
  expect(run).toHaveBeenCalledWith('note', { text: 'autre chose', pieces: { images: [], files: ['/p/c.md'], selection: '' } });
  expect(input.value).toBe('');
  expect(composerPieces()).toBe(0);
});

it('Poser la forme, Écrire les invariants, un brouillon dans le champ : partent sans texte, le brouillon reste', async () => {
  await clearAll();
  await type('un brouillon');
  for (const [step, id, label] of [['forme', 'forme', 'Poser la forme'], ['invariants', 'invariants', 'Écrire les invariants (rouges)']]) {
    await showStep(step);
    await click(label);
    expect(run).toHaveBeenLastCalledWith(id, {});
    expect(input.value).toBe('un brouillon');
  }
});
