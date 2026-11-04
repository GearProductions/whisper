/** comment-box — la petite zone de commentaire qui s'ouvre sous un élément
 *  (Relire : 💬 ou ✗ sur la note, un cas, un commit ; une remarque du
 *  brouillon à modifier) : un texte, Ajouter (ou Enregistrer), Annuler ;
 *  Échap annule, Ctrl+Entrée valide. Le texte est borné à ce que le principal
 *  accepte (DRAFT_MAX).
 *  Deux modes : sans `value`, la zone tient son texte (départ : `initial`) ;
 *  avec `value`, elle est contrôlée — l'appelant tient le texte (et peut y
 *  ajouter, zone ouverte) et le reçoit par `onChange`. Dans les deux cas seul
 *  le bouton Ajouter, Envoyer de son cadre (prompt-tools, avec le micro qui dicte
 *  dans la zone) ou Ctrl+Entrée appelle `onSave`.
 *  Ne connaît pas : le pont, la cible (l'appelant la tient).
 *  Utilisé par : markdown-view, note-view, forme-view, invariants-view, commits-view, draft-view. */
import { useRef, useState } from 'react';
import { DRAFT_MAX, type Strings } from 'core/vibecoder';
import { PromptTools } from './prompt-tools';

type Props = {
  t: Strings; initial?: string; value?: string; onChange?(text: string): void;
  save?: string; onSave(text: string): void; onCancel(): void;
};

export function CommentBox({ t, initial = '', value, onChange, save, onSave, onCancel }: Props) {
  const [own, setOwn] = useState(initial);
  const input = useRef<HTMLTextAreaElement>(null);
  const text = value ?? own;
  const setText = (v: string) => { setOwn(v); onChange?.(v); };
  const done = () => { if (text.trim()) onSave(text.trim()); };
  return (
    <form className="vc-cbox" onSubmit={(e) => { e.preventDefault(); done(); }}>
      <div className="vc-prompt">
        <textarea ref={input} autoFocus value={text} maxLength={DRAFT_MAX} rows={3} placeholder={t.commentPlaceholder}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onCancel(); }
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); done(); }
          }} />
        <PromptTools t={t} field={input} onSend={done} sendDisabled={!text.trim()} sendTitle={save ?? t.commentAdd} />
      </div>
      <div className="vc-cbox-foot">
        <button type="submit" className="vc-run" data-tone="accent" disabled={!text.trim()}>{save ?? t.commentAdd}</button>
        <button type="button" className="vc-run" data-tone="ghost" onClick={onCancel}>{t.commentCancel}</button>
        <span className="vc-cbox-hint">{t.commentHint}</span>
      </div>
    </form>
  );
}
