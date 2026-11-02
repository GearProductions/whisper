/** forme-view — l'étape Forme (Créer) : les modules de la rubrique « Forme »
 *  de la note, groupés par premier dossier ; chacun son chemin (dossier
 *  atténué, nom en gras), son contrat en rubriques (ce qu'il expose, ne
 *  connaît pas, utilisé par) et son état (touché par la branche, existe, à
 *  créer, Icon ok devant « touché ») ; ses outils, au survol de la ligne
 *  (IconButton) : comment le cite dans le champ, open l'ouvre s'il existe.
 *  En tête : la validation de la forme, la pastille Fable. Sans module : ce
 *  qu'il faut faire pour en avoir.
 *  Relecteur (view.flow === 'review') : rien à juger ni à générer — ni
 *  validation, ni Fable, ni « Poser la forme » ; 💬 sur un module ouvre sous
 *  lui une zone de commentaire, pour le brouillon de revue (remark).
 *  Contract : le contrat d'un module, par rubrique (contractParts, InlineMd).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views,
 *  modules-view (Contract). */
import { useState } from 'react';
import { contractParts, fileParts, groupModules, remark, type Strings } from 'core/vibecoder';
import type { VibeLang, VibeModule } from 'technicals/bridge';
import { Icon, IconButton } from './icons';
import { CommentBox } from './comment-box';
import { InlineMd } from './markdown-view';
import { Invite, Run, StepHead } from './step-parts';
import type { StepProps, VibeActs } from './step-views';
import { FablePill, MarkControl } from './validation';
import './forme-view.css';

const fr = {
  title: 'Forme de la note',
  summary: (n: number, touched: number, missing: number) =>
    [`${n} module${n > 1 ? 's' : ''}`, touched && `${touched} touché${touched > 1 ? 's' : ''}`, missing && `${missing} à créer`].filter(Boolean).join(' · '),
  root: 'racine',
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
    root: 'root',
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

export function FormeView(p: StepProps) {
  const { view, t, act, busy } = p;
  const s = S[view.lang];
  const { note, modules } = view;
  const groups = groupModules(modules);
  const review = view.flow === 'review';
  const quote = !review && view.actions.some((a) => a.id === 'comment') ? (text: string) => act.prefill('comment', text) : undefined;
  const comment = review ? (path: string, text: string) => act.draft({ add: remark(`forme: ${path}`, text) }) : undefined;
  return (
    <>
      <StepHead p={p} own={note && !modules.length ? ['forme'] : []}>
        {!review && view.agent.model !== 'fable' ? <FablePill lang={view.lang} onPick={() => act.set({ model: 'fable', effort: 'high' })} /> : null}
      </StepHead>
      {!note || !modules.length ? (
        <Invite title={note ? (review ? s.noFormeReview : s.noForme) : s.noNote} text={note ? (review ? s.noFormeReviewText : s.noFormeText) : s.noNoteText}>
          {note ? <Run a={view.actions.find((a) => a.id === 'forme')} busy={busy} tone="accent" onRun={() => act.run('forme')} /> : null}
        </Invite>
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
          {groups.map((g) => (
            <div key={g.folder} className="vc-fgroup">
              <div className="vc-fgroup-head">
                <span className="vc-mono">{g.folder || s.root}</span>
                <span className="vc-fgroup-n">{g.modules.length}</span>
              </div>
              <ul className="vc-fmods">
                {g.modules.map((m) => <ModuleRow key={m.path} m={m} s={s} t={t} act={act} onQuote={quote} onComment={comment} />)}
              </ul>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

type RowProps = { m: VibeModule; s: typeof fr; t: Strings; act: VibeActs; onQuote?(text: string): void; onComment?(path: string, text: string): void };

function ModuleRow({ m, s, t, act, onQuote, onComment }: RowProps) {
  const [commenting, setCommenting] = useState(false);
  const state = m.touched ? 'touched' : m.file ? 'exists' : 'missing';
  const { dir, name } = fileParts(m.path);
  return (
    <li className="vc-fmod" data-state={state}>
      <span className="vc-fdot" aria-hidden="true" />
      <div className="vc-fmain">
        <div className="vc-fline">
          <span className="vc-fpath vc-mono" title={m.path}><span className="vc-fdir">{dir}</span><b>{name}</b></span>
          <span className="vc-fstate" data-state={state} title={s.stateTitle[state]}>{state === 'touched' ? <><Icon name="ok" />{s.state.touched}</> : s.state[state]}</span>
          {m.commits.length ? <span className="vc-fcommits vc-mono" title={m.commits.map((h) => h.slice(0, 7)).join(' ')}>{s.commits(m.commits.length)}</span> : null}
          <span className="vc-ftools">
            {onQuote ? <IconButton icon="comment" label={s.quote} onClick={() => onQuote(m.path)} /> : null}
            {onComment ? <IconButton icon="comment" label={s.comment} onClick={() => setCommenting(!commenting)} /> : null}
            {m.file ? <IconButton icon="open" label={t.openTitle} onClick={() => act.open(m.file!.id)} /> : null}
          </span>
        </div>
        <Contract text={m.contract} t={t} onOpenLink={act.openLink} />
        {commenting && onComment ? (
          <CommentBox t={t} onCancel={() => setCommenting(false)} onSave={(text) => { onComment(m.path, text); setCommenting(false); }} />
        ) : null}
      </div>
    </li>
  );
}

// Le contrat d'un module, par rubrique (expose · ne connaît pas · utilisé par) ; rien s'il est vide.
export function Contract({ text, t, onOpenLink }: { text: string; t: Strings; onOpenLink(url: string): void }) {
  const parts = contractParts(text);
  return parts.length ? (
    <dl className="vc-fcontract">
      {parts.map((p, i) => (
        <div key={i} data-label={p.label ? undefined : 'main'}>
          {p.label ? <dt>{p.label}</dt> : null}
          <dd><InlineMd text={p.text} t={t} onOpenLink={onOpenLink} /></dd>
        </div>
      ))}
    </dl>
  ) : null;
}
