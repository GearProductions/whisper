/** code-view — un code affiché dans un éditeur CodeMirror (F-113) : monospace,
 *  numéroté (à partir de `from`), coloré d'après l'extension de son fichier
 *  (languageFor, codeHighlight), en texte, jamais en HTML (I-40) ; `at` : défilé
 *  à cette ligne (numérotée comme l'affichage). Avec `edit` : modifiable,
 *  Ctrl+S → onSave ; en lecture seule sans `edit` ou si `locked` (le motif, en
 *  titre). Un code changé par les props remplace le document. Avec `onQuote` :
 *  un clic sur une ligne ou une sélection, puis 💬 ou Retour → fixup citent ses
 *  lignes entières (codeBlock). Libellés : `t` (français par défaut).
 *  Ne connaît pas : le pont, le relevé, la note.
 *  Utilisé par : invariants-view (Code, Voir le fichier), module-code (Voir le
 *  code), note-view (Brut). */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, keymap, lineNumbers } from '@codemirror/view';
import { codeHighlight, languageFor } from 'technicals/codemirror';
import { codeBlock, t as strings, type Strings } from 'core/vibecoder';

export type CodeEdit = { locked: string | null; onChange(text: string): void; onSave(): void };

export function CodeView({ code, path, from = 1, at, edit, onQuote, t = strings('fr') }: {
  code: string;
  path: string;
  from?: number;
  at?: number;
  edit?: CodeEdit;
  onQuote?(block: string, id: 'comment' | 'fix'): void;
  t?: Strings;
}): ReactNode {
  const host = useRef<HTMLDivElement>(null);
  const view = useRef<EditorView | null>(null);
  const readOnly = useRef(new Compartment()).current;
  // Les dernières props, lues par l'éditeur sans le recréer.
  const latest = useRef({ code, edit });
  latest.current = { code, edit };
  const [picked, setPicked] = useState(false);
  const locked = edit?.locked ?? null;
  const ro = !edit || !!locked;

  // L'éditeur, recréé pour un autre fichier ou une autre numérotation.
  useEffect(() => {
    const v = new EditorView({
      parent: host.current!,
      state: EditorState.create({
        doc: latest.current.code,
        extensions: [
          lineNumbers({ formatNumber: (n) => String(n + from - 1) }),
          history(),
          keymap.of([
            { key: 'Mod-s', preventDefault: true, run: () => {
              const e = latest.current.edit;
              if (e && !e.locked) e.onSave();
              return true;
            } },
            ...defaultKeymap, ...historyKeymap,
          ]),
          languageFor(path),
          codeHighlight,
          EditorView.darkTheme.of(true),
          readOnly.of(EditorState.readOnly.of(ro)),
          EditorView.updateListener.of((u) => {
            if (u.selectionSet) setPicked(true);
            const text = u.state.doc.toString();
            if (u.docChanged && text !== latest.current.code) latest.current.edit?.onChange(text);
          }),
        ],
      }),
    });
    view.current = v;
    return () => { v.destroy(); view.current = null; };
    // Le code et la lecture seule suivent par les effets ci-dessous.
  }, [path, from]);

  // Un code changé par les props (le disque, Abandonner) : le document remplacé.
  useEffect(() => {
    const v = view.current;
    if (v && v.state.doc.toString() !== code) v.dispatch({ changes: { from: 0, to: v.state.doc.length, insert: code } });
  }, [code]);

  useEffect(() => {
    view.current?.dispatch({ effects: readOnly.reconfigure(EditorState.readOnly.of(ro)) });
  }, [ro, readOnly]);

  useEffect(() => {
    const v = view.current;
    if (!v || at == null) return;
    const line = v.state.doc.line(Math.min(Math.max(at - from + 1, 1), v.state.doc.lines));
    v.dispatch({ effects: EditorView.scrollIntoView(line.from, { y: 'start' }) });
  }, [at, from, path]);

  const quote = (id: 'comment' | 'fix') => {
    const v = view.current;
    if (!v) return;
    const { anchor, head } = v.state.selection.main;
    onQuote!(codeBlock(v.state.doc.toString(), anchor, head), id);
  };
  return (
    <>
      <div ref={host} className="vc-src scroll" data-locked={locked ? true : undefined} title={locked ?? undefined}
        aria-label={path} />
      {onQuote ? (
        <div className="vc-src-tools">
          <button type="button" className="vc-tool" title={t.quote} aria-label={t.quote} disabled={!picked} onClick={() => quote('comment')}>💬</button>
          <button type="button" className="vc-mini" title={t.fixTitle} disabled={!picked} onClick={() => quote('fix')}>{t.fix}</button>
        </div>
      ) : null}
    </>
  );
}
