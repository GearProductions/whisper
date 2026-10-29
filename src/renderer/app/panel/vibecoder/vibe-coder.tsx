/** vibe-coder — l'écran VibeCoder d'un agent, à la place de l'en-tête et du
 *  corps du panneau : en-tête (agent — sa couleur, seule touche de couleur
 *  avec Envoyer —, la branche ⎇, un bouton qui ouvre et ferme la vue des
 *  branches, et à côté Pull, Rebase, Pousser (sync-buttons) ; Créer / Relire,
 *  Relire grisé sans PR ouverte sur la branche (view.reviewable), et à part
 *  Artefacts (un bouton, hors de Créer / Relire, F-92 : ouvert, le panneau
 *  artifacts-view prend la gauche et le centre, à la place du parcours et de
 *  l'étape ou de la vue des branches ; l'artefact choisi est suivi
 *  (follow) ; Copier dans le projet : copy-artifact, direct ; le refermer,
 *  choisir une étape, Créer / Relire ou la vue des branches le ferme) ; langue,
 *  relevé, conversation affichée ou masquée, retour à la conversation,
 *  fermer ; le robot d'une PR dans un worktree : son badge, sans action) ; le
 *  parcours à gauche (il dit où l'on en est ; y choisir une étape, ou Créer /
 *  Relire, ferme la vue des branches) ; au centre, la vue des branches
 *  (branches-view) si elle est ouverte, sinon l'étape choisie (step-views :
 *  son en-tête porte ses actions ; Relire, une PR fusionnée ou fermée en
 *  bandeau) ; Vibe ou pas, le même parcours et la même étape — pendant Vibe
 *  (view.vibe), une bannière en tête du centre (vibe-banner) qui l'arrête
 *  (set vibe false) ; à droite, en onglets, la conversation (reçue en
 *  children), les actions lancées (runs-view, le nombre en cours, en attente
 *  d'une autorisation ou arrêtées à trancher), les tâches de fond (`tasks`,
 *  le nombre en cours) ou les processus du projet (processes-view, le nombre
 *  en cours), masquable, sa largeur à la poignée (300 px → 60 %) ; la barre
 *  d'état en bas (son ⚙ Tâches ouvre l'onglet). Le parcours et Ctrl+1…6
 *  n'ouvrent qu'une étape que le relevé dit ouverte (open) ; une étape
 *  choisie qui ne l'est plus laisse la place à celle en cours. Une vue
 *  d'étape qui échoue ne fait tomber ni l'écran ni le brouillon (I-29). Il
 *  tient les réponses en cours aux questions ouvertes, le verdict de la revue
 *  (Relire), le modèle choisi par action (envoyé s'il n'est pas le
 *  conseillé), le champ de chaque étape (fieldOf : son texte part en
 *  args.text de l'action ; exigé et vide, le champ prend le clavier ; partie,
 *  il se vide), la vue des branches ouverte ou non, le panneau Artefacts ouvert ou non, les modifications gardées des
 *  fichiers suivis (drafts, par chemin : useFileDraft ; changer d'étape ne
 *  les jette pas) — tout cela gardé par agent
 *  (kept : l'écran est recréé à chaque changement d'agent). Préparer un message dans le champ
 *  de la conversation, ou un message qui exige son texte, réaffiche la
 *  conversation (colonne masquée, ou onglet Actions, Tâches, Processus).
 *  Le fichier de module suivi (`code`, Voir le code) passe à la vue d'étape ;
 *  l'étape change, la vue des branches ou les Artefacts s'ouvrent ou se ferment, ou l'écran se ferme (dont un changement d'agent) : plus
 *  aucun fichier suivi. L'onglet Actions ouvert le dit au principal
 *  (runsSeen : true, les courses de l'agent vues) ; quitté, ou l'écran fermé
 *  (dont un changement d'agent) : runsSeen false.
 *  Ne connaît pas : le pont (rappels passés), le contenu de la conversation.
 *  Utilisé par : panel-app. */
import { Component, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { isBusy, titleOf } from 'core/conversation';
import { convWidth, fieldOf, isLive, modelArg, t as strings, type Answers, type Kept, type ModelPicks, type Strings } from 'core/vibecoder';
import type { Thread, VibeCode, VibeLang, VibeStepId, VibeView } from 'technicals/bridge';
import type { Drafts } from './file-draft';
import { ArtifactsView } from './artifacts-view';
import { BranchesView } from './branches-view';
import { Journey } from './journey';
import { ProcessesView } from './processes-view';
import { Picks } from './model-pick';
import { RunsView } from './runs-view';
import { StatusBar } from './status-bar';
import { SyncButtons } from './sync-buttons';
import { ClosedBanner, StopRun, WorktreeBadge } from './step-parts';
import { STEP_VIEWS, type StepProps, type VibeActs } from './step-views';
import { VibeBanner } from './vibe-banner';
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
  onHide(): void;
  side: Side;                  // la colonne de la conversation : affichée, sa largeur (panel-app la retient)
  onSide(side: Side): void;
  children: ReactNode;         // la colonne de la conversation
  kept: Kept;                  // la saisie de l'écran, par agent (panel-app la tient)
  code: VibeCode | null;       // le fichier de module suivi (act.follow), tel que le principal le pousse
};

export type Side = { open: boolean; width: number };

// Un état de l'écran, gardé pour l'agent : rendu quand on revient sur lui.
function useKept<T>(kept: Kept, agent: string, key: string, initial: T) {
  const [value, set] = useState<T>(() => kept.get(agent, key, initial));
  useEffect(() => { kept.set(agent, key, value); }, [kept, agent, key, value]);
  return [value, set] as const;
}

export function VibeCoder({ view, thread, act: given, tasks, tasksOpen, contextOpen, onGauge, onTasks, onHide, side, onSide, children, kept, code }: Props) {
  const t = strings(view.lang);
  const [picked, setPicked] = useKept<VibeStepId | null>(kept, view.agentId, 'picked', null);
  const { steps } = view;
  // L'étape choisie si elle est ouverte, sinon celle en cours (elle suit le parcours tant qu'on n'a rien choisi).
  const step = steps.find((s) => s.id === picked && s.open)
    || steps.find((s) => s.status === 'current') || steps[0] || null;
  const busy = isBusy(thread.status);
  // La vue des branches (le bouton ⎇) : ouverte, elle prend le centre à la place de l'étape.
  const [branchesOpen, setBranchesOpen] = useKept(kept, view.agentId, 'branches', false);
  const branches = branchesOpen && !!view.repo;
  // Le panneau Artefacts : ouvert, il prend la gauche et le centre ; il ne change pas le parcours (flow).
  const [arts, setArts] = useKept(kept, view.agentId, 'artifacts', false);
  const pick = (id: VibeStepId) => { setBranchesOpen(false); setArts(false); setPicked(id); };
  const [answers, setAnswers] = useKept<Answers>(kept, view.agentId, 'answers', {});
  const onAnswer: StepProps['onAnswer'] = (q, a) => setAnswers((all) => ({ ...all, [q]: a }));
  const [picks, setPicks] = useKept<ModelPicks>(kept, view.agentId, 'picks', {});
  const root = useRef<HTMLDivElement>(null);
  // L'onglet Actions ou Processus, choisi par-dessus Conversation | Tâches (que panel-app tient).
  const [pane, setPane] = useState<'runs' | 'procs' | null>(null);
  const show = () => { if (!side.open) onSide({ ...side, open: true }); setPane(null); if (tasksOpen) onTasks(); };
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
  const [texts, setTexts] = useKept<Record<string, string>>(kept, view.agentId, 'texts', {});
  const setText = (key: string) => (text: string) => setTexts((all) => ({ ...all, [key]: text }));
  const drafts = useKept<Drafts>(kept, view.agentId, 'drafts', {});
  // Les rappels, avec le modèle choisi (s'il n'est pas le conseillé) et le texte du champ de l'action ;
  // ce qui passe par le champ de la conversation le réaffiche.
  const act: VibeActs = {
    ...given,
    run: async (id, args = {}) => {
      const a = view.actions.find((x) => x.id === id);
      const model = a && modelArg(a, picks);
      const key = a && args.text === undefined ? fieldOf(a) : null;
      const text = key ? (texts[key] ?? '').trim() : undefined;
      if (key && a!.needs === 'text' && !text) {
        root.current?.querySelector<HTMLTextAreaElement>(`[data-field="${key}"]`)?.focus();
        return false;
      }
      if (a && (a.kind === 'prefill' || (a.needs === 'text' && !key && args.text === undefined))) show();
      const sent = await given.run(id, { ...args, ...(key ? { text } : {}), ...(model ? { model } : {}) });
      if (sent && key) setText(key)('');
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
  const [verdict, setVerdict] = useKept<StepProps['verdict']>(kept, view.agentId, 'verdict', 'comment');

  // Ctrl+1…6 : par la touche (sur un clavier AZERTY, le chiffre est sous Maj).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const digit = /^(?:Digit|Numpad)([1-6])$/.exec(e.code);
      const s = digit && e.ctrlKey && !e.altKey && !e.metaKey ? steps[Number(digit[1]) - 1] : null;
      if (!s?.open) return;
      e.preventDefault();
      pick(s.id);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [steps]);

  const View = step && STEP_VIEWS[step.id];
  return (
    <Picks.Provider value={{ picks, lang: view.lang, pick: (id, m) => setPicks((p) => ({ ...p, [id]: m })) }}>
    <StopRun.Provider value={{ stop: (id) => act.runOp(id, 'stop'), state: (id) => view.runs?.find((r) => r.id === id)?.state ?? null }}>
      <div className="vc" ref={root} data-conv={side.open ? undefined : 'hidden'} style={{ '--vc-conv': `${side.width}px` } as CSSProperties}>
        <Top view={view} thread={thread} busy={busy} t={t} act={act} side={side} onSide={onSide} onHide={onHide}
          branches={branches} onBranches={() => { setArts(false); setBranchesOpen(!branches); }}
          arts={arts} onArts={() => setArts(!arts)} onFlow={() => { setBranchesOpen(false); setArts(false); }} />
        {arts ? (
          <Guard t={t}>
            <ArtifactsView artifacts={view.artifacts ?? []} lang={view.lang} code={code} onChoose={act.follow} onOpen={act.open}
              onCopy={(artifact) => act.run('copy-artifact', { direct: true, artifact })} />
          </Guard>
        ) : <>
        <Journey view={view} t={t} selected={branches ? null : step && step.id} onPick={pick} onOpen={act.open} />
        <section className="vc-center">
          {view.vibe ? <VibeBanner t={t} onStop={() => act.set({ vibe: false })} /> : null}
          {view.error ? <div className="vc-error" role="status"><b>{view.error}</b> {t.errorHint}</div> : null}
          {branches ? (
            <div className="vc-step scroll" key="branches"><Guard t={t}><BranchesView view={view} t={t} act={act} busy={busy} /></Guard></div>
          ) : (
            <div className="vc-step scroll" key={step ? step.id : ''}>
              {view.flow === 'review' ? <ClosedBanner pr={view.pr} t={t} /> : null}
              {step && View ? <Guard t={t}><View view={view} step={step} t={t} act={act} busy={busy} answers={answers} onAnswer={onAnswer} verdict={verdict} onVerdict={setVerdict}
                text={texts[step.id] ?? ''} setText={setText(step.id)} code={code} drafts={drafts} /></Guard> : null}
            </div>
          )}
        </section>
        </>}
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
          </div>
          {children}
          {tasksOpen && !pane ? <div className="vc-tasks-tab" role="tabpanel">{tasks}</div> : null}
          {pane === 'runs' ? <div className="vc-tasks-tab" role="tabpanel"><Guard t={t}><RunsView runs={runs} t={t} onRunOp={act.runOp} onOpenLink={act.openLink} /></Guard></div> : null}
          {pane === 'procs' ? <div className="vc-tasks-tab" role="tabpanel"><Guard t={t}><ProcessesView view={view} t={t} act={act} busy={busy} /></Guard></div> : null}
        </section>
        <StatusBar view={view} thread={thread} t={t} busy={busy} tasksOpen={tasksOpen && !pane} contextOpen={contextOpen}
          onSet={act.set} onGauge={onGauge} onTasks={toggleTasks} />
      </div>
    </StopRun.Provider>
    </Picks.Provider>
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

const LANGS: Record<VibeLang, string> = { fr: 'FR', en: 'EN' };

type TopProps = {
  view: VibeView; thread: Thread; busy: boolean; t: Strings; act: VibeActs; side: Side; onSide(side: Side): void; onHide(): void;
  branches: boolean; onBranches(): void; onFlow(): void;   // la vue des branches ouverte ; le bouton ⎇ ; Créer / Relire choisi
  arts: boolean; onArts(): void;                           // le panneau Artefacts ouvert ; son bouton
};

function Top({ view, thread, busy, t, act, side, onSide, onHide, branches, onBranches, onFlow, arts, onArts }: TopProps) {
  const [spins, setSpins] = useState(0); // ⟳ tourne une fois par clic
  return (
    <div className="vc-top">
      <div className="vc-ident">
        <span className="vc-dot" data-busy={busy || undefined} />
        <span className="vc-name" title={thread.dir}>{thread.name}</span>
        {view.repo ? (
          <button type="button" className="vc-branch" aria-pressed={branches} onClick={onBranches}
            title={`${t.branch(view.repo.branch, view.repo.base)}\n${branches ? t.branchesClose : t.branchesOpen}`}>
            {`⎇ ${view.repo.branch}`}
          </button>
        ) : null}
        {view.repo ? <SyncButtons view={view} onRun={act.run} /> : null}
        <WorktreeBadge view={view} />
      </div>
      <div className="vc-modes">
        <Segmented value={view.flow} labels={t.flow} title={t.flowTitle} off={view.reviewable ? {} : { review: t.notReviewable }}
          onPick={(flow) => { onFlow(); act.set({ flow }); }} />
        <div className="vc-seg">
          <button type="button" aria-pressed={arts} title={t.artifactsTitle} onClick={onArts}>{t.artifacts}</button>
        </div>
      </div>
      <div className="vc-tools">
        {view.dev === 'reload' ? (
          <button type="button" className="vc-mini vc-dev" title={t.reloadUiTitle} onClick={() => act.set({ reloadUi: true })}>{t.reloadUi}</button>
        ) : view.dev === 'restart' ? (
          <button type="button" className="vc-mini vc-dev" data-restart title={t.restartAppTitle} onClick={() => act.set({ restartApp: true })}>
            <span className="vc-dev-dot" aria-hidden="true" />{t.restartApp}
          </button>
        ) : null}
        <Segmented value={view.lang} labels={LANGS} title={t.langTitle} onPick={(lang) => act.set({ lang })} />
        <button type="button" className="vc-icon vc-refresh" title={t.refresh} aria-label={t.refresh}
          onClick={() => { setSpins((n) => n + 1); act.refresh(); }}>
          <span key={spins} className={spins ? 'vc-spin' : undefined}>↻</span>
        </button>
        <button type="button" className="vc-icon vc-side-toggle" title={side.open ? t.convHide : t.convShow} aria-label={side.open ? t.convHide : t.convShow}
          aria-pressed={side.open} onClick={() => onSide({ ...side, open: !side.open })}>
          <svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" /><path d="M10 2.5v11" /></svg>
        </button>
        <button type="button" className="vc-icon" title={t.back} aria-label={t.back} onClick={() => act.set({ view: 'conversation' })}>💬</button>
        <button type="button" className="vc-icon vc-close" title={t.close} aria-label={t.close} onClick={onHide}>×</button>
      </div>
    </div>
  );
}

// off : les choix grisés et leur raison (en infobulle).
function Segmented<T extends string>({ value, labels, title, off = {}, onPick }: { value: T; labels: Record<T, string>; title: string; off?: Partial<Record<T, string>>; onPick(v: T): void }) {
  return (
    <div className="vc-seg" role="group" title={title}>
      {(Object.keys(labels) as T[]).map((k) => (
        <button key={k} type="button" aria-pressed={k === value} disabled={!!off[k]} title={off[k]}
          onClick={() => { if (k !== value) onPick(k); }}>{labels[k]}</button>
      ))}
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
