/** note-view — l'étape Note : la note du ticket rendue, à jour pendant que
 *  l'agent l'écrit. Ce qu'il a changé depuis le début de son dernier tour a
 *  un liseré vert ; « Voir les modifications » montre le diff brut, retraits
 *  compris, replié autour des changements ; « Vu » repart de la note
 *  actuelle. Les lignes de « Ce que ça ne doit pas faire » portent leur
 *  marque en pastille. 💬 sur un bloc le cite dans le champ (Relire : il
 *  ouvre sous le bloc une zone de commentaire, pour le brouillon de revue ;
 *  ✗ sur la note aussi, sous son en-tête). En tête : son chemin, Ouvrir, sa
 *  validation, la pastille Fable (Créer). Au-dessus, Créer : les questions ouvertes
 *  (questions-view) ; Relire : la relecture de la note par l'agent (Relancer). Pas de
 *  note : ce qu'il faut faire pour en avoir une.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { useMemo, useState } from 'react';
import { changedLines, excerpt, fileParts, foldDiff, lineDiff, mustNotTags, remark, type DiffLine } from 'core/vibecoder';
import type { MustNotMark, VibeLang } from 'technicals/bridge';
import { CommentBox } from './comment-box';
import { MarkdownView } from './markdown-view';
import { QuestionsView } from './questions-view';
import { Invite, OutputCard, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import { FablePill, MarkControl } from './validation';
import './note-view.css';

const fr = {
  changes: 'Changée par l\'agent depuis votre dernier message',
  added: 'lignes ajoutées ou changées',
  removed: 'lignes retirées',
  showDiff: 'Voir les modifications',
  showNote: 'Voir la note',
  seen: 'Vu',
  seenTitle: 'Ne plus surligner : la note actuelle devient la référence',
  skip: (n: number) => `⋯ ${n} ligne${n > 1 ? 's' : ''} inchangée${n > 1 ? 's' : ''}`,
  marks: {
    invariant: ['invariant', 'Critique et invisible à l\'écran : un test d\'invariant, protégé'],
    variant: ['variant', 'Un test ordinaire (variant) suffit'],
    review: ['review', 'Vu en review'],
    structure: ['structure', 'Garanti par la structure du code'],
    none: ['à classer', 'Sans marque : → invariant, variant, review ou structure ?'],
  } as Record<NonNullable<MustNotMark> | 'none', [string, string]>,
  noNote: 'Pas encore de note pour cette branche',
  noNoteText: ' Dictez ou écrivez la demande dans le champ ci-dessus, puis « Rédiger la note » : l\'agent la rédige sous docs/tickets/ et pose à part ses questions ouvertes.',
  noNoteReview: 'Pas de note de ticket dans cette PR',
  noNoteReviewText: ' Une note se cherche sous docs/tickets/, d\'après la branche de la PR ; chargez d\'abord la PR à l\'étape PR.',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    changes: 'Changed by the agent since your last message',
    added: 'lines added or changed',
    removed: 'lines removed',
    showDiff: 'Show the changes',
    showNote: 'Show the note',
    seen: 'Seen',
    seenTitle: 'Stop highlighting: the current note becomes the reference',
    skip: (n) => `⋯ ${n} unchanged line${n === 1 ? '' : 's'}`,
    marks: {
      invariant: ['invariant', 'Critical and invisible on screen: a protected invariant test'],
      variant: ['variant', 'An ordinary test (variant) is enough'],
      review: ['review', 'Checked in review'],
      structure: ['structure', 'Guaranteed by the code\'s structure'],
      none: ['unmarked', 'No mark: → invariant, variant, review or structure?'],
    },
    noNote: 'No note for this branch yet',
    noNoteText: ' Dictate or type the request in the field above, then « Write the note »: the agent writes it under docs/tickets/ and asks its open questions apart.',
    noNoteReview: 'No ticket note in this PR',
    noNoteReviewText: ' A note is looked for under docs/tickets/, after the PR\'s branch; load the PR first, at the PR step.',
  },
};

export function NoteView(p: StepProps) {
  const { view, t, act, busy, answers, onAnswer } = p;
  const s = S[view.lang];
  const { note } = view;
  const review = view.flow === 'review';
  const [raw, setRaw] = useState(false);
  const before = note?.before ?? null, text = note?.text ?? '';
  const diff = useMemo(() => (before === null ? null : lineDiff(before, text)), [before, text]);
  const changed = useMemo(() => (diff ? changedLines(diff) : undefined), [diff]);
  const tags = mustNotTags(text, note?.mustNot ?? []);
  const output = review && view.pr ? view.outputs[`pr-${view.pr.number}-note.md`] : undefined;

  // 💬 : Créer, cité dans le champ ; Relire, une zone de commentaire sous le bloc, pour le brouillon de revue.
  const quote = !review && view.actions.some((a) => a.id === 'comment') ? (q: string) => act.prefill('comment', q) : undefined;
  const comment = review ? (q: string, text: string) => act.draft({ add: remark(`note: ${excerpt(q, 80)}`, text) }) : undefined;
  // Relire, ✗ : la zone de commentaire sous l'en-tête de la note.
  const [refusing, setRefusing] = useState(false);
  const mark = (v: 'ok' | 'ko' | null) => {
    act.mark('note', v);
    setRefusing(review && v === 'ko');
  };
  const tag = (line: number) => {
    if (!tags.has(line)) return null;
    const [label, title] = s.marks[tags.get(line) ?? 'none'];
    return <span className="vc-mn" data-mark={tags.get(line) ?? 'none'} title={title}>{label}</span>;
  };
  const added = changed ? changed.size : 0;
  const removed = diff ? diff.filter((l) => l.kind === 'removed').length : 0;

  return (
    <>
      <StepHead p={p} own={['answers', ...(note ? [] : ['note']), ...(output ? ['review-note'] : [])]}>
        {!review && view.agent.model !== 'fable' ? <FablePill lang={view.lang} onPick={() => act.set({ model: 'fable', effort: 'high' })} /> : null}
      </StepHead>
      {!review && view.questions.length ? <QuestionsView view={view} t={t} act={act} busy={busy} answers={answers} onAnswer={onAnswer} /> : null}
      {output ? (
        <OutputCard title={t.outputs['pr-#-note.md']} file={`pr-${view.pr!.number}-note.md`} time={output.time} t={t}
          tools={<Run a={view.actions.find((a) => a.id === 'review-note')} busy={busy} tone="ghost" label={t.rerun} onRun={() => act.run('review-note')} />}>
          <MarkdownView md={output.text} t={t} onOpenLink={act.openLink} onQuote={quote} onComment={comment} />
        </OutputCard>
      ) : null}
      {note ? (
        <section className="vc-card vc-note">
          <div className="vc-card-head">
            <span className="vc-note-file">📄</span>
            <span className="vc-note-path vc-mono" title={note.path}><span>{fileParts(note.path).dir}</span><b>{fileParts(note.path).name}</b></span>
            <button type="button" className="vc-mini vc-note-open" title={t.openTitle} onClick={() => act.open(note.id)}>{t.open}</button>
            <span className="vc-note-mark"><MarkControl what="note" state={note.mark} review={review} lang={view.lang} onMark={mark} /></span>
          </div>
          {refusing ? (
            <div className="vc-note-refuse">
              <CommentBox t={t} onCancel={() => setRefusing(false)}
                onSave={(text) => { act.draft({ add: remark('note', text) }); setRefusing(false); }} />
            </div>
          ) : null}
          {diff && (added || removed) ? (
            <div className="vc-note-changes" role="status">
              <span className="vc-note-pulse" aria-hidden="true" />
              <span className="vc-note-what">
                {s.changes}
                {added ? <span className="vc-note-n" data-kind="added" title={s.added}>{`+${added}`}</span> : null}
                {removed ? <span className="vc-note-n" data-kind="removed" title={s.removed}>{`−${removed}`}</span> : null}
              </span>
              <button type="button" className="vc-mini" aria-pressed={raw} onClick={() => setRaw(!raw)}>{raw ? s.showNote : s.showDiff}</button>
              <button type="button" className="vc-mini" title={s.seenTitle} onClick={() => { setRaw(false); act.set({ seen: true }); }}>{`✓ ${s.seen}`}</button>
            </div>
          ) : null}
          <div className="vc-card-body">
            {raw && diff ? <RawDiff diff={diff} lang={view.lang} />
              : <MarkdownView md={note.text} t={t} onOpenLink={act.openLink} onQuote={quote} onComment={comment} changed={changed} tag={tag} />}
          </div>
        </section>
      ) : (
        <Invite title={review ? s.noNoteReview : s.noNote} text={review ? s.noNoteReviewText : s.noNoteText}>
          {review ? null : <Run a={view.actions.find((a) => a.id === 'note')} busy={busy} tone="accent" onRun={() => act.run('note')} />}
        </Invite>
      )}
    </>
  );
}

// Le diff brut de la note : ajouts en vert, retraits en rouge barrés, le reste replié autour des changements.
function RawDiff({ diff, lang }: { diff: DiffLine[]; lang: VibeLang }) {
  const folded = useMemo(() => foldDiff(diff), [diff]);
  return (
    <div className="vc-rawdiff scroll">
      {folded.map((l, i) => {
        if (l.kind === 'skip') return <div key={i} className="vc-dl-skip">{S[lang].skip(l.count)}</div>;
        const Line = l.kind === 'added' ? 'ins' : l.kind === 'removed' ? 'del' : 'div';
        return (
          <Line key={i} className="vc-dl" data-kind={l.kind}>
            <span className="vc-dl-sign" aria-hidden="true">{l.kind === 'added' ? '+' : l.kind === 'removed' ? '−' : ' '}</span>
            <span className="vc-dl-text">{l.text || ' '}</span>
          </Line>
        );
      })}
    </div>
  );
}
