/** invariants-view — l'étape Invariants : chaque test d'invariant de la
 *  branche (ou de la PR), lu en pseudo-code, une carte par cas : son titre,
 *  le pseudo-code coloré (assertions et « étant donné / quand / alors »
 *  repérés), ses cas limites, ce qu'il garantit, son point d'attention ; ✓ /
 *  ✗ (l'état : validé, refusé, modifié depuis), 💬, Ouvrir. ✗ et 💬 citent le
 *  cas dans le champ (Relire : au brouillon de revue, le texte du champ ou le
 *  titre). Par fichier : sa progression, « Tout valider » quand chaque cas
 *  est lu sans point d'attention ; pas lu : ses cas et « Lire en
 *  pseudo-code ». En tête : le résumé de l'étape, l'alignement (align.md).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { useMemo } from 'react';
import { casesOf, excerpt, fileParts, progress, pseudoLines, remark, type CaseView, type Progress, type Strings } from 'core/vibecoder';
import type { VibeLang, VibeTestFile } from 'technicals/bridge';
import { InlineMd, MarkdownView } from './markdown-view';
import { Invite, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import { CaseVerdict } from './validation';
import './invariants-view.css';

const fr = {
  cases: (_n: number): string => 'cas',
  ok: (n: number): string => (n > 1 ? 'validés' : 'validé'),
  ko: (n: number): string => (n > 1 ? 'refusés' : 'refusé'),
  changed: (n: number): string => `modifié${n > 1 ? 's' : ''} depuis la validation`,
  warnings: 'avec un point d\'attention',
  unread: 'à lire',
  read: 'lu',
  toRead: 'à lire',
  validated: (ok: number, total: number) => `${ok} / ${total} validé${ok > 1 ? 's' : ''}`,
  all: '✓ Tout valider',
  allTitle: 'Valider chaque cas de ce fichier qui n\'a pas de verdict : tous sont lus, aucun n\'a de point d\'attention',
  state: { ok: '✓ Validé', ko: '✗ Refusé', changed: '⚠ Modifié depuis la validation' },
  changedTitle: 'Le test a changé depuis votre verdict : relisez le cas',
  edges: 'Cas limites',
  guarantees: 'Garantit',
  warning: 'Attention',
  quote: 'Citer ce cas dans le champ',
  quoteReview: 'Ajouter au brouillon de revue : le texte du champ, sinon le titre du cas',
  unreadText: (n: number) => `${n} cas, pas encore lu${n > 1 ? 's' : ''} en pseudo-code (ou le fichier a changé depuis la lecture).`,
  noReading: 'Pas de lecture pour ce cas (son titre a pu changer) : relancez « Lire en pseudo-code ».',
  noTests: 'Aucun test d\'invariant sur la branche',
  noTestsText: ' « Écrire les invariants (rouges) » les écrit d\'après les lignes « → invariant » de la note ; ou dictez du pseudo-code dans le champ, il est traduit dans le langage du projet.',
  noTestsReview: 'Aucun test d\'invariant dans cette PR',
  noTestsReviewText: ' Les tests d\'invariants sont rangés sous tests/invariants/.',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    cases: (n) => (n === 1 ? 'case' : 'cases'),
    ok: () => 'approved',
    ko: () => 'rejected',
    changed: () => 'changed since the approval',
    warnings: 'with a warning',
    unread: 'to read',
    read: 'read',
    toRead: 'to read',
    validated: (ok, total) => `${ok} / ${total} approved`,
    all: '✓ Approve all',
    allTitle: 'Approve every case of this file that has no verdict: all are read, none has a warning',
    state: { ok: '✓ Approved', ko: '✗ Rejected', changed: '⚠ Changed since the approval' },
    changedTitle: 'The test changed since your verdict: read the case again',
    edges: 'Edge cases',
    guarantees: 'Guarantees',
    warning: 'Warning',
    quote: 'Quote this case in the field',
    quoteReview: 'Add to the review draft: the text of the field, else the case title',
    unreadText: (n) => `${n} case${n === 1 ? '' : 's'}, not read as pseudo-code yet (or the file changed since the reading).`,
    noReading: 'No reading for this case (its title may have changed): run « Read as pseudo-code » again.',
    noTests: 'No invariant test on the branch',
    noTestsText: ' « Write the invariants (red) » writes them from the note\'s « → invariant » lines; or dictate pseudo-code in the field, it is translated into the project\'s language.',
    noTestsReview: 'No invariant test in this PR',
    noTestsReviewText: ' Invariant tests live under tests/invariants/.',
  },
};
type Labels = typeof fr;
type Verdict = 'ok' | 'ko' | null;

export function InvariantsView({ view, step, t, act, busy }: StepProps) {
  const s = S[view.lang];
  const review = view.flow === 'review';
  const total = progress(view.invariants);
  const align = view.outputs['align.md'];
  const target = (f: VibeTestFile, title: string) => `case:${f.path}:${title}`;
  // ✗ et 💬 : Créer, le cas cité dans le champ ; Relire, au brouillon de revue (le texte du champ, sinon le titre).
  const verdict = (f: VibeTestFile, title: string, v: Verdict) => {
    act.mark(target(f, title), v);
    if (v === 'ko') {
      if (review) act.draft({ add: remark(target(f, title), title) });
      else act.prefill('case-ko', title);
    }
  };
  const quote = (f: VibeTestFile, title: string) => (review ? act.draft({ add: remark(target(f, title), title) }) : act.prefill('comment', title));
  const quoteAlign = review ? (q: string) => act.draft({ add: remark(`align: ${excerpt(q, 80)}`, q) })
    : view.actions.some((a) => a.id === 'comment') ? (q: string) => act.prefill('comment', q) : undefined;
  return (
    <>
      <StepHead step={step} t={t} />
      {view.invariants.length ? <Summary p={total} s={s} /> : null}
      {align ? (
        <details className="vc-card vc-ialign" open>
          <summary className="vc-card-head">
            <span className="vc-card-title">{t.outputs['align.md']}</span>
            <span className="vc-card-file vc-mono">align.md</span>
            <span className="vc-card-time" title={new Date(align.time).toLocaleString(t.locale)}>{t.ago(Date.now() - align.time)}</span>
          </summary>
          <div className="vc-card-body"><MarkdownView md={align.text} t={t} onOpenLink={act.openLink} onQuote={quoteAlign} /></div>
        </details>
      ) : null}
      {view.invariants.map((f) => {
        const p = progress([f]);
        const { dir, name } = fileParts(f.path);
        return (
          <section key={f.id} className="vc-ifile" aria-label={f.path}>
            <div className="vc-ifile-head">
              <span className="vc-ifile-path vc-mono" title={f.path}><span className="vc-ifile-dir">{dir}</span><b>{name}</b></span>
              <span className="vc-ifile-read" data-read={!!f.reading || undefined}>{f.reading ? s.read : s.toRead}</span>
              <span className="vc-ifile-progress">
                <Bar p={p} />
                <span>{s.validated(p.ok, p.total)}</span>
              </span>
              <span className="vc-ifile-tools">
                {p.all ? (
                  <button type="button" className="vc-vbtn" title={s.allTitle}
                    onClick={() => casesOf(f).forEach((c) => { if (c.mark !== 'ok' && c.mark !== 'ko') act.mark(target(f, c.title), 'ok'); })}>
                    {s.all}
                  </button>
                ) : null}
                {review ? null : <button type="button" className="vc-mini" title={t.openTitle} onClick={() => act.open(f.id)}>{t.open}</button>}
              </span>
            </div>
            {f.reading ? casesOf(f).map((c, i) => (
              <CaseCard key={c.title} c={c} n={i + 1} s={s} t={t} lang={view.lang} review={review} onOpenLink={act.openLink}
                onVerdict={(v) => verdict(f, c.title, v)} onQuote={() => quote(f, c.title)} onOpen={review ? undefined : () => act.open(f.id)} />
            )) : (
              <div className="vc-iunread">
                <p>{s.unreadText(f.cases.length)}</p>
                <ol>
                  {casesOf(f).map((c) => (
                    <li key={c.title}>
                      <span>{c.title}</span>
                      {c.mark ? <span className="vc-case-state" data-state={c.mark}>{s.state[c.mark]}</span> : null}
                    </li>
                  ))}
                </ol>
                <Run a={view.actions.find((a) => a.id === 'read-invariants')} busy={busy} tone="accent" onRun={() => act.run('read-invariants')} />
              </div>
            )}
          </section>
        );
      })}
      {view.invariants.length ? null : (
        <Invite title={review ? s.noTestsReview : s.noTests} text={review ? s.noTestsReviewText : s.noTestsText}>
          {review ? null : <Run a={view.actions.find((a) => a.id === 'invariants')} busy={busy} tone="accent" onRun={() => act.run('invariants')} />}
        </Invite>
      )}
    </>
  );
}

// La progression : validés (vert), refusés (rouge), le reste.
function Bar({ p }: { p: Progress }) {
  return (
    <span className="vc-ibar" aria-hidden="true">
      <i data-k="ok" style={{ flexGrow: p.ok }} /><i data-k="ko" style={{ flexGrow: p.ko }} /><i style={{ flexGrow: p.total - p.ok - p.ko }} />
    </span>
  );
}

function Summary({ p, s }: { p: Progress; s: Labels }) {
  const stats: [number, string, string][] = [
    [p.total, s.cases(p.total), ''], [p.ok, s.ok(p.ok), 'ok'], [p.ko, s.ko(p.ko), 'ko'], [p.changed, s.changed(p.changed), 'warn'],
    [p.warnings, s.warnings, 'warn'], [p.unread, s.unread, 'muted'],
  ];
  return (
    <div className="vc-isum">
      {stats.map(([n, label, tone], i) => (i < 2 || n ? <span key={i} className="vc-isum-stat" data-tone={tone || undefined}><b>{n}</b>{label}</span> : null))}
      <Bar p={p} />
    </div>
  );
}

type CardProps = {
  c: CaseView; n: number; s: Labels; t: Strings; lang: VibeLang; review: boolean;
  onOpenLink(url: string): void; onVerdict(v: Verdict): void; onQuote(): void; onOpen?(): void;
};

function CaseCard({ c, n, s, t, lang, review, onOpenLink, onVerdict, onQuote, onOpen }: CardProps) {
  const r = c.reading;
  const quote = review ? s.quoteReview : s.quote;
  return (
    <article className="vc-case" data-mark={c.mark || undefined} data-warn={r?.warning ? true : undefined}>
      <div className="vc-case-head">
        <span className="vc-case-n">{n}</span>
        <h3 className="vc-case-title">{c.title}</h3>
        {c.mark ? <span className="vc-case-state" data-state={c.mark} title={c.mark === 'changed' ? s.changedTitle : undefined}>{s.state[c.mark]}</span> : null}
      </div>
      {r ? (
        <>
          <Pseudo code={r.pseudo} />
          {r.edges.length ? (
            <div className="vc-case-row">
              <span className="vc-case-label">{s.edges}</span>
              <ul className="vc-case-edges">{r.edges.map((e, i) => <li key={i}><InlineMd text={e} t={t} onOpenLink={onOpenLink} /></li>)}</ul>
            </div>
          ) : null}
          {r.guarantees ? (
            <div className="vc-case-row vc-case-guarantee">
              <span className="vc-case-label">{s.guarantees}</span>
              <p><InlineMd text={r.guarantees} t={t} onOpenLink={onOpenLink} /></p>
            </div>
          ) : null}
          {r.warning ? (
            <div className="vc-attention" role="note">
              <span className="vc-attention-icon" aria-hidden="true">⚠</span>
              <p><b>{s.warning}</b><InlineMd text={r.warning} t={t} onOpenLink={onOpenLink} /></p>
            </div>
          ) : null}
        </>
      ) : <p className="vc-case-none">{s.noReading}</p>}
      <div className="vc-case-foot">
        {r ? <CaseVerdict state={c.mark} lang={lang} onMark={onVerdict} /> : null}
        <span className="vc-case-tools">
          <button type="button" className="vc-tool" title={quote} aria-label={quote} onClick={onQuote}>💬</button>
          {onOpen ? <button type="button" className="vc-mini" title={t.openTitle} onClick={onOpen}>{t.open}</button> : null}
        </span>
      </div>
    </article>
  );
}

// Le pseudo-code, ligne à ligne : mots-clés, chaînes, nombres, commentaires et leurs « étant donné / quand / alors » ; les assertions repérées.
function Pseudo({ code }: { code: string }) {
  const lines = useMemo(() => pseudoLines(code), [code]);
  return (
    <pre className="vc-pseudo scroll">
      <code>
        {lines.map((l, i) => (
          <span key={i} className="vc-pl" data-assert={l.assert || undefined}>
            {l.parts.map((p, j) => (p.kind === 'text' ? p.text : <span key={j} className={`vc-tk-${p.kind}`}>{p.text}</span>))}
          </span>
        ))}
      </code>
    </pre>
  );
}
