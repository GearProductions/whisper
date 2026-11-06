/** draft-view — la suite de l'étape PR pour le relecteur (le corps, sous l'en-tête
 *  et la PR que rend pr-view) : le brouillon de revue de la PR (ses remarques
 *  par DraftRemarks, avec leur cible), le verdict (Approuver / Commenter /
 *  Demander des changements, celui que vibe-coder passe : le choix de
 *  l'utilisateur, sinon celui que proposent les marques ; jamais publié sans
 *  son clic) et Publier la revue (direct ou via l'agent, F-114) ; publiée
 *  (pr-<n>-review.json) : son état et son lien (icône external) ; quand elle
 *  est celle du brouillon et du verdict (reviewSent), la carte est grisée et
 *  résumée sur sa ligne d'état (verdict, remarques, date : rien ne bouge) et
 *  Publier est grisé (« déjà publiée »). Pas d'en-tête d'étape : pr-view le
 *  rend et lui laisse l'action publish (own).
 *  Ne connaît pas : le pont (rappels passés), le choix du verdict (vibe-coder).
 *  Utilisé par : pr-view. */
import { parseReview, reviewSent, VERDICTS, type Verdict } from 'core/vibecoder';
import type { VibeLang } from 'technicals/bridge';
import { DraftRemarks } from './draft-remarks';
import { IconButton } from './icons';
import { OutputCard, Run } from './step-parts';
import type { StepProps } from './step-views';
import './draft-view.css';

const fr = {
  draft: 'Brouillon de revue',
  count: (n: number) => (n > 1 ? `${n} remarques` : n ? '1 remarque' : 'vide'),
  empty: 'Pas encore de remarque. Commenter ou À revoir sur la note, un cas d\'invariant ou un commit ouvrent une zone de commentaire : la remarque vient ici.',
  already: 'déjà publiée',
  verdict: 'Verdict',
  verdicts: { approve: 'Approuver', comment: 'Commenter', 'request-changes': 'Demander des changements' } as Record<Verdict, string>,
  published: 'Revue publiée',
  states: { APPROVED: 'Approuvée', COMMENTED: 'Commentée', CHANGES_REQUESTED: 'Changements demandés' } as Record<string, string>,
  unknown: 'Publiée',
  unreadable: 'Fichier illisible',
  open: 'Voir la revue sur GitHub',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    draft: 'Review draft',
    count: (n) => (n > 1 ? `${n} remarks` : n ? '1 remark' : 'empty'),
    empty: 'No remark yet. Comment or Needs rework on the note, an invariant case or a commit open a comment box: the remark comes here.',
    already: 'already published',
    verdict: 'Verdict',
    verdicts: { approve: 'Approve', comment: 'Comment', 'request-changes': 'Request changes' },
    published: 'Review published',
    states: { APPROVED: 'Approved', COMMENTED: 'Commented', CHANGES_REQUESTED: 'Changes requested' },
    unknown: 'Published',
    unreadable: 'Unreadable file',
    open: 'See the review on GitHub',
  },
};

export function DraftView(p: StepProps) {
  const { view, t, act, busy, verdict, onVerdict: setVerdict } = p;
  const s = S[view.lang];
  const file = view.pr ? `pr-${view.pr.number}-review.json` : '';
  const out = view.outputs[file];
  const review = out ? parseReview(out.text) : null;
  const sent = reviewSent(review, view.draft, verdict);
  const publish = view.actions.find((a) => a.id === 'publish');
  return (
    <>
      {out ? (
        <OutputCard className={sent ? 'vc-published vc-sent' : 'vc-published'} title={s.published} file={file} time={out.time} t={t}
          tools={review?.url ? <IconButton icon="external" label={`${s.open}\n${review.url}`} onClick={() => act.openLink(review.url!)} /> : null}>
          <span className="vc-review-state" data-state={review?.state || undefined}>
            {review ? s.states[review.state] || review.state || s.unknown : s.unreadable}
            {sent ? ` · ${s.count(view.draft.length)} · ${new Date(review!.at ?? out.time).toLocaleString(t.locale)}` : null}
          </span>
        </OutputCard>
      ) : null}
      <OutputCard className="vc-draft" title={s.draft} t={t} tools={<span className="vc-count">{s.count(view.draft.length)}</span>}>
        {view.draft.length ? (
          <DraftRemarks remarks={view.draft} t={t} target onOpenLink={act.openLink}
            onEdit={(id, text) => act.draft({ edit: { id, text } })} onRemove={(id) => act.draft({ remove: id })} />
        ) : <div className="vc-draft-empty">{s.empty}</div>}
      </OutputCard>
      <div className="vc-publish">
        <div className="vc-seg vc-verdicts" role="group" aria-label={s.verdict}>
          {VERDICTS.map((v) => (
            <button key={v} type="button" aria-pressed={v === verdict} data-verdict={v} onClick={() => setVerdict(v)}>{s.verdicts[v]}</button>
          ))}
        </div>
        <Run a={sent && publish ? { ...publish, disabled: publish.disabled || s.already } : publish} busy={busy} tone="accent" onRun={(x) => act.run('publish', { verdict, ...x })} />
      </div>
    </>
  );
}
