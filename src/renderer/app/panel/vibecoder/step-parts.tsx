/** step-parts — les pièces des vues d'étape Modules, Revue, PR (Créer) et PR,
 *  Commits, À l'écran, Revue (Relire) : l'en-tête d'étape (nom, état, faits,
 *  outils à droite), la carte d'une sortie de skill (titre, fichier, depuis
 *  quand), le bouton d'une action du relevé (son libellé ou un plus court, qui
 *  travaille, pourquoi c'est grisé ; absent si l'action n'existe pas), la
 *  invitation (rien encore, et ce qui le produit), la carte d'une PR, le
 *  bandeau du mode Vibe.
 *  Ne connaît pas : le pont (rappels passés).
 *  Utilisé par : modules-view, review-view, pr-view, pr-picker, commits-view, ecran-view, draft-view ; vibe-coder (bandeau). */
import type { ReactNode } from 'react';
import { webUrl, type Strings } from 'core/vibecoder';
import type { VibeAction, VibeLang, VibePr, VibeStep } from 'technicals/bridge';
import './step-parts.css';

const fr = {
  vibe: 'Mode Vibe : l\'agent déroule le guide ; vous testez et approuvez à la fin.',
  openPr: 'Ouvrir ↗',
  openPrTitle: 'Ouvrir la PR dans le navigateur',
  by: (author: string) => `par ${author}`,
};
const S: Record<VibeLang, typeof fr> = {
  fr,
  en: {
    vibe: 'Vibe mode: the agent runs the guide; you test and approve at the end.',
    openPr: 'Open ↗',
    openPrTitle: 'Open the PR in the browser',
    by: (author) => `by ${author}`,
  },
};

export function StepHead({ step, t, children }: { step: VibeStep; t: Strings; children?: ReactNode }) {
  return (
    <div className="vc-step-head">
      <h2>{t.steps[step.id]}</h2>
      <span className="vc-badge" data-status={step.status}>{t.stepStatus[step.status]}</span>
      {step.facts ? <span className="vc-facts">{step.facts}</span> : null}
      {children ? <div className="vc-step-tools">{children}</div> : null}
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

type RunProps = { a: VibeAction | undefined; busy: boolean; label?: ReactNode; tone?: 'accent' | 'plain' | 'ghost'; onRun(): void };

// Une action du relevé : envoyée (grisée si l'agent travaille) ou préparée dans le champ.
export function Run({ a, busy, label, tone = 'plain', onRun }: RunProps) {
  if (!a) return null;
  const send = a.kind === 'send';
  return (
    <button type="button" className="vc-run" data-tone={tone} disabled={!!a.disabled || (busy && send)}
      title={a.disabled ? `${a.hint}\n— ${a.disabled}` : a.hint} onClick={onRun}>
      <span className="vc-run-label">{label ?? a.label}</span>
      {send ? <span className="vc-run-who">{a.who}</span> : null}
      {a.disabled && !busy && tone !== 'ghost' ? <span className="vc-run-why">{a.disabled}</span> : null}
    </button>
  );
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

export function VibeBanner({ lang }: { lang: VibeLang }) {
  return <div className="vc-vibe-banner" role="note"><span aria-hidden="true">⚡</span>{S[lang].vibe}</div>;
}
