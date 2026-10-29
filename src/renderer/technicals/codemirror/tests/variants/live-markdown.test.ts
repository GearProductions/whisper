// @vitest-environment happy-dom
import { EditorState, type Extension } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { lineBadges, lineButtons, lineMarks, liveMarkdown } from '../../live-markdown';

const views: EditorView[] = [];
afterEach(() => { for (const v of views.splice(0)) v.destroy(); document.body.replaceChildren(); });

function mount(doc: string, extensions: Extension) {
  const parent = document.createElement('div');
  document.body.append(parent);
  const view = new EditorView({ state: EditorState.create({ doc, extensions }), parent });
  views.push(view);
  return view;
}
const lines = (v: EditorView) => [...v.contentDOM.querySelectorAll('.cm-line')];
// Ce que montre une ligne : son texte sans les marques cachées.
function seen(line: Element) {
  const copy = line.cloneNode(true) as Element;
  for (const h of copy.querySelectorAll('.cm-md-hidden')) h.remove();
  return copy.textContent;
}

describe('liveMarkdown', () => {
  const NOTE = '# Titre\n\nUn **gras**, *it*, `code` et [lien](https://x.fr).';

  it('hors des lignes du curseur : marques masquées, mise en forme par classes', () => {
    const v = mount(NOTE, liveMarkdown({ onLink: () => {} }));
    expect(lines(v).map(seen)).toEqual(['Titre', '', 'Un gras, it, code et lien.']);
    expect(lines(v)[0].classList.contains('cm-md-h1')).toBe(true);
    for (const [cls, t] of [['cm-md-strong', 'gras'], ['cm-md-em', 'it'], ['cm-md-code', 'code'], ['cm-md-link', 'lien']]) {
      expect(seen(v.contentDOM.querySelector(`.${cls}`)!)).toBe(t);
    }
  });

  it('la ligne du curseur, éditeur au focus : ses marques visibles, les autres masquées', () => {
    const v = mount(NOTE, liveMarkdown({ onLink: () => {} }));
    // happy-dom émet selectionchange pendant la mise à jour : le focus simulé, la sélection posée sans le DOM
    Object.defineProperty(v, 'hasFocus', { get: () => true });
    v.dispatch({ selection: { anchor: 2 } });
    expect(lines(v).map(seen)).toEqual(['# Titre', '', 'Un gras, it, code et lien.']);
  });

  it('Ctrl+clic sur un lien → onLink(url) ; hors d’un lien, rien', () => {
    const onLink = vi.fn();
    const v = mount('[lien](https://x.fr) et <https://y.fr>', liveMarkdown({ onLink }));
    const ctrlClickAt = (pos: number) => {
      v.posAtCoords = () => pos; // happy-dom ne mesure rien
      v.contentDOM.dispatchEvent(new MouseEvent('mousedown', { ctrlKey: true, bubbles: true }));
    };
    ctrlClickAt(2);
    expect(onLink).toHaveBeenLastCalledWith('https://x.fr');
    ctrlClickAt(25);
    expect(onLink).toHaveBeenLastCalledWith('https://y.fr');
    ctrlClickAt(21);
    expect(onLink).toHaveBeenCalledTimes(2);
  });

});

describe('lineMarks', () => {
  it('le liseré suit sa ligne quand le texte bouge', () => {
    const v = mount('a\nb\nc', lineMarks(new Set([1]), 'vu'));
    expect(lines(v).map((l) => l.classList.contains('vu'))).toEqual([false, true, false]);
    v.dispatch({ changes: { from: 0, insert: 'nouvelle\n' } });
    expect(lines(v).map((l) => l.classList.contains('vu'))).toEqual([false, false, true, false]);
  });

  it('une ligne hors du document : ignorée', () => {
    const v = mount('a', lineMarks(new Set([-1, 1]), 'vu'));
    expect(v.contentDOM.querySelector('.vu')).toBeNull();
  });
});

describe('lineBadges', () => {
  it('une pastille en texte, jamais en HTML (I-40)', () => {
    const IMG = '<img src=x onerror=alert(1)>';
    const v = mount('a\nb', lineBadges([{ line: 1, text: IMG, title: 'titre', cls: 'tag' }]));
    const tag = v.dom.querySelector('.cm-md-badges .tag') as HTMLElement;
    expect(tag.textContent).toBe(IMG);
    expect(tag.title).toBe('titre');
    expect(v.dom.querySelector('img')).toBeNull();
  });
});

const icon = () => document.createElementNS('http://www.w3.org/2000/svg', 'svg');

describe('lineButtons', () => {
  it('un clic sur le bouton donne sa ligne (depuis 0)', () => {
    const onClick = vi.fn();
    const v = mount('a\nb', lineButtons([1], 'Commenter', onClick, icon));
    v.lineBlockAtHeight = () => v.lineBlockAt(2); // happy-dom ne mesure rien : la ligne « b »
    (v.dom.querySelector('.cm-md-button') as HTMLButtonElement).click();
    expect(onClick).toHaveBeenCalledWith(1);
  });

  it('l’icône est le contenu, un élément neuf par bouton ; le libellé en title et aria-label', () => {
    const v = mount('a\nb', lineButtons([0, 1], 'Commenter', () => {}, icon));
    const btns = [...v.dom.querySelectorAll<HTMLButtonElement>('.cm-md-button')];
    expect(btns).toHaveLength(2);
    for (const b of btns) {
      expect(b.children).toHaveLength(1);
      expect(b.firstElementChild!.tagName.toLowerCase()).toBe('svg');
      expect(b.textContent).toBe('');
      expect([b.title, b.getAttribute('aria-label')]).toEqual(['Commenter', 'Commenter']);
    }
    expect(btns[0].firstElementChild).not.toBe(btns[1].firstElementChild);
  });
});

// CodeMirror pose un <img class="cm-widgetBuffer"> à côté de tout widget en ligne : il n'en faut aucun.
it('ni img ni widget en ligne, marques cachées, pastilles et boutons ensemble', () => {
  const v = mount('# T\n\n**g** [l](u)\n- x', [
    liveMarkdown({ onLink: () => {} }), lineMarks(new Set([2]), 'vu'),
    lineBadges([{ line: 3, text: 't', title: 't', cls: 'tag' }]), lineButtons([0, 2, 3], 'Commenter', () => {}, icon),
  ]);
  expect(v.dom.querySelector('img')).toBeNull();
  expect(v.dom.querySelectorAll('.cm-md-button')).toHaveLength(3);
});
