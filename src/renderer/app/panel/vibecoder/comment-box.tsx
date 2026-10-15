/** comment-box — la petite zone de commentaire qui s'ouvre sous un élément
 *  (Relire : 💬 ou ✗ sur la note, un cas, un commit ; une remarque du
 *  brouillon à modifier) : un texte, Ajouter (ou Enregistrer), Annuler ;
 *  Échap annule, Ctrl+Entrée valide. Le texte est borné à ce que le principal
 *  accepte (DRAFT_MAX).
 *  Ne connaît pas : le pont, la cible (l'appelant la tient).
 *  Utilisé par : markdown-view, note-view, invariants-view, commits-view, draft-view. */
import { useState } from 'react';
import { DRAFT_MAX, type Strings } from 'core/vibecoder';

type Props = { t: Strings; initial?: string; save?: string; onSave(text: string): void; onCancel(): void };

export function CommentBox({ t, initial = '', save, onSave, onCancel }: Props) {
  const [text, setText] = useState(initial);
  const done = () => { if (text.trim()) onSave(text.trim()); };
  return (
    <form className="vc-cbox" onSubmit={(e) => { e.preventDefault(); done(); }}>
      <textarea autoFocus value={text} maxLength={DRAFT_MAX} rows={3} placeholder={t.commentPlaceholder}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); done(); }
        }} />
      <div className="vc-cbox-foot">
        <button type="submit" className="vc-run" data-tone="accent" disabled={!text.trim()}>{save ?? t.commentAdd}</button>
        <button type="button" className="vc-run" data-tone="ghost" onClick={onCancel}>{t.commentCancel}</button>
        <span className="vc-cbox-hint">{t.commentHint}</span>
      </div>
    </form>
  );
}
