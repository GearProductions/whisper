/** invariants-view — l'étape Invariants : chaque test d'invariant de la
 *  branche (ou de la PR) ; lu en pseudo-code, une carte par cas : son titre,
 *  le pseudo-code coloré (assertions et « étant donné / quand / alors »
 *  repérés), ses cas limites, ce qu'il garantit, son point d'attention. Dans
 *  son en-tête, alignés : « Pseudo-code / Code », le verdict (CaseVerdict :
 *  badges Validé / À revoir ; la carte discrète une fois validée), modifié
 *  depuis (Icon warn et texte), 💬 et Ouvrir (à la ligne du cas) en
 *  IconButton. « Pseudo-code / Code » montre à la place son code (CodeView :
 *  coloré d'après l'extension du fichier, comme « Voir le fichier » ; sans 💬
 *  sur ses lignes). Relecteur : le code d'origine du cas, en lecture seule.
 *  Créateur : Code et Voir le fichier ouvrent le fichier entier modifiable (Code :
 *  défilé à la ligne du cas), un seul à la fois, suivi par son id (act.follow ;
 *  refermé par l'utilisateur : act.follow(null)) ; la modification gardée,
 *  Ctrl+S, Enregistrer, Abandonner : useFileDraft et DraftEditor (file-draft),
 *  grisés si f.locked (le motif en titre). À revoir et 💬 citent le
 *  cas dans le champ (relecteur : 💬 ouvre sous la carte une zone de
 *  commentaire, pour le brouillon de revue, le cas en cible). Par fichier : sa
 *  progression ; dans les outils de l'en-tête, alignés : « Tout valider »
 *  (Icon ok et texte) quand aucun cas n'a de point d'attention (lu ou pas,
 *  progress().all), « Relire » (refaire sa lecture ; en accent si la
 *  lecture est périmée, f.stale : le test a changé depuis, sa lecture reste
 *  affichée, marquée « lecture périmée ») ou, pas lu, « Lire en pseudo-code »
 *  (texte ; en accent seulement quand c'est l'action mise en avant, primary :
 *  Vibe ; ses cartes sans lecture, Validé / À revoir quand même, la lecture est
 *  facultative), Ouvrir (IconButton). « Voir le fichier » (tout son code,
 *  numéroté ; un test que la branche, ou la PR, modifie, f.base : DiffPicker
 *  Fichier · Diff depuis la base de la branche, le diff ModuleDiffView entier,
 *  en lecture seule, de f.base au texte de l'éditeur en créateur, à f.source en
 *  relecteur). Sans test, l'invitation à les écrire, ou « rien à
 *  écrire » si la note n'a aucune ligne « → invariant » ; créateur, la note avec
 *  une ligne « → invariant » : à côté, « ✓ Rien à écrire » (elles sont déjà
 *  observées par des tests existants), validation à la main pour la note telle
 *  qu'elle est (MarkControl, comme « ✓ Valider la note »). En tête : « Tout
 *  relire », le résumé de l'étape (Summary : fichiers, cas, validés, à lire ; l'en-tête
 *  d'étape ne les répète plus), les cas à valider, ce que veut dire
 *  « Attention » (s'il y en a), l'alignement
 *  (align.md ; créateur : Relancer dans son en-tête, l'action align seule, pour
 *  revérifier après avoir corrigé les tests ; relecteur, son bouton est dans la
 *  rangée de l'étape).
 *  Le bloc Attention a son 💬 : créateur, il cite le cas et son point
 *  d'attention en entier dans le champ (attentionQuote) ; relecteur, il ouvre la
 *  zone de la carte si elle est fermée et y ajoute le point d'attention
 *  (withAttention) sans rien effacer : seul « Ajouter » le verse au brouillon.
 *  Relecteur : sous chaque cas, les remarques du brouillon qui le visent (DraftRemarks, remarksAt), grisées,
 *  empilées, modifiables sur place ; à côté de 💬, « Poser une question à l'agent » (cite le titre dans le champ,
 *  ne l'envoie pas) ; un cas À revoir : le bouton de remarque (CaseVerdict.onRemark) ouvre la zone, sans rien
 *  ajouter ; À revoir ne l'ouvre plus d'office. Le fichier ouvert est gardé par agent (useKept).
 *  Vue IDE, la seule : sous l'en-tête de l'étape, une carte (IdeView(invariantTree(view))) ; à gauche la
 *  même arborescence que la Forme : les tests (vert : ajoutés par la branche, jaune : modifiés, d'après leur
 *  base ; sans numéro) et les fichiers de la Forme, en retrait, numérotés (sans Forme : les tests seuls) ; à
 *  droite, d'un test choisi, son en-tête et ses cartes, comme avant (le premier d'emblée) ; d'un fichier de la
 *  Forme, son code en lecture seule (ModuleCode readOnly, comme à l'étape Forme ; suivi par son id, act.follow(null) en le quittant) s'il est touché, sinon son
 *  contrat (Contract de forme-view). Aucune analyse des imports. Choisir un autre fichier referme le fichier
 *  ouvert d'un test (OnLeave : act.follow(null)). Sans test : l'invitation, pas de carte ; son texte cite
 *  le bouton tel qu'il est (« Écrire les invariants (rouges) »).
 *  Sous Garantit, ce que le cas garde (caseLink) : chaque ligne de la note citée, un lien qui passe à
 *  l'étape Note sur elle (goToNote) ; un I-… : son numéro, sans lien ; rien : « non rattaché » ; la lecture
 *  périmée : marqué périmé, comme elle.
 *  L'alignement (align.md) : MarkdownView tagged (badges pour toi / pour l'agent, le grisé).
 *  Ne connaît pas : le pont (rappels passés), le brouillon (ses remarques, par cible). Utilisé par : step-views. */
import { Fragment, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  attentionQuote, awaiting, caseLine, caseLink, caseSource, casesOf, excerpt, fileParts, invariantTree, progress, pseudoLines, remark, remarksAt, withAttention, type CaseLink, type CaseView, type Progress, type Strings,
} from 'core/vibecoder';
import type { VibeComment, VibeLang, VibeModule, VibeTestFile } from 'technicals/bridge';
import { CaseLinks } from './case-link';
import { CodeView } from './code-view';
import { CommentBox } from './comment-box';
import { DiffPicker } from './diff-picker';
import { DraftRemarks } from './draft-remarks';
import { DraftEditor, useFileDraft } from './file-draft';
import { Contract } from './forme-view';
import { Icon, IconButton } from './icons';
import { IdeView } from './ide-view';
import { useKept } from './kept-scope';
import { InlineMd, MarkdownView } from './markdown-view';
import { ModuleCode } from './module-code';
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
  changedState: 'Modifié depuis la validation',
  changedTitle: 'Le test a changé depuis votre verdict : relisez le cas',
  edges: 'Cas limites',
  guarantees: 'Garantit',
  warning: 'Attention',
  warningHelp: 'Attention : le relecteur pense que ce test ne vérifie pas vraiment ce qu\'il annonce (mock, boucle, assertion faible…). Ce n\'est pas un échec : une piste pour votre relecture.',
  quote: 'Citer ce cas dans le champ',
  quoteReview: 'Une remarque sur ce cas, au brouillon de revue',
  quoteAttention: 'Citer ce point d\'attention dans le champ',
  quoteAttentionReview: 'Reprendre ce point d\'attention dans une remarque, au brouillon de revue',
  formeReadOnly: 'Lecture seule : la Forme se modifie à l\'étape Forme.',
  noReading: 'Pas de lecture pour ce cas (son titre a pu changer) : « Relire » le fichier.',
  reread: 'Relire',
  rereadAll: 'Tout relire',
  casesHere: (n: number) => `${n} cas à valider : Validé ou À revoir sur chaque carte, ou « Tout valider » sur un fichier sans point d'attention.`,
  noTests: 'Aucun test d\'invariant sur la branche',
  noTestsText: ' « Écrire les invariants (rouges) » les écrit d\'après les lignes « → invariant » de la note ; ou dictez du pseudo-code dans le champ, il est traduit dans le langage du projet.',
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
    changedState: 'Changed since the approval',
    changedTitle: 'The test changed since your verdict: read the case again',
    edges: 'Edge cases',
    guarantees: 'Guarantees',
    warning: 'Warning',
    warningHelp: 'Warning: the reviewer thinks this test does not really check what it claims (mock, loop, weak assertion…). It is not a failure: a lead for your review.',
    quote: 'Quote this case in the field',
    quoteReview: 'A remark on this case, to the review draft',
    quoteAttention: 'Quote this warning in the field',
    quoteAttentionReview: 'Take this warning into a remark, to the review draft',
    formeReadOnly: 'Read only: the shape is changed in the Forme step.',
    noReading: 'No reading for this case (its title may have changed): « Read again » the file.',
    reread: 'Read again',
    rereadAll: 'Read all again',
    casesHere: (n) => `${n} case${n > 1 ? 's' : ''} to approve: Approved or Needs rework on each card, or « Approve all » on a file with no warning.`,
    noTests: 'No invariant test on the branch',
    noTestsText: ' « Write the invariants (red) » writes them from the note\'s « → invariant » lines; or dictate pseudo-code in the field, it is translated into the project\'s language.',
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
  // À revoir : Créer, le cas cité dans le champ ; Relire, marque seulement (son bouton de remarque ouvre la zone de la carte).
  const verdict = (f: VibeTestFile, title: string, v: Verdict) => {
    act.mark(target(f, title), v);
    if (v === 'ko' && !review) act.prefill('case-ko', title);
  };
  const quoteAlign = !review && view.actions.some((a) => a.id === 'comment') ? (q: string) => act.prefill('comment', q) : undefined;
  const commentAlign = review ? (q: string, text: string) => act.draft({ add: remark(`align: ${excerpt(q, 80)}`, text) }) : undefined;

  // Créer : le fichier ouvert, par son chemin (un id t<i> change de fichier quand la liste change),
  // et où (le titre d'un cas, Code ; null, Voir le fichier). Un seul à la fois.
  const [shown, setShown] = useKept<{ path: string; title: string | null } | null>('shown', null);
  const file = review || !shown ? undefined : view.invariants.find((f) => f.path === shown.path);
  const id = file?.id ?? null;
  // null n'est pas envoyé ici : refermé par l'utilisateur, show(null) l'envoie.
  useEffect(() => { if (id) act.follow(id); }, [id]);
  const show = (next: typeof shown) => { setShown(next); if (!next) act.follow(null); };
  const locked = file?.locked ?? null;
  const d = useFileDraft(file ?? null, props.code, locked, act.save, props.drafts);
  const editor = (at?: number): ReactNode => (file ? <DraftEditor d={d} file={file} locked={locked} t={t} at={at} /> : null);
  // Le fichier choisi : son en-tête (chemin, lecture, progression, outils), Voir le fichier, une carte par cas.
  const fileBlock = (f: VibeTestFile) => {
    const p = progress([f]);
    const { dir, name } = fileParts(f.path);
    return (
      <section key={f.path} className="vc-ifile" aria-label={f.path}>
        {review ? null : <OnLeave fn={() => show(null)} />}
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
          <CaseCard key={c.title} c={c} n={i + 1} link={caseLink(c.reading, view.note?.mustNot ?? [])} stale={!!f.stale} onGo={props.goToNote} code={caseSource(f, i)} from={f.lines[i]} path={f.path} s={s} t={t} lang={view.lang} review={review} onOpenLink={act.openLink}
            onVerdict={(v) => verdict(f, c.title, v)} onQuote={() => act.prefill('comment', c.title)}
            onQuoteAttention={() => act.prefill('comment', attentionQuote(c.title, c.reading?.warning ?? ''), true)} onOpen={() => act.open(f.id, caseLine(f, c.title))}
            onComment={(text) => act.draft({ add: remark(target(f, c.title), text) })}
            remarks={review ? remarksAt(view.draft, target(f, c.title)) : []}
            onDraft={act.draft}
            edit={review ? undefined : {
              shown: f === file && shown?.title === c.title,
              onShow: (on) => show(on ? { path: f.path, title: c.title } : null),
              view: () => editor(f.lines[i]),
            }} />
        ))}
      </section>
    );
  };
  // Un fichier de la Forme : son code en lecture seule s'il est touché (suivi pour que le principal pousse son texte,
  // et cessé en le quittant, comme un test), sinon son contrat.
  const formeBlock = (rank: number, m: VibeModule | null) => (m
    ? (
      <Fragment key={m.path}>
        <OnLeave fn={() => act.follow(null)} />
        <ModuleCode m={m} readOnly={s.formeReadOnly} code={props.code} t={t} lang={view.lang} open onFollow={act.follow} onSave={act.save} drafts={props.drafts} noTree />
      </Fragment>
    )
    : <div className="vc-ifile"><Contract text={view.modules[rank].contract} t={t} onOpenLink={act.openLink} /></div>);
  return (
    <>
      <StepHead p={props} own={['read-invariants', ...(review ? [] : ['align']), ...(view.invariants.length ? [] : ['invariants'])]}>
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
              {/* Dans le summary : le clic relance sans replier la carte. */}
              {review ? null : (
                <span onClick={(e) => e.preventDefault()}>
                  <Run a={view.actions.find((a) => a.id === 'align')} busy={busy} tone="ghost" label={t.rerun} onRun={() => act.run('align')} />
                </span>
              )}
            </span>
          </summary>
          <div className="vc-card-body"><MarkdownView md={align.text} tagged t={t} onOpenLink={act.openLink} onQuote={quoteAlign} onComment={commentAlign} /></div>
        </details>
      ) : null}
      {view.invariants.length ? (
        <section className="vc-card vc-iide">
          <IdeView files={invariantTree(view)}>{(ide) => (ide?.test != null ? fileBlock(view.invariants[ide.test]) : ide?.rank != null ? formeBlock(ide.rank, ide.code) : null)}</IdeView>
        </section>
      ) : null}
      {view.invariants.length ? null : (
        <Invite title={review ? s.noTestsReview : s.noTests} text={review ? s.noTestsReviewText : write?.hidden ? s.noInvLines : s.noTestsText}>
          {review ? null : <Run a={write} busy={busy} tone="accent" onRun={() => act.run('invariants')} />}
          {review || write?.hidden ? null : <MarkControl what="nothing" state={view.note?.nothingMark ?? null} review={false} lang={view.lang} onMark={(v) => act.mark('nothing', v)} />}
        </Invite>
      )}
    </>
  );
}

// Quitter le fichier choisi (un autre est choisi) referme ce qu'il avait ouvert, et cesse de le suivre.
function OnLeave({ fn }: { fn(): void }) {
  useEffect(() => fn, []);
  return null;
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
  c: CaseView; n: number; s: Labels;
  link: CaseLink; stale: boolean; onGo?(line: string): void;   // ce que le cas garde (caseLink) ; la lecture périmée ; passer à la ligne de la note
  t: Strings; lang: VibeLang; review: boolean;
  code: string; from: number; path: string;   // son code d'origine ('' : inconnu), sa première ligne, son fichier
  onOpenLink(url: string): void; onVerdict(v: Verdict): void; onQuote(): void; onQuoteAttention(): void; onOpen(): void;
  onComment(text: string): void;   // Relecteur : la remarque de la zone de commentaire, sur ce cas
  remarks: VibeComment[]; onDraft: StepProps['act']['draft'];   // Relecteur : celles du brouillon sur ce cas
  // Créateur : Code ouvre le fichier entier modifiable, un seul à la fois (invariants-view le tient) ; relecteur : absent.
  edit?: { shown: boolean; onShow(on: boolean): void; view(): ReactNode };
};

function CaseCard({ c, n, link, stale, onGo, code, from, path, s, t, lang, review, onOpenLink, onVerdict, onQuote, onQuoteAttention, onOpen, onComment, remarks, onDraft, edit }: CardProps) {
  const r = c.reading;
  const quote = review ? s.quoteReview : s.quote;
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');   // Relecteur : le texte de la zone, tenu ici pour que le point d'attention s'y ajoute
  const [local, setLocal] = useState(false);
  const showCode = edit ? edit.shown : local;
  // Pseudo-code sur une carte déjà fermée ne referme pas le fichier ouvert ailleurs.
  const setShowCode = edit ? (on: boolean) => { if (on !== edit.shown) edit.onShow(on); } : setLocal;
  // Relecteur : 💬 et le bouton de remarque d'un À revoir ouvrent la zone de commentaire ; créateur : 💬 cite le cas dans le champ.
  const close = () => { setWriting(false); setText(''); };
  return (
    <article className="vc-case" data-mark={c.mark || undefined} data-warn={r?.warning ? true : undefined}>
      <div className="vc-case-head">
        <span className="vc-case-n">{n}</span>
        <h3 className="vc-case-title">{c.title}</h3>
        {c.mark === 'changed' ? <span className="vc-case-state" title={s.changedTitle}><Icon name="warn" />{s.changedState}</span> : null}
        {code ? (
          <span className="vc-seg vc-case-view" role="group" aria-label={s.show}>
            <button type="button" aria-pressed={!showCode} onClick={() => setShowCode(false)}>{s.pseudo}</button>
            <button type="button" aria-pressed={showCode} onClick={() => setShowCode(true)}>{s.code}</button>
          </span>
        ) : null}
        <CaseVerdict state={c.mark} lang={lang} onMark={onVerdict} onRemark={review ? () => setWriting(true) : undefined} />
        <span className="vc-case-tools">
          <IconButton icon="comment" label={quote} pressed={review ? writing : undefined} onClick={() => (review ? setWriting(!writing) : onQuote())} />
          {review ? <IconButton icon="ask" label={t.askAgent} onClick={onQuote} /> : null}
          <IconButton icon="open" label={t.openTitle} onClick={onOpen} />
        </span>
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
              <span style={{ marginLeft: 'auto' }}>
                <IconButton icon="comment" label={review ? s.quoteAttentionReview : s.quoteAttention}
                  onClick={() => { if (!review) return onQuoteAttention(); setWriting(true); setText(withAttention(text, r.warning ?? '')); }} />
              </span>
            </div>
          ) : null}
        </>
      ) : <p className="vc-case-none">{s.noReading}</p>}
      <CaseLinks link={link} stale={stale} lang={lang} onGo={onGo} />
      {remarks.length ? <DraftRemarks remarks={remarks} t={t} onDraft={onDraft} onOpenLink={onOpenLink} /> : null}
      {writing ? <CommentBox t={t} value={text} onChange={setText} onCancel={close} onSave={(v) => { onComment(v); close(); }} /> : null}
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
