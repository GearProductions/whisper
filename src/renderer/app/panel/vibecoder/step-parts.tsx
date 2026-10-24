/** step-parts — les pièces des vues d'étape : l'en-tête d'étape (nom, état,
 *  faits, outils à droite ; dessous, le champ de l'étape quand une de ses
 *  actions en prend le texte (fieldOf), puis la rangée des actions de l'étape
 *  — celle que le guide fait faire ensuite mise en avant, et elle seule d'une
 *  autre étape quand celle-ci est en cours —, sauf celles que la vue montre
 *  elle-même et celles que le relevé masque), le champ d'une étape, la carte
 *  d'une sortie de skill (titre, fichier, depuis quand), le bouton d'une
 *  action du relevé (son libellé ou un plus court, qui travaille ou le choix
 *  du modèle, pourquoi c'est grisé ; sa course en cours : « en cours » et ⏹ ;
 *  absent si l'action n'existe pas ou que le relevé la masque (hidden) ; une
 *  action que l'appli fait elle-même : « direct », à côté « via » l'agent, et
 *  dessous son dernier résultat, F-114), l'invitation (rien encore, et ce qui
 *  le produit), la carte d'une PR, le bandeau d'une PR fusionnée ou fermée,
 *  le badge du robot d'une PR ouverte dans un worktree (et Décharger).
 *  Ne connaît pas : le pont (rappels passés ; ⏹ par le contexte StopRun).
 *  Utilisé par : les vues d'étape, vibe-screen ; vibe-coder (bandeau d'une
 *  PR fermée, badge du worktree). */
import { createContext, useContext, type ReactNode } from 'react';
import { fieldOf, isLive, t as strings, webUrl, type Strings } from 'core/vibecoder';
import type { VibeAction, VibeArgs, VibeLang, VibePr, VibeRun, VibeView } from 'technicals/bridge';
import { ModelPick, Picks } from './model-pick';
import type { StepProps } from './step-views';
import './step-parts.css';

const fr = {
  openPr: 'Ouvrir ↗',
  openPrTitle: 'Ouvrir la PR dans le navigateur',
  by: (author: string) => `par ${author}`,
  worktree: (n: number) => `PR #${n} · worktree`,
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    openPr: 'Open ↗',
    openPrTitle: 'Open the PR in the browser',
    by: (author) => `by ${author}`,
    worktree: (n) => `PR #${n} · worktree`,
  },
};

// Une action qui cite ({{quote}}) part d'un bloc ou d'un cas, pas d'un bouton à elle.
const cites = (a: VibeAction) => a.kind === 'prefill' && !!a.text?.includes('{{quote}}');

// La course d'une action sur son bouton : son état (VibeView.runs) et ⏹ (vibe-coder le relie à act.runOp(id, 'stop')).
export const StopRun = createContext<{ stop(id: string): void; state(id: string): VibeRun['state'] | null }>({ stop: () => {}, state: () => null });

// Le champ d'une étape (ou de l'écran Vibe, celui de la note) : son texte part avec l'action qui le prend (fieldOf).
export function StepField({ name, text, setText, hint }: { name: string; text: string; setText(text: string): void; hint: string }) {
  return (
    <div className="vc-cbox vc-step-field">
      <textarea data-field={name} value={text} rows={3} placeholder={hint} aria-label={hint} onChange={(e) => setText(e.target.value)} />
    </div>
  );
}

// L'en-tête d'une étape ; `own` : les actions que la vue montre elle-même (pas répétées ici) ; les masquées, nulle part.
export function StepHead({ p, own = [], children }: { p: StepProps; own?: string[]; children?: ReactNode }) {
  const { view, step, t, act, busy } = p;
  const field = view.actions.some((a) => fieldOf(a) === step.id);
  const current = step.status === 'current';
  const acts = view.actions
    .filter((a) => !a.hidden && (a.step === step.id || (a.primary && current)) && !cites(a) && !own.includes(a.id))
    .sort((a, b) => Number(b.primary && current) - Number(a.primary && current));
  return (
    <div className="vc-step-head">
      <h2>{t.steps[step.id]}</h2>
      <span className="vc-badge" data-status={step.status}>{t.stepStatus[step.status]}</span>
      {step.facts ? <span className="vc-facts">{step.facts}</span> : null}
      {children ? <div className="vc-step-tools">{children}</div> : null}
      {field ? <StepField name={step.id} text={p.text} setText={p.setText} hint={t.fieldHint} /> : null}
      {acts.length ? (
        <div className="vc-step-acts">
          {acts.map((a) => <Run key={a.id} a={a} busy={busy} tone={a.primary && current ? 'accent' : 'plain'} onRun={(x) => act.run(a.id, x)} />)}
        </div>
      ) : null}
    </div>
  );
}

type CardProps = { title: ReactNode; file?: string; time?: number; t: Strings; tools?: ReactNode; className?: string; children?: ReactNode };

// Une carte : son titre, le fichier qu'elle montre et depuis quand, ses outils à droite.
export function OutputCard({ title, file, time, t, tools, className, children }: CardProps) {
  return (
    <section className={className ? `vc-card ${className}` : 'vc-card'}>
      <div className="vc-card-head">
        <span className="vc-card-title">{title}</span>
        {file ? <span className="vc-card-file vc-mono">{file}</span> : null}
        <span className="vc-card-end">
          {time ? <span className="vc-card-time" title={new Date(time).toLocaleString(t.locale)}>{t.ago(Date.now() - time)}</span> : null}
          {tools}
        </span>
      </div>
      {children ? <div className="vc-card-body">{children}</div> : null}
    </section>
  );
}

// onRun : sans argument, par l'agent ; { direct: true } : par l'appli elle-même (VibeAction.direct).
type RunProps = { a: VibeAction | undefined; busy: boolean; label?: ReactNode; tone?: 'accent' | 'plain' | 'ghost'; onRun(extra?: VibeArgs): void };

// Une action du relevé (masquée, hidden : rien) : envoyée ou préparée dans le champ ; un message de la conversation (sans
// étape) est grisé tant qu'elle travaille, une action d'étape court à part (sa course en cours :
// « en cours » et ⏹). En sous-contexte, le choix du modèle à côté (sinon, qui travaille). Une action
// que l'appli fait elle-même (F-114) : le bouton « direct », puis le petit « via »
// l'agent (son modèle ou qui travaille), et dessous « … » en cours, sinon son dernier
// résultat (✓ ou ✗, une ligne, le détail déplié).
export function Run({ a, busy, label, tone = 'plain', onRun }: RunProps) {
  const run = useContext(StopRun);
  const t = strings(useContext(Picks)?.lang ?? 'fr');
  if (!a || a.hidden) return null;
  const send = a.kind === 'send';
  const waits = busy && send && a.step === null;   // un message de la conversation, qui travaille
  const off = !!a.disabled || waits;
  const direct = send ? a.direct : undefined;
  const state = run.state(a.id);
  const live = isLive(state);   // sa course retient les autres
  const running = live && state ? (
    <span className="vc-run-on">
      {t.runState[state]}
      {state !== 'stopped' ? <button type="button" className="vc-icon" title={t.runStopTitle} aria-label={t.runStop} onClick={() => run.stop(a.id)}>⏹</button> : null}
    </span>
  ) : null;
  const button = (
    <button type="button" className="vc-run" data-tone={tone} disabled={off}
      title={a.disabled ? `${a.hint}\n— ${a.disabled}` : a.hint} onClick={() => (direct ? onRun({ direct: true }) : onRun())}>
      <span className="vc-run-label">{label ?? a.label}</span>
      {direct ? <span className="vc-run-who">direct</span>
        : send && !a.models.length && tone !== 'ghost' ? <span className="vc-run-who">{a.who}</span> : null}
      {a.disabled && !waits && tone !== 'ghost' && !direct?.running && !live ? <span className="vc-run-why">{a.disabled}</span> : null}
    </button>
  );
  if (direct) {
    const last = direct.last;
    return (
      <span className="vc-direct">
        <span className="vc-run-group">
          {button}
          <button type="button" className="vc-via" disabled={off} title={a.hint} onClick={() => onRun()}>
            via{a.models.length ? null : <span className="vc-run-who">{a.who}</span>}
          </button>
          {a.models.length ? <ModelPick a={a} /> : null}
          {running}
        </span>
        {direct.running ? <span className="vc-direct-res" data-state="running">…</span> : last ? (
          <details className="vc-direct-res" data-state={last.ok ? 'ok' : 'ko'}>
            <summary title={new Date(last.time).toLocaleString()}><span className="vc-direct-mark">{last.ok ? '✓' : '✗'}</span> {last.line}</summary>
            {last.detail ? <pre className="vc-mono">{last.detail}</pre> : null}
          </details>
        ) : null}
      </span>
    );
  }
  return (send && a.models.length) || running ? <span className="vc-run-group">{button}{send ? <ModelPick a={a} /> : null}{running}</span> : button;
}

// Rien encore : ce qui manque, et le bouton qui le produit.
export function Invite({ title, text, children }: { title: ReactNode; text?: ReactNode; children?: ReactNode }) {
  return <div className="vc-invite"><div><b>{title}</b>{text}</div>{children}</div>;
}

// Une PR : numéro, titre, auteur, base ← tête (ce qui en est connu), lien ; dessous, children (sa description).
export function PrCard({ pr, lang, onOpenLink, children }: { pr: VibePr; lang: VibeLang; onOpenLink(url: string): void; children?: ReactNode }) {
  const s = S[lang];
  const url = webUrl(pr.url);
  return (
    <section className="vc-card vc-pr">
      <div className="vc-pr-head">
        <svg className="vc-pr-icon" viewBox="0 0 16 16" aria-hidden="true">
          <circle cx="4" cy="3.5" r="1.75" /><circle cx="4" cy="12.5" r="1.75" /><circle cx="12" cy="12.5" r="1.75" />
          <path d="M4 5.25v5.5M12 10.75V6.5a2 2 0 0 0-2-2H7.5M9.25 2.75 7.5 4.5l1.75 1.75" />
        </svg>
        <span className="vc-pr-number">{`#${pr.number}`}</span>
        <span className="vc-pr-title">{pr.title}</span>
        {url ? <button type="button" className="vc-mini" title={`${s.openPrTitle}\n${url}`} onClick={() => onOpenLink(url)}>{s.openPr}</button> : null}
      </div>
      {pr.author || (pr.base && pr.head) ? (
        <div className="vc-pr-meta">
          {pr.author ? <span>{s.by(pr.author)}</span> : null}
          {pr.base && pr.head ? <span className="vc-pr-branches vc-mono" title={`${pr.head} → ${pr.base}`}>{`${pr.base} ← ${pr.head}`}</span> : null}
        </div>
      ) : null}
      {children ? <div className="vc-card-body vc-pr-body">{children}</div> : null}
    </section>
  );
}

// Relire : la PR suivie est fusionnée ou fermée (son état connu et pas OPEN).
export function ClosedBanner({ pr, t }: { pr: VibePr | null; t: Strings }) {
  if (!pr?.state || pr.state === 'OPEN') return null;
  return <div className="vc-closed" role="status"><b>{`#${pr.number}`}</b>{t.prClosed[pr.state]}</div>;
}

// Le robot temporaire d'une PR ouverte dans un worktree (F-110) : « PR #n · worktree » et Décharger
// (l'agent du dépôt retire le worktree, le robot part avec lui).
export function WorktreeBadge({ view, busy, onRun }: { view: VibeView; busy: boolean; onRun(): void }) {
  if (!view.worktree?.temp || !view.pr) return null;
  return (
    <span className="vc-wt" title={view.worktree.dir}>
      <span className="vc-wt-badge">{S[view.lang].worktree(view.pr.number)}</span>
      <Run a={view.actions.find((a) => a.id === 'unload-worktree')} busy={busy} tone="ghost" onRun={onRun} />
    </span>
  );
}
