/** breadcrumb — le fil d'Ariane, au-dessus de l'étape : les étapes en une
 *  ligne (point plein : faite ; anneau qui pulse : en cours ; gris : à venir ; pour les étapes qui se valident
 *  (Note, Forme, Invariants, Modules), la couleur suit leur validation, crumbCheck : verte validée, jaune modifiée
 *  depuis ou à revoir, grise jamais validée ;
 *  le libellé à côté du point), reliées d'un trait ; leur état et leurs faits
 *  en infobulle, avec le raccourci (Ctrl+1…6) pour les six. Chaque étape
 *  est cliquable, faite, en cours ou à venir : un clic appelle onPick, rien
 *  d'autre (le fil garde ses états).
 *  Le créateur (note 0.16.0-ecran-essentiel) : sous le fil, une ligne dit toujours où on en est (statusLine de
 *  core/vibecoder : ce que le système fait, ou ce qu'il attend de l'utilisateur, en gras dans ce cas ; les pauses, la
 *  note sans ✓, un ✓ d'étape retiré en sont des cas), avec à côté le bouton du moteur quand il sert (vibe : l'action
 *  vibe et si le moteur tourne) : Arrêter pendant que le système enchaîne (onStopVibe), même l'action masquée
 *  (« déjà en cours ») ; Reprendre quand il est arrêté (onVibe ; grisé, avec sa raison, si l'action l'est) ; ni l'un ni
 *  l'autre tant que l'action est masquée (note ou ✓ d'étape pas posé), ni à la pause 'note'. Ni libellé ni infobulle ne
 *  disent « Vibe » ; les noms internes (vibe, onVibe, onStopVibe) restent. Un relevé en erreur : pas de ligne, mais Arrêter
 *  reste tant que le moteur tourne.
 *  L'interrupteur Express (view.express ; onExpress(true | false)) reste au bout du fil, toujours là, note validée ou
 *  non, le moteur en route ou non ; absent, pas d'interrupteur. Plus de « N commits » ni de liste pour le créateur.
 *  Le relecteur (flow 'review') : ni ligne ni bouton du moteur ; au bout du fil, « N commits » déplie sous le fil la
 *  liste des commits de la branche (un `fixup!` en couleur d'attention), re-clic : repliée ; aucun commit : le texte
 *  seul. La liste ouverte se ferme avec Échap (écouté en capture : il n'atteint pas les autres Échap du panneau) ou
 *  un clic hors de la liste et de son bouton ; les écouteurs ne vivent que liste ouverte. Un clic sur un commit le
 *  déplie : Voir le diff (dans l'éditeur, c<rang>), GitHub (sa page, gh:c<rang>) — deux IconButton (icons), libellé
 *  en infobulle — et ses fichiers, en texte simple.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : vibe-coder. */
import { useEffect, useState } from 'react';
import { crumbCheck, statusLine, waitingFor, type Strings } from 'core/vibecoder';
import type { VibeAction, VibeCommit, VibeStepId, VibeView } from 'technicals/bridge';
import { IconButton } from './icons';
import './breadcrumb.css';

type Props = {
  view: VibeView; t: Strings; selected: VibeStepId | null;
  vibe: { a: VibeAction; on: boolean } | null;
  onPick(id: VibeStepId): void; onOpen(id: string): void; onVibe(): void; onStopVibe(): void;
  onExpress?(on: boolean): void;   // l'interrupteur Express ; absent : pas d'interrupteur
};

export function Breadcrumb({ view, t, selected, vibe, onPick, onOpen, onVibe, onStopVibe, onExpress }: Props) {
  const [list, setList] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const n = view.commits.length;
  const review = view.flow === 'review';
  const line = statusLine(view);   // le créateur : toujours une ligne (sauf relevé en erreur) ; le relecteur : aucune
  // Le bouton du moteur : Arrêter même sans ligne (relevé en erreur), Reprendre seulement à côté d'une ligne ; jamais au relecteur.
  const engine = !review && vibe && (vibe.on || (line && !vibe.a.hidden && view.pause !== 'note')) ? (vibe.on ? (
    <button type="button" className="vc-run" data-tone="ghost" title={t.vibeStopTitle} onClick={onStopVibe}>{t.vibeStop}</button>
  ) : (
    <button type="button" className="vc-run" data-tone="vibe" disabled={!!vibe.a.disabled}
      title={vibe.a.disabled ? `${vibe.a.hint}\n— ${vibe.a.disabled}` : vibe.a.hint} onClick={onVibe}>{vibe.a.label}</button>
  )) : null;
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
            <li key={s.id} data-status={s.status} data-check={crumbCheck(s) ?? undefined}>
              <button type="button" className="vc-jstep" aria-current={s.id === selected ? 'step' : undefined} onClick={() => onPick(s.id)}
                title={`${t.steps[s.id]} — ${t.stepStatus[s.status]}${s.check ? ` · ${t.stepCheck[s.check.state ?? 'none']}` : ''}${waitingFor(view.steps, s.id) ? ` · ${t.waitingFor(t.steps[waitingFor(view.steps, s.id)!])}` : ''}${s.facts ? ` · ${s.facts}` : ''}${i < 6 ? ` (${t.shortcut(i + 1)})` : ''}`}>
                <span className="vc-jdot" />
                <span className="vc-jlabel">{t.steps[s.id]}</span>
              </button>
            </li>
          ))}
        </ol>
        {review ? (n ? (
          <button type="button" className="vc-ccount" aria-expanded={list} onClick={() => setList(!list)}>{t.commitsOf(n)}</button>
        ) : <span className="vc-ccount">{t.commitsOf(0)}</span>) : null}
        {onExpress ? (
          <label className="vc-express" title={t.expressTitle}>
            <input type="checkbox" checked={!!view.express} onChange={() => onExpress(!view.express)} />{t.express}
          </label>
        ) : null}
      </div>
      {line || engine ? (
        <div className="vc-line">
          {line ? <p role="status" data-yours={line.yours}>{line.text}</p> : null}
          {engine}
        </div>
      ) : null}
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
