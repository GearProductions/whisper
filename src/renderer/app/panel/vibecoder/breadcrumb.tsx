/** breadcrumb — le fil d'Ariane, au-dessus de l'étape : les étapes en une
 *  ligne (point plein : faite ; anneau qui pulse : en cours ; gris : à venir ;
 *  le libellé à côté du point), reliées d'un trait ; leur état et leurs faits
 *  en infobulle. Un clic ouvre l'étape, si elle est ouverte (VibeStep.open,
 *  dit par le principal) ; une étape pas ouverte : sans clic. Au bout,
 *  « N commits » déplie sous le fil la liste des commits de la branche (un
 *  `fixup!` en couleur d'attention), re-clic : repliée ; aucun commit : le
 *  texte seul. La liste ouverte se ferme avec Échap (écouté en capture : il
 *  n'atteint pas les autres Échap du panneau) ou un clic hors de la liste et
 *  de son bouton ; les écouteurs ne vivent que liste ouverte. Un clic sur un commit le déplie : Voir le diff (dans
 *  l'éditeur, c<rang>), GitHub (sa page, gh:c<rang>) — deux IconButton
 *  (icons), libellé en infobulle — et ses fichiers, en texte simple.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : vibe-coder. */
import { useEffect, useState } from 'react';
import type { Strings } from 'core/vibecoder';
import type { VibeCommit, VibeStepId, VibeView } from 'technicals/bridge';
import { IconButton } from './icons';
import './breadcrumb.css';

type Props = { view: VibeView; t: Strings; selected: VibeStepId | null; onPick(id: VibeStepId): void; onOpen(id: string): void };

export function Breadcrumb({ view, t, selected, onPick, onOpen }: Props) {
  const [list, setList] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const n = view.commits.length;
  useEffect(() => {
    if (!list) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); setList(false); } };
    const onDown = (e: MouseEvent) => { if (!(e.target instanceof Element && e.target.closest('.vc-commits, .vc-ccount'))) setList(false); };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    return () => { document.removeEventListener('keydown', onKey, true); document.removeEventListener('mousedown', onDown); };
  }, [list]);
  return (
    <nav className="vc-crumbs" aria-label={t.journey}>
      <div className="vc-crumbs-line">
        <ol className="vc-steps">
          {view.steps.map((s, i) => (
            <li key={s.id} data-status={s.status}>
              <button type="button" className="vc-jstep" aria-current={s.id === selected ? 'step' : undefined} disabled={!s.open} onClick={() => onPick(s.id)}
                title={`${t.steps[s.id]} — ${t.stepStatus[s.status]}${s.facts ? ` · ${s.facts}` : ''}${!s.open ? ` · ${t.notOpen}` : i < 6 ? ` (${t.shortcut(i + 1)})` : ''}`}>
                <span className="vc-jdot" />
                <span className="vc-jlabel">{t.steps[s.id]}</span>
              </button>
            </li>
          ))}
        </ol>
        {n ? (
          <button type="button" className="vc-ccount" aria-expanded={list} onClick={() => setList(!list)}>{t.commitsOf(n)}</button>
        ) : <span className="vc-ccount">{t.commitsOf(0)}</span>}
      </div>
      {list && n ? (
        <ul className="vc-commits">
          {view.commits.map((c, i) => (
            <li key={c.hash} className={c.fixup ? 'fixup' : undefined}>
              <button type="button" className="vc-jcommit" aria-expanded={open === c.hash} title={`${c.hash} ${c.subject}`}
                onClick={() => setOpen(open === c.hash ? null : c.hash)}>
                <code>{c.hash.slice(0, 7)}</code><span>{c.subject}</span>
              </button>
              {open === c.hash ? <CommitDetail c={c} rank={i} t={t} onOpen={onOpen} /> : null}
            </li>
          ))}
        </ul>
      ) : null}
    </nav>
  );
}

// Un commit déplié : le diff, sa page, ses fichiers.
function CommitDetail({ c, rank, t, onOpen }: { c: VibeCommit; rank: number; t: Strings; onOpen(id: string): void }) {
  return (
    <div className="vc-jcommit-detail">
      <div className="vc-jcommit-links">
        <IconButton icon="diff" label={t.diffTitle} onClick={() => onOpen(`c${rank}`)} />
        <IconButton icon="external" label={t.githubTitle} onClick={() => onOpen(`gh:c${rank}`)} />
      </div>
      <ul className="vc-jfiles" aria-label={t.files(c.files.length)}>
        {c.files.map((f) => (
          <li key={f} className="vc-mono" title={f}>{f}</li>
        ))}
      </ul>
    </div>
  );
}
