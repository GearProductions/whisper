/** editor-base — le socle d'un éditeur CodeMirror du panneau : l'historique,
 *  les raccourcis par défaut, Ctrl+S → onSave (sauf locked), onChange à chaque
 *  frappe — pas pour un document remplacé par le texte reçu (syncDoc). Lit
 *  les dernières props par `latest`, sans recréer l'éditeur.
 *  Ne connaît pas : React, le pont, le métier.
 *  Utilisé par : app/panel/vibecoder (code-view, note-editor). */
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands';
import type { Extension } from '@codemirror/state';
import { EditorView, keymap } from '@codemirror/view';

type Latest = { text: string; locked?: string | null; onChange?(text: string): void; onSave?(): void };

export function editorBase(latest: { readonly current: Latest }): Extension {
  return [
    history(),
    keymap.of([
      { key: 'Mod-s', preventDefault: true, run: () => {
        if (!latest.current.locked) latest.current.onSave?.();
        return true;
      } },
      ...defaultKeymap, ...historyKeymap,
    ]),
    EditorView.updateListener.of((u) => {
      if (!u.docChanged) return;
      const text = u.state.doc.toString();
      if (text !== latest.current.text) latest.current.onChange?.(text);
    }),
  ];
}

// Un texte reçu (le disque, Abandonner) qui diffère du document le remplace.
export function syncDoc(view: EditorView | null, text: string) {
  if (view && view.state.doc.toString() !== text) view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
}
