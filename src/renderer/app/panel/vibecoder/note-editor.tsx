/** note-editor — la note éditable façon Obsidian (CodeMirror 6, liveMarkdown) :
 *  ce qui est tapé se met en forme au fil de la frappe ; un bouton-icône
 *  comment par bloc (blockQuotes, lineButtons, iconElement ; quoteLabel en
 *  title et aria-label), recalculés sur le document tapé, cite le texte
 *  du bloc (onQuote) ; liseré vert des changements de l'agent (lineMarks) ;
 *  pastilles des marques de « Ce que ça ne doit pas faire » (lineBadges) ;
 *  Ctrl+clic sur un lien → onOpenLink ; Ctrl+S → onSave (editorBase) ; locked : lecture
 *  seule, le motif en titre. Un texte changé par les props (le disque,
 *  Abandonner) remplace le document sans revenir à onChange. En texte, jamais
 *  en HTML (I-40). Lignes de changed et tags numérotées depuis 0.
 *  Défile en lui-même (hauteur bornée sur .cm-editor, .cm-scroller défile),
 *  pas avec la colonne : CodeMirror ne dessine que ce qu'il voit.
 *  Les styles (cm-md-*, vc-note-editor, vc-changed) : note-view.css.
 *  Ne connaît pas : le pont, le relevé.
 *  Utilisé par : note-view. */
import { useEffect, useMemo, useRef, type ReactNode } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView } from '@codemirror/view';
import { editorBase, lineBadges, lineButtons, lineMarks, liveMarkdown, syncDoc } from 'technicals/codemirror';
import { blockQuotes } from 'core/vibecoder';
import { iconElement } from './icons';

type Tag = { line: number; text: string; title: string; cls: string };

// Stable : une fonction neuve à chaque rendu reconstruirait les boutons de la gouttière.
const commentIcon = () => iconElement('comment');

export function NoteEditor({ text, locked, changed, tags, onChange, onSave, onQuote, quoteLabel = '', onOpenLink }: {
  text: string;
  locked: string | null;
  changed?: Set<number>;
  tags: Tag[];
  onChange(text: string): void;
  onSave(): void;
  onQuote?(text: string): void;
  quoteLabel?: string;   // le libellé du bouton de citation (title, aria-label)
  onOpenLink(url: string): void;
}): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  // Un compartiment par décor : reconfigurer l'un ne remet pas les autres aux lignes des props.
  const [readOnly, marks, badges, buttons] = useRef([0, 1, 2, 3].map(() => new Compartment())).current;
  // Les dernières props, lues par l'éditeur sans le recréer.
  const latest = useRef({ text, locked, onChange, onSave, onQuote, onOpenLink });
  latest.current = { text, locked, onChange, onSave, onQuote, onOpenLink };

  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: latest.current.text,
        extensions: [
          editorBase(latest),
          liveMarkdown({ onLink: (url) => latest.current.onOpenLink(url) }),
          EditorView.lineWrapping,
          EditorView.darkTheme.of(true),
          readOnly.of([]), marks.of([]), badges.of([]), buttons.of([]),
        ],
      }),
    });
    v.scrollDOM.classList.add('scroll'); // la barre aux couleurs de l'appli, sur ce qui défile
    view.current = v;
    return () => { v.destroy(); view.current = null; };
  }, []);

  // Un texte changé par les props (le disque, Abandonner) : le document remplacé.
  useEffect(() => syncDoc(view.current, text), [text]);

  const configure = (c: Compartment, ext: Parameters<Compartment['reconfigure']>[0]) =>
    view.current?.dispatch({ effects: c.reconfigure(ext) });

  useEffect(() => configure(readOnly, EditorState.readOnly.of(!!locked)), [locked]);

  // Comparés par valeur : un tableau neuf aux mêmes lignes ne remet pas les décors en place.
  const changedKey = [...(changed ?? [])].join(',');
  useEffect(() => configure(marks, changed ? lineMarks(changed, 'vc-changed') : []), [changedKey]);
  const tagsKey = JSON.stringify(tags);
  useEffect(() => configure(badges, lineBadges(tags)), [tagsKey]);

  const quoteKey = useMemo(() => blockQuotes(text).map((q) => q.line).join(','), [text]);
  const quoting = !!onQuote;
  useEffect(() => configure(buttons, !quoting || !quoteKey ? [] : lineButtons(quoteKey.split(',').map(Number), quoteLabel, (line) => {
    // le bloc de cette ligne dans le document au moment du clic
    const q = blockQuotes(view.current!.state.doc.toString()).find((b) => b.line === line);
    if (q) latest.current.onQuote?.(q.text);
  }, commentIcon)), [quoteKey, quoting, quoteLabel]);

  return <div ref={host} className="vc-note-editor" data-locked={locked ? true : undefined} title={locked ?? undefined} />;
}
