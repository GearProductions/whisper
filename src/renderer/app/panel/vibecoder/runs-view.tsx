/** runs-view — l'onglet Actions de VibeCoder : une ligne par course (une
 *  action d'étape qui court à part de la conversation), la plus récente
 *  d'abord, telles que le relevé les donne : son libellé, qui travaille, son
 *  état (un point), depuis quand ; Arrêter (icône stop) tant qu'elle travaille ; sa demande
 *  d'autorisation (outil, cible) avec Autoriser / Toujours / Refuser ;
 *  arrêtée : Garder / Annuler ; sa réponse (Markdown), repliée, dépliable.
 *  Une course se désigne par l'id de son action, jamais par un texte.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : vibe-coder. */
import { duration, isRunning, type Strings } from 'core/vibecoder';
import type { VibeRun, VibeRunOp } from 'technicals/bridge';
import { Icon } from './icons';
import { MarkdownView } from './markdown-view';
import './runs-view.css';

type Props = { runs: VibeRun[]; t: Strings; onRunOp(id: string, op: VibeRunOp): void; onOpenLink(url: string): void };

export function RunsView({ runs, t, onRunOp, onOpenLink }: Props) {
  return (
    <div className="vc-procs scroll">
      {runs.map((r) => <Row key={`${r.id}@${r.since}`} r={r} t={t} onOp={(op) => onRunOp(r.id, op)} onOpenLink={onOpenLink} />)}
      {runs.length ? null : <div className="vc-empty">{t.noRuns}</div>}
    </div>
  );
}

function Row({ r, t, onOp, onOpenLink }: { r: VibeRun; t: Strings; onOp(op: VibeRunOp): void; onOpenLink(url: string): void }) {
  const working = isRunning(r);
  const when = working ? t.runFor(duration(Date.now() - r.since)) : t.ago(Date.now() - (r.end ?? r.since));
  const button = (op: VibeRunOp, label: string, title: string, tone: 'accent' | 'plain' | 'ghost' = 'plain') => (
    <button type="button" className="vc-run" data-tone={tone} title={title} onClick={() => onOp(op)}>{label}</button>
  );
  return (
    <section className="vc-card vc-proc vc-run-row" data-status={r.state}>
      <div className="vc-card-head">
        <span className="vc-proc-dot" title={t.runState[r.state]} aria-label={t.runState[r.state]} />
        <span className="vc-proc-name">
          <span className="vc-card-title" title={r.label}>{r.label}</span>
          <span className="vc-proc-run">{`${r.who} · ${t.runState[r.state]}`}</span>
        </span>
        <span className="vc-card-time" title={new Date(r.since).toLocaleString(t.locale)}>{when}</span>
        {working ? <button type="button" className="vc-icon" title={t.runStopTitle} aria-label={t.runStopTitle} onClick={() => onOp('stop')}><Icon name="stop" /></button> : null}
      </div>
      {r.permission ? (
        <div className="vc-run-bar" role="alert">
          <span className="vc-run-ask">{t.runAsks} <b>{r.permission.tool}</b> <code className="vc-mono" title={r.permission.target}>{r.permission.target}</code></span>
          {button('allow', t.allow, t.allowTitle, 'accent')}
          {button('always', t.always, t.alwaysTitle)}
          {button('deny', t.deny, t.denyTitle, 'ghost')}
        </div>
      ) : null}
      {r.state === 'stopped' ? (
        <div className="vc-run-bar">
          {button('keep', t.keep, t.keepTitle, 'accent')}
          {button('undo', t.undo, t.undoTitle)}
        </div>
      ) : null}
      {r.reply ? (
        <details className="vc-run-reply">
          <summary>{t.runReply}</summary>
          <div className="vc-card-body"><MarkdownView md={r.reply} t={t} onOpenLink={onOpenLink} /></div>
        </details>
      ) : null}
    </section>
  );
}
