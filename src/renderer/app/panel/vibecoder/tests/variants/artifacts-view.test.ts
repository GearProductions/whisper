// @vitest-environment happy-dom
// ArtifactsView (artifacts-view.tsx) : le choix annoncé (par défaut, au clic, quand l'id glisse), le texte de
// l'artefact choisi, un média sans bac à sable, Ouvrir et Copier dans le projet (onRun, par ids), la liste vide ;
// l'arborescence (dossiers pliés, Tout replier), le centre vide pour un dossier ou plusieurs éléments, la saisie
// (renommer, nouveau, problème de nom, dossier caché refusé), la suppression (toujours confirmée, noms envoyés
// avec les ids), le déplacement, le dépôt de fichiers (id du dossier lu à ce moment) et la sélection qui suit le
// nom attendu.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it } from 'vitest';
import type { VibeArgs, VibeArtifact, VibeArtifactDir, VibeCode } from 'technicals/bridge';
import { ArtifactsView, type ArtifactsViewProps as Props } from '../../artifacts-view';
import { TREE_MIME } from '../../artifact-tree-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const art = (id: string, name: string, kind: VibeArtifact['kind'] = 'text', truncated = false): VibeArtifact =>
  ({ id, name, kind, size: 2048, time: 1, url: kind === 'page' || kind === 'media' ? `vibe-artifact://x/${id}?t=1` : null, truncated });
const dir = (id: string, name: string): VibeArtifactDir => ({ id, name });

let calls: string[] = [];
let runs: { action: string; args: VibeArgs }[] = [];
beforeEach(() => { calls = []; runs = []; act(() => root.render(null)); });
const draw = (artifacts: VibeArtifact[], code: VibeCode | null = null, dirs: VibeArtifactDir[] = [], add: Partial<Props> = {}) => act(() => {
  root.render(createElement(ArtifactsView, {
    artifacts, artifactDirs: dirs, lang: 'fr', code,
    onDrop: (files, folder) => calls.push(`drop ${files.length} ${folder ?? '-'}`),
    onRun: (action, args) => runs.push({ action, args }),
    onChoose: (id) => calls.push(`choose ${id}`), onOpen: (id) => calls.push(`open ${id}`), ...add,
  }));
});
const row = (key: string) => [...page.querySelectorAll<HTMLElement>('.vc-tree-row')].find((r) => r.dataset.key === key)!;
const keys = () => [...page.querySelectorAll<HTMLElement>('.vc-tree-row')].map((r) => r.dataset.key);
const button = (text: string) => [...page.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.textContent)?.startsWith(text))!;
const click = (el: Element, init: MouseEventInit = {}) => act(() => { el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, ...init })); });
const press = (key: string) => act(() => { page.querySelector('.vc-tree')!.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true })); });
const menuAt = (el: Element) => act(() => { el.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, cancelable: true, clientX: 5, clientY: 5 })); });
const entry = (label: string) => [...page.querySelectorAll<HTMLButtonElement>('[role=menuitem]')].find((b) => b.textContent === label)!;
const heading = () => page.querySelector('.vc-art-head h2')?.textContent ?? null;
const type = (value: string) => act(() => {
  const input = page.querySelector('input')!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const enter = () => act(() => { page.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); });
const fire = (el: Element, type: string, props: object) => act(() => {
  const e = new Event(type, { bubbles: true, cancelable: true });
  Object.assign(e, props);
  el.dispatchEvent(e);
});

it('le premier choisi par défaut et annoncé, un clic en annonce un autre, une seule fois', async () => {
  await draw([art('a0', 'a.txt'), art('a1', 'b.html', 'page')]);
  expect(calls).toEqual(['choose a0']);
  await click(row('b.html'));
  await draw([art('a0', 'a.txt'), art('a1', 'b.html', 'page')]);
  expect(calls).toEqual(['choose a0', 'choose a1']);
});

it('un id qui glisse (un ajout avant lui) est annoncé à nouveau ; le choisi disparu : le centre reste vide', async () => {
  await draw([art('a0', 'a.txt'), art('a1', 'b.txt')]);
  await click(row('b.txt'));
  await draw([art('a0', '0.txt'), art('a1', 'a.txt'), art('a2', 'b.txt')]);
  expect(calls.at(-1)).toBe('choose a2');
  expect(heading()).toBe('b.txt');
  await draw([art('a0', 'a.txt')]);
  expect(heading()).toBeNull();
});

it('le texte : celui de son id seulement, « fichier tronqué » si truncated', async () => {
  await draw([art('a0', 'a.txt')], { id: 'a9', text: 'autre', time: 1 });
  expect(page.querySelector('.vc-src')).toBeNull();
  await draw([art('a0', 'a.txt')], { id: 'a0', text: 'bonjour', time: 1, truncated: true });
  expect(page.querySelector('.vc-src')?.textContent).toContain('bonjour');
  expect(page.textContent).toContain('Fichier tronqué');
});

it('un média dans un cadre sans bac à sable ; Ouvrir donne l\'id, Copier dans le projet passe par onRun avec les ids de la sélection', async () => {
  await draw([art('a0', 'img.png', 'media')]);
  expect(page.querySelector('iframe')?.getAttribute('src')).toBe('vibe-artifact://x/a0?t=1');
  expect(page.querySelector('iframe')?.hasAttribute('sandbox')).toBe(false);
  expect([button('Ouvrir').title, button('Ouvrir').textContent]).toEqual(['Ouvrir dans l\'éditeur', '']);
  expect(button('Copier').textContent).toBe('Copier dans le projet');
  button('Ouvrir').click();
  button('Copier').click();
  expect(calls).toEqual(['choose a0', 'open a0']);
  expect(runs).toEqual([{ action: 'copy-artifact', args: { direct: true, artifacts: ['a0'] } }]);
});

it('la liste vide : ce que le skill fait, rien annoncé, plus de zone de dépôt séparée ni d\'Ajouter', async () => {
  await draw([]);
  expect(page.textContent).toContain('Aucun artefact');
  expect(page.textContent).not.toContain('Ajouter');
  expect(page.querySelectorAll('[data-own-drop]')).toHaveLength(1);   // l'arborescence elle-même
  expect(calls).toEqual([]);
});

it('les dossiers sont pliés au départ ; le chevron déplie ; Tout replier les referme', async () => {
  await draw([art('a0', 'doc/x.md', 'markdown'), art('a1', 'z.txt')], null, [dir('d0', 'doc')]);
  expect(keys()).toEqual(['doc', 'z.txt']);
  await click(row('doc').querySelector('.vc-tree-chevron')!);
  expect(keys()).toEqual(['doc', 'doc/x.md', 'z.txt']);
  await click(button('Tout replier'));
  expect(keys()).toEqual(['doc', 'z.txt']);
});

it('un dossier ou plusieurs éléments sélectionnés : le centre reste vide', async () => {
  await draw([art('a0', 'a.txt'), art('a1', 'b.txt')], null, [dir('d0', 'doc')]);
  expect(heading()).toBe('a.txt');
  await click(row('doc'));
  expect(heading()).toBeNull();
  await click(row('a.txt'));
  expect(heading()).toBe('a.txt');
  await click(row('b.txt'), { ctrlKey: true });
  expect(heading()).toBeNull();
  await click(button('Copier'));
  expect(runs).toEqual([{ action: 'copy-artifact', args: { direct: true, artifacts: ['a0', 'a1'] } }]);
});

it('Renommer (F2) : le nom tapé part avec l\'id, et l\'artefact au centre suit le nouveau nom', async () => {
  const before = [art('a0', 'a.txt'), art('a1', 'b.txt')];
  await draw(before);
  await click(row('a.txt'));
  await press('F2');
  await type('c.txt');
  await enter();
  expect(runs).toEqual([{ action: 'rename-artifact', args: { direct: true, artifacts: ['a0'], name: 'c.txt' } }]);
  await draw([art('a0', 'b.txt'), art('a1', 'c.txt')]);   // le relevé suivant : les ids ont glissé
  expect(heading()).toBe('c.txt');
});

it('un renommage refusé par le principal : sa ligne sous l\'arborescence, et la sélection n\'attend plus le nom', async () => {
  const files = [art('a0', 'a.txt'), art('a1', 'b.txt')];
  await draw(files);
  await click(row('a.txt'));
  await press('F2');
  await type('c.txt');
  await enter();
  const refused = { running: false, last: { ok: false, line: 'Refused: "c.txt" already exists.', detail: '', time: 5 } };
  await draw(files, null, [], { result: refused });
  expect(page.querySelector('.vc-art-result')?.textContent).toContain('Refused: "c.txt" already exists.');
  await draw([art('a0', 'a.txt'), art('a1', 'b.txt'), art('a2', 'z.txt')], null, [], { result: refused });
  expect(heading()).toBe('a.txt');   // toujours choisi : la sélection suit le relevé, sans attendre c.txt
  await draw(files, null, [], { result: { running: true, last: null } });
  expect(page.querySelector('.vc-art-result')?.textContent).toBe('…');
});

it('un nom impossible : encart rouge avec la raison, Entrée n\'envoie rien ; un dossier caché est refusé', async () => {
  await draw([art('a0', 'a.txt'), art('a1', 'b.txt')]);
  await click(row('a.txt'));
  await press('F2');
  await type('b.txt');
  expect(page.querySelector('input')!.getAttribute('aria-invalid')).toBe('true');
  expect(page.querySelector('.vc-rename-problem')!.textContent).toBe('Ce nom est déjà pris.');
  await enter();
  expect(runs).toEqual([]);
  await act(async () => { page.querySelector('input')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })); });
  expect(page.querySelector('input')).toBeNull();
  await menuAt(page.querySelector('.vc-tree')!);
  await click(entry('Nouveau dossier'));
  await type('.cache');
  expect(page.querySelector('.vc-rename-problem')!.textContent).toContain('caché');
  await enter();
  expect(runs).toEqual([]);
});

it('Nouveau fichier dans un dossier : id du dossier et nom seul ; à la racine : sans dossier', async () => {
  await draw([art('a0', 'a.txt')], null, [dir('d0', 'doc')]);
  await menuAt(row('doc'));
  await click(entry('Nouveau fichier'));
  await type('n.md');
  await enter();
  await menuAt(page.querySelector('.vc-tree')!);
  await click(entry('Nouveau dossier'));
  await type('sous');
  await enter();
  expect(runs).toEqual([
    { action: 'new-artifact-file', args: { direct: true, name: 'n.md', folder: 'd0' } },
    { action: 'new-artifact-folder', args: { direct: true, name: 'sous' } },
  ]);
});

it('Supprimer demande toujours confirmation : Suppr, le menu ; annuler n\'envoie rien ; confirmer envoie les ids et les noms confirmés', async () => {
  await draw([art('a0', 'a.txt'), art('a1', 'b.txt')]);
  await click(row('b.txt'));
  await press('Delete');
  expect(page.querySelector('[role=alertdialog]')).not.toBeNull();
  expect(runs).toEqual([]);
  await click(button('Annuler'));
  expect(page.querySelector('[role=alertdialog]')).toBeNull();
  await menuAt(row('b.txt'));
  await click(entry('Supprimer'));
  expect(page.querySelector('[role=alertdialog]')).not.toBeNull();
  expect(runs).toEqual([]);
  await draw([art('a0', 'z.txt'), art('a1', 'a.txt'), art('a2', 'b.txt')]);   // un robot a écrit : les ids ont glissé
  await click([...page.querySelectorAll('.vc-confirm-foot button')].at(-1)!);
  expect(runs).toEqual([{ action: 'trash-artifacts', args: { direct: true, artifacts: ['a2'], names: ['b.txt'] } }]);
});

it('supprimer une sélection : une confirmation pour tout, noms et ids dans le même ordre', async () => {
  await draw([art('a0', 'a.txt'), art('a1', 'doc/x.md'), art('a2', 'z.txt')], null, [dir('d0', 'doc')]);
  await click(row('doc'));
  await click(row('z.txt'), { ctrlKey: true });
  await press('Delete');
  expect(page.querySelector('.vc-confirm-msg')!.textContent).toContain('2 éléments');
  await click([...page.querySelectorAll('.vc-confirm-foot button')].at(-1)!);
  expect(runs).toEqual([{ action: 'trash-artifacts', args: { direct: true, artifacts: ['d0', 'a2'], names: ['doc', 'z.txt'] } }]);
});

it('Couper puis Coller dans un dossier : move-artifacts avec les ids', async () => {
  await draw([art('a0', 'a.txt'), art('a1', 'doc/x.md', 'markdown')], null, [dir('d0', 'doc')]);
  await click(row('a.txt'));
  await menuAt(row('a.txt'));
  await click(entry('Couper'));
  await menuAt(row('doc'));
  await click(entry('Coller'));
  expect(runs).toEqual([{ action: 'move-artifacts', args: { direct: true, artifacts: ['a0'], folder: 'd0' } }]);
});

it('glisser une ligne sur un dossier : move-artifacts, jamais onDrop ; l\'artefact affiché le reste sous son nouveau nom', async () => {
  await draw([art('a0', 'a.txt')], null, [dir('d0', 'doc')]);
  const store = new Map<string, string>();
  const data = { types: [] as string[], files: [], dropEffect: '', effectAllowed: '', setData: (k: string, v: string) => { store.set(k, v); }, getData: (k: string) => store.get(k) ?? '' };
  await fire(row('a.txt'), 'dragstart', { dataTransfer: data });
  await fire(row('doc'), 'drop', { dataTransfer: { ...data, types: [TREE_MIME] } });
  expect(runs).toEqual([{ action: 'move-artifacts', args: { direct: true, artifacts: ['a0'], folder: 'd0' } }]);
  expect(calls.filter((c) => c.startsWith('drop'))).toEqual([]);
  await draw([art('a0', 'doc/a.txt')], null, [dir('d0', 'doc')]);   // le relevé suivant : le fichier affiché a changé de nom
  expect(heading()).toBe('doc/a.txt');
});

it('des fichiers déposés : onDrop avec l\'id d<i> du dossier visé, sans id à la racine', async () => {
  await draw([art('a0', 'a.txt')], null, [dir('d0', 'doc')]);
  const files = [new File(['x'], 'a.txt'), new File(['y'], 'b.txt')];
  await fire(row('doc'), 'drop', { dataTransfer: { types: ['Files'], files } });
  await fire(page.querySelector('.vc-tree')!, 'drop', { dataTransfer: { types: ['Files'], files } });
  await fire(page.querySelector('.vc-tree')!, 'drop', { dataTransfer: { types: ['Files'], files: [] } });
  expect(calls).toEqual(['choose a0', 'drop 2 d0', 'drop 2 -']);
});

it('Dupliquer : duplicate-artifacts avec les ids', async () => {
  await draw([art('a0', 'a.txt')]);
  await menuAt(row('a.txt'));
  await click(entry('Dupliquer'));
  expect(runs).toEqual([{ action: 'duplicate-artifacts', args: { direct: true, artifacts: ['a0'] } }]);
});
