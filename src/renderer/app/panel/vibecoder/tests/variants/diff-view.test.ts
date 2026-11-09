// @vitest-environment happy-dom
// DiffView (diff-view.tsx), sur le diff que la page calcule (lineDiff, appelé tel quel) : une balise
// écrite dans une ligne, ajoutée, retirée ou gardée, n'y devient aucun élément (I-40 : le rendu
// HTML, lui, reste protégé avec CodeView ; la règle de structure interdit toute insertion de HTML).
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { lineDiff } from 'core/vibecoder';
import { DiffView } from '../../diff-view';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

// La page où DiffView est monté sur le diff de `before` à `after`, une fois affiché.
async function shown(before: string, after: string) {
  const container = document.createElement('div');
  document.body.append(container);
  await act(async () => { createRoot(container).render(createElement(DiffView, { diff: lineDiff(before, after), lang: 'fr' })); });
  return container;
}

const SCRIPT = "const s = '<script>alert(1)</script>';";
const IMG = 'const v = <img src=x onerror=alert(1) />;';

it('<script> dans une ligne ajoutée', async () => {
  const page = await shown('const a = 1;', `const a = 1;\n${SCRIPT}`);

  // aucun élément script produit
  expect(page.querySelector('script')).toBeNull();
  // témoin : la ligne ajoutée est bien affichée, en texte
  expect(page.textContent).toContain(SCRIPT);
});

it('<img onerror> dans une ligne retirée', async () => {
  const page = await shown(`const a = 1;\n${IMG}`, 'const a = 1;');

  // aucun élément img produit
  expect(page.querySelector('img')).toBeNull();
  // témoin : la ligne retirée est bien affichée, en texte
  expect(page.textContent).toContain(IMG);
});

// Une ligne inchangée, gardée autour d'un changement.
it('<script> dans une ligne gardée autour d’un changement', async () => {
  const page = await shown(`${SCRIPT}\nconst a = 1;`, `${SCRIPT}\nconst a = 2;`);

  // aucun élément script produit
  expect(page.querySelector('script')).toBeNull();
  // témoin : la ligne gardée est bien affichée, en texte
  expect(page.textContent).toContain(SCRIPT);
});

// Un fichier absent à la référence (at.base ou at.head null) : tout le texte est ajouté.
it('<img onerror> dans un fichier absent à la référence', async () => {
  const page = await shown('', IMG);

  // aucun élément img produit
  expect(page.querySelector('img')).toBeNull();
  // témoin : la ligne est bien affichée, en texte
  expect(page.textContent).toContain(IMG);
});
