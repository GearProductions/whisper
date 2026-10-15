/** commits-view — l'étape Commits (Relire) : la relecture des commits de la PR
 *  (pr-<n>-commits.md), une carte par commit (hash, sujet, ses remarques
 *  rendues). 💬 sur une carte : une remarque au brouillon de revue, pour ce
 *  commit — le texte du champ, sinon la relecture de ce commit ; la carte
 *  compte celles qui y sont déjà. Pas de relecture : Relire les commits.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { commitTitle, remark, sections } from 'core/vibecoder';
import type { VibeLang } from 'technicals/bridge';
import { MarkdownView } from './markdown-view';
import { Invite, OutputCard, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import './commits-view.css';

const fr = {
  general: 'Ensemble des commits',
  toDraft: 'Ajouter au brouillon de revue : le texte du champ, sinon cette relecture',
  inDraft: (n: number) => (n > 1 ? `${n} remarques au brouillon` : '1 remarque au brouillon'),
  again: 'Relire de nouveau',
  none: 'Commits pas encore relus',
  noneHint: 'Un par un : les quatre questions, la duplication avec l\'existant, les en-têtes, l\'histoire que racontent les commits.',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    general: 'All commits',
    toDraft: 'Add to the review draft: the text of the field, else this review',
    inDraft: (n) => (n > 1 ? `${n} remarks in the draft` : '1 remark in the draft'),
    again: 'Review again',
    none: 'Commits not reviewed yet',
    noneHint: 'One by one: the four questions, duplication with existing code, file headers, the story the commits tell.',
  },
};

export function CommitsView({ view, step, t, act, busy }: StepProps) {
  const s = S[view.lang];
  const action = view.actions.find((a) => a.id === 'review-commits');
  const file = view.pr ? `pr-${view.pr.number}-commits.md` : '';
  const out = view.outputs[file];
  return (
    <>
      <StepHead step={step} t={t}>
        {out ? (
          <span className="vc-out-meta">
            <span className="vc-mono">{file}</span>
            <span title={new Date(out.time).toLocaleString(t.locale)}>{t.ago(Date.now() - out.time)}</span>
            <Run a={action} busy={busy} tone="ghost" label={s.again} onRun={() => act.run('review-commits')} />
          </span>
        ) : null}
      </StepHead>
      {out ? sections(out.text).map((sec, i) => {
        const commit = commitTitle(sec.title);
        const item = remark(sec.title || s.general, sec.body);
        const drafted = view.draft.filter((d) => d.target === item.target).length;
        return (
          <OutputCard key={i} className="vc-commit-review" t={t}
            title={commit ? <><code className="vc-chip">{commit.hash.slice(0, 7)}</code><span className="vc-commit-subject">{commit.subject}</span></> : sec.title || s.general}
            tools={(
              <>
                {drafted ? <span className="vc-count">{s.inDraft(drafted)}</span> : null}
                <button type="button" className="vc-tool" title={s.toDraft} aria-label={s.toDraft} onClick={() => act.draft({ add: item })}>💬</button>
              </>
            )}>
            {sec.body ? <MarkdownView md={sec.body} t={t} onOpenLink={act.openLink} /> : null}
          </OutputCard>
        );
      }) : (
        <Invite title={s.none} text={s.noneHint}><Run a={action} busy={busy} onRun={() => act.run('review-commits')} /></Invite>
      )}
    </>
  );
}
