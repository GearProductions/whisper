/** commits-view — l'étape Commits (Relire) : les commits de la PR, sans IA,
 *  une carte chacun (hash, sujet ; Voir le diff dans l'éditeur, c<rang> ;
 *  GitHub ↗, gh:c<rang> ; ses fichiers, chacun ouvrable, c<rang>/<i>) ; s'il y a une relecture
 *  (pr-<n>-commits.md), ses remarques sous le commit qu'elles visent, et ses
 *  autres rubriques (l'ensemble…) en tête. 💬 sur une carte : une zone de
 *  commentaire sous elle, la remarque va au brouillon de revue pour ce
 *  commit ; la carte compte celles qui y sont déjà. Relire les commits (IA)
 *  reste un bouton de l'en-tête.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { useState, type ReactNode } from 'react';
import { commitReviews, remark, type Strings } from 'core/vibecoder';
import type { VibeComment, VibeLang } from 'technicals/bridge';
import { CommentBox } from './comment-box';
import { MarkdownView } from './markdown-view';
import { OutputCard, Run, StepHead } from './step-parts';
import type { StepProps, VibeActs } from './step-views';
import './commits-view.css';

const fr = {
  general: 'Ensemble des commits',
  toDraft: 'Une remarque sur ce commit, au brouillon de revue',
  inDraft: (n: number) => (n > 1 ? `${n} remarques au brouillon` : '1 remarque au brouillon'),
  again: 'Relire de nouveau',
  none: 'Aucun commit dans cette PR.',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    general: 'All commits',
    toDraft: 'A remark on this commit, to the review draft',
    inDraft: (n) => (n > 1 ? `${n} remarks in the draft` : '1 remark in the draft'),
    again: 'Review again',
    none: 'No commit in this PR.',
  },
};

export function CommitsView({ view, step, t, act, busy }: StepProps) {
  const s = S[view.lang];
  const action = view.actions.find((a) => a.id === 'review-commits');
  const file = view.pr ? `pr-${view.pr.number}-commits.md` : '';
  const out = view.outputs[file];
  const { byHash, others } = commitReviews(out?.text ?? '', view.commits);
  return (
    <>
      <StepHead step={step} t={t}>
        {out ? (
          <span className="vc-out-meta">
            <span className="vc-mono">{file}</span>
            <span title={new Date(out.time).toLocaleString(t.locale)}>{t.ago(Date.now() - out.time)}</span>
          </span>
        ) : null}
        <Run a={action} busy={busy} tone={out ? 'ghost' : 'plain'} label={out ? s.again : undefined} onRun={() => act.run('review-commits')} />
      </StepHead>
      {others.map((sec, i) => (
        <Commented key={`o${i}`} target={sec.title || s.general} title={sec.title || s.general} s={s} t={t} act={act} draft={view.draft}>
          {sec.body ? <MarkdownView md={sec.body} t={t} onOpenLink={act.openLink} /> : null}
        </Commented>
      ))}
      {view.commits.map((c, i) => {
        const review = byHash.get(c.hash);
        return (
          <Commented key={c.hash} target={`${c.hash.slice(0, 7)} ${c.subject}`} s={s} t={t} act={act} draft={view.draft}
            title={<><code className="vc-chip" data-fixup={c.fixup || undefined}>{c.hash.slice(0, 7)}</code><span className="vc-commit-subject">{c.subject}</span></>}
            links={(
              <>
                <button type="button" className="vc-mini" title={t.diffTitle} onClick={() => act.open(`c${i}`)}>{t.diff}</button>
                <button type="button" className="vc-mini" title={t.githubTitle} onClick={() => act.open(`gh:c${i}`)}>{t.github}</button>
              </>
            )}>
            {c.files.length ? (
              <details className="vc-commit-files" open={c.files.length <= 6}>
                <summary>{t.files(c.files.length)}</summary>
                <ul>
                  {c.files.map((f, j) => (
                    <li key={f}><button type="button" className="vc-mono" title={`${t.openTitle} : ${f}`} onClick={() => act.open(`c${i}/${j}`)}>{f}</button></li>
                  ))}
                </ul>
              </details>
            ) : null}
            {review ? <div className="vc-commit-ai"><MarkdownView md={review} t={t} onOpenLink={act.openLink} /></div> : null}
          </Commented>
        );
      })}
      {view.commits.length ? null : <div className="vc-empty">{s.none}</div>}
    </>
  );
}

type CommentedProps = {
  target: string; title: ReactNode; links?: ReactNode; s: typeof fr; t: Strings; act: VibeActs; draft: VibeComment[];
  children?: ReactNode;
};

// Une carte de commit (ou de rubrique) : 💬 ouvre sous elle la zone de commentaire, pour cette cible.
function Commented({ target, title, links, s, t, act, draft, children }: CommentedProps) {
  const [writing, setWriting] = useState(false);
  const item = remark(target, '');
  const drafted = draft.filter((d) => d.target === item.target).length;
  return (
    <OutputCard className="vc-commit-review" t={t} title={title}
      tools={(
        <>
          {drafted ? <span className="vc-count">{s.inDraft(drafted)}</span> : null}
          {links}
          <button type="button" className="vc-tool" title={s.toDraft} aria-label={s.toDraft} aria-pressed={writing} onClick={() => setWriting(!writing)}>💬</button>
        </>
      )}>
      {children || writing ? (
        <>
          {children}
          {writing ? (
            <CommentBox t={t} onCancel={() => setWriting(false)}
              onSave={(text) => { act.draft({ add: remark(target, text) }); setWriting(false); }} />
          ) : null}
        </>
      ) : null}
    </OutputCard>
  );
}
