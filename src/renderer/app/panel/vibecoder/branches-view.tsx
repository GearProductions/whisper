/** branches-view — la vue des branches (le bouton ⎇ de l'en-tête) : Actualiser
 *  (fetch) et Retirer le worktree (remove-worktree) ; la PR chargée
 *  (view.loaded : titre, auteur, base ← tête, description rendue, lien) et les
 *  choix de lieu du relevé — pr-here (changer de branche), pr-worktree (un
 *  nouveau worktree), stash (mettre de côté), unload-pr (revenir sur la
 *  branche principale) et, avec des modifications (stash et unload-pr
 *  montrés) et une PR suivie, « Rester sur la branche » (ne plus la suivre,
 *  set({ pr: null }), sans git) ; son worktree s'il existe (en création,
 *  ouvert → aller à son robot, ou le proposer à nouveau). Sans PR chargée, les
 *  mêmes choix de lieu (revenir sur la base, mettre de côté). Quatre onglets :
 *  Mes PR, À relire, Toutes les PR (view.prs, demandées à gh à l'ouverture :
 *  set({ prs: true }) ; false : gh en échec) — un clic suit la PR et la charge (set({ pr }),
 *  load-pr) — et Branches locales (view.branches, la branche active marquée ;
 *  un clic → switch-branch { branch }). Créer une branche : son nom, son
 *  départ (origin/<base>, par défaut : sans start, ou une branche locale), Créer ici
 *  (new-here) ou Dans un nouveau worktree (new-worktree), { branch, start? }.
 *  Toutes ces actions sont directes (F-114, { direct: true }), grisées avec
 *  leur raison, absentes si le relevé les masque ; le principal revérifie.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : vibe-coder. */
import { useEffect, useState } from 'react';
import { webUrl, type Strings } from 'core/vibecoder';
import type { VibeArgs, VibeLang, VibeView } from 'technicals/bridge';
import { MarkdownView } from './markdown-view';
import { PrCard, Run } from './step-parts';
import type { VibeActs } from './step-views';
import { originBase } from './sync-buttons';
import './branches-view.css';

// Les choix de lieu, actions directes du relevé (main/core/vibecoder place), dans cet ordre.
const PLACES = ['pr-here', 'pr-worktree', 'stash', 'unload-pr'];
const TABS = ['mine', 'review', 'all', 'local'] as const;
type Tab = typeof TABS[number];

const fr = {
  tabs: { mine: 'Mes PR', review: 'À relire', all: 'Toutes les PR', local: 'Branches locales' } as Record<Tab, string>,
  noBody: 'Pas de description.',
  loading: 'Liste des PR en cours…',
  failed: 'gh n\'a pas répondu (connecté ? dépôt GitHub ?)',
  none: 'Aucune PR ouverte ici.',
  noBranch: 'Aucune branche locale.',
  pick: (n: number) => `Suivre et charger la PR #${n}`,
  goTo: (b: string) => `Aller sur la branche ${b}`,
  current: 'branche active',
  open: 'Ouvrir dans le navigateur',
  stay: 'Rester sur la branche',
  stayTitle: 'Ne plus suivre cette PR sans changer de branche : le dossier garde ses modifications',
  wtCreating: 'Création du worktree en cours…',
  wtOpen: 'Ouverte dans un worktree',
  goRobot: (n: number) => `Aller au robot PR #${n}`,
  addRobot: (n: number) => `Ajouter le robot PR #${n}`,
  addRobotTitle: 'Le worktree est là sans son robot : le proposer à nouveau (question de confiance)',
  create: 'Créer une branche',
  name: 'Nom de la branche',
  start: 'Départ',
  nameFirst: 'Saisissez un nom',
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    tabs: { mine: 'My PRs', review: 'To review', all: 'All PRs', local: 'Local branches' },
    noBody: 'No description.',
    loading: 'Listing the PRs…',
    failed: 'No answer from gh (logged in? GitHub repository?)',
    none: 'No open PR here.',
    noBranch: 'No local branch.',
    pick: (n) => `Follow and load PR #${n}`,
    goTo: (b) => `Go to branch ${b}`,
    current: 'active branch',
    open: 'Open in the browser',
    stay: 'Stay on the branch',
    stayTitle: 'Stop following this PR without switching branch: the folder keeps its changes',
    wtCreating: 'Creating the worktree…',
    wtOpen: 'Open in a worktree',
    goRobot: (n) => `Go to the PR #${n} robot`,
    addRobot: (n) => `Add the PR #${n} robot`,
    addRobotTitle: 'The worktree is there without its robot: offer it again (trust question)',
    create: 'Create a branch',
    name: 'Branch name',
    start: 'Start',
    nameFirst: 'Type a name',
  },
};

type Props = { view: VibeView; t: Strings; act: Pick<VibeActs, 'run' | 'set' | 'openLink'>; busy: boolean };

export function BranchesView({ view, t, act, busy }: Props) {
  const s = S[view.lang];
  const [tab, setTab] = useState<Tab>('mine');
  const origin = originBase(view);
  const [name, setName] = useState('');
  const [start, setStart] = useState('');   // '' : origin/<base>, le défaut du principal
  // Les trois listes de PR, demandées à gh (sans agent) à l'ouverture.
  useEffect(() => { act.set({ prs: true }); }, []);
  const action = (id: string) => view.actions.find((a) => a.id === id);
  const ready = (id: string) => { const a = action(id); return !!a && !a.hidden && !a.disabled && !busy; };
  const run = (id: string, x: VibeArgs = {}) => { void act.run(id, { direct: true, ...x }); };
  const load = (n: number) => { act.set({ pr: n }); run('load-pr', { pr: n }); };
  const pr = view.loaded ?? null;
  const wt = view.worktree;
  const places = PLACES.flatMap((id) => { const a = action(id); return a && !a.hidden ? [a] : []; });
  const shown = (id: string) => places.some((a) => a.id === id);
  const branches = view.branches ?? [];
  const items = tab === 'local' || !view.prs ? null : view.prs[tab];
  // Créer une branche : sans nom, ses deux choix grisés.
  const named = (id: string) => { const a = action(id); return a && !name.trim() ? { ...a, disabled: a.disabled ?? s.nameFirst } : a; };
  const create = (id: string) => { run(id, { branch: name.trim(), ...(start ? { start } : {}) }); setName(''); };
  return (
    <>
      <div className="vc-br-tools">
        <Run a={action('fetch')} busy={busy} onRun={() => run('fetch')} />
        <Run a={action('remove-worktree')} busy={busy} tone="ghost" onRun={() => run('remove-worktree')} />
      </div>
      {pr ? (
        <PrCard pr={pr} lang={view.lang} onOpenLink={act.openLink}>
          {pr.body.trim() ? <MarkdownView md={pr.body} t={t} onOpenLink={act.openLink} /> : <span className="vc-pr-nobody">{s.noBody}</span>}
        </PrCard>
      ) : null}
      {!wt?.temp && (places.length || (pr && wt)) ? (
        <div className="vc-pr-worktree">
          {places.map((a) => <Run key={a.id} a={a} busy={busy} onRun={() => run(a.id)} />)}
          {pr && shown('unload-pr') && shown('stash') ? <button type="button" className="vc-mini" title={s.stayTitle} onClick={() => act.set({ pr: null })}>{s.stay}</button> : null}
          {!pr || !wt ? null : wt.state === 'creating' ? <span className="vc-pr-hint">{s.wtCreating}</span> : (
            <>
              <span className="vc-pr-hint" title={wt.dir}>{s.wtOpen}</span>
              <button type="button" className="vc-mini" title={wt.state === 'robot' ? wt.dir : s.addRobotTitle}
                onClick={() => act.set({ worktree: true })}>{wt.state === 'robot' ? s.goRobot(pr.number) : s.addRobot(pr.number)}</button>
            </>
          )}
        </div>
      ) : null}
      <div className="vc-pr-list-head">
        <div className="vc-seg" role="group">
          {TABS.map((k) => {
            const n = k === 'local' ? view.branches?.length : view.prs && view.prs[k].length;
            return (
              <button key={k} type="button" aria-pressed={k === tab} onClick={() => setTab(k)}>
                {s.tabs[k]}{n ? <span className="vc-count">{n}</span> : null}
              </button>
            );
          })}
        </div>
      </div>
      {tab === 'local' ? (
        !branches.length ? <div className="vc-pr-hint">{s.noBranch}</div> : (
          <ul className="vc-pr-list">
            {branches.map((b) => {
              const here = b === view.repo?.branch;
              const why = action('switch-branch')?.disabled;
              return (
                <li key={b} aria-current={here || undefined}>
                  <button type="button" className="vc-pr-item" disabled={here || !ready('switch-branch')}
                    title={here ? s.current : why ? `${s.goTo(b)}\n— ${why}` : s.goTo(b)} onClick={() => run('switch-branch', { branch: b })}>
                    <span className="vc-pr-item-title vc-mono">{b}</span>
                    {here ? <span className="vc-pr-item-author">{s.current}</span> : null}
                  </button>
                </li>
              );
            })}
          </ul>
        )
      ) : view.prs === false ? <div className="vc-pr-hint">{s.failed}</div>
        : !items ? <div className="vc-pr-hint">{s.loading}</div>
        : !items.length ? <div className="vc-pr-hint">{s.none}</div> : (
          <ul className="vc-pr-list">
            {items.map((p) => {
              const url = webUrl(p.url);
              return (
                <li key={p.number} aria-current={p.number === pr?.number || undefined}>
                  <button type="button" className="vc-pr-item" disabled={!ready('load-pr')} title={s.pick(p.number)} onClick={() => load(p.number)}>
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
      <div className="vc-pr-list-head"><span>{s.create}</span></div>
      <div className="vc-br-new">
        <input className="vc-mono" value={name} placeholder={s.name} aria-label={s.name} title={s.name} spellCheck={false}
          onChange={(e) => setName(e.target.value)} />
        <select value={start} aria-label={s.start} title={s.start} onChange={(e) => setStart(e.target.value)}>
          <option value="">{origin || '—'}</option>
          {branches.map((b) => <option key={b} value={b}>{b}</option>)}
        </select>
        <Run a={named('new-here')} busy={busy} onRun={() => create('new-here')} />
        <Run a={named('new-worktree')} busy={busy} onRun={() => create('new-worktree')} />
      </div>
    </>
  );
}
