// @vitest-environment happy-dom
// Invariant du diff d'un fichier (note 0.11.0,
// docs/tickets/feat/0.11.0-stabiliser-vibecoder.md, « Ce que ça ne doit pas
// faire ») : le diff s'affiche en morceaux de texte, jamais en HTML (I-40) —
// le diff brut de la note, par DiffView. Le diff d'un fichier de module (en
// ligne ou côte à côte, ModuleDiffView) : module-diff-view.test.ts. Le code
// sans diff : code-view.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Le vrai composant, monté par React (createRoot) dans une page happy-dom, sur
// le diff que la page calcule (lineDiff, appelé tel quel) : une balise écrite
// dans une ligne, ajoutée, retirée ou gardée, n'y devient aucun élément.
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { DiffView } from 'app/panel/vibecoder';
import { lineDiff } from 'core/vibecoder';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];
afterEach(() => {
  act(() => { for (const r of roots.splice(0)) r.unmount(); });
  document.body.replaceChildren();
});

// La page où DiffView est monté sur le diff de `before` à `after`, une fois affiché.
async function shown(before: string, after: string) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => { root.render(createElement(DiffView, { diff: lineDiff(before, after), lang: 'fr' })); });
  return container;
}

const SCRIPT = "const s = '<script>alert(1)</script>';";
const IMG = 'const v = <img src=x onerror=alert(1) />;';

describe('une balise écrite dans une ligne du diff reste du texte', () => {
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
});
