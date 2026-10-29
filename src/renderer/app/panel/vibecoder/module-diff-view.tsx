/** module-diff-view — le diff d'un fichier de module (Voir le code, F-113),
 *  comme celui de VS Code (@codemirror/merge) : de before à after, en ligne
 *  (un éditeur sur after, unifiedMergeView, sans boutons Accepter/Rejeter) ou
 *  côte à côte (MergeView, sans revertControls) ; en lecture seule, numéroté
 *  et coloré comme CodeView (languageFor, codeHighlight), replié autour des
 *  changements (collapseUnchanged, « N lignes inchangées » d'après lang), sauf
 *  avec `whole` (le fichier entier, ses lignes retirées, modifiées, ajoutées
 *  marquées) ; le texte en texte, jamais en HTML (I-40). Recréé quand une
 *  prop change. Ses styles : module-diff-view.css (le cadre et la
 *  numérotation : .vc-src).
 *  Ne connaît pas : le pont, le relevé, git, lineDiff.
 *  Utilisé par : module-code, invariants-view, commit-file. */
import { useEffect, useRef, type ReactElement } from 'react';
import { MergeView, unifiedMergeView } from '@codemirror/merge';
import { EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { codeHighlight, languageFor } from 'technicals/codemirror';
import type { VibeLang } from 'technicals/bridge';
import './module-diff-view.css';

const PHRASES: Record<VibeLang, Record<string, string>> = {
  fr: { '$ unchanged lines': '$ lignes inchangées' },
  en: {},
};

export function ModuleDiffView({ before, after, path, mode, lang, whole }: {
  before: string;
  after: string;
  path: string;
  mode: 'inline' | 'split';
  lang: VibeLang;
  whole?: boolean;
}): ReactElement {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const extensions = [
      lineNumbers(),
      languageFor(path),
      codeHighlight,
      EditorView.darkTheme.of(true),
      EditorState.readOnly.of(true),
      EditorView.editable.of(false),
      EditorState.phrases.of(PHRASES[lang]),
    ];
    const collapseUnchanged = whole ? undefined : {};
    const parent = host.current!;
    if (mode === 'inline') {
      const v = new EditorView({
        parent,
        state: EditorState.create({
          doc: after,
          extensions: [...extensions, unifiedMergeView({ original: before, mergeControls: false, collapseUnchanged })],
        }),
      });
      v.scrollDOM.classList.add('scroll');
      return () => v.destroy();
    }
    const m = new MergeView({ parent, a: { doc: before, extensions }, b: { doc: after, extensions }, collapseUnchanged });
    m.dom.classList.add('scroll');
    return () => m.destroy();
  }, [before, after, path, mode, lang, whole]);

  return <div ref={host} className="vc-src vc-mdiff" data-mode={mode} aria-label={path} />;
}
