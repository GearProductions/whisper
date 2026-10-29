// @vitest-environment happy-dom
// CommitsView (commits-view.tsx) : un fichier d'un commit, cliqué → act.follow(c<rang>/<i>) et ouvert sous sa
// carte, un seul à la fois ; recliqué, fermé ou décalé par un relevé → act.follow(null) ; 💬 d'une ligne → une zone de commentaire,
// la remarque au brouillon sur la cible du commit, le chemin et les lignes citées (quoteRemark). Finitions : Voir le diff,
// GitHub, 💬, fermer → des IconButton (libellé en aria-label) ; les fichiers, une liste sans <details> ni titre.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { expect, it } from 'vitest';
import { quoteRemark, t } from 'core/vibecoder';
import type { VibeCode, VibeView } from 'technicals/bridge';
import { CommitsView } from '../../commits-view';
import type { StepProps } from '../../step-views';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const page = document.createElement('div');
document.body.append(page);
const root = createRoot(page);
const follows: (string | null)[] = [];
const drafts: unknown[] = [];
const commits = [
  { hash: 'aaaaaaa1', subject: 'un', fixup: false, files: ['src/a.ts', 'src/b.ts'] },
  { hash: 'bbbbbbb2', subject: 'deux', fixup: false, files: ['src/c.ts'] },
];
const draw = (code: VibeCode | null, cs = commits) => act(() => {
  const view = { lang: 'fr', flow: 'review', actions: [], outputs: {}, pr: null, commits: cs, draft: [] } as unknown as VibeView;
  const props = { view, step: { id: 'commits', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
    code, drafts: [{}, () => {}], act: { run: async () => true, follow: (id: string | null) => { follows.push(id); }, mark: () => {}, prefill: () => {},
      draft: (op: unknown) => { drafts.push(op); }, open: () => {}, openLink: () => {}, save: async () => true } } as unknown as StepProps;
  root.render(createElement(CommitsView, props));
});
// Un bouton par son texte, ou par son libellé (aria-label) pour un IconButton.
const click = (text: string) => act(() => {
  ([...page.querySelectorAll('button')].find((b) => b.textContent === text || b.getAttribute('aria-label') === text) as HTMLButtonElement).click();
});

it('cliqué : suivi et ouvert sous sa carte, un seul ; recliqué ou fermé : follow(null)', async () => {
  await draw(null);
  await click('src/b.ts');
  expect(follows).toEqual(['c0/1']);
  await draw({ id: 'c0/1', text: 'b', time: 0 });
  expect(page.querySelectorAll('.vc-commit-file')).toHaveLength(1);
  await click('src/c.ts');
  expect(follows.at(-1)).toBe('c1/0');
  expect(page.querySelectorAll('.vc-commit-file')).toHaveLength(1);
  expect(page.querySelector('.vc-commit-file-head')!.textContent).toContain('src/c.ts');
  await click('src/c.ts');
  expect(follows.at(-1)).toBeNull();
  expect(page.querySelector('.vc-commit-file')).toBeNull();
  await click('src/a.ts');
  await click(t('fr').close);
  expect(follows.slice(-2)).toEqual(['c0/0', null]);
  expect(page.querySelector('.vc-commit-file')).toBeNull();
});

it('un relevé qui change les commits : l\'id ne désigne plus ce fichier, fermé', async () => {
  await draw(null);
  await click('src/b.ts');
  await draw({ id: 'c0/1', text: 'b', time: 0 }, [{ ...commits[0], hash: 'ccccccc3', files: ['src/a.ts', 'src/d.ts'] }]);
  expect(follows.at(-1)).toBeNull();
  expect(page.querySelector('.vc-commit-file')).toBeNull();
});

it('💬 d\'une ligne : une zone de commentaire, la remarque au brouillon sur la cible du commit', async () => {
  await draw(null);
  await click('src/a.ts');
  await draw({ id: 'c0/0', text: 'x = 1\ny = 2', time: 0 });
  const view = EditorView.findFromDOM(page.querySelector('.vc-commit-file .cm-editor') as HTMLElement)!;
  await act(() => { view.dispatch({ selection: { anchor: 0, head: 5 } }); });
  await act(() => { (page.querySelector('.vc-commit-file .vc-src-tools button') as HTMLButtonElement).click(); });
  const box = page.querySelector('.vc-commit-file textarea') as HTMLTextAreaElement;
  expect(box).not.toBeNull();
  await act(() => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!.call(box, 'pourquoi ?');
    box.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await click('Ajouter au brouillon');
  expect(drafts.at(-1)).toEqual({ add: quoteRemark('aaaaaaa un', 'src/a.ts', 'x = 1', 'pourquoi ?') });
  expect(page.querySelector('.vc-commit-file textarea')).toBeNull();
});

it('finitions : liens et 💬 en IconButton, les fichiers en liste compacte', async () => {
  const opened: string[] = [];
  await act(() => {
    const view = { lang: 'fr', flow: 'review', actions: [], outputs: {}, pr: null, commits, draft: [] } as unknown as VibeView;
    const props = { view, step: { id: 'commits', status: 'current', facts: '', open: true }, t: t('fr'), busy: false, text: '', setText: () => {},
      code: null, drafts: [{}, () => {}], act: { run: async () => true, follow: () => {}, mark: () => {}, prefill: () => {}, draft: () => {},
        open: (id: string) => { opened.push(id); }, openLink: () => {}, save: async () => true } } as unknown as StepProps;
    root.render(createElement(CommitsView, props));
  });
  const tr = t('fr');
  await click(tr.diffTitle);
  await click(tr.githubTitle);
  expect(opened).toEqual(['c0', 'gh:c0']);
  const card = page.querySelector('.vc-commit-review')!;
  for (const label of [tr.diffTitle, tr.githubTitle, 'Une remarque sur ce commit, au brouillon de revue']) {
    const b = card.querySelector(`button[aria-label="${label}"]`)!;
    expect(b.className).toBe('vc-tool');
    expect(b.getAttribute('title')).toBe(label);
    expect(b.querySelector('svg')).not.toBeNull();
  }
  expect(page.querySelector('details')).toBeNull();
  expect(page.textContent).not.toMatch(/💬|✕|↗|2 fichiers/);
  const list = card.querySelector('ul.vc-commit-files')!;
  expect(list.getAttribute('aria-label')).toBe(tr.files(2));
  expect([...list.querySelectorAll('li')].map((li) => li.textContent)).toEqual(['src/a.ts', 'src/b.ts']);
  await click('Une remarque sur ce commit, au brouillon de revue');
  expect(card.querySelector('button[aria-label="Une remarque sur ce commit, au brouillon de revue"]')!.getAttribute('aria-pressed')).toBe('true');
  expect(card.querySelector('textarea')).not.toBeNull();
});
