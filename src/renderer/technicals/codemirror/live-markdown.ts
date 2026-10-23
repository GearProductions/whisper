/** live-markdown — le Markdown mis en forme au fil de la frappe, façon Obsidian
 *  (CodeMirror 6) : liveMarkdown masque les marques (#, **, *, `, [](…)) hors
 *  des lignes du curseur et met en forme titres, gras, italique, code et liens
 *  par classes (cm-md-*) ; Ctrl+clic sur un lien → onLink(url). lineMarks : un
 *  liseré sur des lignes, reporté au fil de la frappe ; lineBadges, lineButtons :
 *  pastilles et boutons dans une gouttière à droite des lignes, construits par
 *  textContent, jamais en HTML (I-40).
 *  Ni widget en ligne ni Decoration.replace : CodeMirror pose à côté de chacun
 *  un <img class="cm-widgetBuffer">, et la page de la note ne doit montrer
 *  aucun élément img (invariant note-editor). Les marques sont donc cachées par
 *  une classe (display: none), pas retirées du DOM.
 *  Lignes numérotées depuis 0 (doc.line(n + 1), seule conversion).
 *  Ne connaît pas : React, le pont, le métier.
 *  Utilisé par : app/panel/vibecoder (note-editor). */
import { markdown } from '@codemirror/lang-markdown';
import { syntaxTree } from '@codemirror/language';
import {
  RangeSet, StateField, type EditorState, type Extension, type Range, type RangeValue,
} from '@codemirror/state';
import {
  Decoration, EditorView, GutterMarker, ViewPlugin, gutter, type DecorationSet, type ViewUpdate,
} from '@codemirror/view';

const MARKS: Record<string, string> = {
  StrongEmphasis: 'cm-md-strong', Emphasis: 'cm-md-em', InlineCode: 'cm-md-code', Link: 'cm-md-link',
};
const HIDE = Decoration.mark({ class: 'cm-md-hidden' });

// Les lignes touchées par la sélection, quand l'éditeur a le focus : leurs marques restent visibles.
function cursorLines(view: EditorView) {
  const lines = new Set<number>();
  if (!view.hasFocus) return lines;
  for (const r of view.state.selection.ranges) {
    const to = view.state.doc.lineAt(r.to).number;
    for (let n = view.state.doc.lineAt(r.from).number; n <= to; n++) lines.add(n);
  }
  return lines;
}

function decorate(view: EditorView): DecorationSet {
  const { doc } = view.state;
  const shown = cursorLines(view);
  const out: Range<Decoration>[] = [];
  const hide = (from: number, to: number) => {
    if (from < to && !shown.has(doc.lineAt(from).number)) out.push(HIDE.range(from, to));
  };
  for (const { from, to } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from, to,
      enter: (n) => {
        const name = n.name;
        const h = /^ATXHeading([1-6])$/.exec(name);
        if (h) out.push(Decoration.line({ class: `cm-md-h${h[1]}` }).range(doc.lineAt(n.from).from));
        else if (name === 'FencedCode' || name === 'CodeBlock') {
          for (let l = doc.lineAt(n.from).number; l <= doc.lineAt(n.to).number; l++) {
            out.push(Decoration.line({ class: 'cm-md-codeblock' }).range(doc.line(l).from));
          }
        } else if (MARKS[name] && n.from < n.to) out.push(Decoration.mark({ class: MARKS[name] }).range(n.from, n.to));
        else if (name === 'HeaderMark') hide(n.from, doc.sliceString(n.to, n.to + 1) === ' ' ? n.to + 1 : n.to);
        else if (name === 'EmphasisMark') hide(n.from, n.to);
        else if (name === 'CodeMark' && n.node.parent?.name === 'InlineCode') hide(n.from, n.to);
        else if (['LinkMark', 'URL', 'LinkTitle'].includes(name) && n.node.parent?.name === 'Link') hide(n.from, n.to);
      },
    });
  }
  return Decoration.set(out, true);
}

// L'adresse du lien sous pos : [texte](url) ou <url>.
function linkAt(state: EditorState, pos: number) {
  let n = syntaxTree(state).resolveInner(pos, 1);
  while (n.name !== 'Link' && n.name !== 'Autolink') {
    if (!n.parent) return null;
    n = n.parent;
  }
  const url = n.getChild('URL');
  return url ? state.sliceDoc(url.from, url.to) : null;
}

export function liveMarkdown({ onLink }: { onLink(url: string): void }): Extension {
  return [
    markdown(),
    // le masquage est un comportement, pas une mise en forme : il vit ici, les styles cm-md-* ailleurs
    EditorView.baseTheme({ '.cm-md-hidden': { display: 'none' } }),
    ViewPlugin.fromClass(class {
      decorations: DecorationSet;
      constructor(view: EditorView) { this.decorations = decorate(view); }
      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || u.viewportChanged || u.focusChanged
          || syntaxTree(u.startState) !== syntaxTree(u.state)) this.decorations = decorate(u.view);
      }
    }, { decorations: (p) => p.decorations }),
    EditorView.domEventHandlers({
      mousedown(e, view) {
        if (!(e.ctrlKey || e.metaKey)) return false;
        const pos = view.posAtCoords({ x: e.clientX, y: e.clientY });
        const url = pos == null ? null : linkAt(view.state, pos);
        if (!url) return false;
        e.preventDefault();
        onLink(url);
        return true;
      },
    }),
  ];
}

// Des valeurs posées au début de lignes du document initial, déplacées avec le texte au fil de la frappe.
function onLines<T extends { line: number }, V extends RangeValue>(items: T[], value: (item: T) => V) {
  return StateField.define<RangeSet<V>>({
    create: (state) => RangeSet.of(items
      .filter(({ line }) => line >= 0 && line < state.doc.lines)
      .map((i) => value(i).range(state.doc.line(i.line + 1).from)), true),
    update: (set, tr) => set.map(tr.changes),
  });
}

export function lineMarks(lines: Set<number>, cls: string): Extension {
  const deco = Decoration.line({ class: cls });
  const field = onLines([...lines].map((line) => ({ line })), () => deco);
  return [field, EditorView.decorations.from(field)];
}

class Badge extends GutterMarker {
  constructor(readonly b: { text: string; title: string; cls: string }) { super(); }
  eq(o: Badge) { return o.b.text === this.b.text && o.b.title === this.b.title && o.b.cls === this.b.cls; }
  toDOM() {
    const el = document.createElement('span');
    el.className = this.b.cls;
    el.textContent = this.b.text;
    el.title = this.b.title;
    return el;
  }
}

export function lineBadges(badges: { line: number; text: string; title: string; cls: string }[]): Extension {
  const field = onLines(badges, (b) => new Badge(b));
  return [field, gutter({ class: 'cm-md-badges', side: 'after', markers: (v) => v.state.field(field) })];
}

class LineButton extends GutterMarker {
  constructor(readonly label: string) { super(); }
  eq(o: LineButton) { return o.label === this.label; }
  toDOM() {
    const el = document.createElement('button');
    el.type = 'button';
    el.className = 'cm-md-button';
    el.textContent = this.label;
    el.addEventListener('mousedown', (e) => e.preventDefault()); // l'éditeur garde le focus
    return el;
  }
}

export function lineButtons(lines: number[], label: string, onClick: (line: number) => void): Extension {
  const button = new LineButton(label);
  const field = onLines(lines.map((line) => ({ line })), () => button);
  return [field, gutter({
    class: 'cm-md-buttons', side: 'after', markers: (v) => v.state.field(field),
    domEventHandlers: {
      // la ligne où se trouve le bouton au moment du clic (le texte a pu bouger depuis)
      click: (view, block, e) => {
        if (!(e.target as Element).closest('.cm-md-button')) return false;
        onClick(view.state.doc.lineAt(block.from).number - 1);
        return true;
      },
    },
  })];
}
