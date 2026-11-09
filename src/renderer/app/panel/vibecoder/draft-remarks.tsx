/** draft-remarks — des remarques du brouillon de revue, empilées : leur texte
 *  (Markdown), un crayon (la zone de commentaire sur place ; Enregistrer →
 *  onDraft({ edit })) et une croix (onDraft({ remove })). Grisées sous un élément (note, cas, commit) ;
 *  avec `target` (la liste du brouillon), la cible de chacune au-dessus, sans grisé.
 *  Ne connaît pas : le pont, le brouillon entier (les remarques qu'on lui passe).
 *  Utilisé par : draft-view, note-view, forme-view, invariants-view, commits-view. */
import { useState } from 'react';
import type { Strings } from 'core/vibecoder';
import type { VibeComment } from 'technicals/bridge';
import { CommentBox } from './comment-box';
import { IconButton } from './icons';
import { MarkdownView } from './markdown-view';
import './draft-remarks.css';

const S = {
  fr: { remove: 'Retirer du brouillon', edit: 'Modifier cette remarque' },
  en: { remove: 'Remove from the draft', edit: 'Edit this remark' },
};

type Props = {
  remarks: VibeComment[]; t: Strings; target?: boolean;
  onDraft(op: { edit?: { id: number; text: string }; remove?: number }): void;   // act.draft
  onOpenLink?(url: string): void;
};

export function DraftRemarks({ remarks, t, target, onDraft, onOpenLink = () => {} }: Props) {
  const s = S[t.locale.startsWith('fr') ? 'fr' : 'en'];
  const [editing, setEditing] = useState<number | null>(null);
  return (
    <ul className={target ? 'vc-draft-list' : 'vc-draft-list vc-remarks-muted'}>
      {remarks.map((c) => (
        <li key={c.id}>
          {target ? <div className="vc-draft-target" title={c.target}>{c.target}</div> : null}
          {editing === c.id ? (
            <CommentBox t={t} initial={c.text} save={t.commentSave} onCancel={() => setEditing(null)}
              onSave={(text) => { onDraft({ edit: { id: c.id, text } }); setEditing(null); }} />
          ) : (
            <>
              <MarkdownView md={c.text} t={t} onOpenLink={onOpenLink} />
              <span className="vc-draft-tools">
                <IconButton icon="edit" label={s.edit} onClick={() => setEditing(c.id)} />
                <IconButton icon="close" label={s.remove} className="vc-draft-remove" onClick={() => onDraft({ remove: c.id })} />
              </span>
            </>
          )}
        </li>
      ))}
    </ul>
  );
}
