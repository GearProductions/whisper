/** forme-view — l'étape Forme (Créer) en vue IDE, la seule : à gauche l'arborescence des modules de la
 *  rubrique « Forme » de la note (IdeView(ideFiles(view, 'module')), le nom coloré comme VS Code) ; à droite,
 *  pour le module choisi, sa ligne (chemin : dossier atténué, nom en gras ; état : touché par la branche,
 *  existe, à créer, Icon ok devant « touché » ; commits ; outils : comment le cite dans le champ, 💬 le
 *  commente en relecteur, open l'ouvre s'il existe) et l'interrupteur Structure · Code (tenu ici).
 *  Structure : son contrat par rubrique (Contract), et en relecteur la zone de commentaire (CommentBox,
 *  pour le brouillon de revue, remark). Code : ModuleCode (noTree, diff depuis la base d'abord : tout vert
 *  pour un module nouveau, seulement ce que la branche ajoute ou change pour un existant ; readOnly en
 *  relecteur), ou « la branche ne change pas ce module » s'il n'a pas de code. Hors du code (Structure,
 *  ou rien à montrer), act.follow(null) : le principal cesse de suivre un fichier.
 *  En tête : la validation de la forme ; dessous, le commit proposé s'il y en a un
 *  (ProposedCommit : la note ou la Forme changée depuis son commit, Préparer le commit en fait un fixup). Sans note, ou sans Forme : l'Invite de ce qu'il
 *  faut faire, puis, s'il y en a, les fichiers que la branche change (chacun un module d'un seul fichier,
 *  son code à droite).
 *  Relecteur (view.flow === 'review') : rien à juger ni à générer — ni validation, ni « Poser la
 *  forme » ; code en lecture seule ; sous le module, ses remarques du brouillon (remarksAt,
 *  DraftRemarks : grisées, crayon, croix) ; à côté de Commenter, « Poser une question à
 *  l'agent » cite son chemin dans le champ (prefill, rien d'envoyé : I-2).
 *  L'onglet affiché (Structure · Code) est gardé par agent (useKept).
 *  Contract : le contrat d'un module, par rubrique (contractParts, InlineMd).
 *  Ne connaît pas : le pont (rappels passés), le brouillon entier (view.draft, filtré par module). Utilisé par : step-views, modules-view (Contract). */
import { useEffect, useState, type ReactNode } from 'react';
import { contractParts, fileParts, ideFiles, remark, remarksAt, type IdeFile, type Strings } from 'core/vibecoder';
import type { VibeLang, VibeModule } from 'technicals/bridge';
import { Icon, IconButton } from './icons';
import { CommentBox } from './comment-box';
import { DraftRemarks } from './draft-remarks';
import { InlineMd } from './markdown-view';
import { IdeView } from './ide-view';
import { useKept } from './kept-scope';
import { ModuleCode } from './module-code';
import { PROPOSED_ACTS, ProposedCommit } from './proposed-commit';
import { Invite, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import { MarkControl } from './validation';
import './forme-view.css';

const fr = {
  title: 'Forme de la note',
  summary: (n: number, touched: number, missing: number) =>
    [`${n} module${n > 1 ? 's' : ''}`, touched && `${touched} touché${touched > 1 ? 's' : ''}`, missing && `${missing} à créer`].filter(Boolean).join(' · '),
  readOnly: 'Lecture seule : vous relisez cette PR.',
  state: { touched: 'touché', exists: 'existe', missing: 'à créer' },
  stateTitle: {
    touched: 'La branche le modifie (commité ou non)',
    exists: 'Il existe déjà ; la branche ne le touche pas encore',
    missing: 'Il n\'existe pas encore : un module à générer',
  },
  commits: (n: number) => `${n} commit${n > 1 ? 's' : ''}`,
  quote: 'Citer ce module dans le champ',
  noNote: 'Pas encore de note',
  noNoteText: ' La forme s\'écrit dans la note, rubrique « Forme » : rédigez d\'abord la note (étape Note).',
  noForme: 'Pas encore de forme',
  noFormeText: ' « Poser la forme » rédige la rubrique « Forme » de la note (modules, signatures, contrats) sans écrire de code ; le champ peut la préciser.',
  noFormeReview: 'Pas de forme dans la note',
  noFormeReviewText: ' La note de la PR n\'a pas de rubrique « Forme » : aucun module à relire ici.',
  comment: 'Commenter ce module (brouillon de revue)',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    title: 'The note\'s shape',
    summary: (n, touched, missing) =>
      [`${n} module${n === 1 ? '' : 's'}`, touched && `${touched} touched`, missing && `${missing} to create`].filter(Boolean).join(' · '),
    readOnly: 'Read only: you are reviewing this PR.',
    state: { touched: 'touched', exists: 'exists', missing: 'to create' },
    stateTitle: {
      touched: 'The branch changes it (committed or not)',
      exists: 'It already exists; the branch does not touch it yet',
      missing: 'It does not exist yet: a module to generate',
    },
    commits: (n) => `${n} commit${n === 1 ? '' : 's'}`,
    quote: 'Quote this module in the field',
    noNote: 'No note yet',
    noNoteText: ' The shape is written in the note, section « Forme »: write the note first (Note step).',
    noForme: 'No shape yet',
    noFormeText: ' « Lay down the shape » writes the note\'s « Forme » section (modules, signatures, contracts) without writing code; the field can refine it.',
    noFormeReview: 'No shape in the note',
    noFormeReviewText: ' The PR\'s note has no « Forme » section: no module to review here.',
    comment: 'Comment on this module (review draft)',
  },
};

type Shown = 'structure' | 'code';

export function FormeView(p: StepProps) {
  const { view, t, act, busy } = p;
  const s = S[view.lang];
  const { note, modules } = view;
  const [shown, setShown] = useKept<Shown>('shown', 'structure');
  const review = view.flow === 'review';
  const files = ideFiles(view, 'module');
  const code = (m: VibeModule) => (
    <ModuleCode key={m.path} m={m} readOnly={review ? s.readOnly : undefined} code={p.code} t={t} lang={view.lang} open onFollow={act.follow} onSave={act.save}
      onQuote={(block) => act.prefill('comment', block, true)} drafts={p.drafts} noTree />
  );
  return (
    <>
      <StepHead p={p} own={[...(note && !modules.length ? ['forme'] : []), ...(view.outputs['commit.md'] ? PROPOSED_ACTS : [])]} />
      <ProposedCommit p={p} />
      {!note || !modules.length ? (
        <>
          <Invite title={note ? (review ? s.noFormeReview : s.noForme) : s.noNote} text={note ? (review ? s.noFormeReviewText : s.noFormeText) : s.noNoteText}>
            {note ? <Run a={view.actions.find((a) => a.id === 'forme')} busy={busy} tone="accent" onRun={() => act.run('forme')} /> : null}
          </Invite>
          {files.length ? <section className="vc-card vc-forme"><IdeView files={files}>{(f) => (f?.code ? code(f.code) : null)}</IdeView></section> : null}
        </>
      ) : (
        <section className="vc-card vc-forme">
          <div className="vc-card-head">
            <span className="vc-card-title">{s.title}</span>
            <span className="vc-forme-sum">
              {s.summary(modules.length, modules.filter((m) => m.touched).length, modules.filter((m) => !m.file).length)}
            </span>
            {review ? null : (
              <span className="vc-forme-mark">
                <MarkControl what="forme" state={note.formeMark} review={false} lang={view.lang} onMark={(v) => act.mark('forme', v)} />
              </span>
            )}
          </div>
          <IdeView files={files}>
            {(f) => f && f.rank !== null ? (
              <Chosen key={f.path} f={f} m={modules[f.rank]} s={s} p={p} shown={shown} onShown={setShown} code={code} />
            ) : null}
          </IdeView>
        </section>
      )}
    </>
  );
}

type ChosenProps = { f: IdeFile; m: VibeModule; s: typeof fr; p: StepProps; shown: Shown; onShown(k: Shown): void; code(m: VibeModule): ReactNode };

// Le module choisi : sa ligne (chemin, état, commits, outils, interrupteur), puis le contrat ou le code.
function Chosen({ f, m, s, p, shown, onShown, code }: ChosenProps) {
  const { view, t, act } = p;
  const [commenting, setCommenting] = useState(false);
  const review = view.flow === 'review';
  const quote = !review && view.actions.some((a) => a.id === 'comment') ? (text: string) => act.prefill('comment', text) : undefined;
  const target = `forme: ${m.path}`;
  const state = m.touched ? 'touched' : m.file ? 'exists' : 'missing';
  const { dir, name } = fileParts(m.path);
  const showCode = shown === 'code' && !!f.code;
  // Hors du code, le principal ne suit plus de fichier (ModuleCode envoie le sien quand il s'affiche).
  useEffect(() => { if (!showCode) act.follow(null); }, [showCode]);
  return (
    <div className="vc-fmain" data-state={state}>
      <div className="vc-fline">
        <span className="vc-fpath vc-mono" title={m.path}><span className="vc-fdir">{dir}</span><b>{name}</b></span>
        <span className="vc-fstate" data-state={state} title={s.stateTitle[state]}>{state === 'touched' ? <><Icon name="ok" />{s.state.touched}</> : s.state[state]}</span>
        {m.commits.length ? <span className="vc-fcommits vc-mono" title={m.commits.map((h) => h.slice(0, 7)).join(' ')}>{s.commits(m.commits.length)}</span> : null}
        <span className="vc-ftools">
          {quote ? <IconButton icon="comment" label={s.quote} onClick={() => quote(m.path)} /> : null}
          {review ? <IconButton icon="ask" label={t.askAgent} onClick={() => act.prefill('comment', m.path)} /> : null}
          {review ? <IconButton icon="comment" label={s.comment} onClick={() => setCommenting(!commenting)} /> : null}
          {m.file ? <IconButton icon="open" label={t.openTitle} onClick={() => act.open(m.file!.id)} /> : null}
        </span>
        <div className="vc-seg" role="group" aria-label={`${t.structure} / ${t.code}`}>
          {(['structure', 'code'] as Shown[]).map((k) => (
            <button key={k} type="button" aria-pressed={k === shown} onClick={() => onShown(k)}>{t[k]}</button>
          ))}
        </div>
      </div>
      {shown === 'structure' ? <Contract text={m.contract} t={t} onOpenLink={act.openLink} />
        : f.code ? code(f.code) : <p className="vc-fnone">{t.noChange}</p>}
      {review ? <DraftRemarks remarks={remarksAt(view.draft, target)} t={t} onOpenLink={act.openLink}
        onEdit={(id, text) => act.draft({ edit: { id, text } })} onRemove={(id) => act.draft({ remove: id })} /> : null}
      {commenting && review ? (
        <CommentBox t={t} onCancel={() => setCommenting(false)} onSave={(text) => { act.draft({ add: remark(target, text) }); setCommenting(false); }} />
      ) : null}
    </div>
  );
}

// Le contrat d'un module, par rubrique (expose · ne connaît pas · utilisé par) ; rien s'il est vide.
export function Contract({ text, t, onOpenLink }: { text: string; t: Strings; onOpenLink(url: string): void }) {
  const parts = contractParts(text);
  return parts.length ? (
    <dl className="vc-fcontract">
      {parts.map((p, i) => (
        <div key={i} data-label={p.item ? 'item' : p.label ? undefined : 'main'}>
          {p.label ? <dt>{p.label}</dt> : null}
          <dd><InlineMd text={p.text} t={t} onOpenLink={onOpenLink} /></dd>
        </div>
      ))}
    </dl>
  ) : null;
}
