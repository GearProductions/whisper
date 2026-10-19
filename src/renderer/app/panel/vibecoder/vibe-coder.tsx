/** vibe-coder — l'écran VibeCoder d'un agent, à la place de l'en-tête et du
 *  corps du panneau : en-tête (agent — sa couleur, seule touche de couleur
 *  avec Envoyer —, branche, Créer / Relire, Guide / Vibe, langue, relevé,
 *  conversation affichée ou masquée, retour à la conversation, fermer ; le
 *  robot d'une PR dans un worktree : son badge et Décharger) ; le
 *  parcours à gauche (il dit où l'on en est) ; au centre, les onglets des
 *  étapes, l'étape choisie (step-views : son en-tête porte ses actions ; en
 *  Vibe, un bandeau le rappelle en haut ; Relire, une PR fusionnée ou fermée
 *  aussi) ; à droite, en onglets, la conversation (reçue en children), les
 *  actions lancées (runs-view, le nombre en cours, en attente d'une
 *  autorisation ou arrêtées à trancher), les tâches de fond (`tasks`, le
 *  nombre en cours) ou les processus du projet (processes-view, le nombre en
 *  cours), masquable, sa
 *  largeur à la poignée (300 px → 60 %) ; la barre d'état en bas (son ⚙
 *  Tâches ouvre l'onglet). Ctrl+1…6 ouvrent les étapes. Une vue d'étape qui
 *  échoue ne fait tomber ni l'écran ni le brouillon (I-29). Il tient les
 *  réponses en cours aux questions ouvertes, le verdict de la revue (Relire),
 *  le modèle choisi par action (envoyé s'il n'est pas le conseillé), le champ
 *  de chaque étape et celui de Tout dérouler (fieldOf : son texte part en
 *  args.text de l'action ; exigé et vide, le champ prend le clavier ; partie,
 *  il se vide). Préparer un message dans le champ de la conversation, ou un
 *  message qui exige son texte, réaffiche la conversation (colonne masquée,
 *  ou onglet Actions, Tâches, Processus).
 *  Ne connaît pas : le pont (rappels passés), le contenu de la conversation.
 *  Utilisé par : panel-app. */
import { Component, useEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react';
import { isBusy, titleOf } from 'core/conversation';
import { convWidth, fieldOf, modelArg, t as strings, type Answers, type ModelPicks, type Strings } from 'core/vibecoder';
import type { Thread, VibeLang, VibeStepId, VibeView } from 'technicals/bridge';
import { Journey } from './journey';
import { ProcessesView } from './processes-view';
import { Picks } from './model-pick';
import { RunsView } from './runs-view';
import { StatusBar } from './status-bar';
import { ClosedBanner, StopRun, VibeBanner, WorktreeBadge } from './step-parts';
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
  onHide(): void;
  side: Side;                  // la colonne de la conversation : affichée, sa largeur (panel-app la retient)
  onSide(side: Side): void;
  children: ReactNode;         // la colonne de la conversation
};

export type Side = { open: boolean; width: number };

export function VibeCoder({ view, thread, act: given, tasks, tasksOpen, contextOpen, onGauge, onTasks, onHide, side, onSide, children }: Props) {
  const t = strings(view.lang);
  const [picked, setPicked] = useState<VibeStepId | null>(null);
  const { steps } = view;
  // L'étape choisie, sinon celle en cours (elle suit le parcours tant qu'on n'a rien choisi).
  const step = steps.find((s) => s.id === picked) || steps.find((s) => s.status === 'current') || steps[0] || null;
  const busy = isBusy(thread.status);
  const [answers, setAnswers] = useState<Answers>({});
  const onAnswer: StepProps['onAnswer'] = (q, a) => setAnswers((all) => ({ ...all, [q]: a }));
  const [picks, setPicks] = useState<ModelPicks>({});
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
  const live = runs.filter((r) => r.state === 'running' || r.state === 'asking' || r.state === 'stopped').length;
  // Le champ de chaque étape, et celui de Tout dérouler ('vibe') : par fieldOf.
  const [texts, setTexts] = useState<Record<string, string>>({});
  const setText = (key: string) => (text: string) => setTexts((all) => ({ ...all, [key]: text }));
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
    prefill: (id, quote) => { show(); given.prefill(id, quote); },
  };
  // Le verdict de la revue (Relire), tenu ici comme les réponses : il survit à un changement d'onglet.
  const [verdict, setVerdict] = useState<StepProps['verdict']>('comment');

  // Ctrl+1…6 : par la touche (sur un clavier AZERTY, le chiffre est sous Maj).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const digit = /^(?:Digit|Numpad)([1-6])$/.exec(e.code);
      const s = digit && e.ctrlKey && !e.altKey && !e.metaKey ? steps[Number(digit[1]) - 1] : null;
      if (!s) return;
      e.preventDefault();
      setPicked(s.id);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [steps]);

  const View = step && STEP_VIEWS[step.id];
  return (
    <Picks.Provider value={{ picks, lang: view.lang, pick: (id, m) => setPicks((p) => ({ ...p, [id]: m })) }}>
    <StopRun.Provider value={{ stop: (id) => act.runOp(id, 'stop'), state: (id) => view.runs?.find((r) => r.id === id)?.state ?? null }}>
      <div className="vc" ref={root} data-conv={side.open ? undefined : 'hidden'} style={{ '--vc-conv': `${side.width}px` } as CSSProperties}>
        <Top view={view} thread={thread} busy={busy} t={t} act={act} side={side} onSide={onSide} onHide={onHide} />
        <Journey view={view} t={t} selected={step && step.id} onPick={setPicked} onOpen={act.open} />
        <section className="vc-center">
          <div className="vc-tabs vc-band" role="tablist">
            {steps.map((s, i) => (
              <button key={s.id} type="button" role="tab" className="vc-tab" aria-selected={s === step} data-status={s.status}
                title={i < 6 ? t.shortcut(i + 1) : undefined} onClick={() => setPicked(s.id)}>
                <span className="vc-tdot" />{t.steps[s.id]}
              </button>
            ))}
          </div>
          {view.error ? <div className="vc-error" role="status"><b>{view.error}</b> {t.errorHint}</div> : null}
          <div className="vc-step scroll" key={step ? step.id : ''} role="tabpanel">
            {view.autonomy === 'vibe' ? (
              <VibeBanner lang={view.lang}
                field={view.actions.some((a) => fieldOf(a) === 'vibe' && a.primary) ? { text: texts.vibe ?? '', setText: setText('vibe') } : undefined} />
            ) : null}
            {view.flow === 'review' ? <ClosedBanner pr={view.pr} t={t} /> : null}
            {step && View ? <Guard t={t}><View view={view} step={step} t={t} act={act} busy={busy} answers={answers} onAnswer={onAnswer} verdict={verdict} onVerdict={setVerdict}
              text={texts[step.id] ?? ''} setText={setText(step.id)} /></Guard> : null}
          </div>
        </section>
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

type TopProps = { view: VibeView; thread: Thread; busy: boolean; t: Strings; act: VibeActs; side: Side; onSide(side: Side): void; onHide(): void };

function Top({ view, thread, busy, t, act, side, onSide, onHide }: TopProps) {
  const [spins, setSpins] = useState(0); // ⟳ tourne une fois par clic
  return (
    <div className="vc-top">
      <div className="vc-ident">
        <span className="vc-dot" data-busy={busy || undefined} />
        <span className="vc-name" title={thread.dir}>{thread.name}</span>
        {view.repo ? <span className="vc-branch" title={t.branch(view.repo.branch, view.repo.base)}>{`⎇ ${view.repo.branch}`}</span> : null}
        <WorktreeBadge view={view} busy={busy} onRun={() => act.run('unload-worktree')} />
      </div>
      <div className="vc-modes">
        <Segmented value={view.flow} labels={t.flow} title={t.flowTitle} onPick={(flow) => act.set({ flow })} />
        <Segmented value={view.autonomy} labels={t.autonomy} title={t.autonomyTitle} onPick={(autonomy) => act.set({ autonomy })} />
      </div>
      <div className="vc-tools">
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

function Segmented<T extends string>({ value, labels, title, onPick }: { value: T; labels: Record<T, string>; title: string; onPick(v: T): void }) {
  return (
    <div className="vc-seg" role="group" title={title}>
      {(Object.keys(labels) as T[]).map((k) => (
        <button key={k} type="button" aria-pressed={k === value} onClick={() => { if (k !== value) onPick(k); }}>{labels[k]}</button>
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
