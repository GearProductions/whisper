// @vitest-environment happy-dom
// ArtifactsView (artifacts-view.tsx) : le choix annoncé (par défaut, au clic, au repli), le texte de l'artefact
// choisi (tronqué, d'un autre id), un média sans bac à sable, Ouvrir et Copier par l'id, la liste vide ; la zone de
// dépôt (data-own-drop, onDrop avec des fichiers seulement), Ajouter (grisé en cours) et la dernière ligne.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it } from 'vitest';
import type { VibeArtifact, VibeCode } from 'technicals/bridge';
import { ArtifactsView, type ArtifactsViewProps as Props } from '../../artifacts-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const art = (id: string, name: string, kind: VibeArtifact['kind'] = 'text', truncated = false): VibeArtifact =>
  ({ id, name, kind, size: 2048, time: 1, url: kind === 'page' || kind === 'media' ? `vibe-artifact://x/${id}?t=1` : null, truncated });

let calls: string[] = [];
beforeEach(() => { calls = []; act(() => root.render(null)); });
const draw = (artifacts: VibeArtifact[], code: VibeCode | null = null, add: Partial<Props> = {}) => act(() => {
  root.render(createElement(ArtifactsView, {
    artifacts, lang: 'fr', code, adding: false, added: null,
    onAdd: () => calls.push('add'), onDrop: (files) => calls.push(`drop ${files.length}`), ...add,
    onChoose: (id) => calls.push(`choose ${id}`), onOpen: (id) => calls.push(`open ${id}`), onCopy: (id) => calls.push(`copy ${id}`),
  }));
});
const button = (text: string) => [...page.querySelectorAll('button')].find((b) => (b.getAttribute('aria-label') || b.textContent)?.startsWith(text))!;

it('le premier choisi par défaut et annoncé, un clic en annonce un autre, une seule fois', async () => {
  await draw([art('a0', 'a.txt'), art('a1', 'b.html', 'page')]);
  expect(calls).toEqual(['choose a0']);
  await act(async () => button('b.html').click());
  await draw([art('a0', 'a.txt'), art('a1', 'b.html', 'page')]);
  expect(calls).toEqual(['choose a0', 'choose a1']);
});

it('le choisi disparu → le premier, annoncé ; un id qui glisse (un ajout avant lui) est annoncé à nouveau', async () => {
  await draw([art('a0', 'a.txt'), art('a1', 'b.txt')]);
  await act(async () => button('b.txt').click());
  await draw([art('a0', '0.txt'), art('a1', 'a.txt'), art('a2', 'b.txt')]);
  expect(calls.at(-1)).toBe('choose a2');
  await draw([art('a0', 'a.txt')]);
  expect(calls.at(-1)).toBe('choose a0');
});

it('le texte : celui de son id seulement, « fichier tronqué » si truncated', async () => {
  await draw([art('a0', 'a.txt')], { id: 'a9', text: 'autre', time: 1 });
  expect(page.querySelector('.vc-src')).toBeNull();
  await draw([art('a0', 'a.txt')], { id: 'a0', text: 'bonjour', time: 1, truncated: true });
  expect(page.querySelector('.vc-src')?.textContent).toContain('bonjour');
  expect(page.textContent).toContain('Fichier tronqué');
});

it('un média dans un cadre sans bac à sable ; Ouvrir et Copier donnent l\'id', async () => {
  await draw([art('a0', 'img.png', 'media')]);
  expect(page.querySelector('iframe')?.getAttribute('src')).toBe('vibe-artifact://x/a0?t=1');
  expect(page.querySelector('iframe')?.hasAttribute('sandbox')).toBe(false);
  expect([button('Ouvrir').title, button('Ouvrir').textContent]).toEqual(['Ouvrir dans l\'éditeur', '']);   // une icône, le libellé en infobulle
  expect(button('Copier').textContent).toBe('Copier dans le projet');   // Copier garde son texte
  button('Ouvrir').click();
  button('Copier').click();
  expect(calls).toEqual(['choose a0', 'open a0', 'copy a0']);
});

it('la liste vide : ce que le skill fait, rien annoncé', async () => {
  await draw([]);
  expect(page.textContent).toContain('Aucun artefact');
  expect(calls).toEqual([]);
});

const drop = (files: File[]) => {
  const e = new Event('drop', { bubbles: true }) as Event & { dataTransfer?: unknown };
  e.dataTransfer = { files };
  act(() => { page.querySelector('[data-own-drop]')!.dispatchEvent(e); });
};

it('la zone de dépôt : data-own-drop, onDrop avec les fichiers déposés, pas sans fichier', async () => {
  await draw([]);
  expect(page.querySelector('[data-own-drop]')?.textContent).toContain('Déposez des fichiers');
  drop([]);
  expect(calls).toEqual([]);
  drop([new File(['x'], 'a.txt'), new File(['y'], 'b.txt')]);
  expect(calls).toEqual(['drop 2']);
});

it('Ajouter appelle onAdd, grisé pendant l\'ajout', async () => {
  await draw([]);
  button('Ajouter').click();
  expect(calls).toEqual(['add']);
  await draw([], null, { adding: true });
  expect(button('Ajouter').disabled).toBe(true);
});

it('la dernière ligne : « … » en cours, rien si vide, l\'échec montré', async () => {
  const res = () => page.querySelector('.vc-direct-res');
  await draw([], null, { added: { ok: true, line: '' } });
  expect(res()).toBeNull();
  await draw([], null, { adding: true, added: { ok: true, line: '2 fichiers ajoutés' } });
  expect(res()?.textContent).toBe('…');
  await draw([], null, { added: { ok: false, line: 'Trop gros' } });
  expect(res()?.getAttribute('data-state')).toBe('ko');
  expect(res()?.textContent).toContain('Trop gros');
  await draw([], null, { added: { ok: true, line: '2 fichiers ajoutés' } });
  expect(res()?.getAttribute('data-state')).toBe('ok');
});
