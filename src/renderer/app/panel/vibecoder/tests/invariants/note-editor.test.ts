// @vitest-environment happy-dom
// Invariant de la note et du code modifiables (note 0.11.0,
// docs/tickets/feat/0.11.0-editer-invariants-et-note.md, « Ce que ça ne doit
// pas faire ») : la note en édition et le code se mettent en forme sans HTML ;
// une balise tapée ou écrite dans le fichier reste du texte (I-40) — la note
// (NoteEditor, ses pastilles), son Brut et les tests d'invariants modifiables
// (CodeView en edit). Ce qui est écrit dans le fichier, sans frappe :
// code-view.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Les vrais composants, montés par React (createRoot) dans une page happy-dom ;
// une frappe : le texte ajouté dans la ligne affichée, que l'éditeur relève
// comme le ferait le navigateur. Ce que la page affiche : le conteneur.
import { act, createElement, useState, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';
import { CodeView, NoteEditor } from 'app/panel/vibecoder';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const roots: Root[] = [];
afterEach(() => {
  act(() => { for (const r of roots.splice(0)) r.unmount(); });
  document.body.replaceChildren();
});

// La page où l'élément est monté, une fois affiché.
async function shown(el: ReactNode) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push(root);
  await act(async () => { root.render(el); });
  return container;
}

type NoteProps = Parameters<typeof NoteEditor>[0];
// La note éditable, sans pastille ni liseré, aucun rappel observé.
const note = (text: string, over: Partial<NoteProps> = {}) => createElement(NoteEditor, {
  text, locked: null, tags: [], onChange: () => {}, onSave: () => {}, onOpenLink: () => {}, ...over,
});

// La note éditable telle que note-view la tient : chaque modification lui revient en texte ;
// `typed` relève les textes reçus par onChange.
function NoteHost({ initial, typed }: { initial: string; typed: string[] }) {
  const [text, setText] = useState(initial);
  return note(text, { onChange: (t) => { typed.push(t); setText(t); } });
}

// Un test d'invariant modifiable tel que invariants-view le tient (CodeView en edit).
function CodeHost({ initial, path, typed }: { initial: string; path: string; typed: string[] }) {
  const [code, setCode] = useState(initial);
  return createElement(CodeView, { code, path, edit: { locked: null, onChange: (t) => { typed.push(t); setCode(t); }, onSave: () => {} } });
}

// Une frappe à la fin de la dernière ligne affichée par l'éditeur (CodeMirror relève le changement du DOM),
// dans son texte, pas dans un widget (💬, pastille : contenteditable=false).
async function type(page: HTMLElement, text: string) {
  const line = [...page.querySelectorAll('.cm-line')].at(-1);
  const walker = line && document.createTreeWalker(line, NodeFilter.SHOW_TEXT);
  let last: Text | null = null;
  while (walker?.nextNode()) {
    if (!walker.currentNode.parentElement?.closest('[contenteditable="false"]')) last = walker.currentNode as Text;
  }
  if (!last) throw new Error('aucune ligne de l’éditeur où taper');
  await act(async () => {
    last!.data += text;
    await new Promise((r) => setTimeout(r, 100));
  });
}

const SCRIPT = '<script>alert(1)</script>';
const IMG = '<img src=x onerror=alert(1)>';

describe('la note éditable : une balise écrite dans le fichier reste du texte', () => {
  it('<script> dans un paragraphe', async () => {
    const page = await shown(note(`# Titre\n\nUn paragraphe ${SCRIPT} fin.\n`));

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : la balise est affichée, en texte
    expect(page.textContent).toContain(SCRIPT);
  });

  it('<img onerror> dans un titre', async () => {
    const page = await shown(note(`## Titre ${IMG}\n`));

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la balise est affichée, en texte
    expect(page.textContent).toContain(IMG);
  });

  it('<img onerror> dans un élément de liste', async () => {
    const page = await shown(note(`- un élément ${IMG}\n- un autre\n`));

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la balise est affichée, en texte
    expect(page.textContent).toContain(IMG);
  });

  it('<script> dans du code en ligne', async () => {
    const page = await shown(note(`Du code \`${SCRIPT}\` en ligne.\n`));

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : la balise est affichée, en texte
    expect(page.textContent).toContain(SCRIPT);
  });

  it('<img onerror> dans un bloc de code', async () => {
    const page = await shown(note(`\`\`\`html\n${IMG}\n\`\`\`\n`));

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la balise est affichée, en texte
    expect(page.textContent).toContain(IMG);
  });

  // Markdown reconnaît un bloc HTML : il n'est pas rendu pour autant.
  it('un bloc HTML seul sur sa ligne', async () => {
    const page = await shown(note(`Avant.\n\n<div>${IMG}</div>\n\nAprès.\n`));

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la balise est affichée, en texte
    expect(page.textContent).toContain(IMG);
  });

  it('<img onerror> dans le texte d’un lien', async () => {
    const page = await shown(note(`Voir [${IMG}](https://exemple.fr).\n`));

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la balise est affichée, en texte
    expect(page.textContent).toContain(IMG);
  });

  // Une pastille porte un texte venu de la note (une marque de « Ce que ça ne doit pas faire »).
  it('<img onerror> dans le texte d’une pastille', async () => {
    const page = await shown(note('## Ce que ça ne doit pas faire\n\n- rien\n', {
      tags: [{ line: 3, text: IMG, title: IMG, cls: 'vc-tag' }],
    }));

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : le texte de la pastille est affiché, en texte
    expect(page.textContent).toContain(IMG);
  });

  it('grisée (un tour en cours) : <script> reste du texte', async () => {
    const page = await shown(note(`Un paragraphe ${SCRIPT}.\n`, { locked: 'Un tour de la conversation est en cours' }));

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : la balise est affichée, en texte
    expect(page.textContent).toContain(SCRIPT);
  });
});

describe('la note éditable : une balise tapée reste du texte', () => {
  it('<img onerror> tapé à la fin de la note', async () => {
    const typed: string[] = [];
    const page = await shown(createElement(NoteHost, { initial: '# Titre\n\nfin', typed }));

    await type(page, ` ${IMG}`);

    // témoin : l'éditeur a bien reçu la frappe
    expect(typed.at(-1)).toContain(IMG);
    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la balise tapée est affichée, en texte
    expect(page.textContent).toContain(IMG);
  });

  it('<script> tapé à la fin de la note', async () => {
    const typed: string[] = [];
    const page = await shown(createElement(NoteHost, { initial: '# Titre\n\nfin', typed }));

    await type(page, ` ${SCRIPT}`);

    // témoin : l'éditeur a bien reçu la frappe
    expect(typed.at(-1)).toContain(SCRIPT);
    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : la balise tapée est affichée, en texte
    expect(page.textContent).toContain(SCRIPT);
  });
});

describe('le Markdown de la note (Brut) et les tests modifiables : une balise reste du texte', () => {
  it('Brut : <script> écrit dans la note', async () => {
    const page = await shown(createElement(CodeView, {
      code: `# Titre\n\n${SCRIPT}\n`, path: 'docs/tickets/feat/x.md', edit: { locked: null, onChange: () => {}, onSave: () => {} },
    }));

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : la balise est affichée, en texte
    expect(page.textContent).toContain(SCRIPT);
  });

  it('Brut : <img onerror> tapé dans la note', async () => {
    const typed: string[] = [];
    const page = await shown(createElement(CodeHost, { initial: '# Titre\n\nfin', path: 'docs/tickets/feat/x.md', typed }));

    await type(page, ` ${IMG}`);

    // témoin : l'éditeur a bien reçu la frappe
    expect(typed.at(-1)).toContain(IMG);
    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la balise tapée est affichée, en texte
    expect(page.textContent).toContain(IMG);
  });

  it('un test d’invariant modifiable : <img onerror> tapé dans du JSX', async () => {
    const typed: string[] = [];
    const page = await shown(createElement(CodeHost, { initial: "it('cas', () => {});\nconst v = 1;", path: 'src/a/tests/invariants/a.test.tsx', typed }));

    await type(page, ` const w = ${IMG};`);

    // témoin : l'éditeur a bien reçu la frappe
    expect(typed.at(-1)).toContain(IMG);
    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la balise tapée est affichée, en texte
    expect(page.textContent).toContain(IMG);
  });

  it('un test d’invariant modifiable : <script> tapé dans une chaîne', async () => {
    const typed: string[] = [];
    const page = await shown(createElement(CodeHost, { initial: "it('cas', () => {});\nconst v = 1;", path: 'src/a/tests/invariants/a.test.ts', typed }));

    await type(page, ` const s = '${SCRIPT}';`);

    // témoin : l'éditeur a bien reçu la frappe
    expect(typed.at(-1)).toContain(SCRIPT);
    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : la balise tapée est affichée, en texte
    expect(page.textContent).toContain(SCRIPT);
  });
});
