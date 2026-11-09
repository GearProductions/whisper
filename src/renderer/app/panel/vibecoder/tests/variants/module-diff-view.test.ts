// @vitest-environment happy-dom
// ModuleDiffView (module-diff-view.tsx) : en lecture seule dans les deux modes ; recréé
// quand une prop change ; replié autour des changements, « N lignes inchangées » d'après lang,
// sauf avec whole ; une balise écrite dans une ligne (ajoutée, retirée, gardée, d'un fichier absent à
// la référence) reste du texte, dans les deux modes.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { ModuleDiffView } from '../../module-diff-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

function mount() {
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  const render = (props: Parameters<typeof ModuleDiffView>[0]) => act(() => { root.render(createElement(ModuleDiffView, props)); });
  const views = () => [...page.querySelectorAll('.cm-editor')].map((e) => EditorView.findFromDOM(e as HTMLElement)!);
  return { page, render, views };
}

const lines = (n: number, last: string) => [...Array.from({ length: n }, (_, i) => `l${i}`), last].join('\n');

it('en lecture seule, en ligne comme côte à côte', async () => {
  const v = mount();
  await v.render({ before: 'a', after: 'b', path: 'src/a.ts', mode: 'inline', lang: 'fr' });
  expect(v.views()).toHaveLength(1);
  await v.render({ before: 'a', after: 'b', path: 'src/a.ts', mode: 'split', lang: 'fr' });
  expect(v.views()).toHaveLength(2);
  for (const view of v.views()) {
    expect(view.state.readOnly).toBe(true);
    expect(view.contentDOM.contentEditable).toBe('false');
  }
});

it('recréé quand le texte change', async () => {
  const v = mount();
  await v.render({ before: 'a', after: 'b', path: 'src/a.ts', mode: 'inline', lang: 'fr' });
  await v.render({ before: 'a', after: 'c', path: 'src/a.ts', mode: 'inline', lang: 'fr' });
  expect(v.views().map((x) => x.state.doc.toString())).toEqual(['c']);
});

it('les lignes inchangées repliées, le libellé d’après lang', async () => {
  const v = mount();
  await v.render({ before: lines(20, 'x'), after: lines(20, 'y'), path: 'src/a.ts', mode: 'inline', lang: 'fr' });
  expect(v.page.querySelector('.cm-collapsedLines')?.textContent).toMatch(/^\d+ lignes inchangées$/);
  await v.render({ before: lines(20, 'x'), after: lines(20, 'y'), path: 'src/a.ts', mode: 'split', lang: 'en' });
  expect(v.page.querySelector('.cm-collapsedLines')?.textContent).toMatch(/^\d+ unchanged lines$/);
});

it('whole : rien de replié, en ligne comme côte à côte', async () => {
  const v = mount();
  await v.render({ before: lines(20, 'x'), after: lines(20, 'y'), path: 'src/a.ts', mode: 'inline', lang: 'fr', whole: true });
  expect(v.page.querySelector('.cm-collapsedLines')).toBeNull();
  await v.render({ before: lines(20, 'x'), after: lines(20, 'y'), path: 'src/a.ts', mode: 'split', lang: 'fr', whole: true });
  expect(v.page.querySelector('.cm-collapsedLines')).toBeNull();
  expect(v.views()).toHaveLength(2);
});

const SCRIPT = "const s = '<script>alert(1)</script>';";
const IMG = 'const v = <img src=x onerror=alert(1) />;';

// La page où ModuleDiffView est monté sur le diff de `before` à `after` d'un .ts, dans `mode`, une fois affiché.
async function shown(before: string, after: string, mode: 'inline' | 'split') {
  const v = mount();
  await v.render({ before, after, path: 'src/a.ts', mode, lang: 'fr' });
  return v.page;
}

for (const [mode, label] of [['inline', 'en ligne'], ['split', 'côte à côte']] as const) {
  describe(`${label} : une balise écrite dans une ligne du diff reste du texte`, () => {
    it('<script> dans une ligne ajoutée', async () => {
      const page = await shown('const a = 1;', `const a = 1;\n${SCRIPT}`, mode);

      // aucun élément script produit
      expect(page.querySelector('script')).toBeNull();
      // témoin : la ligne ajoutée est bien affichée, en texte
      expect(page.textContent).toContain(SCRIPT);
    });

    it('<img onerror> dans une ligne retirée', async () => {
      const page = await shown(`const a = 1;\n${IMG}`, 'const a = 1;', mode);

      // aucun élément img produit
      expect(page.querySelector('img')).toBeNull();
      // témoin : la ligne retirée est bien affichée, en texte
      expect(page.textContent).toContain(IMG);
    });

    // Une ligne inchangée, gardée autour d'un changement.
    it('<script> dans une ligne gardée autour d’un changement', async () => {
      const page = await shown(`${SCRIPT}\nconst a = 1;`, `${SCRIPT}\nconst a = 2;`, mode);

      // aucun élément script produit
      expect(page.querySelector('script')).toBeNull();
      // témoin : la ligne gardée est bien affichée, en texte
      expect(page.textContent).toContain(SCRIPT);
    });

    // Un fichier absent à la référence (at.base ou at.head null, passé '') : tout le texte est ajouté.
    it('<img onerror> dans un fichier absent à la référence', async () => {
      const page = await shown('', IMG, mode);

      // aucun élément img produit
      expect(page.querySelector('img')).toBeNull();
      // témoin : la ligne est bien affichée, en texte
      expect(page.textContent).toContain(IMG);
    });
  });
}
