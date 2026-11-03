/** modules-view — l'étape Modules (Créer). En tête, le commit proposé
 *  (ProposedCommit : commit.md, ✓ Commiter, Relancer ; ses actions hors de l'en-tête)
 *  et la relecture du dernier diff (review.md, citer par bloc, Relancer). Puis une ligne par
 *  module de la Forme, un accordéon : point plein s'il est touché (vert :
 *  commité ; accent : modifié, pas encore commité), anneau sinon ; son numéro
 *  (l'ordre de génération, celui de la Forme) ; nom en
 *  gras, dossier atténué ; les commits qui le touchent en puces (un clic : son
 *  diff dans l'éditeur) ; au bout de sa ligne, ses outils (ModuleTools) :
 *  Générer (ce module seul, au choix), replié comme déplié ; déplié, puis
 *  Relire le diff (du dernier commit qui le touche, sinon les changements non
 *  commités) et Ouvrir. Pas de commit par module : Commiter les modules, à la
 *  fin. Générer ce module et Relire le diff (lancé seul après Générer ;
 *  Relancer sur sa carte) ne sont pas dans l'en-tête de l'étape (own) ; dessous, son
 *  contrat par rubrique (Contract) et, s'il est touché, son code (ModuleCode).
 *  Un seul déplié à la fois, le chemin du module déplié tenu ici ; ici aussi
 *  plus aucun fichier suivi quand on replie, ou que le module déplié n'a pas
 *  (ou plus) de fichier (un module qui en a envoie lui-même le sien). Dans les
 *  outils de la carte, l'interrupteur et la légende ; à côté de son titre
 *  (OutputCard acts), les actions de l'étape (CARD_ACTS : Générer les
 *  modules, puis Commiter les modules s'il y a un module pas commité ; la
 *  prochaine action mise en avant), qui ne sont donc plus dans l'en-tête ;
 *  sans module, elles y restent. Préparer le commit n'est pas de l'étape
 *  (own) : il sert au premier commit (Invariants) et aux fixups de la note
 *  (Forme).
 *  Relecteur (view.flow 'review') : les modules en lecture seule — ni commit.md,
 *  ni review.md ; les actions qui modifient (Générer, Relire le diff, Commiter,
 *  commit-modules) ne sont pas dans son relevé, donc ne s'affichent pas ; le code
 *  de ModuleCode en lecture seule (readOnly : motif en titre, ni Enregistrer ni
 *  Abandonner) ;
 *  les puces de commit et Ouvrir restent. Puis CommitsSection (commits-view),
 *  qui porte elle-même Relire les commits : 'review-commits' est dans own.
 *  Deux vues, un interrupteur dans les outils de la carte (view.modulesView, retenu par le principal :
 *  act.set({ modulesView }), liste par défaut) : la liste, l'accordéon ci-dessus ; la vue IDE (IdeView),
 *  l'arborescence des fichiers des modules (ideFiles(view, 'file')), leur nom coloré comme VS Code (nouveau, modifié, supprimé, à générer),
 *  et à droite, du fichier choisi, les outils de son module (ModuleTools, tous) sur la ligne du sélecteur
 *  de son code (ModuleCode, noTree, tools). Un fichier sans code (module pas touché) : les outils
 *  seuls, et plus aucun fichier suivi. Sans module : les fichiers de la branche, dans les deux vues, sans
 *  interrupteur. Basculer ne suit plus aucun fichier ; chaque vue suit ensuite le sien. Le point d'état
 *  de la liste vient de moduleState (core).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { useEffect, useState } from 'react';
import { fileParts, ideFiles, moduleCommits, moduleState, type IdeFile, type ModuleState } from 'core/vibecoder';
import type { VibeLang, VibeModule } from 'technicals/bridge';
import { CommitsSection } from './commits-view';
import { Contract } from './forme-view';
import { IdeView } from './ide-view';
import { MarkdownView } from './markdown-view';
import { ModuleCode } from './module-code';
import { PROPOSED_ACTS, ProposedCommit } from './proposed-commit';
import { Invite, OutputCard, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import './modules-view.css';

const fr = {
  modules: 'Modules de la Forme',
  state: { done: 'commité', wip: 'en cours', todo: 'à faire' } as Record<ModuleState, string>,
  stateTitle: { done: 'Commité sur la branche', wip: 'Modifié, pas encore commité', todo: 'Pas encore touché par la branche' } as Record<ModuleState, string>,
  generate: 'Générer',
  review: 'Relire le diff',
  reviewOf: (hash: string) => `Relire le diff de ${hash}, le dernier commit qui touche ce module`,
  reviewWip: 'Relire les changements pas encore commités',
  open: 'Ouvrir',
  toCreate: 'à créer',
  rankTitle: (n: number, of: number) => `Ordre de génération : ${n} sur ${of}`,
  readOnly: 'Lecture seule : vous relisez cette PR.',
  noModule: 'La Forme ne liste aucun module',
  noModuleHint: 'Les modules viennent de la rubrique « Forme » de la note : étape Forme, Poser la forme.',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    modules: 'Modules of the Shape',
    state: { done: 'committed', wip: 'in progress', todo: 'to do' },
    stateTitle: { done: 'Committed on the branch', wip: 'Changed, not committed yet', todo: 'Not touched by the branch yet' },
    generate: 'Generate',
    review: 'Review the diff',
    reviewOf: (hash) => `Review the diff of ${hash}, the last commit touching this module`,
    reviewWip: 'Review the changes not committed yet',
    open: 'Open',
    toCreate: 'to create',
    rankTitle: (n: number, of: number) => `Generation order: ${n} of ${of}`,
    readOnly: 'Read only: you are reviewing this PR.',
    noModule: 'The Shape lists no module',
    noModuleHint: 'Modules come from the “Forme” section of the note: Shape step, Set the shape.',
  },
};

// Les outils d'un module (les mêmes dans l'accordéon et dans la vue IDE) ; i : son rang dans view.modules.
// Générer (ce module seul), puis, avec all, Relire le diff et Ouvrir. Pas de Commiter : Commiter les modules.
function ModuleTools({ p, m, i, all }: { p: StepProps; m: VibeModule; i: number; all: boolean }) {
  const { view, t, act, busy } = p;
  const s = S[view.lang];
  const action = (id: string) => view.actions.find((a) => a.id === id);
  const generate = action('module');
  const reviewDiff = action('review-diff');
  const commits = moduleCommits(m, view.commits);
  const last = commits[commits.length - 1];
  return (
    <div className="vc-mod-acts" onClick={(e) => e.preventDefault()}>
      {generate ? (
        <button type="button" disabled={!!generate.disabled || busy}
          title={`${generate.hint} (${generate.who})${generate.disabled ? `\n— ${generate.disabled}` : ''}`}
          onClick={() => act.run('module', { module: i })}>{s.generate}</button>
      ) : null}
      {all && reviewDiff && m.touched ? (
        <button type="button" disabled={!!reviewDiff.disabled || busy}
          title={`${last ? s.reviewOf(last.hash.slice(0, 7)) : s.reviewWip} (${reviewDiff.who})${reviewDiff.disabled ? `\n— ${reviewDiff.disabled}` : ''}`}
          onClick={() => act.run('review-diff', last ? { commit: last.hash } : {})}>{s.review}</button>
      ) : null}
      {all && m.file ? (
        <button type="button" title={`${t.openTitle} : ${m.file.path}`} onClick={() => act.open(m.file!.id)}>{s.open}</button>
      ) : null}
    </div>
  );
}

// Vue IDE : à droite, du fichier choisi, les outils de son module puis son code ; sans code, plus aucun fichier suivi.
function IdeBody({ p, file }: { p: StepProps; file: IdeFile | null }) {
  const { view, t, act } = p;
  const has = !!file?.code;
  useEffect(() => { if (!has) act.follow(null); }, [file?.path, has]);
  const tools = file && file.rank != null ? <ModuleTools p={p} m={view.modules[file.rank]} i={file.rank} all /> : null;
  return (
    <>
      {file?.code ? null : tools}
      {file?.code ? (
        <ModuleCode key={file.path} m={file.code} tools={tools} noTree readOnly={view.flow === 'review' ? S[view.lang].readOnly : undefined} code={p.code} t={t} lang={view.lang} open
          onFollow={act.follow} onSave={act.save} onQuote={(block, id) => act.prefill(id, block, true)} drafts={p.drafts} />
      ) : null}
    </>
  );
}

// Les actions de l'étape dans la carte des modules, pas dans l'en-tête (Commiter les modules les suit, s'il y a un
// module pas commité) ; sans module, elles restent dans l'en-tête.
const CARD_ACTS = ['modules'];

export function ModulesView(p: StepProps) {
  const { view, t, act, busy } = p;
  const [opened, setOpened] = useState<string | null>(null); // le module déplié
  const s = S[view.lang];
  const action = (id: string) => view.actions.find((a) => a.id === id);
  const quote = action('comment') ? (text: string) => act.prefill('comment', text) : undefined;
  const reviewer = view.flow === 'review';
  const commit = reviewer ? undefined : view.outputs['commit.md'];
  const review = reviewer ? undefined : view.outputs['review.md'];
  const counts = view.modules.reduce((n, m) => ({ ...n, [moduleState(m)]: n[moduleState(m)] + 1 }), { done: 0, wip: 0, todo: 0 } as Record<ModuleState, number>);
  const reviewDiff = action('review-diff');
  const files = ideFiles(view, 'file');
  const hasModules = view.modules.length > 0;
  const ide = view.modulesView === 'ide' || !hasModules;   // sans module : les fichiers de la branche, dans les deux vues
  const switchTo = (k: 'ide' | 'list') => { act.follow(null); act.set({ modulesView: k }); };
  // Un seul effet pour replier-sans-fichier : le module déplié n'a pas de fichier, ou n'existe plus.
  const openedFiles = view.modules.find((m) => m.path === opened)?.files?.length ?? 0;
  useEffect(() => { if (!ide && opened && !openedFiles) act.follow(null); }, [ide, opened, openedFiles]);
  return (
    <>
      <StepHead p={p} own={reviewer
        ? ['review-commits']
        : [...(commit ? PROPOSED_ACTS : []), 'commit-prepare', 'review-diff', 'commit-modules', 'module', ...(hasModules ? CARD_ACTS : [])]} />
      <ProposedCommit p={p} />
      {review ? (
        <OutputCard className="vc-diff-review" title={t.outputs['review.md']} file="review.md" time={review.time} t={t}
          tools={<Run a={reviewDiff} busy={busy} tone="ghost" label={t.rerun} onRun={() => act.run('review-diff')} />}>
          <MarkdownView md={review.text} t={t} onOpenLink={act.openLink} onQuote={quote} />
        </OutputCard>
      ) : null}
      {hasModules || files.length ? (
        <OutputCard className="vc-modules" title={s.modules} t={t} acts={hasModules && !reviewer ? (
          [...CARD_ACTS, ...(view.modules.some((m) => m.uncommitted) ? ['commit-modules'] : [])].map((id) => {
            const a = action(id);
            return <Run key={id} a={a} busy={busy} tone={a?.primary ? 'accent' : 'plain'} onRun={(x) => act.run(id, x)} />;
          })
        ) : undefined} tools={(
          <>
            {hasModules ? (
              <>
                <div className="vc-seg" role="group" aria-label={`${t.ideView} / ${t.listView}`}>
                  {(['ide', 'list'] as const).map((k) => (
                    <button key={k} type="button" aria-pressed={k === (ide ? 'ide' : 'list')} onClick={() => switchTo(k)}>{k === 'ide' ? t.ideView : t.listView}</button>
                  ))}
                </div>
                <span className="vc-mod-legend">
                  {(['done', 'wip', 'todo'] as ModuleState[]).map((k) => (
                    <span key={k} data-state={k}><i className="vc-mod-dot" />{`${counts[k]} ${s.state[k]}`}</span>
                  ))}
                </span>
              </>
            ) : null}
          </>
        )}>
          {ide ? (
            <div className="vc-mod-ide">
              <IdeView files={files}>{(file) => <IdeBody p={p} file={file} />}</IdeView>
            </div>
          ) : <ul className="vc-mod-list">
            {view.modules.map((m, i) => {
              const state = moduleState(m);
              const open = opened === m.path;
              const { dir, name } = fileParts(m.path);
              const commits = moduleCommits(m, view.commits);
              const tools = <ModuleTools p={p} m={m} i={i} all={open} />;
              return (
                <li key={`${i}:${m.path}`} className="vc-mod" data-state={state}>
                  <span className="vc-mod-dot" title={s.stateTitle[state]} />
                  {/* onToggle part aussi quand open change par les props : seul l'écart est un geste. */}
                  <details className="vc-mod-main" open={open} onToggle={(e) => {
                    const now = e.currentTarget.open;
                    if (now === open) return;
                    setOpened(now ? m.path : null);
                    if (!now) act.follow(null);
                  }}>
                    <summary className="vc-mod-line" title={m.file ? m.file.path : m.path}>
                      <span className="vc-mod-rank" title={s.rankTitle(i + 1, view.modules.length)}>{i + 1}</span>
                      <span className="vc-mod-name vc-mono">{name}</span>
                      <span className="vc-mod-dir vc-mono">{dir}</span>
                      {!m.file && state === 'todo' ? <span className="vc-mod-new">{s.toCreate}</span> : null}
                      {commits.map((c) => (
                        <button key={c.hash} type="button" className="vc-chip" data-fixup={c.fixup || undefined}
                          title={`${c.hash.slice(0, 7)} ${c.subject}\n${t.diffTitle}`} onClick={() => act.open(`c${view.commits.indexOf(c)}`)}>
                          {c.hash.slice(0, 7)}
                        </button>
                      ))}
                      {tools}
                    </summary>
                    <Contract text={m.contract} t={t} onOpenLink={act.openLink} />
                    {m.touched ? (
                      <ModuleCode m={m} readOnly={reviewer ? s.readOnly : undefined} code={p.code} t={t} lang={view.lang} open={open} onFollow={act.follow} onSave={act.save}
                        onQuote={(block, id) => act.prefill(id, block, true)} drafts={p.drafts} />
                    ) : null}
                  </details>
                </li>
              );
            })}
          </ul>}
        </OutputCard>
      ) : <Invite title={s.noModule} text={s.noModuleHint} />}
      <CommitsSection {...p} />
    </>
  );
}
