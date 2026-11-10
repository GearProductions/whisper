// @vitest-environment happy-dom
// NoteEditor (note-editor.tsx) : Ctrl+S → onSave, sauf grisé ; le texte changé par les props
// remplace le document sans revenir à onChange ; le bouton de citation (icône comment, quoteLabel en
// title et aria-label) cite son bloc, et suit les blocs tapés.
// Le défilement porté par .cm-scroller (la barre de l'appli sur lui), pas par le cadre.
// Une balise écrite dans la note (paragraphe, titre, liste, code, bloc HTML, lien, note grisée), dans
// son Brut ou tapée dans un test d'invariant modifiable, reste du texte (I-40 : la règle de structure
// interdit toute insertion de HTML ; la pastille et la frappe dans la note restent protégées).
import { act, createElement, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { EditorView } from '@codemirror/view';
import { describe, expect, it } from 'vitest';
import { CodeView } from '../../code-view';
import { NoteEditor } from '../../note-editor';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

type Props = Parameters<typeof NoteEditor>[0];
const base: Props = { text: '', locked: null, tags: [], onChange: () => {}, onSave: () => {}, onOpenLink: () => {} };

function mount() {
  const page = document.createElement('div');
  document.body.append(page);
  const root = createRoot(page);
  const render = (props: Partial<Props>) => act(() => { root.render(createElement(NoteEditor, { ...base, ...props })); });
  const view = () => EditorView.findFromDOM(page.querySelector('.cm-editor') as HTMLElement)!;
  const ctrlS = () => act(() => {
    page.querySelector('.cm-content')!.dispatchEvent(new KeyboardEvent('keydown', { key: 's', ctrlKey: true, bubbles: true, cancelable: true }));
  });
  const buttons = () => [...page.querySelectorAll<HTMLButtonElement>('.cm-md-button')];
  return { page, render, view, ctrlS, buttons };
}

it('Ctrl+S enregistre, sauf grisé', async () => {
  const saved: number[] = [];
  const v = mount();
  await v.render({ text: 'a', onSave: () => saved.push(1) });
  await v.ctrlS();
  expect(saved).toHaveLength(1);
  await v.render({ text: 'a', locked: 'une course', onSave: () => saved.push(1) });
  await v.ctrlS();
  expect(saved).toHaveLength(1);
  expect(v.view().state.readOnly).toBe(true);
  expect(v.page.querySelector('.vc-note-editor')!.getAttribute('title')).toBe('une course');
});

it('le texte changé par les props remplace le document, sans le renvoyer à onChange', async () => {
  const typed: string[] = [];
  const v = mount();
  await v.render({ text: 'un', onChange: (t) => typed.push(t) });
  await v.render({ text: 'deux', onChange: (t) => typed.push(t) });
  expect(v.view().state.doc.toString()).toBe('deux');
  expect(typed).toEqual([]);
  await act(() => { v.view().dispatch({ changes: { from: 4, insert: '!' } }); });
  expect(typed).toEqual(['deux!']);
});

it('le bouton de citation cite le texte de son bloc, et suit les blocs tapés', async () => {
  const quoted: string[] = [];
  const v = mount();
  await v.render({ text: '# Un **titre**\n\nUn paragraphe.', onQuote: (t) => quoted.push(t), quoteLabel: 'Citer' });
  expect(v.buttons()).toHaveLength(2);
  // une icône, pas d'emoji ; le libellé en title et aria-label
  const [b] = v.buttons();
  expect(b.querySelector('svg')).not.toBeNull();
  expect(b.textContent).toBe('');
  expect([b.title, b.getAttribute('aria-label')]).toEqual(['Citer', 'Citer']);
  // happy-dom n'a pas de mise en page : le clic tombe sur la première ligne
  await act(() => { v.buttons()[0].click(); });
  expect(quoted).toEqual(['Un titre']);
  // le parent renvoie le texte tapé (onChange → brouillon → text), comme note-view
  let typed = '';
  await v.render({ text: '# Un **titre**\n\nUn paragraphe.', onQuote: (t) => quoted.push(t), onChange: (t) => { typed = t; } });
  await act(() => { v.view().dispatch({ changes: { from: v.view().state.doc.length, insert: '\n\nUn autre.' } }); });
  await v.render({ text: typed, onQuote: (t) => quoted.push(t) });
  expect(v.buttons()).toHaveLength(3);
});

it('sans onQuote, pas de bouton de citation ; pastilles et liseré sur leurs lignes', async () => {
  const v = mount();
  await v.render({ text: 'a\nb\nc', changed: new Set([1]), tags: [{ line: 2, text: 'inv', title: 'invariant', cls: 'vc-tag' }] });
  expect(v.buttons()).toHaveLength(0);
  expect(v.page.querySelector('.cm-line.vc-changed')?.textContent).toBe('b');
  expect(v.page.querySelector('.vc-tag')?.textContent).toBe('inv');
});

// Les lignes l0…l(n-1), une par ligne.
const lines = (n: number) => Array.from({ length: n }, (_, i) => `l${i}`).join('\n');

describe('focus : la ligne défilée et mise en évidence', () => {
  const marked = (page: HTMLElement) => [...page.querySelectorAll('.cm-line.vc-focus')].map((l) => l.textContent);

  it('focus 12 : la ligne 12 marquée et dans la vue ; sans focus : en haut, rien de marqué', async () => {
    const v = mount();
    await v.render({ text: lines(500) });
    expect(marked(v.page)).toEqual([]);
    expect(v.view().viewport.from).toBe(0);
    await v.render({ text: lines(500), focus: 12 });
    expect(marked(v.page)).toEqual(['l12']);
    const at = v.view().state.doc.line(13).from;
    expect(v.view().viewport.from <= at && at <= v.view().viewport.to).toBe(true);
  });

  it('une ligne lointaine est défilée dans la vue', async () => {
    const v = mount();
    await v.render({ text: lines(500), focus: 400 });
    const at = v.view().state.doc.line(401).from;
    expect(v.view().viewport.from <= at && at <= v.view().viewport.to).toBe(true);
    expect(marked(v.page)).toEqual(['l400']);
  });

  it('focus au-delà de la dernière ligne : rien de marqué, rien ne casse', async () => {
    const v = mount();
    await v.render({ text: lines(5), focus: 99 });
    expect(marked(v.page)).toEqual([]);
    await v.render({ text: lines(5), focus: -1 });
    expect(marked(v.page)).toEqual([]);
  });

  it('focus changé pendant que la note est montée : la marque suit, puis disparaît', async () => {
    const v = mount();
    await v.render({ text: lines(500), focus: 3 });
    expect(marked(v.page)).toEqual(['l3']);
    await v.render({ text: lines(500), focus: 450 });
    expect(marked(v.page)).toEqual(['l450']);
    await v.render({ text: lines(500) });
    expect(marked(v.page)).toEqual([]);
  });

  it('ne retire pas le liseré des changements', async () => {
    const v = mount();
    await v.render({ text: lines(5), changed: new Set([1]), focus: 2 });
    expect(v.page.querySelector('.cm-line.vc-changed')?.textContent).toBe('l1');
    expect(marked(v.page)).toEqual(['l2']);
  });
});

it('le défilement est celui de l\'éditeur (.cm-scroller), pas de son cadre', async () => {
  const v = mount();
  await v.render({ text: 'a' });
  expect(v.view().scrollDOM.classList.contains('scroll')).toBe(true);
  expect(v.page.querySelector('.vc-note-editor')!.classList.contains('scroll')).toBe(false);
});

// La page où l'élément est monté, une fois affiché.
async function shown(el: ReturnType<typeof createElement>) {
  const container = document.createElement('div');
  document.body.append(container);
  await act(async () => { createRoot(container).render(el); });
  return container;
}

// Un test d'invariant modifiable tel que invariants-view le tient (CodeView en edit).
function CodeHost({ initial, path, typed }: { initial: string; path: string; typed: string[] }) {
  const [code, setCode] = useState(initial);
  return createElement(CodeView, { code, path, edit: { locked: null, onChange: (t) => { typed.push(t); setCode(t); }, onSave: () => {} } });
}

// Une frappe à la fin de la dernière ligne affichée par l'éditeur (CodeMirror relève le changement du DOM),
// dans son texte, pas dans un widget (contenteditable=false).
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
    const v = mount();
    await v.render({ text: `# Titre\n\nUn paragraphe ${SCRIPT} fin.\n` });
    const page = v.page;

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : la balise est affichée, en texte
    expect(page.textContent).toContain(SCRIPT);
  });

  it('<img onerror> dans un titre', async () => {
    const v = mount();
    await v.render({ text: `## Titre ${IMG}\n` });
    const page = v.page;

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la balise est affichée, en texte
    expect(page.textContent).toContain(IMG);
  });

  it('<img onerror> dans un élément de liste', async () => {
    const v = mount();
    await v.render({ text: `- un élément ${IMG}\n- un autre\n` });
    const page = v.page;

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la balise est affichée, en texte
    expect(page.textContent).toContain(IMG);
  });

  it('<script> dans du code en ligne', async () => {
    const v = mount();
    await v.render({ text: `Du code \`${SCRIPT}\` en ligne.\n` });
    const page = v.page;

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : la balise est affichée, en texte
    expect(page.textContent).toContain(SCRIPT);
  });

  it('<img onerror> dans un bloc de code', async () => {
    const v = mount();
    await v.render({ text: `\`\`\`html\n${IMG}\n\`\`\`\n` });
    const page = v.page;

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la balise est affichée, en texte
    expect(page.textContent).toContain(IMG);
  });

  // Markdown reconnaît un bloc HTML : il n'est pas rendu pour autant.
  it('un bloc HTML seul sur sa ligne', async () => {
    const v = mount();
    await v.render({ text: `Avant.\n\n<div>${IMG}</div>\n\nAprès.\n` });
    const page = v.page;

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la balise est affichée, en texte
    expect(page.textContent).toContain(IMG);
  });

  it('<img onerror> dans le texte d’un lien', async () => {
    const v = mount();
    await v.render({ text: `Voir [${IMG}](https://exemple.fr).\n` });
    const page = v.page;

    // aucun élément img produit
    expect(page.querySelector('img')).toBeNull();
    // témoin : la balise est affichée, en texte
    expect(page.textContent).toContain(IMG);
  });

  it('grisée (un tour en cours) : <script> reste du texte', async () => {
    const v = mount();
    await v.render({ text: `Un paragraphe ${SCRIPT}.\n`, locked: 'Un tour de la conversation est en cours' });
    const page = v.page;

    // aucun élément script produit
    expect(page.querySelector('script')).toBeNull();
    // témoin : la balise est affichée, en texte
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
