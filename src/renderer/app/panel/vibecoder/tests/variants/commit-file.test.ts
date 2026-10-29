// @vitest-environment happy-dom
// CommitFile (commit-file.tsx) : en lecture seule (pas d'éditeur modifiable, pas d'Enregistrer), 💬 seul →
// onQuote(block) ; le texte d'un autre id ignoré ; text null : « absent… » ; sans at, pas de sélecteur.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { VibeCode } from 'technicals/bridge';
import { CommitFile } from '../../commit-file';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const file = { id: 'c0/0', path: 'src/a.ts' };
const at = { base: '', head: 'a\nb', commit: { before: '', after: 'a\nb' } };

async function mount(code: VibeCode | null, quoted: string[] = []) {
  const page = document.createElement('div');
  document.body.append(page);
  await act(async () => {
    createRoot(page).render(createElement(CommitFile, { file, code, lang: 'fr', t: t('fr'), onQuote: (b) => { quoted.push(b); } }));
  });
  return page;
}

it('Fichier : en lecture seule, sans Enregistrer ; 💬 seul → onQuote(block)', async () => {
  const quoted: string[] = [];
  const page = await mount({ id: 'c0/0', text: 'a\nb', time: 0, at }, quoted);
  const view = EditorView.findFromDOM(page.querySelector('.cm-editor') as HTMLElement)!;
  expect(view.state.readOnly).toBe(true);
  expect([...page.querySelectorAll('button')].map((b) => b.textContent)).not.toContain('Enregistrer');
  expect(page.querySelectorAll('.vc-src-tools button')).toHaveLength(1);
  await act(() => { view.dispatch({ selection: { anchor: 0, head: 1 } }); });
  await act(() => { (page.querySelector('.vc-src-tools button') as HTMLButtonElement).click(); });
  expect(quoted).toHaveLength(1);
  expect(quoted[0]).toContain('a');
});

it('le texte poussé pour un autre id : rien ; text null : absent ou trop gros ; sans at : pas de sélecteur', async () => {
  const other = await mount({ id: 'c0/1', text: 'x', time: 0, at });
  expect(other.querySelector('.cm-editor')).toBeNull();
  expect(other.querySelector('select')).toBeNull();
  const none = await mount({ id: 'c0/0', text: null, time: 0 });
  expect(none.textContent).toBe('Absent à la tête de la PR, ou trop gros.');
});
