/** breadcrumb — le fil d'Ariane, au-dessus de l'étape : les étapes en une
 *  ligne (point plein : faite ; anneau qui pulse : en cours ; gris : à venir ;
 *  le libellé à côté du point), reliées d'un trait ; leur état et leurs faits
 *  en infobulle, avec le raccourci (Ctrl+1…6) pour les six. Chaque étape
 *  est cliquable, faite, en cours ou à venir : un clic appelle onPick, rien
 *  d'autre (le fil garde ses états). Au bout,
 *  « N commits » déplie sous le fil la liste des commits de la branche (un
 *  `fixup!` en couleur d'attention), re-clic : repliée ; aucun commit : le
 *  texte seul. La liste ouverte se ferme avec Échap (écouté en capture : il
 *  n'atteint pas les autres Échap du panneau) ou un clic hors de la liste et
 *  de son bouton ; les écouteurs ne vivent que liste ouverte. Un clic sur un commit le déplie : Voir le diff (dans
 *  l'éditeur, c<rang>), GitHub (sa page, gh:c<rang>) — deux IconButton
 *  (icons), libellé en infobulle — et ses fichiers, en texte simple.
 *  Vibe, à côté de « N commits » (vibe : l'action et si Vibe tourne ; null, le
 *  relecteur : rien) : le bouton de l'action (grisé, avec sa raison, si elle
 *  l'est) ; pendant Vibe, Arrêter Vibe à sa place (onStopVibe), même l'action masquée (« déjà en cours »).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : vibe-coder. */
import { useEffect, useState } from 'react';
import type { Strings } from 'core/vibecoder';
import type { VibeAction, VibeCommit, VibeStepId, VibeView } from 'technicals/bridge';
import { IconButton } from './icons';
import './breadcrumb.css';

type Props = {
  view: VibeView; t: Strings; selected: VibeStepId | null;
  vibe: { a: VibeAction; on: boolean } | null;
  onPick(id: VibeStepId): void; onOpen(id: string): void; onVibe(): void; onStopVibe(): void;
};

export function Breadcrumb({ view, t, selected, vibe, onPick, onOpen, onVibe, onStopVibe }: Props) {
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
              <button type="button" className="vc-jstep" aria-current={s.id === selected ? 'step' : undefined} onClick={() => onPick(s.id)}
                title={`${t.steps[s.id]} — ${t.stepStatus[s.status]}${s.facts ? ` · ${s.facts}` : ''}${i < 6 ? ` (${t.shortcut(i + 1)})` : ''}`}>
                <span className="vc-jdot" />
                <span className="vc-jlabel">{t.steps[s.id]}</span>
              </button>
            </li>
          ))}
        </ol>
        {n ? (
          <button type="button" className="vc-ccount" aria-expanded={list} onClick={() => setList(!list)}>{t.commitsOf(n)}</button>
        ) : <span className="vc-ccount">{t.commitsOf(0)}</span>}
        {vibe && (vibe.on || !vibe.a.hidden) ? (vibe.on ? (
          <button type="button" className="vc-run" data-tone="ghost" title={t.vibeStopTitle} onClick={onStopVibe}>{t.vibeStop}</button>
        ) : (
          <button type="button" className="vc-run" data-tone="vibe" disabled={!!vibe.a.disabled}
            title={vibe.a.disabled ? `${vibe.a.hint}\n— ${vibe.a.disabled}` : vibe.a.hint} onClick={onVibe}>{vibe.a.label}</button>
        )) : null}
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
