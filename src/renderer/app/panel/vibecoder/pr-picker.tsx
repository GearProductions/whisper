/** pr-picker — l'étape PR (Relire) : un numéro (ou le lien d'une PR) et
 *  Charger ; la PR chargée (titre, auteur, base ← tête, description rendue,
 *  lien), ou celle qu'on suit en attendant d'être chargée ; Mes PR à relire et
 *  leur liste en cartes (demandée à gh par le principal, sans agent :
 *  set({ prs })). Choisir une PR : la suivre (set), puis la charger
 *  (load-pr, par l'appli elle-même, F-114 ; « via » l'agent sous la PR suivie
 *  pas encore chargée) : sa fiche et sa branche, dans ce dossier. La PR
 *  chargée : ses choix du relevé, directs (F-114), grisés avec leur raison,
 *  absents si le relevé les masque — pr-here (changer de branche), pr-worktree
 *  (un nouveau worktree), stash (mettre de côté), unload-pr (Décharger :
 *  revenir sur la base) et, avec des modifications (stash montré), « Rester
 *  sur la branche » (ne plus la suivre, set({ pr: null }), sans git) ; la PR
 *  suivie pas chargée, ou sur son robot : Décharger ne fait que ne plus la
 *  suivre. Son worktree, s'il existe (en création, ouvert → aller à son robot,
 *  ou le proposer à nouveau). Retirer le worktree est sur le badge du robot
 *  (vibe-coder), pas ici.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : step-views. */
import { useState } from 'react';
import { prNumber, webUrl } from 'core/vibecoder';
import type { VibeArgs, VibeLang } from 'technicals/bridge';
import { MarkdownView } from './markdown-view';
import { Invite, PrCard, Run, StepHead } from './step-parts';
import type { StepProps } from './step-views';
import './pr-picker.css';

// Les choix de la PR chargée, actions directes du relevé (main/core/vibecoder place), dans cet ordre.
const PLACES = ['pr-here', 'pr-worktree', 'stash', 'unload-pr'];

const fr = {
  field: 'Numéro ou lien de la PR',
  placeholder: '# ou lien',
  load: 'Charger',
  noBody: 'Pas de description.',
  notLoaded: (n: number) => `PR #${n} pas encore chargée`,
  notLoadedHint: 'Charger récupère la fiche de la PR et sa branche ; ce dossier ne change de branche qu\'à votre choix.',
  loading: (n: number) => `Chargement de la PR #${n}…`,
  toReview: 'À relire',
  list: 'Mes PR à relire',
  listTitle: 'Liste les PR du dépôt dont on vous demande la relecture (gh, sans agent).',
  listHint: 'Mes PR à relire liste celles où votre relecture est demandée.',
  none: 'Aucune PR n\'attend votre relecture.',
  pick: (n: number) => `Suivre et charger la PR #${n}`,
  open: 'Ouvrir dans le navigateur',
  unload: 'Décharger la PR',
  unloadTitle: 'Ne plus suivre cette PR : revenir au choix d\'une PR',
  stay: 'Rester sur la branche',
  stayTitle: 'Ne plus suivre cette PR sans changer de branche : le dossier garde ses modifications',
  wtCreating: 'Création du worktree en cours…',
  wtOpen: 'Ouverte dans un worktree',
  goRobot: (n: number) => `Aller au robot PR #${n}`,
  addRobot: (n: number) => `Ajouter le robot PR #${n}`,
  addRobotTitle: 'Le worktree est là sans son robot : le proposer à nouveau (question de confiance)',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    field: 'PR number or link',
    placeholder: '# or link',
    load: 'Load',
    noBody: 'No description.',
    notLoaded: (n) => `PR #${n} not loaded yet`,
    notLoadedHint: 'Load fetches the PR\'s card and its branch; this folder switches branch only when you choose.',
    loading: (n) => `Loading PR #${n}…`,
    toReview: 'To review',
    list: 'My PRs to review',
    listTitle: 'Lists the repository\'s PRs where your review is requested (gh, no agent).',
    listHint: 'My PRs to review lists those where your review is requested.',
    none: 'No PR is waiting for your review.',
    pick: (n) => `Follow and load PR #${n}`,
    open: 'Open in the browser',
    unload: 'Unload the PR',
    unloadTitle: 'Stop following this PR: back to choosing one',
    stay: 'Stay on the branch',
    stayTitle: 'Stop following this PR without switching branch: the folder keeps its changes',
    wtCreating: 'Creating the worktree…',
    wtOpen: 'Open in a worktree',
    goRobot: (n) => `Go to the PR #${n} robot`,
    addRobot: (n) => `Add the PR #${n} robot`,
    addRobotTitle: 'The worktree is there without its robot: offer it again (trust question)',
  },
};

export function PrPicker(props: StepProps) {
  const { view, t, act, busy } = props;
  const s = S[view.lang];
  const [typed, setTyped] = useState('');
  const action = (id: string) => view.actions.find((a) => a.id === id);
  const loadAction = action('load-pr');
  const canLoad = !!loadAction && !loadAction.disabled && !busy;
  // Charger : par l'appli elle-même ({ direct: true }, F-114), ou via l'agent ({}).
  const load = (n: number, extra: VibeArgs) => { act.set({ pr: n }); act.run('load-pr', { pr: n, ...extra }); };
  const asked = prNumber(typed);
  const pr = view.pr;
  const loaded = !!pr && !!view.outputs[`pr-${pr.number}.json`];
  const wt = view.worktree;
  const places = PLACES.flatMap((id) => { const a = action(id); return a && !a.hidden ? [a] : []; });
  const shown = (id: string) => places.some((a) => a.id === id);
  // Décharger sans git : la PR pas chargée ou sur son robot (unload-pr masqué) ; avec des modifications, Rester sur la branche.
  const stay = shown('unload-pr') && shown('stash');
  return (
    <>
      <StepHead p={props} own={['prs', 'load-pr', ...PLACES, 'remove-worktree']}>
        <form className="vc-pr-form" onSubmit={(e) => { e.preventDefault(); if (asked && canLoad) { load(asked, { direct: true }); setTyped(''); } }}>
          <input className="vc-mono" value={typed} placeholder={s.placeholder} aria-label={s.field} title={s.field} spellCheck={false}
            onChange={(e) => setTyped(e.target.value)} />
          <button type="submit" disabled={!asked || !canLoad} title={loadAction ? loadAction.hint : undefined}>{s.load}</button>
        </form>
        {pr && !shown('unload-pr') ? <button type="button" className="vc-mini" title={s.unloadTitle} onClick={() => act.set({ pr: null })}>{s.unload}</button> : null}
      </StepHead>
      {pr && loaded ? (
        <PrCard pr={pr} lang={view.lang} onOpenLink={act.openLink}>
          {pr.body.trim() ? <MarkdownView md={pr.body} t={t} onOpenLink={act.openLink} /> : <span className="vc-pr-nobody">{s.noBody}</span>}
        </PrCard>
      ) : pr ? (
        <Invite title={busy ? s.loading(pr.number) : s.notLoaded(pr.number)} text={s.notLoadedHint}>
          <Run a={loadAction} busy={busy} onRun={(x) => load(pr.number, x ?? {})} />
        </Invite>
      ) : null}
      {pr && loaded && !wt?.temp ? (
        <div className="vc-pr-worktree">
          {places.map((a) => <Run key={a.id} a={a} busy={busy} onRun={(x) => act.run(a.id, x)} />)}
          {stay ? <button type="button" className="vc-mini" title={s.stayTitle} onClick={() => act.set({ pr: null })}>{s.stay}</button> : null}
          {!wt ? null : wt.state === 'creating' ? <span className="vc-pr-hint">{s.wtCreating}</span> : (
            <>
              <span className="vc-pr-hint" title={wt.dir}>{s.wtOpen}</span>
              <button type="button" className="vc-mini" title={wt.state === 'robot' ? wt.dir : s.addRobotTitle}
                onClick={() => act.set({ worktree: true })}>{wt.state === 'robot' ? s.goRobot(pr.number) : s.addRobot(pr.number)}</button>
            </>
          )}
        </div>
      ) : null}
      <div className="vc-pr-list-head">
        <span>{s.toReview}</span>
        {view.prs?.length ? <span className="vc-count">{view.prs.length}</span> : null}
        <button type="button" className="vc-run" data-tone={view.prs ? 'ghost' : pr ? 'plain' : 'accent'} title={s.listTitle}
          onClick={() => act.set({ prs: true })}><span className="vc-run-label">{s.list}</span></button>
      </div>
      {!view.prs ? <div className="vc-pr-hint">{s.listHint}</div>
        : !view.prs.length ? <div className="vc-pr-hint">{s.none}</div> : (
          <ul className="vc-pr-list">
            {view.prs.map((p) => {
              const url = webUrl(p.url);
              return (
                <li key={p.number} aria-current={p.number === pr?.number || undefined}>
                  <button type="button" className="vc-pr-item" disabled={!canLoad} title={s.pick(p.number)} onClick={() => load(p.number, { direct: true })}>
                    <span className="vc-pr-item-number vc-mono">{`#${p.number}`}</span>
                    <span className="vc-pr-item-title">{p.title}</span>
                    {p.author ? <span className="vc-pr-item-author">{p.author}</span> : null}
                  </button>
                  {url ? <button type="button" className="vc-tool" title={`${s.open}\n${url}`} aria-label={s.open} onClick={() => act.openLink(url)}>↗</button> : null}
                </li>
              );
            })}
          </ul>
        )}
    </>
  );
}
