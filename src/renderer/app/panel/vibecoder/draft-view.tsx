/** draft-view — l'étape Revue (Relire) : le brouillon de revue de la PR (une
 *  ligne par remarque : sa cible, son texte, × la retire), le verdict
 *  (Approuver / Commenter / Demander des changements, Commenter d'abord comme
 *  sur GitHub) et Publier la revue ; publiée (pr-<n>-review.json) : son état
 *  et son lien.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { parseReview } from 'core/vibecoder';
import type { VibeArgs, VibeLang } from 'technicals/bridge';
import { MarkdownView } from './markdown-view';
import { OutputCard, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import './draft-view.css';

type Verdict = NonNullable<VibeArgs['verdict']>;
const VERDICTS: Verdict[] = ['approve', 'comment', 'request-changes'];

const fr = {
  draft: 'Brouillon de revue',
  count: (n: number) => (n > 1 ? `${n} remarques` : n ? '1 remarque' : 'vide'),
  empty: 'Pas encore de remarque. ✗ sur un cas d\'invariant, 💬 sur la note, un cas ou un commit l\'y ajoutent : le texte du champ, sinon ce qu\'on cite.',
  remove: 'Retirer du brouillon',
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
    empty: 'No remark yet. ✗ on an invariant case, 💬 on the note, a case or a commit add one: the text of the field, else what is quoted.',
    remove: 'Remove from the draft',
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

export function DraftView({ view, step, t, act, busy, verdict, onVerdict: setVerdict }: StepProps) {
  const s = S[view.lang];
  const file = view.pr ? `pr-${view.pr.number}-review.json` : '';
  const out = view.outputs[file];
  const review = out ? parseReview(out.text) : null;
  return (
    <>
      <StepHead step={step} t={t} />
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
                <MarkdownView md={c.text} t={t} onOpenLink={act.openLink} />
                <button type="button" className="vc-tool vc-draft-remove" title={s.remove} aria-label={s.remove}
                  onClick={() => act.draft({ remove: c.id })}>×</button>
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
        <Run a={view.actions.find((a) => a.id === 'publish')} busy={busy} tone="accent" onRun={() => act.run('publish', { verdict })} />
      </div>
    </>
  );
}
