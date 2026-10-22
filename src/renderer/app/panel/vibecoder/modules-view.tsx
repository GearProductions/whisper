/** modules-view — l'étape Modules (Créer). En tête, le commit proposé
 *  (commit.md : le message tel qu'il sera commité ; ✓ Commiter, direct ou
 *  via l'agent, F-114 ; 💬, Relancer)
 *  et la relecture du dernier diff (review.md, 💬 par bloc, Relancer). Puis une ligne par
 *  module de la Forme : point plein s'il est touché (vert : commité ; accent :
 *  modifié, pas encore commité), anneau sinon ; nom en gras, dossier atténué,
 *  contrat ; les commits qui le touchent en puces (un clic : son diff dans
 *  l'éditeur) ; au survol (ou au clavier) :
 *  Générer, Relire le diff (du dernier commit qui le touche, sinon les
 *  changements non commités), Ouvrir. Sous un module touché, l'accordéon
 *  Voir le code (ModuleCode) : un seul déplié à la fois, le chemin du module
 *  déplié tenu ici.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { useState } from 'react';
import { fileParts, moduleCommits } from 'core/vibecoder';
import type { VibeLang, VibeModule } from 'technicals/bridge';
import { MarkdownView } from './markdown-view';
import { ModuleCode } from './module-code';
import { Invite, OutputCard, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import './modules-view.css';

type State = 'done' | 'wip' | 'todo';

const fr = {
  commitHint: 'Les fichiers indexés, avec ce message, mot pour mot.',
  quoteCommit: 'Citer le message dans le champ',
  modules: 'Modules de la Forme',
  state: { done: 'commité', wip: 'en cours', todo: 'à faire' } as Record<State, string>,
  stateTitle: { done: 'Commité sur la branche', wip: 'Modifié, pas encore commité', todo: 'Pas encore touché par la branche' } as Record<State, string>,
  generate: 'Générer',
  review: 'Relire le diff',
  reviewOf: (hash: string) => `Relire le diff de ${hash}, le dernier commit qui touche ce module`,
  reviewWip: 'Relire les changements pas encore commités',
  open: 'Ouvrir',
  toCreate: 'à créer',
  noModule: 'La Forme ne liste aucun module',
  noModuleHint: 'Les modules viennent de la rubrique « Forme » de la note : étape Forme, Poser la forme.',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    commitHint: 'The staged files, with this message, word for word.',
    quoteCommit: 'Quote the message in the field',
    modules: 'Modules of the Shape',
    state: { done: 'committed', wip: 'in progress', todo: 'to do' },
    stateTitle: { done: 'Committed on the branch', wip: 'Changed, not committed yet', todo: 'Not touched by the branch yet' },
    generate: 'Generate',
    review: 'Review the diff',
    reviewOf: (hash) => `Review the diff of ${hash}, the last commit touching this module`,
    reviewWip: 'Review the changes not committed yet',
    open: 'Open',
    toCreate: 'to create',
    noModule: 'The Shape lists no module',
    noModuleHint: 'Modules come from the “Forme” section of the note: Shape step, Set the shape.',
  },
};

const stateOf = (m: VibeModule): State => (m.commits.length ? 'done' : m.touched ? 'wip' : 'todo');

export function ModulesView(p: StepProps) {
  const { view, t, act, busy } = p;
  const [opened, setOpened] = useState<string | null>(null); // le module dont le code est déplié
  const s = S[view.lang];
  const action = (id: string) => view.actions.find((a) => a.id === id);
  const quote = action('comment') ? (text: string) => act.prefill('comment', text) : undefined;
  const commit = view.outputs['commit.md'];
  const review = view.outputs['review.md'];
  const counts = view.modules.reduce((n, m) => ({ ...n, [stateOf(m)]: n[stateOf(m)] + 1 }), { done: 0, wip: 0, todo: 0 } as Record<State, number>);
  const generate = action('module');
  const reviewDiff = action('review-diff');
  return (
    <>
      <StepHead p={p} own={[...(commit ? ['commit', 'commit-prepare'] : []), ...(review ? ['review-diff'] : [])]} />
      {commit ? (
        <OutputCard className="vc-proposed" title={t.outputs['commit.md']} file="commit.md" time={commit.time} t={t}
          tools={(
            <>
              {quote ? <button type="button" className="vc-tool" title={s.quoteCommit} aria-label={s.quoteCommit}
                onClick={() => quote(commit.text.trim().split('\n')[0])}>💬</button> : null}
              <Run a={action('commit-prepare')} busy={busy} tone="ghost" label={t.rerun} onRun={() => act.run('commit-prepare')} />
            </>
          )}>
          <pre className="vc-commit-msg">{commit.text.trim()}</pre>
          <div className="vc-commit-foot">
            <Run a={action('commit')} busy={busy} tone="accent" onRun={(x) => act.run('commit', x)} />
            <span>{s.commitHint}</span>
          </div>
        </OutputCard>
      ) : null}
      {review ? (
        <OutputCard className="vc-diff-review" title={t.outputs['review.md']} file="review.md" time={review.time} t={t}
          tools={<Run a={reviewDiff} busy={busy} tone="ghost" label={t.rerun} onRun={() => act.run('review-diff')} />}>
          <MarkdownView md={review.text} t={t} onOpenLink={act.openLink} onQuote={quote} />
        </OutputCard>
      ) : null}
      {view.modules.length ? (
        <OutputCard className="vc-modules" title={s.modules} t={t} tools={(
          <span className="vc-mod-legend">
            {(['done', 'wip', 'todo'] as State[]).map((k) => (
              <span key={k} data-state={k}><i className="vc-mod-dot" />{`${counts[k]} ${s.state[k]}`}</span>
            ))}
          </span>
        )}>
          <ul className="vc-mod-list">
            {view.modules.map((m, i) => {
              const state = stateOf(m);
              const { dir, name } = fileParts(m.path);
              const commits = moduleCommits(m, view.commits);
              const last = commits[commits.length - 1];
              return (
                <li key={`${i}:${m.path}`} className="vc-mod" data-state={state}>
                  <span className="vc-mod-dot" title={s.stateTitle[state]} />
                  <div className="vc-mod-main">
                    <div className="vc-mod-line" title={m.file ? m.file.path : m.path}>
                      <span className="vc-mod-name vc-mono">{name}</span>
                      <span className="vc-mod-dir vc-mono">{dir}</span>
                      {!m.file && state === 'todo' ? <span className="vc-mod-new">{s.toCreate}</span> : null}
                      {commits.map((c) => (
                        <button key={c.hash} type="button" className="vc-chip" data-fixup={c.fixup || undefined}
                          title={`${c.hash.slice(0, 7)} ${c.subject}\n${t.diffTitle}`} onClick={() => act.open(`c${view.commits.indexOf(c)}`)}>
                          {c.hash.slice(0, 7)}
                        </button>
                      ))}
                    </div>
                    {m.contract ? <div className="vc-mod-contract" title={m.contract}>{m.contract}</div> : null}
                    {m.touched ? (
                      <ModuleCode m={m} code={p.code} t={t} open={opened === m.path}
                        onOpen={(o) => setOpened(o ? m.path : null)} onFollow={act.follow} onSave={act.save}
                        onQuote={(block, id) => act.prefill(id, block, true)} />
                    ) : null}
                  </div>
                  <div className="vc-mod-acts">
                    {generate ? (
                      <button type="button" disabled={!!generate.disabled || busy}
                        title={`${generate.hint} (${generate.who})${generate.disabled ? `\n— ${generate.disabled}` : ''}`}
                        onClick={() => act.run('module', { module: i })}>{s.generate}</button>
                    ) : null}
                    {reviewDiff && m.touched ? (
                      <button type="button" disabled={!!reviewDiff.disabled || busy}
                        title={`${last ? s.reviewOf(last.hash.slice(0, 7)) : s.reviewWip} (${reviewDiff.who})${reviewDiff.disabled ? `\n— ${reviewDiff.disabled}` : ''}`}
                        onClick={() => act.run('review-diff', last ? { commit: last.hash } : {})}>{s.review}</button>
                    ) : null}
                    {m.file ? (
                      <button type="button" title={`${t.openTitle} : ${m.file.path}`} onClick={() => act.open(m.file!.id)}>{s.open}</button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </OutputCard>
      ) : <Invite title={s.noModule} text={s.noModuleHint} />}
    </>
  );
}
