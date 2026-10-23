// @vitest-environment happy-dom
// Invariant de l'affichage du code (note 0.11.0,
// docs/tickets/feat/0.11.0-code-des-modules.md, « Ce que ça ne doit pas
// faire ») : le code s'affiche en morceaux de texte, jamais en HTML (I-40) —
// Voir le code d'un module (éditable ou grisé), Code et Voir le fichier de
// l'étape Invariants, tous par CodeView.
// Adapté par la note 0.11.0 (docs/tickets/feat/0.11.0-editer-invariants-et-note.md,
// accord donné) : CodeView passe à CodeMirror, qui ne dessine rien dans un
// rendu react-dom/server ; il est donc monté dans une page simulée, mêmes cas,
// même propriété observée sur l'affichage réel.
// Protégé : si un test échoue, corriger le code.
//
// Le vrai composant, monté par React (createRoot) dans une page happy-dom : une
// balise écrite dans le code n'y devient aucun élément, elle reste du texte.
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CodeView } from 'app/panel/vibecoder';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];
afterEach(() => {
  act(() => { for (const r of roots.splice(0)) r.unmount(); });
  document.body.replaceChildren();
});

// La page où CodeView est monté, une fois affiché.
async function shown(props: Parameters<typeof CodeView>[0]) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => { root.render(createElement(CodeView, props)); });
  return container;
}
// L'édition, ouverte ou grisée.
const edit = (locked: string | null) => ({ locked, onChange: () => {}, onSave: () => {} });

const SCRIPT = "const s = '<script>alert(1)</script>';";
const IMG = 'const v = <img src=x onerror=alert(1) />;';

describe('une balise écrite dans le code reste du texte', () => {
  it('<script> dans une chaîne d’un .ts', async () => {
    const page = await shown({ code: SCRIPT, path: 'src/a.ts' });

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : le code est bien affiché, en texte
    expect(page.textContent).toContain(SCRIPT);
  });

  it('<img onerror> dans du JSX d’un .tsx', async () => {
    const page = await shown({ code: IMG, path: 'src/a.tsx' });

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : le code est bien affiché, en texte
    expect(page.textContent).toContain(IMG);
  });

  // Une extension que la coloration ne connaît pas : le code tout en texte.
  it('<script> dans un fichier d’un langage inconnu (.html)', async () => {
    const page = await shown({ code: '<script>alert(1)</script>', path: 'src/a.html' });

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : le code est bien affiché, en texte
    expect(page.textContent).toContain('<script>alert(1)</script>');
  });
});

describe('de même quand le code est modifiable', () => {
  it('éditable : <script> reste du texte', async () => {
    const page = await shown({ code: SCRIPT, path: 'src/a.ts', edit: edit(null) });

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : le code est bien affiché, en texte
    expect(page.textContent).toContain(SCRIPT);
  });

  it('grisé (une course génère le module) : <script> reste du texte', async () => {
    const page = await shown({ code: SCRIPT, path: 'src/a.ts', edit: edit('Ce module est en cours de génération') });

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : le code est bien affiché, en texte
    expect(page.textContent).toContain(SCRIPT);
  });

  it('éditable : <img onerror> reste du texte', async () => {
    const page = await shown({ code: IMG, path: 'src/a.tsx', edit: edit(null) });

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : le code est bien affiché, en texte
    expect(page.textContent).toContain(IMG);
  });
});
