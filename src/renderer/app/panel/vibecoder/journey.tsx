/** journey — le parcours, à gauche : les étapes (point plein : faite ;
 *  anneau qui pulse : en cours ; gris : à venir ; leurs faits en une ligne),
 *  reliées d'un trait, puis les commits de la branche (un `fixup!` en couleur
 *  d'attention). Un clic ouvre l'étape, si elle est ouverte (VibeStep.open,
 *  dit par le principal) ; une étape pas ouverte : sans clic, son état en
 *  titre. Un clic sur un commit le déplie :
 *  Voir le diff (dans l'éditeur, c<rang>), GitHub ↗ (sa page, gh:c<rang>) et
 *  ses fichiers, chacun ouvrable (c<rang>/<i>), sans IA.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : vibe-coder. */
import { useState } from 'react';
import type { Strings } from 'core/vibecoder';
import type { VibeCommit, VibeStepId, VibeView } from 'technicals/bridge';

type Props = { view: VibeView; t: Strings; selected: VibeStepId | null; onPick(id: VibeStepId): void; onOpen(id: string): void };

export function Journey({ view, t, selected, onPick, onOpen }: Props) {
  const done = view.steps.filter((s) => s.status === 'done').length;
  const [open, setOpen] = useState<string | null>(null);
  return (
    <nav className="vc-journey scroll" aria-label={t.journey}>
      <div className="vc-side-title vc-band"><span>{t.journey}</span><span>{view.steps.length ? `${done} / ${view.steps.length}` : ''}</span></div>
      <ol className="vc-steps">
        {view.steps.map((s, i) => (
          <li key={s.id} data-status={s.status}>
            <button type="button" className="vc-jstep" aria-current={s.id === selected ? 'step' : undefined} disabled={!s.open} onClick={() => onPick(s.id)}
              title={`${t.steps[s.id]} — ${t.stepStatus[s.status]}${!s.open ? ` · ${t.notOpen}` : i < 6 ? ` (${t.shortcut(i + 1)})` : ''}`}>
              <span className="vc-jdot" />
              <span className="vc-jlabel">{t.steps[s.id]}</span>
              <span className="vc-jfacts">{s.facts}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="vc-side-title"><span>{t.commits}</span><span>{view.commits.length || ''}</span></div>
      <ul className="vc-commits">
        {view.commits.length ? view.commits.map((c, i) => (
          <li key={c.hash} className={c.fixup ? 'fixup' : undefined}>
            <button type="button" className="vc-jcommit" aria-expanded={open === c.hash} title={`${c.hash} ${c.subject}`}
              onClick={() => setOpen(open === c.hash ? null : c.hash)}>
              <code>{c.hash.slice(0, 7)}</code><span>{c.subject}</span>
            </button>
            {open === c.hash ? <CommitDetail c={c} rank={i} t={t} onOpen={onOpen} /> : null}
          </li>
        )) : <li className="vc-none">{t.noCommits}</li>}
      </ul>
    </nav>
  );
}

// Un commit déplié : le diff, sa page, ses fichiers.
function CommitDetail({ c, rank, t, onOpen }: { c: VibeCommit; rank: number; t: Strings; onOpen(id: string): void }) {
  return (
    <div className="vc-jcommit-detail">
      <div className="vc-jcommit-links">
        <button type="button" className="vc-mini" title={t.diffTitle} onClick={() => onOpen(`c${rank}`)}>{t.diff}</button>
        <button type="button" className="vc-mini" title={t.githubTitle} onClick={() => onOpen(`gh:c${rank}`)}>{t.github}</button>
      </div>
      <ul className="vc-jfiles" aria-label={t.files(c.files.length)}>
        {c.files.map((f, i) => (
          <li key={f}><button type="button" className="vc-mono" title={`${t.openTitle} : ${f}`} onClick={() => onOpen(`c${rank}/${i}`)}>{f}</button></li>
        ))}
      </ul>
    </div>
  );
}
