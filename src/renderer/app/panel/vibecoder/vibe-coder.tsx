/** vibe-coder — l'écran VibeCoder d'un agent, à la place de l'en-tête et du
 *  corps du panneau : en-tête (agent, branche, Créer / Relire, Guide / Vibe,
 *  langue, relevé, retour à la conversation, fermer) ; le parcours à gauche ;
 *  au centre, les onglets des étapes, l'étape choisie (step-views) et la
 *  prochaine étape ; à droite, la conversation (reçue en children) ; la
 *  barre d'état en bas. Ctrl+1…6 ouvrent les étapes. Une vue d'étape qui
 *  échoue ne fait tomber ni l'écran ni le brouillon (I-29).
 *  Ne connaît pas : le pont (rappels passés), le contenu de la conversation.
 *  Utilisé par : panel-app. */
import { Component, useEffect, useState, type ReactNode } from 'react';
import { isBusy, titleOf } from 'core/conversation';
import { t as strings, type Strings } from 'core/vibecoder';
import type { Thread, VibeLang, VibeStepId, VibeView } from 'technicals/bridge';
import { Journey } from './journey';
import { NextStep } from './next-step';
import { StatusBar } from './status-bar';
import { STEP_VIEWS, type VibeActs } from './step-views';
import './vibecoder.css';

type Props = {
  view: VibeView;
  thread: Thread;              // la conversation en cours de l'agent : nom, état, contexte, tâches
  act: VibeActs;
  tasksOpen: boolean;
  contextOpen: boolean;
  onGauge(): void;             // le détail du contexte, sur la conversation
  onTasks(): void;             // le volet des tâches, dans la conversation
  onHide(): void;
  children: ReactNode;         // la colonne de la conversation
};

export function VibeCoder({ view, thread, act, tasksOpen, contextOpen, onGauge, onTasks, onHide, children }: Props) {
  const t = strings(view.lang);
  const [picked, setPicked] = useState<VibeStepId | null>(null);
  const { steps } = view;
  // L'étape choisie, sinon celle en cours (elle suit le parcours tant qu'on n'a rien choisi).
  const step = steps.find((s) => s.id === picked) || steps.find((s) => s.status === 'current') || steps[0] || null;
  const busy = isBusy(thread.status);

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
    <div className="vc">
      <Top view={view} thread={thread} busy={busy} t={t} act={act} onHide={onHide} />
      <Journey view={view} t={t} selected={step && step.id} onPick={setPicked} />
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
          {step && View ? <Guard t={t}><View view={view} step={step} t={t} act={act} busy={busy} /></Guard> : null}
        </div>
        <NextStep actions={view.actions} step={step && step.id} t={t} busy={busy} asking={thread.status === 'asking'}
          onRun={act.run} onPick={setPicked} />
      </section>
      <section className="vc-conv" aria-label={t.conversation}>
        <div className="vc-side-title vc-band"><span>{t.conversation}</span><span className="vc-conv-name">{titleOf(thread)}</span></div>
        {children}
      </section>
      <StatusBar view={view} thread={thread} t={t} tasksOpen={tasksOpen} contextOpen={contextOpen}
        onSet={act.set} onGauge={onGauge} onTasks={onTasks} />
    </div>
  );
}

const LANGS: Record<VibeLang, string> = { fr: 'FR', en: 'EN' };

function Top({ view, thread, busy, t, act, onHide }: { view: VibeView; thread: Thread; busy: boolean; t: Strings; act: VibeActs; onHide(): void }) {
  const [spins, setSpins] = useState(0); // ⟳ tourne une fois par clic
  return (
    <div className="vc-top">
      <div className="vc-ident">
        <span className="vc-dot" data-busy={busy || undefined} />
        <span className="vc-name" title={thread.dir}>{thread.name}</span>
        {view.repo ? <span className="vc-branch" title={t.branch(view.repo.branch, view.repo.base)}>{`⎇ ${view.repo.branch}`}</span> : null}
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
