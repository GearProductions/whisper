// @vitest-environment happy-dom
// Invariant du diff d'un fichier de module (note 0.11.0,
// docs/tickets/feat/0.11.0-stabiliser-vibecoder.md, « Ce que ça ne doit pas
// faire ») : le diff en ligne ou côte à côte, lui aussi, en texte, jamais en
// HTML (I-40) — Voir le code d'un module, depuis la base de la branche ou le
// dernier commit, par ModuleDiffView. Le diff brut de la note, par DiffView :
// diff-view.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Le vrai composant, monté par React (createRoot) dans une page happy-dom, sur
// le texte d'avant et celui d'après : une balise écrite dans une ligne,
// ajoutée, retirée ou gardée, n'y devient aucun élément, dans les deux modes.
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { ModuleDiffView } from 'app/panel/vibecoder';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];
afterEach(() => {
  act(() => { for (const r of roots.splice(0)) r.unmount(); });
  document.body.replaceChildren();
});

// La page où ModuleDiffView est monté sur le diff de `before` à `after` d'un .ts, dans `mode`, une fois affiché.
async function shown(before: string, after: string, mode: 'inline' | 'split') {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => { root.render(createElement(ModuleDiffView, { before, after, path: 'src/a.ts', mode, lang: 'fr' })); });
  return container;
}

const SCRIPT = "const s = '<script>alert(1)</script>';";
const IMG = 'const v = <img src=x onerror=alert(1) />;';

describe('en ligne : une balise écrite dans une ligne du diff reste du texte', () => {
  it('<script> dans une ligne ajoutée', async () => {
    const page = await shown('const a = 1;', `const a = 1;\n${SCRIPT}`, 'inline');

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : la ligne ajoutée est bien affichée, en texte
    expect(page.textContent).toContain(SCRIPT);
  });

  it('<img onerror> dans une ligne retirée', async () => {
    const page = await shown(`const a = 1;\n${IMG}`, 'const a = 1;', 'inline');

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la ligne retirée est bien affichée, en texte
    expect(page.textContent).toContain(IMG);
  });

  // Une ligne inchangée, gardée autour d'un changement.
  it('<script> dans une ligne gardée autour d’un changement', async () => {
    const page = await shown(`${SCRIPT}\nconst a = 1;`, `${SCRIPT}\nconst a = 2;`, 'inline');

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : la ligne gardée est bien affichée, en texte
    expect(page.textContent).toContain(SCRIPT);
  });

  // Un fichier absent à la référence (at.base ou at.head null, passé '') : tout le texte est ajouté.
  it('<img onerror> dans un fichier absent à la référence', async () => {
    const page = await shown('', IMG, 'inline');

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la ligne est bien affichée, en texte
    expect(page.textContent).toContain(IMG);
  });
});

describe('côte à côte : une balise écrite dans une ligne du diff reste du texte', () => {
  it('<script> dans une ligne ajoutée', async () => {
    const page = await shown('const a = 1;', `const a = 1;\n${SCRIPT}`, 'split');

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : la ligne ajoutée est bien affichée, en texte
    expect(page.textContent).toContain(SCRIPT);
  });

  it('<img onerror> dans une ligne retirée', async () => {
    const page = await shown(`const a = 1;\n${IMG}`, 'const a = 1;', 'split');

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la ligne retirée est bien affichée, en texte
    expect(page.textContent).toContain(IMG);
  });

  // Une ligne inchangée, gardée autour d'un changement (affichée des deux côtés).
  it('<script> dans une ligne gardée autour d’un changement', async () => {
    const page = await shown(`${SCRIPT}\nconst a = 1;`, `${SCRIPT}\nconst a = 2;`, 'split');

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : la ligne gardée est bien affichée, en texte
    expect(page.textContent).toContain(SCRIPT);
  });

  // Un fichier absent à la référence (at.base ou at.head null, passé '') : tout le texte est ajouté.
  it('<img onerror> dans un fichier absent à la référence', async () => {
    const page = await shown('', IMG, 'split');

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la ligne est bien affichée, en texte
    expect(page.textContent).toContain(IMG);
  });
});
