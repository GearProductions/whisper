/** invariants-view — l'aiguillage de l'étape Invariants (note 0.16.0-ecran-essentiel).
 *  Créateur : l'en-tête de l'étape (StepHead) puis RulesView (rules-view : les règles rangées par ligne « → invariant »,
 *  leurs tests en pseudo-code, l'alignement) ; rien d'autre — ni cartes par cas, ni verdicts, ni Tout valider, ni Lire en
 *  pseudo-code, ni Voir le fichier, ni éditeur (aucun test ne s'édite ici, aucun fichier n'est suivi), ni Summary, ni
 *  Invariants seuls, ni menu de diff, ni Rien à écrire, ni Écrire les invariants.
 *  Relecteur : inchangé. Chaque test d'invariant de la PR, lu en pseudo-code, une carte par cas : son titre, le
 *  pseudo-code coloré (Pseudo, de rules-view), ses cas limites, ce qu'il garantit, son point d'attention. Dans son
 *  en-tête, alignés : « Pseudo-code / Code » (le code d'origine du cas, en lecture seule : CodeView), le verdict
 *  (CaseVerdict : Validé / À revoir ; la carte discrète une fois validée ; À revoir ouvre la zone de remarque, sans rien
 *  ajouter), modifié depuis (Icon warn et texte ; « Le code commun du fichier a changé » si c'est lui, CaseView.common),
 *  💬 (ouvre sous la carte une zone de commentaire pour le brouillon de revue, le cas en cible), « Poser une question à
 *  l'agent » (cite le titre dans le champ, ne l'envoie pas) et Ouvrir (à la ligne du cas) en IconButton. Sous chaque cas,
 *  les remarques du brouillon qui le visent (DraftRemarks, remarksAt), grisées, empilées, modifiables sur place. Le bloc
 *  Attention a son 💬 : il ouvre la zone de la carte si elle est fermée et y ajoute le point d'attention (withAttention),
 *  sans rien effacer : seul « Ajouter » le verse au brouillon. Sous Garantit, ce que le cas garde (caseLink) : chaque
 *  ligne de la note citée, un lien qui passe à l'étape Note sur elle (goToNote) ; un I-… : son numéro, sans lien ; rien :
 *  « non rattaché » ; la lecture périmée : marqué périmé, comme elle. Par fichier : sa progression ; dans les outils de
 *  l'en-tête, alignés : « Tout valider » (quand aucun cas n'a de point d'attention), « Relire » (en accent si la lecture
 *  d'un cas au moins est périmée, f.stale : Validé / À revoir grisés sur ce cas jusqu'à Relire) ou, pas lu, « Lire en
 *  pseudo-code » (en accent quand c'est l'action mise en avant), Ouvrir ; « Voir le fichier » : le diff du test depuis la
 *  référence du menu de diff (f.base, ou at du fichier suivi : head, validations.invariants ; inconnu : le fichier),
 *  en lecture seule. En tête : « Tout relire », le résumé (Summary), les cas à valider, ce que veut dire « Attention »,
 *  l'alignement (align.md, MarkdownView tagged ; 💬 d'une ligne : une remarque du brouillon). Vue IDE, la seule : sous
 *  l'en-tête de l'étape, une carte (IdeView(diff.filter(invariantTree(view)))) ; à gauche l'arborescence de la Forme :
 *  les tests (vert : ajoutés par la branche, jaune : modifiés) et les fichiers de la Forme, en retrait, numérotés ;
 *  « Invariants seuls » (coché d'emblée, gardé par agent : useKept) ; à droite, d'un test choisi, son en-tête et ses
 *  cartes ; d'un fichier de la Forme, son code en lecture seule (ModuleCode, suivi par son id, act.follow(null) en le
 *  quittant : OnLeave) s'il est touché, sinon son contrat (Contract de forme-view) ; un fichier supprimé depuis la
 *  référence (IdeFile.gone) : son diff tout en retraits. Le menu de diff (useIdeDiff 'invariants' : Depuis la base de
 *  la branche, En ligne · Côte à côte) ; StepHead onSince → showValidated. Sans test : l'invitation ; aucune validation
 *  d'étape.
 *  Ne connaît pas : le pont (rappels passés), le brouillon (ses remarques, par cible). Utilisé par : step-views. */
import { Fragment, useEffect, useState, type ReactNode } from 'react';
import {
  awaiting, goneModule, caseLink, caseSource, casesOf, excerpt, fileParts, invariantTree, progress, remark, remarksAt, withAttention, type CaseLink, type CaseView, type IdeFile, type Progress, type Strings,
} from 'core/vibecoder';
import type { VibeComment, VibeLang, VibeModule, VibeTestFile } from 'technicals/bridge';
import { isInvariantPath } from 'shared/test-paths';
import { CaseLinks } from './case-link';
import { CodeView } from './code-view';
import { CommentBox } from './comment-box';
import { DraftRemarks } from './draft-remarks';
import { Contract } from './forme-view';
import { Icon, IconButton } from './icons';
import { IdeView } from './ide-view';
import { useIdeDiff } from './ide-diff';
import { useKept } from './kept-scope';
import { InlineMd, MarkdownView } from './markdown-view';
import { ModuleCode } from './module-code';
import { ModuleDiffView } from './module-diff-view';
import { Attention, Pseudo, RulesView, warningHelp } from './rules-view';
import { Invite, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import { CaseVerdict } from './validation';
import './invariants-view.css';

const fr = {
  files: (n: number): string => (n > 1 ? 'fichiers' : 'fichier'),
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
  commonState: 'Le code commun du fichier a changé',
  commonTitle: 'Le code commun du fichier (hors des cas) a changé depuis votre verdict : relisez le cas',
  edges: 'Cas limites',
  guarantees: 'Garantit',
  quote: 'Une remarque sur ce cas, au brouillon de revue',
  quoteAttention: 'Reprendre ce point d\'attention dans une remarque, au brouillon de revue',
  formeReadOnly: 'Lecture seule : la Forme se modifie à l\'étape Forme.',
  noReading: 'Pas de lecture pour ce cas (son titre a pu changer) : « Relire » le fichier.',
  reread: 'Relire',
  onlyInv: 'Invariants seuls',
  staleOff: 'Lecture périmée : « Relire » le fichier avant de valider ses cas',
  onlyInvTitle: 'Décoché : les autres fichiers de la référence aussi (la Forme, les variants…), en retrait',
  rereadAll: 'Tout relire',
  casesHere: (n: number) => `${n} cas à valider : Validé ou À revoir sur chaque carte, ou « Tout valider » sur un fichier sans point d'attention.`,
  noTests: 'Aucun test d\'invariant dans cette PR',
  noTestsText: ' Les tests d\'invariants sont rangés sous tests/invariants/.',
  pseudo: 'Pseudo-code',
  code: 'Code',
  show: 'Montrer',
  wholeFile: 'Voir le fichier',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    files: (n) => (n === 1 ? 'file' : 'files'),
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
    commonState: 'The file\'s common code changed',
    commonTitle: 'The file\'s common code (outside the cases) changed since your verdict: read the case again',
    edges: 'Edge cases',
    guarantees: 'Guarantees',
    quote: 'A remark on this case, to the review draft',
    quoteAttention: 'Take this warning into a remark, to the review draft',
    formeReadOnly: 'Read only: the shape is changed in the Forme step.',
    noReading: 'No reading for this case (its title may have changed): « Read again » the file.',
    reread: 'Read again',
    onlyInv: 'Invariants only',
    staleOff: 'Outdated reading: « Read again » the file before validating its cases',
    onlyInvTitle: 'Unchecked: the reference\'s other files too (the forme, the variants…), dimmed',
    rereadAll: 'Read all again',
    casesHere: (n) => `${n} case${n > 1 ? 's' : ''} to approve: Approved or Needs rework on each card, or « Approve all » on a file with no warning.`,
    noTests: 'No invariant test in this PR',
    noTestsText: ' Invariant tests live under tests/invariants/.',
    pseudo: 'Pseudo-code',
    code: 'Code',
    show: 'Show',
    wholeFile: 'View the file',
  },
};
type Labels = typeof fr;
type Verdict = 'ok' | 'ko' | null;

export function InvariantsView(props: StepProps) {
  // Créateur : l'en-tête de l'étape, les règles, rien d'autre ; relecteur : ses cartes.
  return props.view.flow === 'review' ? <ReviewInvariants {...props} /> : <><StepHead p={props} /><RulesView {...props} /></>;
}

function ReviewInvariants(props: StepProps) {
  const { view, t, act, busy } = props;
  const s = S[view.lang];
  const read = view.actions.find((a) => a.id === 'read-invariants');
  const wait = awaiting(view);
  const total = progress(view.invariants);
  const align = view.outputs['align.md'];
  const diff = useIdeDiff(view, 'invariants');
  // Invariants seuls (coché par défaut, gardé par agent) : l'arborescence ne garde que les tests d'invariants ; décoché,
  // le reste de la référence aussi, en retrait (la Forme, les fichiers de la branche).
  const [onlyInv, setOnlyInv] = useKept<boolean>('only-invariants', true);
  const dd = { shown: diff.shown, mode: diff.mode, step: 'invariants' as const };
  const target = (f: VibeTestFile, c: CaseView) => `case:${f.path}:${c.key ?? c.title}`;
  const commentAlign = (q: string, text: string) => act.draft({ add: remark(`align: ${excerpt(q, 80)}`, text) });

  // Voir le fichier : le diff entier, en lecture seule, depuis la référence du menu de la vue IDE ;
  // le texte de la référence pas encore connu (undefined : base inconnue, ou fichier pas encore suivi) : le fichier.
  const fileOrDiff = (f: VibeTestFile, after: string, children: ReactNode) => {
    const at = props.code?.id === f.id ? props.code.at : undefined;
    const before = diff.shown === 'file' ? undefined : diff.shown === 'validated' ? at?.validations?.invariants : diff.shown === 'base' && f.base !== undefined ? f.base : at?.[diff.shown];
    return before === undefined ? children : <ModuleDiffView before={before ?? ''} after={after} path={f.path} mode={diff.mode} lang={view.lang} whole />;
  };
  // Le fichier choisi : son en-tête (chemin, lecture, progression, outils), Voir le fichier, une carte par cas.
  const fileBlock = (f: VibeTestFile) => {
    const p = progress([f]);
    const { dir, name } = fileParts(f.path);
    return (
      <section key={f.path} className="vc-ifile" aria-label={f.path}>
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
              <button type="button" className="vc-vbtn" title={f.stale ? s.staleOff : s.allTitle} disabled={!!f.stale}
                onClick={() => casesOf(f).forEach((c) => { if (c.mark !== 'ok' && c.mark !== 'ko') act.mark(target(f, c), 'ok'); })}>
                <Icon name="ok" />{s.all}
              </button>
            ) : null}
            {f.reading ? <Run a={read} busy={busy} tone={f.stale ? 'accent' : 'ghost'} label={s.reread} onRun={() => act.run('read-invariants', { file: f.id })} />
              : <Run a={read} busy={busy} tone={read?.primary ? 'accent' : 'plain'} onRun={() => act.run('read-invariants')} />}
            <IconButton icon="open" label={t.openTitle} onClick={() => act.open(f.id)} />
          </span>
        </div>
        {f.source ? (
          <details className="vc-ifile-src">
            <summary>{s.wholeFile}</summary>
            {fileOrDiff(f, f.source, <CodeView code={f.source} path={f.path} t={t} />)}
          </details>
        ) : null}
        {casesOf(f).map((c, i) => (
          <CaseCard key={c.key ?? c.title} c={c} n={i + 1} link={caseLink(c.reading, view.note?.mustNot ?? [])} stale={!!c.stale} onGo={props.goToNote} code={caseSource(f, i)} from={f.lines[i]} path={f.path} s={s} t={t} lang={view.lang} onOpenLink={act.openLink}
            onVerdict={(v) => act.mark(target(f, c), v)} onQuote={() => act.prefill('comment', c.title)} onOpen={() => act.open(f.id, f.lines[i])}
            onComment={(text) => act.draft({ add: remark(target(f, c), text) })}
            remarks={remarksAt(view.draft, target(f, c))}
            onDraft={act.draft} />
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
        <ModuleCode m={m} readOnly={s.formeReadOnly} code={props.code} t={t} lang={view.lang} open onFollow={act.follow} onSave={act.save} drafts={props.drafts} noTree diff={dd} />
      </Fragment>
    )
    : <div className="vc-ifile"><Contract text={view.modules[rank].contract} t={t} onOpenLink={act.openLink} /></div>);
  // Un fichier de la branche hors des tests et de la Forme (f.code), ou supprimé depuis la référence (id r<i>, view.diffs) :
  // un module d'un seul fichier, son diff (tout en retraits s'il est supprimé).
  const goneBlock = (f: IdeFile) => (
    <Fragment key={f.path}>
      <OnLeave fn={() => act.follow(null)} />
      <ModuleCode m={f.code ?? goneModule(f)} code={props.code} t={t} lang={view.lang} open onFollow={act.follow} onSave={act.save} drafts={props.drafts} noTree diff={dd} />
    </Fragment>
  );

  return (
    <>
      <StepHead p={props} own={['read-invariants', ...(view.invariants.length ? [] : ['invariants'])]} onSince={diff.showValidated}>
        {view.invariants.some((f) => f.reading) ? (
          <Run a={read} busy={busy} label={s.rereadAll} onRun={() => act.run('read-invariants', { file: '*' })} />
        ) : null}
      </StepHead>
      {wait?.kind === 'cases' ? <p className="vc-ihelp">{s.casesHere(wait.count)}</p> : null}
      {view.invariants.length ? <Summary p={total} files={view.invariants.length} s={s} /> : null}
      {total.warnings ? <p className="vc-ihelp"><span><Icon name="warn" /></span>{warningHelp(view.lang)}</p> : null}
      {align ? (
        <details className="vc-card vc-ialign" open>
          <summary className="vc-card-head">
            <span className="vc-card-title">{t.outputs['align.md']}</span>
            <span className="vc-card-file vc-mono">align.md</span>
            <span className="vc-card-end">
              <span className="vc-card-time" title={new Date(align.time).toLocaleString(t.locale)}>{t.ago(Date.now() - align.time)}</span>
            </span>
          </summary>
          <div className="vc-card-body"><MarkdownView md={align.text} tagged t={t} onOpenLink={act.openLink} onComment={commentAlign} /></div>
        </details>
      ) : null}
      {view.invariants.length ? (
        <section className="vc-card vc-iide">
          <IdeView files={diff.filter(invariantTree(view)).filter((f) => !onlyInv || f.test != null || isInvariantPath(f.path))} empty={diff.empty}
            bar={<>{diff.bar}<label className="vc-only-inv" title={s.onlyInvTitle}><input type="checkbox" checked={onlyInv} onChange={(e) => setOnlyInv(e.target.checked)} />{s.onlyInv}</label></>}>
            {(ide) => (ide?.test != null ? fileBlock(view.invariants[ide.test]) : ide?.gone != null ? goneBlock(ide) : ide?.rank != null ? formeBlock(ide.rank, ide.code) : ide?.code ? goneBlock(ide) : null)}
          </IdeView>
        </section>
      ) : null}
      {view.invariants.length ? null : (
        <Invite title={s.noTests} text={s.noTestsText} />
      )}
    </>
  );
}

// Quitter le fichier choisi (un autre est choisi) referme ce qu'il avait ouvert, et cesse de le suivre.
function OnLeave({ fn }: { fn(): void }) {
  useEffect(() => fn, []);
  return null;
}

// La progression : validés (vert), refusés (rouge), le reste.
function Bar({ p }: { p: Progress }) {
  return (
    <span className="vc-ibar" aria-hidden="true">
      <i data-k="ok" style={{ flexGrow: p.ok }} /><i data-k="ko" style={{ flexGrow: p.ko }} /><i style={{ flexGrow: p.total - p.ok - p.ko }} />
    </span>
  );
}

function Summary({ p, files, s }: { p: Progress; files: number; s: Labels }) {
  const stats: [number, string, string][] = [
    [files, s.files(files), ''], [p.total, s.cases(p.total), ''], [p.ok, s.ok(p.ok), 'ok'], [p.ko, s.ko(p.ko), 'ko'], [p.changed, s.changed(p.changed), 'warn'],
    [p.warnings, s.warnings, 'warn'], [p.unread, s.unread, 'muted'],
  ];
  return (
    <div className="vc-isum">
      {stats.map(([n, label, tone], i) => (i < 3 || n ? <span key={i} className="vc-isum-stat" data-tone={tone || undefined}><b>{n}</b>{label}</span> : null))}
      <Bar p={p} />
    </div>
  );
}

type CardProps = {
  c: CaseView; n: number; s: Labels;
  link: CaseLink; stale: boolean; onGo?(line: string): void;   // ce que le cas garde (caseLink) ; la lecture périmée ; passer à la ligne de la note
  t: Strings; lang: VibeLang;
  code: string; from: number; path: string;   // son code d'origine ('' : inconnu), sa première ligne, son fichier
  onOpenLink(url: string): void; onVerdict(v: Verdict): void; onQuote(): void; onOpen(): void;
  onComment(text: string): void;   // la remarque de la zone de commentaire, sur ce cas
  remarks: VibeComment[]; onDraft: StepProps['act']['draft'];   // celles du brouillon sur ce cas
};

function CaseCard({ c, n, link, stale, onGo, code, from, path, s, t, lang, onOpenLink, onVerdict, onQuote, onOpen, onComment, remarks, onDraft }: CardProps) {
  const r = c.reading;
  const [writing, setWriting] = useState(false);
  const [text, setText] = useState('');   // le texte de la zone, tenu ici pour que le point d'attention s'y ajoute
  const [showCode, setShowCode] = useState(false);
  // 💬 et le bouton de remarque d'un À revoir ouvrent la zone de commentaire.
  const close = () => { setWriting(false); setText(''); };
  return (
    <article className="vc-case" data-mark={c.mark || undefined} data-warn={r?.warning ? true : undefined}>
      <div className="vc-case-head">
        <span className="vc-case-n">{n}</span>
        <h3 className="vc-case-title">{c.title}</h3>
        {c.mark === 'changed' ? <span className="vc-case-state" title={c.common ? s.commonTitle : s.changedTitle}><Icon name="warn" />{c.common ? s.commonState : s.changedState}</span> : null}
        {code ? (
          <span className="vc-seg vc-case-view" role="group" aria-label={s.show}>
            <button type="button" aria-pressed={!showCode} onClick={() => setShowCode(false)}>{s.pseudo}</button>
            <button type="button" aria-pressed={showCode} onClick={() => setShowCode(true)}>{s.code}</button>
          </span>
        ) : null}
        <CaseVerdict state={c.mark} lang={lang} onMark={onVerdict} onRemark={() => setWriting(true)} off={stale ? s.staleOff : undefined} />
        <span className="vc-case-tools">
          <IconButton icon="comment" label={s.quote} pressed={writing} onClick={() => setWriting(!writing)} />
          <IconButton icon="ask" label={t.askAgent} onClick={onQuote} />
          <IconButton icon="open" label={t.openTitle} onClick={onOpen} />
        </span>
      </div>
      {showCode ? <CodeView code={code} from={from} path={path} t={t} /> : null}
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
            <Attention text={r.warning} lang={lang} t={t} onOpenLink={onOpenLink}>
              <span style={{ marginLeft: 'auto' }}>
                <IconButton icon="comment" label={s.quoteAttention}
                  onClick={() => { setWriting(true); setText(withAttention(text, r.warning ?? '')); }} />
              </span>
            </Attention>
          ) : null}
        </>
      ) : <p className="vc-case-none">{s.noReading}</p>}
      <CaseLinks link={link} stale={stale} lang={lang} onGo={onGo} />
      {remarks.length ? <DraftRemarks remarks={remarks} t={t} onDraft={onDraft} onOpenLink={onOpenLink} /> : null}
      {writing ? <CommentBox t={t} value={text} onChange={setText} onCancel={close} onSave={(v) => { onComment(v); close(); }} /> : null}
    </article>
  );
}
