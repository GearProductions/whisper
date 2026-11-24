/** forme-view — l'étape Forme.
 *  Créateur (note 0.16.0-ecran-essentiel) : la liste des modules, sans code — une ligne par module, son chemin
 *  (dossier atténué, nom en gras) et ce qu'il fait en une phrase (moduleLine de core/vibecoder) ; ni arbre, ni diff,
 *  ni Structure · Code, ni badge « touché », ni commits, ni icônes, ni boutons, ni validation (le ✓ est sur le badge
 *  de l'étape), ni commit proposé, ni Poser la forme ; aucun fichier suivi. Sans note ou sans Forme : une phrase.
 *  Relecteur (view.flow === 'review'), sa vue, inchangée : à gauche l'arborescence des modules de la rubrique « Forme »
 *  de la note (IdeView(ideFiles(view, 'module'))) ; à droite, pour le module choisi, sa ligne (chemin, état : touché
 *  par la branche, existe, à créer, Icon ok devant « touché » ; commits ; outils : 💬 le commente, « Poser une question
 *  à l'agent » cite son chemin dans le champ (prefill, rien d'envoyé : I-2), open l'ouvre s'il existe) et l'interrupteur
 *  Structure · Code (gardé par agent : useKept). Structure : son contrat par rubrique (Contract) et la zone de commentaire
 *  (CommentBox, remark) ; sous le module, ses remarques du brouillon (remarksAt, DraftRemarks : grisées, crayon, croix).
 *  Code : ModuleCode (noTree, readOnly), ou « la branche ne change pas ce module ». Hors du code, act.follow(null) : le
 *  principal cesse de suivre un fichier. Sans note, ou sans Forme : l'Invite, puis, s'il y en a, les fichiers que la
 *  branche change (chacun un module d'un seul fichier, son code à droite). Ni menu de diff ni validation.
 *  Contract : le contrat d'un module, par rubrique (contractParts, InlineMd).
 *  Ne connaît pas : le pont (rappels passés), le brouillon entier (view.draft, filtré par module). Utilisé par : step-views, modules-view et invariants-view (Contract, le relecteur). */
import { useEffect, useState, type ReactNode } from 'react';
import { contractParts, fileParts, goneModule, ideFiles, moduleLine, remark, remarksAt, type IdeFile, type Strings } from 'core/vibecoder';
import type { VibeLang, VibeModule } from 'technicals/bridge';
import { Icon, IconButton } from './icons';
import { CommentBox } from './comment-box';
import { DraftRemarks } from './draft-remarks';
import { InlineMd } from './markdown-view';
import { IdeView } from './ide-view';
import { useKept } from './kept-scope';
import { ModuleCode } from './module-code';
import { Invite, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import './forme-view.css';

const fr = {
  readOnly: 'Lecture seule : vous relisez cette PR.',
  state: { touched: 'touché', exists: 'existe', missing: 'à créer' },
  stateTitle: {
    touched: 'La branche le modifie (commité ou non)',
    exists: 'Il existe déjà ; la branche ne le touche pas encore',
    missing: 'Il n\'existe pas encore : un module à générer',
  },
  commits: (n: number) => `${n} commit${n > 1 ? 's' : ''}`,
  noNote: 'Pas encore de note',
  noNoteText: ' La forme s\'écrit dans la note, rubrique « Forme » : rédigez d\'abord la note (étape Note).',
  noForme: 'Pas encore de forme',
  noFormeText: ' L\'agent rédige la rubrique « Forme » de la note (modules, signatures, contrats), sans écrire de code.',
  noFormeReview: 'Pas de forme dans la note',
  noFormeReviewText: ' La note de la PR n\'a pas de rubrique « Forme » : aucun module à relire ici.',
  comment: 'Commenter ce module (brouillon de revue)',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    readOnly: 'Read only: you are reviewing this PR.',
    state: { touched: 'touched', exists: 'exists', missing: 'to create' },
    stateTitle: {
      touched: 'The branch changes it (committed or not)',
      exists: 'It already exists; the branch does not touch it yet',
      missing: 'It does not exist yet: a module to generate',
    },
    commits: (n) => `${n} commit${n === 1 ? '' : 's'}`,
    noNote: 'No note yet',
    noNoteText: ' The shape is written in the note, section « Forme »: write the note first (Note step).',
    noForme: 'No shape yet',
    noFormeText: ' The agent writes the note\'s « Forme » section (modules, signatures, contracts), without writing code.',
    noFormeReview: 'No shape in the note',
    noFormeReviewText: ' The PR\'s note has no « Forme » section: no module to review here.',
    comment: 'Comment on this module (review draft)',
  },
};

type Shown = 'structure' | 'code';

export const FormeView = (p: StepProps) => (p.view.flow === 'review' ? <ReviewerForme {...p} /> : <Essentials {...p} />);

// Le créateur : la liste, une ligne par module ; sans note ou sans Forme, une phrase (aucun bouton, aucun fichier suivi).
function Essentials(p: StepProps) {
  const { note, modules, lang } = p.view;
  const s = S[lang];
  return (
    <>
      <StepHead p={p} />
      {note && modules.length ? (
        <ul className="vc-card vc-forme-list">
          {modules.map((m) => {
            const { dir, name } = fileParts(m.path);
            const line = moduleLine(m.contract);
            return (
              <li key={m.path}>
                <span className="vc-fpath vc-mono" title={m.path}><span className="vc-fdir">{dir}</span><b>{name}</b></span>
                {line ? <span className="vc-fsay">{line}</span> : null}
              </li>
            );
          })}
        </ul>
      ) : <Invite title={note ? s.noForme : s.noNote} text={note ? s.noFormeText : s.noNoteText} />}
    </>
  );
}

// Le relecteur : la vue IDE, Structure · Code, ses remarques.
function ReviewerForme(p: StepProps) {
  const { view, t, act, busy } = p;
  const s = S[view.lang];
  const { note, modules } = view;
  const [shown, setShown] = useKept<Shown>('shown', 'structure');
  const files = ideFiles(view, 'module');
  const code = (m: VibeModule) => (
    <ModuleCode key={m.path} m={m} readOnly={s.readOnly} code={p.code} t={t} lang={view.lang} open onFollow={act.follow} onSave={act.save}
      onQuote={(block) => act.prefill('comment', block, true)} drafts={p.drafts} noTree />
  );
  return (
    <>
      <StepHead p={p} own={note && !modules.length ? ['forme'] : []} />
      {!note || !modules.length ? (
        <>
          <Invite title={note ? s.noFormeReview : s.noNote} text={note ? s.noFormeReviewText : s.noNoteText}>
            {note ? <Run a={view.actions.find((a) => a.id === 'forme')} busy={busy} tone="accent" onRun={() => act.run('forme')} /> : null}
          </Invite>
          {files.length ? <section className="vc-card vc-forme"><IdeView files={files}>{(f) => (f?.code ? code(f.code) : f?.gone ? code(goneModule(f)) : null)}</IdeView></section> : null}
        </>
      ) : (
        <section className="vc-card vc-forme">
          <IdeView files={files}>
            {(f) => f && f.rank !== null ? (
              <Chosen key={f.path} f={f} m={modules[f.rank]} s={s} p={p} shown={shown} onShown={setShown} code={code} />
            ) : f?.gone ? code(goneModule(f)) : null}
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
          <IconButton icon="ask" label={t.askAgent} onClick={() => act.prefill('comment', m.path)} />
          <IconButton icon="comment" label={s.comment} onClick={() => setCommenting(!commenting)} />
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
      <DraftRemarks remarks={remarksAt(view.draft, target)} t={t} onOpenLink={act.openLink} onDraft={act.draft} />
      {commenting ? (
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
