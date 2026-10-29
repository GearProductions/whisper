/** invariants-view — l'étape Invariants : chaque test d'invariant de la
 *  branche (ou de la PR) ; lu en pseudo-code, une carte par cas : son titre,
 *  le pseudo-code coloré (assertions et « étant donné / quand / alors »
 *  repérés), ses cas limites, ce qu'il garantit, son point d'attention ; son
 *  verdict (CaseVerdict : ✓ / ✗), l'état (Icon ok / ko / warn et texte :
 *  validé, refusé, modifié depuis), 💬 et Ouvrir (à la ligne du cas) en
 *  IconButton ; « Pseudo-code / Code » montre à la place son code (CodeView :
 *  coloré d'après l'extension du fichier, comme « Voir le fichier » ; sans 💬
 *  sur ses lignes). Relire : le code d'origine du cas, en lecture seule.
 *  Créer : Code et Voir le fichier ouvrent le fichier entier modifiable (Code :
 *  défilé à la ligne du cas), un seul à la fois, suivi par son id (act.follow ;
 *  refermé par l'utilisateur : act.follow(null)) ; la modification gardée,
 *  Ctrl+S, Enregistrer, Abandonner : useFileDraft et DraftEditor (file-draft),
 *  grisés si f.locked (le motif en titre). ✗ et 💬 citent le
 *  cas dans le champ (Relire : ils ouvrent sous la carte une zone de
 *  commentaire, pour le brouillon de revue, le cas en cible). Par fichier : sa
 *  progression ; dans les outils de l'en-tête, alignés : « Tout valider »
 *  (Icon ok et texte) quand aucun cas n'a de point d'attention (lu ou pas,
 *  progress().all), « Relire » (refaire sa lecture ; en accent si la
 *  lecture est périmée, f.stale : le test a changé depuis, sa lecture reste
 *  affichée, marquée « lecture périmée ») ou, pas lu, « Lire en pseudo-code »
 *  (texte ; en accent seulement quand c'est l'action mise en avant, primary :
 *  Vibe ; ses cartes sans lecture, ✓ / ✗ quand même, la lecture est
 *  facultative), Ouvrir (IconButton). « Voir le fichier » (tout son code,
 *  numéroté ; un test que la branche, ou la PR, modifie, f.base : DiffPicker
 *  Fichier · Diff depuis la base de la branche, le diff ModuleDiffView entier,
 *  en lecture seule, de f.base au texte de l'éditeur en Créer, à f.source en
 *  Relire). Sans test, l'invitation à les écrire, ou « rien à
 *  écrire » si la note n'a aucune ligne « → invariant » ; Créer, la note avec
 *  une ligne « → invariant » : à côté, « ✓ Rien à écrire » (elles sont déjà
 *  observées par des tests existants), validation à la main pour la note telle
 *  qu'elle est (MarkControl, comme « ✓ Valider la note »). En tête : « Tout
 *  relire », le résumé de l'étape, les cas à valider, ce que veut dire
 *  « Attention » (s'il y en a), l'alignement
 *  (align.md, sans Relancer : Créer, « Écrire les invariants » le refait ;
 *  Relire, son bouton est dans la rangée de l'étape).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  awaiting, caseLine, caseSource, casesOf, excerpt, fileParts, progress, pseudoLines, remark, type CaseView, type Progress, type Strings,
} from 'core/vibecoder';
import type { VibeLang, VibeTestFile } from 'technicals/bridge';
import { CodeView } from './code-view';
import { CommentBox } from './comment-box';
import { DiffPicker } from './diff-picker';
import { DraftEditor, useFileDraft } from './file-draft';
import { Icon, IconButton } from './icons';
import { InlineMd, MarkdownView } from './markdown-view';
import { ModuleDiffView } from './module-diff-view';
import { Invite, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import { CaseVerdict, MarkControl } from './validation';
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
  stale: 'lecture périmée',
  staleTitle: 'Le test a changé depuis cette lecture : « Relire » le fichier',
  validated: (ok: number, total: number) => `${ok} / ${total} validé${ok > 1 ? 's' : ''}`,
  all: 'Tout valider',
  allTitle: 'Valider chaque cas de ce fichier qui n\'a pas de verdict : aucun n\'a de point d\'attention',
  state: { ok: 'Validé', ko: 'Refusé', changed: 'Modifié depuis la validation' },
  changedTitle: 'Le test a changé depuis votre verdict : relisez le cas',
  edges: 'Cas limites',
  guarantees: 'Garantit',
  warning: 'Attention',
  warningHelp: 'Attention : le relecteur pense que ce test ne vérifie pas vraiment ce qu\'il annonce (mock, boucle, assertion faible…). Ce n\'est pas un échec : une piste pour votre relecture.',
  quote: 'Citer ce cas dans le champ',
  quoteReview: 'Une remarque sur ce cas, au brouillon de revue',
  noReading: 'Pas de lecture pour ce cas (son titre a pu changer) : « Relire » le fichier.',
  reread: 'Relire',
  rereadAll: 'Tout relire',
  casesHere: (n: number) => `${n} cas à valider : Valider ou À revoir sur chaque carte, ou « Tout valider » sur un fichier sans point d'attention.`,
  noTests: 'Aucun test d\'invariant sur la branche',
  noTestsText: ' « Écrire les invariants (rouges), puis vérifier l\'alignement » les écrit d\'après les lignes « → invariant » de la note ; ou dictez du pseudo-code dans le champ, il est traduit dans le langage du projet.',
  noInvLines: ' La note ne demande aucun invariant : rien à écrire.',
  noTestsReview: 'Aucun test d\'invariant dans cette PR',
  noTestsReviewText: ' Les tests d\'invariants sont rangés sous tests/invariants/.',
  pseudo: 'Pseudo-code',
  code: 'Code',
  show: 'Montrer',
  wholeFile: 'Voir le fichier',
  sinceBase: 'Diff depuis la base de la branche',
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
    stale: 'outdated reading',
    staleTitle: 'The test changed since this reading: « Read again » the file',
    validated: (ok, total) => `${ok} / ${total} approved`,
    all: 'Approve all',
    allTitle: 'Approve every case of this file that has no verdict: none has a warning',
    state: { ok: 'Approved', ko: 'Rejected', changed: 'Changed since the approval' },
    changedTitle: 'The test changed since your verdict: read the case again',
    edges: 'Edge cases',
    guarantees: 'Guarantees',
    warning: 'Warning',
    warningHelp: 'Warning: the reviewer thinks this test does not really check what it claims (mock, loop, weak assertion…). It is not a failure: a lead for your review.',
    quote: 'Quote this case in the field',
    quoteReview: 'A remark on this case, to the review draft',
    noReading: 'No reading for this case (its title may have changed): « Read again » the file.',
    reread: 'Read again',
    rereadAll: 'Read all again',
    casesHere: (n) => `${n} case${n > 1 ? 's' : ''} to approve: Approve or Needs rework on each card, or « Approve all » on a file with no warning.`,
    noTests: 'No invariant test on the branch',
    noTestsText: ' « Write the invariants (red), then check the alignment » writes them from the note\'s « → invariant » lines; or dictate pseudo-code in the field, it is translated into the project\'s language.',
    noInvLines: ' The note asks for no invariant: nothing to write.',
    noTestsReview: 'No invariant test in this PR',
    noTestsReviewText: ' Invariant tests live under tests/invariants/.',
    pseudo: 'Pseudo-code',
    code: 'Code',
    show: 'Show',
    wholeFile: 'View the file',
    sinceBase: 'Diff since the branch base',
  },
};
type Labels = typeof fr;
type Verdict = 'ok' | 'ko' | null;
const STATE_ICON = { ok: 'ok', ko: 'ko', changed: 'warn' } as const;

export function InvariantsView(props: StepProps) {
  const { view, t, act, busy } = props;
  const s = S[view.lang];
  const read = view.actions.find((a) => a.id === 'read-invariants');
  const write = view.actions.find((a) => a.id === 'invariants');
  const wait = awaiting(view);
  const review = view.flow === 'review';
  const total = progress(view.invariants);
  const align = view.outputs['align.md'];
  const target = (f: VibeTestFile, title: string) => `case:${f.path}:${title}`;
  // ✗ et 💬 : Créer, le cas cité dans le champ ; Relire, la zone de commentaire de la carte (CaseCard), au brouillon de revue.
  const verdict = (f: VibeTestFile, title: string, v: Verdict) => {
    act.mark(target(f, title), v);
    if (v === 'ko' && !review) act.prefill('case-ko', title);
  };
  const quoteAlign = !review && view.actions.some((a) => a.id === 'comment') ? (q: string) => act.prefill('comment', q) : undefined;
  const commentAlign = review ? (q: string, text: string) => act.draft({ add: remark(`align: ${excerpt(q, 80)}`, text) }) : undefined;

  // Créer : le fichier ouvert, par son chemin (un id t<i> change de fichier quand la liste change),
  // et où (le titre d'un cas, Code ; null, Voir le fichier). Un seul à la fois.
  const [shown, setShown] = useState<{ path: string; title: string | null } | null>(null);
  const file = review || !shown ? undefined : view.invariants.find((f) => f.path === shown.path);
  const id = file?.id ?? null;
  // null n'est pas envoyé ici : refermé par l'utilisateur, show(null) l'envoie.
  useEffect(() => { if (id) act.follow(id); }, [id]);
  const show = (next: typeof shown) => { setShown(next); if (!next) act.follow(null); };
  const locked = file?.locked ?? null;
  const d = useFileDraft(file ?? null, props.code, locked, act.save, props.drafts);
  const editor = (at?: number): ReactNode => (file ? <DraftEditor d={d} file={file} locked={locked} t={t} at={at} /> : null);
  return (
    <>
      <StepHead p={props} own={['read-invariants', ...(view.invariants.length ? [] : ['invariants'])]}>
        {view.invariants.some((f) => f.reading) ? (
          <Run a={read} busy={busy} label={s.rereadAll} onRun={() => act.run('read-invariants', { file: '*' })} />
        ) : null}
      </StepHead>
      {wait?.kind === 'cases' ? <p className="vc-ihelp">{s.casesHere(wait.count)}</p> : null}
      {view.invariants.length ? <Summary p={total} s={s} /> : null}
      {total.warnings ? <p className="vc-ihelp"><span><Icon name="warn" /></span>{s.warningHelp}</p> : null}
      {align ? (
        <details className="vc-card vc-ialign" open>
          <summary className="vc-card-head">
            <span className="vc-card-title">{t.outputs['align.md']}</span>
            <span className="vc-card-file vc-mono">align.md</span>
            <span className="vc-card-end">
              <span className="vc-card-time" title={new Date(align.time).toLocaleString(t.locale)}>{t.ago(Date.now() - align.time)}</span>
            </span>
          </summary>
          <div className="vc-card-body"><MarkdownView md={align.text} t={t} onOpenLink={act.openLink} onQuote={quoteAlign} onComment={commentAlign} /></div>
        </details>
      ) : null}
      {view.invariants.map((f) => {
        const p = progress([f]);
        const { dir, name } = fileParts(f.path);
        return (
          <section key={f.id} className="vc-ifile" aria-label={f.path}>
            <div className="vc-ifile-head">
              <span className="vc-ifile-path vc-mono" title={f.path}><span className="vc-ifile-dir">{dir}</span><b>{name}</b></span>
              <span className="vc-ifile-read" data-read={(!!f.reading && !f.stale) || undefined} title={f.stale ? s.staleTitle : undefined}>
                {f.stale ? s.stale : f.reading ? s.read : s.toRead}
              </span>
              <span className="vc-ifile-progress">
                <Bar p={p} />
                <span>{s.validated(p.ok, p.total)}</span>
              </span>
              <span className="vc-ifile-tools">
                {p.all ? (
                  <button type="button" className="vc-vbtn" title={s.allTitle}
                    onClick={() => casesOf(f).forEach((c) => { if (c.mark !== 'ok' && c.mark !== 'ko') act.mark(target(f, c.title), 'ok'); })}>
                    <Icon name="ok" />{s.all}
                  </button>
                ) : null}
                {f.reading ? <Run a={read} busy={busy} tone={f.stale ? 'accent' : 'ghost'} label={s.reread} onRun={() => act.run('read-invariants', { file: f.id })} />
                  : <Run a={read} busy={busy} tone={read?.primary ? 'accent' : 'plain'} onRun={() => act.run('read-invariants')} />}
                <IconButton icon="open" label={t.openTitle} onClick={() => act.open(f.id)} />
              </span>
            </div>
            {f.source ? review ? (
              <details className="vc-ifile-src">
                <summary>{s.wholeFile}</summary>
                <FileOrDiff f={f} after={f.source} s={s} lang={view.lang}><CodeView code={f.source} path={f.path} t={t} /></FileOrDiff>
              </details>
            ) : (
              // onToggle part aussi quand open change par les props : seul l'écart est un geste.
              <details className="vc-ifile-src" open={f === file && shown?.title === null}
                onToggle={(e) => { const now = e.currentTarget.open; if (now !== (f === file && shown?.title === null)) show(now ? { path: f.path, title: null } : null); }}>
                <summary>{s.wholeFile}</summary>
                {f === file && shown?.title === null ? <FileOrDiff f={f} after={d.text ?? f.source} s={s} lang={view.lang}>{editor()}</FileOrDiff> : null}
              </details>
            ) : null}
            {casesOf(f).map((c, i) => (
              <CaseCard key={c.title} c={c} n={i + 1} code={caseSource(f, i)} from={f.lines[i]} path={f.path} s={s} t={t} lang={view.lang} review={review} onOpenLink={act.openLink}
                onVerdict={(v) => verdict(f, c.title, v)} onQuote={() => act.prefill('comment', c.title)} onOpen={() => act.open(f.id, caseLine(f, c.title))}
                onComment={(text) => act.draft({ add: remark(target(f, c.title), text) })}
                edit={review ? undefined : {
                  shown: f === file && shown?.title === c.title,
                  onShow: (on) => show(on ? { path: f.path, title: c.title } : null),
                  view: () => editor(f.lines[i]),
                }} />
            ))}
          </section>
        );
      })}
      {view.invariants.length ? null : (
        <Invite title={review ? s.noTestsReview : s.noTests} text={review ? s.noTestsReviewText : write?.hidden ? s.noInvLines : s.noTestsText}>
          {review ? null : <Run a={write} busy={busy} tone="accent" onRun={() => act.run('invariants')} />}
          {review || write?.hidden ? null : <MarkControl what="nothing" state={view.note?.nothingMark ?? null} review={false} lang={view.lang} onMark={(v) => act.mark('nothing', v)} />}
        </Invite>
      )}
    </>
  );
}

// Voir le fichier : un test que la branche modifie (f.base, son texte à la base), Fichier (children) · son diff
// depuis la base, entier, en lecture seule ; ajouté (pas de f.base) : le fichier seul.
function FileOrDiff({ f, after, s, lang, children }: { f: VibeTestFile; after: string; s: Labels; lang: VibeLang; children: ReactNode }) {
  const [shown, setShown] = useState<'file' | 'base'>('file');
  const [mode, setMode] = useState<'inline' | 'split'>('inline');
  if (typeof f.base !== 'string') return children;
  return (
    <>
      <DiffPicker<'base'> options={[{ key: 'base', label: s.sinceBase }]} shown={shown} onShown={setShown}
        mode={shown === 'base' ? mode : null} onMode={setMode} lang={lang} />
      {shown === 'base' ? <ModuleDiffView before={f.base} after={after} path={f.path} mode={mode} lang={lang} whole /> : children}
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
  code: string; from: number; path: string;   // son code d'origine ('' : inconnu), sa première ligne, son fichier
  onOpenLink(url: string): void; onVerdict(v: Verdict): void; onQuote(): void; onOpen(): void;
  onComment(text: string): void;   // Relire : la remarque de la zone de commentaire, sur ce cas
  // Créer : Code ouvre le fichier entier modifiable, un seul à la fois (invariants-view le tient) ; Relire : absent.
  edit?: { shown: boolean; onShow(on: boolean): void; view(): ReactNode };
};

function CaseCard({ c, n, code, from, path, s, t, lang, review, onOpenLink, onVerdict, onQuote, onOpen, onComment, edit }: CardProps) {
  const r = c.reading;
  const quote = review ? s.quoteReview : s.quote;
  const [writing, setWriting] = useState(false);
  const [local, setLocal] = useState(false);
  const showCode = edit ? edit.shown : local;
  // Pseudo-code sur une carte déjà fermée ne referme pas le fichier ouvert ailleurs.
  const setShowCode = edit ? (on: boolean) => { if (on !== edit.shown) edit.onShow(on); } : setLocal;
  // Relire : ✗ et 💬 ouvrent la zone de commentaire ; Créer : 💬 cite le cas dans le champ.
  const verdict = (v: Verdict) => { onVerdict(v); if (review && v === 'ko') setWriting(true); };
  return (
    <article className="vc-case" data-mark={c.mark || undefined} data-warn={r?.warning ? true : undefined}>
      <div className="vc-case-head">
        <span className="vc-case-n">{n}</span>
        <h3 className="vc-case-title">{c.title}</h3>
        {c.mark ? <span className="vc-case-state" data-state={c.mark} title={c.mark === 'changed' ? s.changedTitle : undefined}><Icon name={STATE_ICON[c.mark]} />{s.state[c.mark]}</span> : null}
        {code ? (
          <span className="vc-seg vc-case-view" role="group" aria-label={s.show}>
            <button type="button" aria-pressed={!showCode} onClick={() => setShowCode(false)}>{s.pseudo}</button>
            <button type="button" aria-pressed={showCode} onClick={() => setShowCode(true)}>{s.code}</button>
          </span>
        ) : null}
      </div>
      {showCode ? edit ? edit.view() : <CodeView code={code} from={from} path={path} t={t} /> : null}
      {r ? (
        <>
          {showCode ? null : <Pseudo code={r.pseudo} />}
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
            <div className="vc-attention" role="note" title={s.warningHelp}>
              <span className="vc-attention-icon"><Icon name="warn" /></span>
              <p><b>{s.warning}</b><InlineMd text={r.warning} t={t} onOpenLink={onOpenLink} /></p>
            </div>
          ) : null}
        </>
      ) : <p className="vc-case-none">{s.noReading}</p>}
      <div className="vc-case-foot">
        <CaseVerdict state={c.mark} lang={lang} onMark={verdict} />
        <span className="vc-case-tools">
          <IconButton icon="comment" label={quote} pressed={review ? writing : undefined} onClick={() => (review ? setWriting(!writing) : onQuote())} />
          <IconButton icon="open" label={t.openTitle} onClick={onOpen} />
        </span>
      </div>
      {writing ? <CommentBox t={t} onCancel={() => setWriting(false)} onSave={(text) => { onComment(text); setWriting(false); }} /> : null}
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
