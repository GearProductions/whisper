/** draft-view — l'étape Revue (Relire) : le brouillon de revue de la PR (une
 *  ligne par remarque : sa cible, son texte ; ✎ le modifie sur place, × la
 *  retire), le verdict
 *  (Approuver / Commenter / Demander des changements, Commenter d'abord comme
 *  sur GitHub) et Publier la revue (direct ou via l'agent, F-114) ; publiée (pr-<n>-review.json) : son état
 *  et son lien.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { useState } from 'react';
import { parseReview } from 'core/vibecoder';
import type { VibeArgs, VibeLang } from 'technicals/bridge';
import { CommentBox } from './comment-box';
import { MarkdownView } from './markdown-view';
import { OutputCard, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import './draft-view.css';

type Verdict = NonNullable<VibeArgs['verdict']>;
const VERDICTS: Verdict[] = ['approve', 'comment', 'request-changes'];

const fr = {
  draft: 'Brouillon de revue',
  count: (n: number) => (n > 1 ? `${n} remarques` : n ? '1 remarque' : 'vide'),
  empty: 'Pas encore de remarque. 💬 ou ✗ sur la note, un cas d\'invariant ou un commit ouvrent une zone de commentaire : la remarque vient ici.',
  remove: 'Retirer du brouillon',
  edit: 'Modifier cette remarque',
  verdict: 'Verdict',
  verdicts: { approve: 'Approuver', comment: 'Commenter', 'request-changes': 'Demander des changements' } as Record<Verdict, string>,
  published: 'Revue publiée',
  states: { APPROVED: 'Approuvée', COMMENTED: 'Commentée', CHANGES_REQUESTED: 'Changements demandés' } as Record<string, string>,
  unknown: 'Publiée',
  unreadable: 'Fichier illisible',
  open: 'Voir sur GitHub ↗',
  openTitle: 'Ouvrir la revue dans le navigateur',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    draft: 'Review draft',
    count: (n) => (n > 1 ? `${n} remarks` : n ? '1 remark' : 'empty'),
    empty: 'No remark yet. 💬 or ✗ on the note, an invariant case or a commit open a comment box: the remark comes here.',
    remove: 'Remove from the draft',
    edit: 'Edit this remark',
    verdict: 'Verdict',
    verdicts: { approve: 'Approve', comment: 'Comment', 'request-changes': 'Request changes' },
    published: 'Review published',
    states: { APPROVED: 'Approved', COMMENTED: 'Commented', CHANGES_REQUESTED: 'Changes requested' },
    unknown: 'Published',
    unreadable: 'Unreadable file',
    open: 'See on GitHub ↗',
    openTitle: 'Open the review in the browser',
  },
};

export function DraftView(p: StepProps) {
  const { view, t, act, busy, verdict, onVerdict: setVerdict } = p;
  const s = S[view.lang];
  const [editing, setEditing] = useState<number | null>(null);
  const file = view.pr ? `pr-${view.pr.number}-review.json` : '';
  const out = view.outputs[file];
  const review = out ? parseReview(out.text) : null;
  return (
    <>
      <StepHead p={p} own={['publish']} />
      {out ? (
        <OutputCard className="vc-published" title={s.published} file={file} time={out.time} t={t}
          tools={review?.url ? <button type="button" className="vc-mini" title={`${s.openTitle}\n${review.url}`} onClick={() => act.openLink(review.url!)}>{s.open}</button> : null}>
          <span className="vc-review-state" data-state={review?.state || undefined}>
            {review ? s.states[review.state] || review.state || s.unknown : s.unreadable}
          </span>
        </OutputCard>
      ) : null}
      <OutputCard className="vc-draft" title={s.draft} t={t} tools={<span className="vc-count">{s.count(view.draft.length)}</span>}>
        {view.draft.length ? (
          <ul className="vc-draft-list">
            {view.draft.map((c) => (
              <li key={c.id}>
                <div className="vc-draft-target" title={c.target}>{c.target}</div>
                {editing === c.id ? (
                  <CommentBox t={t} initial={c.text} save={t.commentSave} onCancel={() => setEditing(null)}
                    onSave={(text) => { act.draft({ edit: { id: c.id, text } }); setEditing(null); }} />
                ) : (
                  <>
                    <MarkdownView md={c.text} t={t} onOpenLink={act.openLink} />
                    <span className="vc-draft-tools">
                      <button type="button" className="vc-tool" title={s.edit} aria-label={s.edit} onClick={() => setEditing(c.id)}>✎</button>
                      <button type="button" className="vc-tool vc-draft-remove" title={s.remove} aria-label={s.remove}
                        onClick={() => act.draft({ remove: c.id })}>×</button>
                    </span>
                  </>
                )}
              </li>
            ))}
          </ul>
        ) : <div className="vc-draft-empty">{s.empty}</div>}
      </OutputCard>
      <div className="vc-publish">
        <div className="vc-seg vc-verdicts" role="group" aria-label={s.verdict}>
          {VERDICTS.map((v) => (
            <button key={v} type="button" aria-pressed={v === verdict} data-verdict={v} onClick={() => setVerdict(v)}>{s.verdicts[v]}</button>
          ))}
        </div>
        <Run a={view.actions.find((a) => a.id === 'publish')} busy={busy} tone="accent" onRun={(x) => act.run('publish', { verdict, ...x })} />
      </div>
    </>
  );
}
