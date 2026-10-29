/** commits-view — l'étape Commits (Relire) : les commits de la PR, sans IA,
 *  une carte chacun (hash, sujet ; Voir le diff dans l'éditeur, c<rang> ;
 *  GitHub ↗, gh:c<rang> ; ses fichiers) ; s'il y a une relecture
 *  (pr-<n>-commits.md), ses remarques sous le commit qu'elles visent, et ses
 *  autres rubriques (l'ensemble…) en tête. 💬 sur une carte : une zone de
 *  commentaire sous elle, la remarque va au brouillon de revue pour ce
 *  commit ; la carte compte celles qui y sont déjà. Un fichier d'un commit,
 *  cliqué : ouvert sous sa carte (CommitFile, le texte que le principal pousse
 *  pour son id c<rang>/<i>), un seul à la fois (act.follow(id) ; recliqué,
 *  fermé, ou l'id ne désignant plus ce hash et ce chemin après un relevé :
 *  act.follow(null)) ; 💬 sur ses lignes : une zone de commentaire
 *  sous lui, la remarque (quoteRemark : son chemin, les lignes citées) va au
 *  brouillon sur la cible du commit, comptée sur sa carte. Relire les
 *  commits (IA, puis Relancer) reste un bouton de l'en-tête.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { useEffect, useState, type ReactNode } from 'react';
import { commitReviews, quoteRemark, remark, type Strings } from 'core/vibecoder';
import type { VibeComment, VibeLang } from 'technicals/bridge';
import { CommentBox } from './comment-box';
import { CommitFile } from './commit-file';
import { MarkdownView } from './markdown-view';
import { OutputCard, Run, StepHead } from './step-parts';
import type { StepProps, VibeActs } from './step-views';
import './commits-view.css';

const fr = {
  general: 'Ensemble des commits',
  toDraft: 'Une remarque sur ce commit, au brouillon de revue',
  inDraft: (n: number) => (n > 1 ? `${n} remarques au brouillon` : '1 remarque au brouillon'),
  none: 'Aucun commit dans cette PR.',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    general: 'All commits',
    toDraft: 'A remark on this commit, to the review draft',
    inDraft: (n) => (n > 1 ? `${n} remarks in the draft` : '1 remark in the draft'),
    none: 'No commit in this PR.',
  },
};

export function CommitsView(p: StepProps) {
  const { view, t, act, busy } = p;
  const s = S[view.lang];
  const action = view.actions.find((a) => a.id === 'review-commits');
  const file = view.pr ? `pr-${view.pr.number}-commits.md` : '';
  const out = view.outputs[file];
  const { byHash, others } = commitReviews(out?.text ?? '', view.commits);
  // Le fichier ouvert (id c<rang>/<i>), avec le hash et le chemin qu'il désignait.
  const [opened, setOpened] = useState<{ i: number; k: number; hash: string; path: string } | null>(null);
  const [quote, setQuote] = useState<string | null>(null);   // les lignes citées par 💬, en attente de la remarque
  const follow = (o: typeof opened) => { setOpened(o); setQuote(null); act.follow(o && `c${o.i}/${o.k}`); };
  // Un relevé qui change les commits (Pull, rebase, push) décale les ids : un id qui ne désigne plus le même fichier est fermé.
  const c0 = opened && view.commits[opened.i];
  const shown = c0 && c0.hash === opened.hash && c0.files[opened.k] === opened.path ? opened : null;
  useEffect(() => { if (opened && !shown) follow(null); }, [opened, shown]);
  return (
    <>
      <StepHead p={p} own={['review-commits']}>
        {out ? (
          <span className="vc-out-meta">
            <span className="vc-mono">{file}</span>
            <span title={new Date(out.time).toLocaleString(t.locale)}>{t.ago(Date.now() - out.time)}</span>
          </span>
        ) : null}
        <Run a={action} busy={busy} tone={out ? 'ghost' : 'plain'} label={out ? t.rerun : undefined} onRun={() => act.run('review-commits')} />
      </StepHead>
      {others.map((sec, i) => (
        <Commented key={`o${i}`} target={sec.title || s.general} title={sec.title || s.general} s={s} t={t} act={act} draft={view.draft}>
          {sec.body ? <MarkdownView md={sec.body} t={t} onOpenLink={act.openLink} /> : null}
        </Commented>
      ))}
      {view.commits.map((c, i) => {
        const review = byHash.get(c.hash);
        const target = `${c.hash.slice(0, 7)} ${c.subject}`;
        const j = shown?.i === i ? shown.k : -1; // le fichier ouvert, s'il est de ce commit
        const path = c.files[j] ?? null;
        return (
          <Commented key={c.hash} target={target} s={s} t={t} act={act} draft={view.draft}
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
                  {c.files.map((f, k) => (
                    <li key={f}><button type="button" className="vc-mono" aria-pressed={k === j}
                      onClick={() => follow(k === j ? null : { i, k, hash: c.hash, path: f })}>{f}</button></li>
                  ))}
                </ul>
              </details>
            ) : null}
            {path != null ? (
              <div className="vc-commit-file">
                <div className="vc-commit-file-head">
                  <span className="vc-mono">{path}</span>
                  <button type="button" className="vc-tool" title={t.close} aria-label={t.close} onClick={() => follow(null)}>✕</button>
                </div>
                <CommitFile file={{ id: `c${i}/${j}`, path }} code={p.code} lang={view.lang} t={t} onQuote={setQuote} />
                {quote != null ? (
                  <CommentBox t={t} onCancel={() => setQuote(null)}
                    onSave={(text) => { act.draft({ add: quoteRemark(target, path, quote, text) }); setQuote(null); }} />
                ) : null}
              </div>
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
