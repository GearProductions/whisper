// @vitest-environment happy-dom
// Invariant de l'affichage du texte d'un fichier ou d'un test, et de son diff
// (note 0.13.0, docs/tickets/feat/0.13.0-ameliorations-interface.md, « Ce que
// ça ne doit pas faire ») : rendre en HTML le texte d'un fichier ou d'un test,
// ni dans son diff (I-40) — le diff entier d'un test d'invariant (ModuleDiffView
// whole, sans repli autour des changements) et le fichier d'un commit en Relire
// (CommitFile : Fichier, Diff de ce commit, Diff depuis la base de la PR). Le
// diff replié : module-diff-view.test.ts ; CodeView : code-view.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Les vrais composants, montés par React (createRoot) dans une page happy-dom :
// une balise écrite dans une ligne n'y devient aucun élément, elle reste du
// texte.
import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import { CommitFile, ModuleDiffView } from 'app/panel/vibecoder';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];
afterEach(() => {
  act(() => { for (const r of roots.splice(0)) r.unmount(); });
  document.body.replaceChildren();
});

// La page où `element` est monté, une fois affiché.
async function shown(element: ReturnType<typeof createElement>) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => { root.render(element); });
  return container;
}

// Le diff entier de `before` à `after` d'un test .ts, dans `mode`.
const wholeDiff = (before: string, after: string, mode: 'inline' | 'split') =>
  shown(createElement(ModuleDiffView, { before, after, path: 'src/a/tests/invariants/a.test.ts', mode, lang: 'fr', whole: true }));

// Le fichier d'un commit, ses versions : à la tête de la PR (head), à la base de la PR, au parent du commit et au commit.
const commitFile = (v: { head: string; base: string; before: string; after: string }) =>
  shown(createElement(CommitFile, {
    file: { id: 'c0/0', path: 'src/a.tsx' },
    code: { id: 'c0/0', text: v.head, time: 0, at: { base: v.base, head: v.head, commit: { before: v.before, after: v.after } } },
    lang: 'fr', t: t('fr'), onQuote: () => {},
  }));

// Choisir, dans le sélecteur de la page, l'option qui porte ce libellé (celui de la note).
async function pick(page: HTMLElement, label: string) {
  const option = [...page.querySelectorAll('option')].find((o) => o.textContent === label);
  if (!option) throw new Error(`aucune option « ${label} »`);
  const select = option.closest('select')!;
  await act(async () => {
    select.value = option.value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

const SCRIPT = "const s = '<script>alert(1)</script>';";
const IMG = 'const v = <img src=x onerror=alert(1) />;';
// Dix lignes inchangées : un repli autour des changements les cacherait.
const FAR = Array.from({ length: 10 }, (_, i) => `const k${i} = ${i};`).join('\n');

describe('le diff entier d’un test : une balise écrite dans une ligne reste du texte', () => {
  // La ligne loin du changement, qu'un repli cacherait : affichée, en texte.
  it('en ligne, <script> dans une ligne inchangée loin du changement', async () => {
    const page = await wholeDiff(`${SCRIPT}\n${FAR}\nconst a = 1;`, `${SCRIPT}\n${FAR}\nconst a = 2;`, 'inline');

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : la ligne loin du changement est bien affichée, en texte
    expect(page.textContent).toContain(SCRIPT);
  });

  it('côte à côte, <img onerror> dans une ligne inchangée loin du changement', async () => {
    const page = await wholeDiff(`${IMG}\n${FAR}\nconst a = 1;`, `${IMG}\n${FAR}\nconst a = 2;`, 'split');

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la ligne loin du changement est bien affichée, en texte
    expect(page.textContent).toContain(IMG);
  });

  it('en ligne, <img onerror> dans une ligne modifiée', async () => {
    const page = await wholeDiff(`${FAR}\nconst a = 1;`, `${FAR}\n${IMG}`, 'inline');

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la ligne modifiée est bien affichée, en texte
    expect(page.textContent).toContain(IMG);
  });
});

describe('le fichier d’un commit en Relire : une balise écrite dans son texte ou son diff reste du texte', () => {
  it('Fichier : <img onerror> dans son texte à la tête de la PR', async () => {
    const page = await commitFile({ head: IMG, base: '', before: '', after: IMG });

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : le texte est bien affiché, en texte
    expect(page.textContent).toContain(IMG);
  });

  it('Diff de ce commit : <script> dans une ligne que le commit ajoute', async () => {
    const page = await commitFile({ head: 'const a = 1;', base: '', before: 'const a = 1;', after: `const a = 1;\n${SCRIPT}` });

    await pick(page, 'Diff de ce commit');

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : la ligne ajoutée par le commit est bien affichée, en texte
    expect(page.textContent).toContain(SCRIPT);
  });

  it('Diff depuis la base de la PR : <img onerror> dans une ligne que la PR retire', async () => {
    const page = await commitFile({ head: 'const a = 1;', base: `const a = 1;\n${IMG}`, before: '', after: 'const a = 1;' });

    await pick(page, 'Diff depuis la base de la PR');

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la ligne retirée par la PR est bien affichée, en texte
    expect(page.textContent).toContain(IMG);
  });
});
