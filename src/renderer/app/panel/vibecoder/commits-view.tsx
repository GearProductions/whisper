/** commits-view — la section Commits de l'étape Modules, pour le relecteur
 *  seul (view.flow === 'review', sinon rien) : les commits de la PR, sans IA,
 *  une carte chacun (hash, sujet ; Voir le diff dans l'éditeur, c<rang> ;
 *  GitHub, gh:c<rang> — des IconButton ; ses fichiers, une liste compacte,
 *  une ligne par fichier, sans cadre ni titre, leur nombre en aria-label) ; s'il y a une relecture
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
 *  commits (IA, puis Relancer) est un bouton de l'en-tête de la section, qui
 *  ne montre rien d'autre qui édite, génère ou commite (lecture seule).
 *  Chaque commit : Validé / À revoir (CaseVerdict, act.mark('commit:<hash>') ;
 *  sur À revoir, « Ajouter une remarque au brouillon » ouvre sa zone de
 *  commentaire, sans rien ajouter), ses remarques du brouillon dessous,
 *  grisées (DraftRemarks : crayon, croix), et *Poser une question à l'agent* :
 *  le cite dans le champ (act.prefill('comment')), l'utilisateur envoie.
 *  Ce n'est plus une étape : un titre de section dans Modules, dont la
 *  vue (modules-view) doit laisser 'review-commits' à cette section (own de
 *  StepHead).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : modules-view. */
import { useEffect, useState, type ReactNode } from 'react';
import { commitReviews, quoteRemark, remark, remarksAt, type Strings } from 'core/vibecoder';
import type { VibeComment, VibeLang, VibeMarkState } from 'technicals/bridge';
import { CommentBox } from './comment-box';
import { CommitFile } from './commit-file';
import { DraftRemarks } from './draft-remarks';
import { IconButton } from './icons';
import { MarkdownView } from './markdown-view';
import { OutputCard, Run } from './step-parts';
import type { StepProps, VibeActs } from './step-views';
import { CaseVerdict } from './validation';
import './commits-view.css';

const fr = {
  title: 'Commits',
  general: 'Ensemble des commits',
  toDraft: 'Une remarque sur ce commit, au brouillon de revue',
  inDraft: (n: number) => (n > 1 ? `${n} remarques au brouillon` : '1 remarque au brouillon'),
  none: 'Aucun commit dans cette PR.',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    title: 'Commits',
    general: 'All commits',
    toDraft: 'A remark on this commit, to the review draft',
    inDraft: (n) => (n > 1 ? `${n} remarks in the draft` : '1 remark in the draft'),
    none: 'No commit in this PR.',
  },
};

export function CommitsSection(p: StepProps) {
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
  if (view.flow !== 'review') return null;
  return (
    <section className="vc-commit-list" aria-label={s.title}>
      <div className="vc-q-head">
        <span className="vc-q-title">{s.title}</span>
        <div className="vc-step-tools">
          {out ? (
            <span className="vc-out-meta">
              <span className="vc-mono">{file}</span>
              <span title={new Date(out.time).toLocaleString(t.locale)}>{t.ago(Date.now() - out.time)}</span>
            </span>
          ) : null}
          <Run a={action} busy={busy} tone={out ? 'ghost' : 'plain'} label={out ? t.rerun : undefined} onRun={() => act.run('review-commits')} />
        </div>
      </div>
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
            verdict={{ state: c.mark ?? null, lang: view.lang, onMark: (v) => act.mark(`commit:${c.hash}`, v) }}
            ask={view.actions.some((a) => a.id === 'comment') ? () => act.prefill('comment', target) : undefined}
            title={<><code className="vc-chip" data-fixup={c.fixup || undefined}>{c.hash.slice(0, 7)}</code><span className="vc-commit-subject">{c.subject}</span></>}
            links={(
              <>
                <IconButton icon="diff" label={t.diffTitle} onClick={() => act.open(`c${i}`)} />
                <IconButton icon="external" label={t.githubTitle} onClick={() => act.open(`gh:c${i}`)} />
              </>
            )}>
            {c.files.length ? (
              <ul className="vc-commit-files" aria-label={t.files(c.files.length)}>
                {c.files.map((f, k) => (
                  <li key={f}><button type="button" className="vc-mono" aria-pressed={k === j}
                    onClick={() => follow(k === j ? null : { i, k, hash: c.hash, path: f })}>{f}</button></li>
                ))}
              </ul>
            ) : null}
            {path != null ? (
              <div className="vc-commit-file">
                <div className="vc-commit-file-head">
                  <span className="vc-mono">{path}</span>
                  <IconButton icon="close" label={t.close} onClick={() => follow(null)} />
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
    </section>
  );
}

type CommentedProps = {
  target: string; title: ReactNode; links?: ReactNode; s: typeof fr; t: Strings; act: VibeActs; draft: VibeComment[];
  verdict?: { state: VibeMarkState; lang: VibeLang; onMark(v: 'ok' | 'ko' | null): void }; // un commit : Validé / À revoir
  ask?(): void; // un commit : Poser une question à l'agent (le cite dans le champ, n'envoie rien)
  children?: ReactNode;
};

// Une carte de commit (ou de rubrique) : 💬 ouvre sous elle la zone de commentaire, pour cette cible ; ses remarques déjà au brouillon dessous, grisées.
function Commented({ target, title, links, verdict, ask, s, t, act, draft, children }: CommentedProps) {
  const [writing, setWriting] = useState(false);
  const here = remarksAt(draft, target);
  const drafted = here.length;
  return (
    <OutputCard className="vc-commit-review" t={t} title={title}
      tools={(
        <>
          {drafted ? <span className="vc-count">{s.inDraft(drafted)}</span> : null}
          {verdict ? <CaseVerdict {...verdict} onRemark={() => setWriting(true)} /> : null}
          {ask ? <IconButton icon="ask" label={t.askAgent} onClick={ask} /> : null}
          {links}
          <IconButton icon="comment" label={s.toDraft} pressed={writing} onClick={() => setWriting(!writing)} />
        </>
      )}>
      {children || writing || drafted ? (
        <>
          {children}
          {drafted ? <DraftRemarks remarks={here} t={t} onOpenLink={act.openLink}
            onEdit={(id, text) => act.draft({ edit: { id, text } })} onRemove={(id) => act.draft({ remove: id })} /> : null}
          {writing ? (
            <CommentBox t={t} onCancel={() => setWriting(false)}
              onSave={(text) => { act.draft({ add: remark(target, text) }); setWriting(false); }} />
          ) : null}
        </>
      ) : null}
    </OutputCard>
  );
}
