/** processes-view — l'onglet Processus de VibeCoder : les commandes qui
 *  lancent le projet de l'agent (son fichier du projet), chacune avec
 *  son nom, sa commande en petit dessous, ▶ Lancer, ⏹ Arrêter, ↻ Relancer, son état (un point), depuis quand, la fin
 *  de son journal (monospace, qui suit la fin tant qu'on n'est pas remonté,
 *  dépliable ; *Journal complet* dans l'éditeur). Sans fichier : *Proposer les
 *  commandes* (l'action propose-run, qui dit qui travaille) ; *Modifier les
 *  commandes* ouvre le fichier dans l'éditeur. Une commande se désigne par son
 *  rang, jamais par un texte.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : vibe-coder. */
import { useLayoutEffect, useRef, useState } from 'react';
import { duration, type Strings } from 'core/vibecoder';
import type { VibeLang, VibeProcess, VibeProcessOp, VibeView } from 'technicals/bridge';
import { Run } from './step-parts';
import type { VibeActs } from './step-views';

const S = {
  fr: {
    status: { running: 'en cours', stopped: 'arrêtée', failed: 'en échec' },
    start: 'Lancer', stop: 'Arrêter', restart: 'Relancer',
    up: (d: string) => `depuis ${d}`,
    exit: (code: number | null) => (code === null ? 'tuée' : `code ${code}`),
    never: 'jamais lancée',
    more: 'Déplier', less: 'Replier', full: 'Journal complet', fullTitle: 'Le journal entier, dans l\'éditeur',
    edit: 'Modifier les commandes', editTitle: 'Le fichier des commandes du projet, dans l\'éditeur (propre à cette machine)',
    noFile: 'Aucune commande pour ce projet. Proposez-les (l\'agent lit le README, package.json, process-compose, vos alias…) ou écrivez-les.',
    none: 'Le fichier du projet n\'a aucune commande valide.',
  },
  en: {
    status: { running: 'running', stopped: 'stopped', failed: 'failed' },
    start: 'Start', stop: 'Stop', restart: 'Restart',
    up: (d: string) => `for ${d}`,
    exit: (code: number | null) => (code === null ? 'killed' : `code ${code}`),
    never: 'never started',
    more: 'Expand', less: 'Collapse', full: 'Full log', fullTitle: 'The whole log, in the editor',
    edit: 'Modify the commands', editTitle: 'The file of the project\'s commands, in the editor (specific to this machine)',
    noFile: 'No command for this project yet. Propose them (the agent reads the README, package.json, process-compose, your aliases…) or write them.',
    none: 'The project file has no valid command.',
  },
} satisfies Record<VibeLang, unknown>;
type Labels = typeof S.fr;

type Props = { view: VibeView; t: Strings; act: VibeActs; busy: boolean };

export function ProcessesView({ view, t, act, busy }: Props) {
  const s = S[view.lang];
  const list = view.processes ?? [];
  return (
    <div className="vc-procs scroll">
      {list.map((p, i) => <Proc key={p.name} p={p} s={s} t={t} onOp={(op) => act.process(op, i)} />)}
      {list.length ? null : <div className="vc-empty">{view.projectFile ? s.none : s.noFile}</div>}
      <div className="vc-procs-foot">
        {view.projectFile ? null : <Run a={view.actions.find((a) => a.id === 'propose-run')} busy={busy} onRun={() => act.run('propose-run')} />}
        <button type="button" className="vc-mini" title={s.editTitle} onClick={() => act.process('edit')}>{s.edit}</button>
      </div>
    </div>
  );
}

function Proc({ p, s, t, onOp }: { p: VibeProcess; s: Labels; t: Strings; onOp(op: VibeProcessOp): void }) {
  const [open, setOpen] = useState(false);
  const log = useRef<HTMLPreElement>(null);
  const atEnd = useRef(true);   // le journal suit sa fin, sauf si on est remonté le lire
  useLayoutEffect(() => { const el = log.current; if (el && atEnd.current) el.scrollTop = el.scrollHeight; }, [p.log, open]);
  const running = p.status === 'running';
  const when = p.since === null ? s.never
    : running ? s.up(duration(Date.now() - p.since))
      : `${p.status === 'failed' ? `${s.exit(p.exit)} · ` : ''}${t.ago(Date.now() - p.since)}`;
  const icon = (op: VibeProcessOp, glyph: string, label: string, enabled: boolean) => (
    <button type="button" className="vc-icon" title={label} aria-label={label} disabled={!enabled} onClick={() => onOp(op)}>{glyph}</button>
  );
  return (
    <section className="vc-card vc-proc" data-status={p.status}>
      <div className="vc-card-head">
        <span className="vc-proc-dot" title={s.status[p.status]} aria-label={s.status[p.status]} />
        <span className="vc-proc-name">
          <span className="vc-card-title" title={`${p.name}\n${p.run}`}>{p.name}</span>
          <code className="vc-proc-run" title={p.run}>{p.run}</code>
        </span>
        <span className="vc-card-time" title={p.since === null ? undefined : new Date(p.since).toLocaleString(t.locale)}>{when}</span>
        {icon('start', '▶', s.start, !running)}
        {icon('stop', '⏹', s.stop, running)}
        {icon('restart', '↻', s.restart, running)}
      </div>
      {p.log ? (
        <>
          <pre ref={log} className="vc-proc-log" data-open={open || undefined}
            onScroll={(e) => { const el = e.currentTarget; atEnd.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24; }}>{p.log}</pre>
          <div className="vc-proc-foot">
            <button type="button" className="vc-barlink" onClick={() => setOpen(!open)}>{open ? s.less : s.more}</button>
            <button type="button" className="vc-barlink" title={s.fullTitle} onClick={() => onOp('log')}>{s.full}</button>
          </div>
        </>
      ) : null}
    </section>
  );
}
