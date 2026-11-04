/** step-parts — les pièces des vues d'étape : l'en-tête d'étape (nom, état,
 *  faits, outils à droite ; dessous, le champ de l'étape quand une de ses
 *  actions en prend le texte (fieldOf), puis la rangée des actions de l'étape
 *  par stepActions — à l'étape en cours, Vibe d'abord avec son propre accent,
 *  puis celle qui fait avancer l'étape mise en avant), le champ d'une étape,
 *  la carte d'une sortie de skill (titre, fichier, depuis quand), le bouton
 *  d'une action du relevé (son libellé ou un plus court, qui travaille,
 *  pourquoi c'est grisé ; ton plain, accent, vibe ou ghost ;
 *  sa course en cours : « en cours » et IconButton stop ;
 *  absent si l'action n'existe pas ou que le relevé la masque (hidden) ; une
 *  action que l'appli fait elle-même : « direct », à côté « via » l'agent, et
 *  dessous son dernier résultat, Icon ok / ko, F-114), l'invitation (rien encore, et ce qui
 *  le produit), la carte d'une PR (IconButton external : l'ouvrir), le badge Relecteur (view.flow
 *  'review', même allure que celui du worktree ; rien en créateur),
 *  le badge du robot d'une PR ouverte dans un worktree (le badge seul :
 *  Retirer le worktree est dans la vue des branches).
 *  Le champ d'une étape est un PromptField (Joindre, ses pièces, le micro et Envoyer : l'action
 *  du champ, fieldAction) ; les pièces et leurs rappels viennent de l'appelant (StepPieces : vibe-coder les
 *  tient, une liste par champ) ; « @ » cite les artefacts du projet (useArtifactMention, d'après
 *  VibeView.artifacts et artifactsDir). Une action n'a plus de choix de modèle ni d'effort à l'écran
 *  (le principal les pose) : le bouton montre qui travaille (`who`).
 *  Ne connaît pas : le pont (rappels passés ; ⏹ et la langue par le contexte StopRun).
 *  Utilisé par : les vues d'étape ; vibe-coder (badge Relecteur,
 *  badge du worktree). */
import { createContext, useContext, useRef, type ReactNode } from 'react';
import { fieldAction, fieldOf, isLive, stepActions, t as strings, webUrl, type Strings } from 'core/vibecoder';
import type { Piece } from 'core/conversation';
import type { VibeAction, VibeArgs, VibeArtifact, VibeLang, VibePr, VibeRun, VibeView } from 'technicals/bridge';
import { useArtifactMention } from './artifact-mention';
import { Icon, IconButton } from './icons';
import { PromptField } from './prompt-field';
import type { StepProps } from './step-views';
import './step-parts.css';

const fr = {
  openPrTitle: 'Ouvrir la PR dans le navigateur',
  by: (author: string) => `par ${author}`,
  worktree: (n: number) => `PR #${n} · worktree`,
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    openPrTitle: 'Open the PR in the browser',
    by: (author) => `by ${author}`,
    worktree: (n) => `PR #${n} · worktree`,
  },
};

// La course d'une action sur son bouton : son état (VibeView.runs) et ⏹ (vibe-coder le relie à act.runOp(id, 'stop')).
// `lang` : la langue des libellés du bouton (sans lui, le français).
export const StopRun = createContext<{ stop(id: string): void; state(id: string): VibeRun['state'] | null; lang?: VibeLang }>({ stop: () => {}, state: () => null });

// Les pièces jointes d'un champ : tenues par l'appelant (vibe-coder), une liste par champ.
export type StepPieces = { pieces: Piece[]; onRemove(p: Piece): void; onAttach(): void; onFiles(files: File[]): void };

// Le champ d'une étape : son texte part avec l'action qui le prend (fieldOf) ; « @ » cite un artefact du projet.
// Dans son cadre (PromptField), Joindre, le micro (dicter dans ce champ) et Envoyer (onSend : l'action du champ, fieldAction ; grisé sans elle).
type FieldProps = StepPieces & {
  name: string; text: string; setText(text: string): void; hint: string; artifacts?: VibeArtifact[]; artifactsDir?: string;
  t: Strings; onSend(): void; sendDisabled: boolean; sendTitle?: string;
};
export function StepField({ name, text, setText, hint, artifacts = [], artifactsDir = '', t, onSend, sendDisabled, sendTitle, pieces, onRemove, onAttach, onFiles }: FieldProps) {
  const input = useRef<HTMLTextAreaElement>(null);
  const mention = useArtifactMention(artifacts, artifactsDir, input, setText);
  return (
    <div className="vc-step-field">
      <PromptField t={t} text={text} setText={(v) => { setText(v); mention.update(); }} field={input} name={name} placeholder={hint} rows={3}
        pieces={pieces} onRemove={onRemove} onAttach={onAttach} onFiles={onFiles}
        onSend={onSend} sendDisabled={sendDisabled} sendTitle={sendTitle}
        onKeyDown={mention.key} onBlur={() => setTimeout(mention.close, 150)}>
        {mention.list}
      </PromptField>
    </div>
  );
}

const NOOP = () => {};

// L'en-tête d'une étape ; `own` : les actions que la vue montre elle-même (pas répétées ici) ; les masquées, nulle part.
// `p` : StepProps, et les pièces de son champ (vibe-coder les passe ; sans elles, aucune).
export function StepHead({ p, own = [], children }: { p: StepProps & Partial<StepPieces>; own?: string[]; children?: ReactNode }) {
  const { view, step, t, act, busy } = p;
  const field = view.actions.some((a) => fieldOf(a) === step.id);
  const sends = fieldAction(view.actions, step.id);
  const acts = stepActions(view, step, own);
  return (
    <div className="vc-step-head">
      <h2>{t.steps[step.id]}</h2>
      <span className="vc-badge" data-status={step.status}>{t.stepStatus[step.status]}</span>
      {step.facts ? <span className="vc-facts">{step.facts}</span> : null}
      {acts.length ? (
        <div className="vc-step-acts">
          {acts.map(({ a, tone }) => <Run key={a.id} a={a} busy={busy} tone={tone} onRun={(x) => act.run(a.id, x)} />)}
        </div>
      ) : null}
      {children ? <div className="vc-step-tools">{children}</div> : null}
      {field ? <StepField name={step.id} text={p.text} setText={p.setText} hint={t.fieldHint} artifacts={view.artifacts} artifactsDir={view.artifactsDir}
        t={t} pieces={p.pieces ?? []} onRemove={p.onRemove ?? NOOP} onAttach={p.onAttach ?? NOOP} onFiles={p.onFiles ?? NOOP}
        onSend={() => { if (sends) act.run(sends.id); }} sendTitle={sends ? `${t.sendField} : ${sends.label}` : undefined}
        sendDisabled={!sends || !!sends.disabled || (sends.needs === 'text' && !p.text.trim())} /> : null}
    </div>
  );
}

type CardProps = { title: ReactNode; file?: string; time?: number; t: Strings; tools?: ReactNode; acts?: ReactNode; className?: string; children?: ReactNode };

// Une carte : son titre, ses actions (acts) à côté, le fichier qu'elle montre et depuis quand, ses outils à droite.
export function OutputCard({ title, file, time, t, tools, acts, className, children }: CardProps) {
  return (
    <section className={className ? `vc-card ${className}` : 'vc-card'}>
      <div className="vc-card-head">
        <span className="vc-card-title">{title}</span>
        {acts ? <span className="vc-card-acts">{acts}</span> : null}
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
type RunProps = { a: VibeAction | undefined; busy: boolean; label?: ReactNode; tone?: 'vibe' | 'accent' | 'plain' | 'ghost'; onRun(extra?: VibeArgs): void };

// Une action du relevé (masquée, hidden : rien) : envoyée ou préparée dans le champ ; un message de la conversation (sans
// étape) est grisé tant qu'elle travaille, une action d'étape court à part (sa course en cours :
// « en cours » et ⏹). Une action
// que l'appli fait elle-même (F-114) : le bouton « direct », puis le petit « via »
// l'agent (qui travaille ; aucun pour une action directe seulement, only ; direct.elsewhere : le bouton direct n'est pas grisé par la conversation qui travaille, « via » l'est), et dessous « … » en cours, sinon son dernier
// résultat (Icon ok ou ko, une ligne, le détail déplié).
export function Run({ a, busy, label, tone = 'plain', onRun }: RunProps) {
  const run = useContext(StopRun);
  const t = strings(run.lang ?? 'fr');
  if (!a || a.hidden) return null;
  const send = a.kind === 'send';
  const waits = busy && send && a.step === null;   // un message de la conversation, qui travaille
  const direct = send ? a.direct : undefined;
  const off = !!a.disabled || waits;
  const offDirect = !!a.disabled || (waits && !direct?.elsewhere);   // elsewhere : un autre dossier que celui de l'agent, « via » reste grisé (I-25)
  const state = run.state(a.id);
  const live = isLive(state);   // sa course retient les autres
  const running = live && state ? (
    <span className="vc-run-on">
      {t.runState[state]}
      {state !== 'stopped' ? <IconButton icon="stop" label={t.runStopTitle} onClick={() => run.stop(a.id)} /> : null}
    </span>
  ) : null;
  const button = (
    <button type="button" className="vc-run" data-tone={tone} disabled={offDirect}
      title={a.disabled ? `${a.hint}\n— ${a.disabled}` : a.hint} onClick={() => (direct ? onRun({ direct: true }) : onRun())}>
      <span className="vc-run-label">{label ?? a.label}</span>
      {direct ? <span className="vc-run-who">direct</span>
        : send && tone !== 'ghost' ? <span className="vc-run-who">{a.who}</span> : null}
      {a.disabled && !waits && tone !== 'ghost' && !direct?.running && !live ? <span className="vc-run-why">{a.disabled}</span> : null}
    </button>
  );
  if (direct) {
    const last = direct.last;
    return (
      <span className="vc-direct">
        <span className="vc-run-group">
          {button}
          {direct.only ? null : (
            <button type="button" className="vc-via" disabled={off} title={a.hint} onClick={() => onRun()}>
              via<span className="vc-run-who">{a.who}</span>
            </button>
          )}
          {running}
        </span>
        {direct.running ? <span className="vc-direct-res" data-state="running">…</span> : last ? (
          <details className="vc-direct-res" data-state={last.ok ? 'ok' : 'ko'}>
            <summary title={new Date(last.time).toLocaleString()}><span className="vc-direct-mark"><Icon name={last.ok ? 'ok' : 'ko'} /></span> {last.line}</summary>
            {last.detail ? <pre className="vc-mono">{last.detail}</pre> : null}
          </details>
        ) : null}
      </span>
    );
  }
  return running ? <span className="vc-run-group">{button}{running}</span> : button;
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
        {url ? <IconButton icon="external" label={`${s.openPrTitle}\n${url}`} onClick={() => onOpenLink(url)} /> : null}
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

// En relecteur (view.flow, décidé par l'appli) : le badge dans l'en-tête ; rien en créateur.
export function ReviewerBadge({ view, t }: { view: VibeView; t: Strings }) {
  if (view.flow !== 'review') return null;
  return <span className="vc-wt-badge" title={t.reviewerTitle}>{t.reviewer}</span>;
}

// Le robot temporaire d'une PR ouverte dans un worktree (F-110) : « PR #n · worktree », son dossier en infobulle.
export function WorktreeBadge({ view }: { view: VibeView }) {
  if (!view.worktree?.temp || !view.pr) return null;
  return <span className="vc-wt-badge" title={view.worktree.dir}>{S[view.lang].worktree(view.pr.number)}</span>;
}
