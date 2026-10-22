// Invariant de l'affichage du code (note 0.11.0,
// docs/tickets/feat/0.11.0-code-des-modules.md, « Ce que ça ne doit pas
// faire ») : le code s'affiche en morceaux de texte, jamais en HTML (I-40) —
// Voir le code d'un module (éditable ou grisé), Code et Voir le fichier de
// l'étape Invariants, tous par CodeView.
// Protégé : si un test échoue, corriger le code.
//
// Le vrai composant, rendu par React en HTML (react-dom/server) : une balise
// écrite dans le code n'y apparaît qu'échappée, en texte.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { CodeView } from 'app/panel/vibecoder';

// Le HTML que produit CodeView pour ce code.
const html = (props: Parameters<typeof CodeView>[0]) => renderToStaticMarkup(createElement(CodeView, props));
// Le texte que montre ce HTML : sans les balises, les caractères échappés rendus.
const textOf = (markup: string) => markup.replace(/<[^>]*>/g, '')
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
// L'édition, ouverte ou grisée.
const edit = (locked: string | null) => ({ locked, onChange: () => {}, onSave: () => {} });

const SCRIPT = "const s = '<script>alert(1)</script>';";
const IMG = 'const v = <img src=x onerror=alert(1) />;';

describe('une balise écrite dans le code reste du texte', () => {
  it('<script> dans une chaîne d’un .ts', () => {
    const markup = html({ code: SCRIPT, path: 'src/a.ts' });

    // aucune balise script produite
    expect(markup).not.toContain('<script');
    // témoin : le code est bien affiché, en texte
    expect(textOf(markup)).toContain(SCRIPT);
  });

  it('<img onerror> dans du JSX d’un .tsx', () => {
    const markup = html({ code: IMG, path: 'src/a.tsx' });

    // aucune balise img produite
    expect(markup).not.toContain('<img');
    // témoin : le code est bien affiché, en texte
    expect(textOf(markup)).toContain(IMG);
  });

  // Une extension que la coloration ne connaît pas : le code tout en texte.
  it('<script> dans un fichier d’un langage inconnu (.html)', () => {
    const markup = html({ code: '<script>alert(1)</script>', path: 'src/a.html' });

    // aucune balise script produite
    expect(markup).not.toContain('<script');
    // témoin : le code est bien affiché, en texte
    expect(textOf(markup)).toContain('<script>alert(1)</script>');
  });
});

describe('de même quand le code est modifiable', () => {
  it('éditable : <script> reste du texte', () => {
    const markup = html({ code: SCRIPT, path: 'src/a.ts', edit: edit(null) });

    // aucune balise script produite
    expect(markup).not.toContain('<script');
    // témoin : le code est bien affiché, en texte
    expect(textOf(markup)).toContain(SCRIPT);
  });

  it('grisé (une course génère le module) : <script> reste du texte', () => {
    const markup = html({ code: SCRIPT, path: 'src/a.ts', edit: edit('Ce module est en cours de génération') });

    // aucune balise script produite
    expect(markup).not.toContain('<script');
    // témoin : le code est bien affiché, en texte
    expect(textOf(markup)).toContain(SCRIPT);
  });

  it('éditable : <img onerror> reste du texte', () => {
    const markup = html({ code: IMG, path: 'src/a.tsx', edit: edit(null) });

    // aucune balise img produite
    expect(markup).not.toContain('<img');
    // témoin : le code est bien affiché, en texte
    expect(textOf(markup)).toContain(IMG);
  });
});
