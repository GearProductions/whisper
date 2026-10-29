// @vitest-environment happy-dom
// ArtifactsView (artifacts-view.tsx) : le choix annoncé (par défaut, au clic, au repli), le texte de l'artefact
// choisi (tronqué, d'un autre id), un média sans bac à sable, Ouvrir et Copier par l'id, la liste vide.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { beforeEach, expect, it } from 'vitest';
import type { VibeArtifact, VibeCode } from 'technicals/bridge';
import { ArtifactsView } from '../../artifacts-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const art = (id: string, name: string, kind: VibeArtifact['kind'] = 'text', truncated = false): VibeArtifact =>
  ({ id, name, kind, size: 2048, time: 1, url: kind === 'page' || kind === 'media' ? `vibe-artifact://x/${id}?t=1` : null, truncated });

let calls: string[] = [];
beforeEach(() => { calls = []; act(() => root.render(null)); });
const draw = (artifacts: VibeArtifact[], code: VibeCode | null = null) => act(() => {
  root.render(createElement(ArtifactsView, {
    artifacts, lang: 'fr', code,
    onChoose: (id) => calls.push(`choose ${id}`), onOpen: (id) => calls.push(`open ${id}`), onCopy: (id) => calls.push(`copy ${id}`),
  }));
});
const button = (text: string) => [...page.querySelectorAll('button')].find((b) => b.textContent?.startsWith(text))!;

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
  button('Ouvrir').click();
  button('Copier').click();
  expect(calls).toEqual(['choose a0', 'open a0', 'copy a0']);
});

it('la liste vide : ce que le skill fait, rien annoncé', async () => {
  await draw([]);
  expect(page.textContent).toContain('Aucun artefact');
  expect(calls).toEqual([]);
});
