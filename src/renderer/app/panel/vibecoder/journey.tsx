/** journey — le parcours, à gauche : les étapes (point plein : faite ;
 *  anneau qui pulse : en cours ; gris : à venir ; leurs faits en une ligne),
 *  reliées d'un trait, puis les commits de la branche (un `fixup!` en couleur
 *  d'attention). Un clic ouvre l'étape.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : vibe-coder. */
import type { Strings } from 'core/vibecoder';
import type { VibeStepId, VibeView } from 'technicals/bridge';

type Props = { view: VibeView; t: Strings; selected: VibeStepId | null; onPick(id: VibeStepId): void };

export function Journey({ view, t, selected, onPick }: Props) {
  const done = view.steps.filter((s) => s.status === 'done').length;
  return (
    <nav className="vc-journey scroll" aria-label={t.journey}>
      <div className="vc-side-title vc-band"><span>{t.journey}</span><span>{view.steps.length ? `${done} / ${view.steps.length}` : ''}</span></div>
      <ol className="vc-steps">
        {view.steps.map((s, i) => (
          <li key={s.id} data-status={s.status}>
            <button type="button" className="vc-jstep" aria-current={s.id === selected ? 'step' : undefined} onClick={() => onPick(s.id)}
              title={`${t.steps[s.id]} — ${t.stepStatus[s.status]}${i < 6 ? ` (${t.shortcut(i + 1)})` : ''}`}>
              <span className="vc-jdot" />
              <span className="vc-jlabel">{t.steps[s.id]}</span>
              <span className="vc-jfacts">{s.facts}</span>
            </button>
          </li>
        ))}
      </ol>
      <div className="vc-side-title"><span>{t.commits}</span><span>{view.commits.length || ''}</span></div>
      <ul className="vc-commits">
        {view.commits.length ? view.commits.map((c) => (
          <li key={c.hash} className={c.fixup ? 'fixup' : undefined} title={`${c.hash} ${c.subject}`}>
            <code>{c.hash.slice(0, 7)}</code><span>{c.subject}</span>
          </li>
        )) : <li className="vc-none">{t.noCommits}</li>}
      </ul>
    </nav>
  );
}
