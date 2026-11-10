/** vibe-coder — l'écran VibeCoder d'un agent, seul écran du panneau :
 *  en-tête de la vue C (48 px) — tout à gauche les robots des agents, l'affiché
 *  en pastille allumée avec son nom (`others`, donné par panel-app :
 *  agent-notices ; tant que le premier relevé des agents manque, à sa place le
 *  nom de l'agent seul), puis le segment branche (⎇ et la branche, une
 *  seule fois : il ouvre et ferme la vue des branches ; habillé comme les
 *  boutons de l'en-tête), puis Pull, Rebase,
 *  Pousser (sync-buttons) ; pas
 *  de bouton Créer / Relire : l'app décide du rôle (view.flow), et le badge
 *  Relecteur s'affiche à côté de celui du worktree quand c'est la relecture ;
 *  le robot d'une PR dans un worktree : son badge, sans action ; au milieu
 *  le nom VibeCoder ; à droite Artefacts, Chercher
 *  (Ctrl K : la palette, toutes portées), puis conversation et ⚙ Réglages (une icône) ;
 *  l'en-tête sert de barre de titre (fenêtre sans cadre : vibecoder.css) ;
 *  Artefacts (un bouton, F-92 : ouvert,
 *  le panneau artifacts-view prend le centre, à la place du fil d'Ariane et de
 *  l'étape ou de la vue des branches ; l'artefact choisi est suivi
 *  (follow) ; ses actions (copier, créer, renommer, déplacer, supprimer… :
 *  onRun, soit act.run, en direct) et les fichiers déposés (onDrop, soit act.drop, avec
 *  le dossier visé) ; le refermer,
 *  choisir une étape ou la vue des branches le ferme) ; ⚙ Réglages (la page des réglages,
 *  onSettings : panel-app l'ouvre) ; conversation
 *  affichée ou masquée — des icônes (icons), libellé en title et aria-label ;
 *  au centre, en tête, le fil d'Ariane (breadcrumb : il dit où l'on en est ; y
 *  choisir une étape ferme la vue des branches ; il porte Vibe, en créateur
 *  seulement : l'action `vibe`, et pendant Vibe, Arrêter Vibe, soit set vibe false),
 *  l'erreur du relevé, et la vue des branches (branches-view) si elle
 *  est ouverte, sinon l'étape choisie (step-views : son en-tête porte ses
 *  actions) ; Vibe ou pas, le
 *  même fil d'Ariane et la même étape ; à droite, en onglets, la conversation (reçue en
 *  children) avec, au bout de la rangée, 🕘 : l'historique (`history`, donné
 *  par panel-app) prend la place du fil, avec « ← Conversation en cours » pour
 *  y revenir ; les actions lancées (runs-view, le nombre en cours, en attente
 *  d'une autorisation ou arrêtées à trancher), les tâches de fond (`tasks`,
 *  le nombre en cours) ou les processus du projet (processes-view, le nombre
 *  en cours), masquable, sa largeur à la poignée (300 px → 60 %) ; la barre
 *  d'état en bas (son ⚙ Tâches ouvre l'onglet ; ses actions en cours, la
 *  colonne affichée sur l'onglet Actions ; son ↻ relève : act.refresh). Le fil d'Ariane et Ctrl+1…6
 *  ouvrent n'importe quelle étape, à venir comprise (le choix ne change que
 *  l'étape affichée : aucun appel au pont, aucune action) ; sans choix,
 *  c'est l'étape en cours. Un cas d'invariant mène à sa ligne de la note (goToNote : l'étape Note choisie,
 *  noteFocus tenu ici, en mémoire, jusqu'à ce que NoteView l'ait atteinte ; la note s'ouvre en haut si la
 *  ligne n'y est plus, son défilement gardé n'est alors pas rendu). Une vue
 *  d'étape qui échoue ne fait tomber ni l'écran ni le brouillon (I-29). Il
 *  tient les réponses en cours aux questions ouvertes, le verdict de la revue
 *  (rôle Relecteur), le champ de chaque étape (fieldOf : son texte part en
 *  args.text de l'action ; exigé et vide, le champ prend le clavier ; partie,
 *  il se vide) et ses pièces jointes (une liste par champ, et une pour le
 *  questionnaire, 'answers' : elles partent avec l'action de leur champ seule,
 *  piecesArg, puis sont libérées, revoke ; le 📎 d'un champ passe par act.attach,
 *  les fichiers déposés ou collés par act.pieces), la vue des branches ouverte ou non, le panneau Artefacts ouvert ou non, les modifications gardées des
 *  fichiers suivis (drafts, par chemin : useFileDraft ; changer d'étape ne
 *  les jette pas) — tout cela gardé par agent
 *  (kept : l'écran est recréé à chaque changement d'agent), par useKept de kept-scope sous un
 *  KeptScope « screen » de l'agent. L'étape affichée a le sien (agent, étape : ses vues y gardent
 *  fichier, pliage, onglet, vue) et c'est ici que se garde son défilement (scrollTop du conteneur,
 *  écrit au défilement, rendu à l'affichage). Le verdict : celui choisi, sinon celui que proposent les
 *  marques (proposedVerdict), sinon Commenter ; le proposé ne publie rien. Aucun modèle ni effort
 *  n'est choisi ici (la page des réglages ; le principal les pose). Préparer un message dans le champ
 *  de la conversation, ou un message qui exige son texte, réaffiche la
 *  conversation (colonne masquée, ou onglet Actions, Tâches, Processus ; l'historique
 *  se referme).
 *  Le fichier de module suivi (`code`, Voir le code) passe à la vue d'étape ;
 *  l'étape change, la vue des branches ou les Artefacts s'ouvrent ou se ferment, ou l'écran se ferme (dont un changement d'agent) : plus
 *  aucun fichier suivi. L'onglet Actions ouvert le dit au principal
 *  (runsSeen : true, les courses de l'agent vues) ; quitté, ou l'écran fermé
 *  (dont un changement d'agent) : runsSeen false.
 *  Ne connaît pas : le pont (rappels passés), le contenu de la conversation.
 *  Utilisé par : panel-app. */
import { Component, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { isBusy, piecesArg, revoke, titleOf, withAttached, withPieces, type Piece } from 'core/conversation';
import { artifactResult, convWidth, fieldOf, isLive, proposedVerdict, scoped, t as strings, type Answers, type Kept, type Strings } from 'core/vibecoder';
import type { Thread, VibeCode, VibeStepId, VibeView } from 'technicals/bridge';
import type { Drafts } from './file-draft';
import { ArtifactsView } from './artifacts-view';
import { Icon } from './icons';
import { KeptScope, useKept } from './kept-scope';
import { BranchesView } from './branches-view';
import { Breadcrumb } from './breadcrumb';
import { ProcessesView } from './processes-view';
import { RunsView } from './runs-view';
import { StatusBar } from './status-bar';
import { SyncButtons } from './sync-buttons';
import { ReviewerBadge, StopRun, WorktreeBadge, type StepPieces } from './step-parts';
import { STEP_VIEWS, type StepProps, type VibeActs } from './step-views';
import './vibecoder.css';

type Props = {
  view: VibeView;
  thread: Thread;              // la conversation en cours de l'agent : nom, état, contexte, tâches
  act: VibeActs;
  tasks: ReactNode;            // le volet des tâches de fond (onglet Tâches de la colonne de droite)
  tasksOpen: boolean;          // l'onglet Tâches est choisi
  contextOpen: boolean;
  onGauge(): void;             // le détail du contexte, sur la conversation
  onTasks(): void;             // Conversation ↔ Tâches
  onSearch(): void;            // Chercher : la palette
  onSettings(): void;          // ⚙ Réglages
  others?: ReactNode;          // les robots des agents et leurs notices (agent-notices, panel-app), tout à gauche ; absent jusqu'au premier agents:state
  branchesAsk?: number;        // +1 : ouvre la vue des branches (Ctrl+Maj+B, la palette) et ferme les Artefacts
  historyOpen: boolean;        // l'historique prend la place du fil
  onHistory(): void;           // 🕘 : l'ouvre / le ferme
  history: ReactNode;          // la liste de l'historique (panel-app)
  side: Side;                  // la colonne de la conversation : affichée, sa largeur (panel-app la retient)
  onSide(side: Side): void;
  children: ReactNode;         // la colonne de la conversation
  kept: Kept;                  // la saisie de l'écran, par agent (panel-app la tient)
  code: VibeCode | null;       // le fichier de module suivi (act.follow), tel que le principal le pousse
};

export type Side = { open: boolean; width: number };

// L'écran d'un agent : ce qu'il garde (étape choisie, champs, réponses, verdict…) va dans le scope « screen »
// de l'agent, ce que garde l'étape affichée dans le scope de l'étape (kept-scope).
export function VibeCoder(props: Props) {
  const screen = useMemo(() => scoped(props.kept, props.view.agentId, 'screen'), [props.kept, props.view.agentId]);
  return <KeptScope.Provider value={screen}><Screen {...props} /></KeptScope.Provider>;
}

function Screen({ view, thread, act: given, tasks, tasksOpen, contextOpen, onGauge, onTasks, onSearch, onSettings, others, branchesAsk = 0, historyOpen, onHistory, history, side, onSide, children, kept, code }: Props) {
  const t = strings(view.lang);
  const [picked, setPicked] = useKept<VibeStepId | null>('picked', null);
  const { steps } = view;
  // L'étape choisie, sinon celle en cours (elle suit le fil d'Ariane tant qu'on n'a rien choisi).
  const step = steps.find((s) => s.id === picked)
    || steps.find((s) => s.status === 'current') || steps[0] || null;
  const busy = isBusy(thread.status);
  // La vue des branches (le bouton ⎇) : ouverte, elle prend le centre à la place de l'étape.
  const [branchesOpen, setBranchesOpen] = useKept('branches', false);
  const branches = branchesOpen && !!view.repo;
  // Le panneau Artefacts : ouvert, il prend le centre ; il ne change pas le rôle (flow).
  const [arts, setArts] = useKept('artifacts', false);
  const asked = useRef(branchesAsk);
  useEffect(() => {
    if (asked.current === branchesAsk) return;
    asked.current = branchesAsk;
    setArts(false);
    setBranchesOpen(true);
  }, [branchesAsk]);
  // La ligne de la note où aller (son texte, mustNot) : en mémoire, jusqu'à ce que NoteView l'ait atteinte (goToNote(null))
  // ou qu'une autre étape soit choisie.
  const [noteFocus, setNoteFocus] = useState<string | null>(null);
  const pick = (id: VibeStepId) => { setBranchesOpen(false); setArts(false); setPicked(id); setNoteFocus(null); };
  const goToNote: StepProps['goToNote'] = (line) => { if (line !== null) pick('note'); setNoteFocus(line); };
  const [answers, setAnswers] = useKept<Answers>('answers', {});
  const onAnswer: StepProps['onAnswer'] = (q, a) => setAnswers((all) => ({ ...all, [q]: a }));
  const root = useRef<HTMLDivElement>(null);
  // L'onglet Actions ou Processus, choisi par-dessus Conversation | Tâches (que panel-app tient).
  const [pane, setPane] = useState<'runs' | 'procs' | null>(null);
  const show = () => { if (!side.open) onSide({ ...side, open: true }); setPane(null); if (tasksOpen) onTasks(); if (historyOpen) onHistory(); };
  // ⚙ Tâches (barre d'état) : la colonne masquée, ou l'onglet Actions, Processus, s'affiche sur l'onglet Tâches ; sinon, l'onglet bascule.
  const toggleTasks = () => {
    if (!side.open) onSide({ ...side, open: true });
    if (pane) { setPane(null); if (!tasksOpen) onTasks(); } else if (side.open || !tasksOpen) onTasks();
  };
  const running = thread.tasks?.filter((x) => x.status === 'running').length || 0;
  const up = view.processes?.filter((p) => p.status === 'running').length || 0;
  const runs = view.runs ?? [];
  const live = runs.filter((r) => isLive(r.state)).length;
  // Le champ de chaque étape : par fieldOf.
  const [texts, setTexts] = useKept<Record<string, string>>('texts', {});
  const setText = (key: string) => (text: string) => setTexts((all) => ({ ...all, [key]: text }));
  const drafts = useKept<Drafts>('drafts', {});
  // Les pièces jointes de chaque champ (sa clé, comme texts ; 'answers' : le questionnaire), tenues avec son texte.
  const [held, setHeld] = useKept<Record<string, Piece[]>>('pieces', {});
  const changePieces = (key: string, f: (cur: Piece[]) => Piece[]) => setHeld((all) => ({ ...all, [key]: f(all[key] ?? []) }));
  const piecesOf = (key: string): StepPieces => ({
    pieces: held[key] ?? [],
    onRemove: (p) => { revoke([p]); changePieces(key, (cur) => cur.filter((x) => x !== p)); },
    onAttach: () => given.attach((what) => changePieces(key, (cur) => withAttached(cur, what))),
    onFiles: async (files) => {
      const added = await given.pieces(files);
      changePieces(key, (cur) => withPieces(cur, added));
    },
  });
  // Les rappels, avec le texte et les pièces du champ de l'action (eux seuls partent avec elle) ;
  // ce qui passe par le champ de la conversation le réaffiche.
  const act: VibeActs = {
    ...given,
    run: async (id, args = {}) => {
      const a = view.actions.find((x) => x.id === id);
      const key = a && args.text === undefined ? fieldOf(a) : null;
      const pkey = key ?? (id === 'answers' ? 'answers' : null);
      const sending = pkey ? held[pkey] ?? [] : [];
      const pieces = piecesArg(sending);
      const text = key ? (texts[key] ?? '').trim() : undefined;
      if (key && a!.needs === 'text' && !text) {
        root.current?.querySelector<HTMLTextAreaElement>(`[data-field="${key}"]`)?.focus();
        return false;
      }
      if (a && (a.kind === 'prefill' || (a.needs === 'text' && !key && args.text === undefined))) show();
      const sent = await given.run(id, { ...args, ...(key ? { text } : {}), ...(pieces ? { pieces } : {}) });
      if (sent && key) setText(key)('');
      if (sent && pkey && sending.length) { revoke(sending); changePieces(pkey, () => []); }
      return sent;
    },
    prefill: (id, quote, block) => { show(); given.prefill(id, quote, block); },
  };
  // L'étape change, la vue des branches ou les Artefacts s'ouvrent ou se ferment, ou l'écran se ferme
  // (il est recréé à chaque changement d'agent) : plus aucun fichier suivi. Les Artefacts suivent le leur (onChoose).
  const center = arts ? ':artifacts' : branches ? ':branches' : step && step.id;
  useEffect(() => () => given.follow(null), [center]);
  // L'onglet Actions ouvert : ses courses vues ; quitté, ou l'écran fermé (dont un changement d'agent) : plus vues.
  const runsOpen = pane === 'runs';
  useEffect(() => {
    if (!runsOpen) return;
    given.set({ runsSeen: true });
    return () => given.set({ runsSeen: false });
  }, [runsOpen]);
  // Le verdict de la revue (Relire), tenu ici comme les réponses : il survit à un changement d'onglet.
  // Choisi, il l'emporte ; sinon celui que proposent les marques ; sinon Commenter. Rien ne part sans le clic Publier.
  const [chosen, setVerdict] = useKept<StepProps['verdict'] | null>('verdict', null);
  const verdict = chosen ?? (view.flow === 'review' ? proposedVerdict(view) : null) ?? 'comment';   // relecteur seulement
  // Ce que garde l'étape affichée (kept-scope), dont le défilement : écrit tel quel dans le scope, sans état React.
  const stepScope = useMemo(() => scoped(kept, view.agentId, step ? step.id : ''), [kept, view.agentId, step && step.id]);
  const stepBox = useRef<HTMLDivElement>(null);
  // Venue d'un cas (noteFocus) : le défilement gardé n'est pas rendu, NoteView défile à la ligne ; introuvable, la note reste en haut.
  useLayoutEffect(() => { if (stepBox.current && noteFocus === null) stepBox.current.scrollTop = stepScope.get('top', 0); }, [center, stepScope]);

  // Ctrl+1…6 : par la touche (sur un clavier AZERTY, le chiffre est sous Maj).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const digit = /^(?:Digit|Numpad)([1-6])$/.exec(e.code);
      const s = digit && e.ctrlKey && !e.altKey && !e.metaKey ? steps[Number(digit[1]) - 1] : null;
      if (!s) return;
      e.preventDefault();
      pick(s.id);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [steps]);

  const View = step && STEP_VIEWS[step.id];
  const vibeAction = view.flow === 'review' ? undefined : view.actions.find((a) => a.id === 'vibe');
  return (
    <StopRun.Provider value={{ stop: (id) => act.runOp(id, 'stop'), state: (id) => view.runs?.find((r) => r.id === id)?.state ?? null, lang: view.lang }}>
      <div className="vc" ref={root} data-conv={side.open ? undefined : 'hidden'} style={{ '--vc-conv': `${side.width}px` } as CSSProperties}>
        <Top view={view} thread={thread} busy={busy} t={t} act={act} side={side} onSide={onSide}
          onSearch={onSearch} onSettings={onSettings} others={others}
          branches={branches} onBranches={() => { setArts(false); setBranchesOpen(!branches); }}
          arts={arts} onArts={() => setArts(!arts)} />
        {arts ? (
          <div className="vc-arts">
            <Guard t={t}>
              <ArtifactsView artifacts={view.artifacts ?? []} artifactDirs={view.artifactDirs ?? []} lang={view.lang} code={code}
                onChoose={act.follow} onOpen={act.open} onRun={act.run} onDrop={act.drop}
                result={artifactResult(view.actions)} />
            </Guard>
          </div>
        ) : (
        <section className="vc-center">
          <Breadcrumb view={view} t={t} selected={branches ? null : step && step.id} onPick={pick} onOpen={act.open}
            vibe={vibeAction ? { a: vibeAction, on: !!view.vibe } : null} onVibe={() => act.run('vibe')} onStopVibe={() => act.set({ vibe: false })} />
          {view.error ? <div className="vc-error" role="status"><b>{view.error}</b> {t.errorHint}</div> : null}
          {branches ? (
            <div className="vc-step scroll" key="branches"><Guard t={t}><BranchesView view={view} t={t} act={act} busy={busy} /></Guard></div>
          ) : (
            <div className="vc-step scroll" key={step ? step.id : ''} ref={stepBox} onScroll={(e) => stepScope.set('top', e.currentTarget.scrollTop)}>
              {step && View ? <KeptScope.Provider value={stepScope}><Guard t={t}><View view={view} step={step} t={t} act={act} busy={busy} answers={answers} onAnswer={onAnswer} verdict={verdict} onVerdict={setVerdict}
                text={texts[step.id] ?? ''} setText={setText(step.id)} code={code} drafts={drafts} noteFocus={noteFocus} goToNote={goToNote}
                {...piecesOf(step.id)} questions={piecesOf('answers')} /></Guard></KeptScope.Provider> : null}
            </div>
          )}
        </section>
        )}
        <section className="vc-conv" aria-label={t.conversation}>
          <Resizer t={t} side={side} root={root} onSide={onSide} />
          <div className="vc-side-tabs vc-band" role="tablist">
            <button type="button" role="tab" className="vc-tab" aria-selected={!tasksOpen && !pane} title={titleOf(thread)}
              onClick={() => { setPane(null); if (tasksOpen) onTasks(); }}>
              {t.conversation}<span className="vc-conv-name">{titleOf(thread)}</span>
            </button>
            <button type="button" role="tab" className="vc-tab" aria-selected={pane === 'runs'} title={t.runsTitle} onClick={() => setPane('runs')}>
              {t.runsOf(live)}
            </button>
            <button type="button" role="tab" className="vc-tab" aria-selected={tasksOpen && !pane} title={t.tasksTitle}
              onClick={() => { setPane(null); if (!tasksOpen) onTasks(); }}>
              {t.tasksOf(running)}
            </button>
            <button type="button" role="tab" className="vc-tab" aria-selected={pane === 'procs'} title={t.procsTitle} onClick={() => setPane('procs')}>
              {t.procsOf(up)}
            </button>
            <button type="button" className="vc-icon vc-history" title={t.history} aria-label={t.history} aria-pressed={historyOpen} onClick={onHistory}><Icon name="history" /></button>
          </div>
          {historyOpen && !tasksOpen && !pane ? (
            <div className="vc-history-view">
              <button type="button" className="vc-mini" onClick={onHistory}>{t.historyBack}</button>
              {history}
            </div>
          ) : children}
          {tasksOpen && !pane ? <div className="vc-tasks-tab" role="tabpanel">{tasks}</div> : null}
          {pane === 'runs' ? <div className="vc-tasks-tab" role="tabpanel"><Guard t={t}><RunsView runs={runs} t={t} onRunOp={act.runOp} onOpenLink={act.openLink} /></Guard></div> : null}
          {pane === 'procs' ? <div className="vc-tasks-tab" role="tabpanel"><Guard t={t}><ProcessesView view={view} t={t} act={act} busy={busy} /></Guard></div> : null}
        </section>
        <StatusBar view={view} thread={thread} t={t} busy={busy} tasksOpen={tasksOpen && !pane} contextOpen={contextOpen}
          onSet={act.set} onGauge={onGauge} onTasks={toggleTasks} onRefresh={act.refresh}
          onRuns={() => { if (!side.open) onSide({ ...side, open: true }); setPane('runs'); }} />
      </div>
    </StopRun.Provider>
  );
}

// La poignée au bord gauche de la conversation : glisser (ou ← / →) change sa largeur, bornée par convWidth.
function Resizer({ t, side, root, onSide }: { t: Strings; side: Side; root: RefObject<HTMLDivElement | null>; onSide(side: Side): void }) {
  const total = () => root.current?.getBoundingClientRect().width ?? 0;
  return (
    <div className="vc-resize" role="separator" aria-orientation="vertical" aria-label={t.convResize} title={t.convResize} tabIndex={0}
      aria-valuenow={side.width}
      onPointerDown={(e) => {
        e.preventDefault();
        const move = (m: PointerEvent) => {
          const r = root.current?.getBoundingClientRect();
          if (r) onSide({ ...side, width: convWidth(r.right - m.clientX, r.width) });
        };
        const up = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); };
        window.addEventListener('pointermove', move);
        window.addEventListener('pointerup', up);
      }}
      onKeyDown={(e) => {
        const step = e.key === 'ArrowLeft' ? 24 : e.key === 'ArrowRight' ? -24 : 0;
        if (!step) return;
        e.preventDefault();
        onSide({ ...side, width: convWidth(side.width + step, total()) });
      }} />
  );
}

type TopProps = {
  view: VibeView; thread: Thread; busy: boolean; t: Strings; act: VibeActs; side: Side; onSide(side: Side): void;
  onSearch(): void; onSettings(): void;
  others?: ReactNode;                                      // les autres agents (agent-notices), tout à gauche, avant le sélecteur
  branches: boolean; onBranches(): void;                   // la vue des branches ouverte ; le bouton ⎇
  arts: boolean; onArts(): void;                           // le panneau Artefacts ouvert ; son bouton
};

function Top({ view, thread, busy, t, act, side, onSide, onSearch, onSettings, others, branches, onBranches, arts, onArts }: TopProps) {
  return (
    <div className="vc-top">
      <div className="vc-ident">
        {others ?? (
          <span className="vc-picker-static">
            <span className="vc-dot" data-busy={busy || undefined} />
            <span className="vc-name" title={thread.dir}>{thread.name}</span>
          </span>
        )}
        {view.repo ? (
          <button type="button" className="vc-top-btn vc-branch" aria-pressed={branches} onClick={onBranches}
            title={`${t.branch(view.repo.branch, view.repo.base)}\n${branches ? t.branchesClose : t.branchesOpen}`}>
            <Icon name="branch" /><span>{view.repo.branch}</span><Icon name="chevron" />
          </button>
        ) : null}
        {view.repo ? <SyncButtons view={view} onRun={act.run} /> : null}
        <WorktreeBadge view={view} />
        <ReviewerBadge view={view} t={t} />
      </div>
      <span className="vc-appname">VibeCoder</span>
      <div className="vc-tools">
        <button type="button" className="vc-top-btn" aria-pressed={arts} title={t.artifactsTitle} onClick={onArts}>{t.artifacts}</button>
        <button type="button" className="vc-search" title={`${t.search} (${t.searchKeys})`} onClick={onSearch}>
          <Icon name="search" /><span>{t.search}</span><kbd>{t.searchKeys}</kbd>
        </button>
        {view.dev === 'reload' ? (
          <button type="button" className="vc-mini vc-dev" title={t.reloadUiTitle} onClick={() => act.set({ reloadUi: true })}>{t.reloadUi}</button>
        ) : view.dev === 'restart' ? (
          <button type="button" className="vc-mini vc-dev" data-restart title={t.restartAppTitle} onClick={() => act.set({ restartApp: true })}>
            <span className="vc-dev-dot" aria-hidden="true" />{t.restartApp}
          </button>
        ) : null}
        <button type="button" className="vc-icon vc-side-toggle" title={side.open ? t.convHide : t.convShow} aria-label={side.open ? t.convHide : t.convShow}
          aria-pressed={side.open} onClick={() => onSide({ ...side, open: !side.open })}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" /><path d="M10 2.5v11" /></svg>
        </button>
        <button type="button" className="vc-icon" title={t.settingsTitle} aria-label={t.settingsTitle} onClick={onSettings}><Icon name="gear" /></button>
      </div>
    </div>
  );
}

// Une vue d'étape qui plante sur un texte inattendu : un message et Réessayer, le reste de l'écran tient.
class Guard extends Component<{ t: Strings; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <div className="vc-empty">
        {this.props.t.broken}{' '}
        <button type="button" className="vc-mini" onClick={() => this.setState({ failed: false })}>{this.props.t.retry}</button>
      </div>
    );
  }
}
