/** breadcrumb — le fil d'Ariane, au-dessus de l'étape : les étapes en une
 *  ligne (point plein : faite ; anneau qui pulse : en cours ; gris : à venir ; pour les étapes qui se valident
 *  (Note, Forme, Invariants, Modules), la couleur suit leur validation, crumbCheck : verte validée, jaune modifiée
 *  depuis ou à revoir, grise jamais validée ;
 *  le libellé à côté du point), reliées d'un trait ; leur état et leurs faits
 *  en infobulle, avec le raccourci (Ctrl+1…6) pour les six du créateur. Chaque étape
 *  est cliquable, faite, en cours ou à venir : un clic appelle onPick, rien
 *  d'autre (le fil garde ses états).
 *  Le créateur (note 0.16.0-ecran-essentiel) : sous le fil, une ligne dit toujours où on en est (statusLine de
 *  core/vibecoder : ce que le système fait, ou ce qu'il attend de l'utilisateur, en gras dans ce cas ; les pauses, la
 *  note sans ✓, un ✓ d'étape retiré en sont des cas), avec à côté le bouton du moteur quand il sert (vibe : l'action
 *  vibe et si le moteur tourne) : Arrêter pendant que le système enchaîne (onStopVibe), même l'action masquée
 *  (« déjà en cours ») ; Reprendre quand il est arrêté (onVibe ; grisé, avec sa raison, si l'action l'est) ; ni l'un ni
 *  l'autre tant que l'action est masquée (note ou ✓ d'étape pas posé), ni à la pause 'note' ; pas de Reprendre à côté
 *  d'un parcours fini (over de statusLine : la PR verte et chaque étape faite, fusionnée, fermée). Ni libellé ni infobulle ne
 *  disent « Vibe » ; les noms internes (vibe, onVibe, onStopVibe) restent. Un relevé en erreur : pas de ligne, mais Arrêter
 *  reste tant que le moteur tourne.
 *  L'interrupteur Express (view.express ; onExpress(true | false)) reste au bout du fil, toujours là, note validée ou
 *  non, le moteur en route ou non ; absent, pas d'interrupteur. Plus de « N commits » ni de liste pour le créateur.
 *  Le relecteur (flow 'review' ; note 0.16.0-revue-essentielle) : son fil a les quatre arrêts du relevé, sous leur nom
 *  d'arrêt (stepName : « Note », « Règles », « Essai », « Publier » ; Ctrl+1…4 en infobulle) ; sous le fil, la même
 *  ligne que le créateur (statusLine : ce que le système lit, ou ce qu'il attend du relecteur) et, à côté, son seul
 *  bouton, « Préparer la revue », à tous les arrêts dès qu'une PR est chargée : un clic appelle onPrepare, une fois, rien
 *  d'autre ; grisé, avec sa raison, quand il n'y a rien à lancer (view.prepare vide : tout est prêt, ou les lectures
 *  courent déjà) ; absent sans PR chargée, sans onPrepare, ou en créateur. Ni bouton du moteur, ni Express. Plus de
 *  « N commits » au bout du fil ni de liste dépliée (ses écouteurs, CommitDetail), pour personne : la PR s'ouvre sur
 *  GitHub depuis sa carte.
 *  Ne connaît pas : le pont (rappels passés), les lectures que le bouton lance (vibe-coder). Utilisé par : vibe-coder. */
import { crumbCheck, runningRuns, statusLine, stepName, waitingFor, type Strings } from 'core/vibecoder';
import type { VibeAction, VibeStepId, VibeView } from 'technicals/bridge';
import './breadcrumb.css';

type Props = {
  view: VibeView; t: Strings; selected: VibeStepId | null;
  vibe: { a: VibeAction; on: boolean } | null;
  onPick(id: VibeStepId): void; onVibe(): void; onStopVibe(): void;
  onExpress?(on: boolean): void;   // l'interrupteur Express ; absent : pas d'interrupteur
  onPrepare?(): void;              // relecteur : « Préparer la revue » ; absent : pas de bouton
};

export function Breadcrumb({ view, t, selected, vibe, onPick, onVibe, onStopVibe, onExpress, onPrepare }: Props) {
  const review = view.flow === 'review';
  const line = statusLine(view);   // une ligne, sauf relevé en erreur
  // Le bouton du moteur : Arrêter même sans ligne (relevé en erreur), Reprendre seulement à côté d'une ligne, et pas d'un parcours
  // fini (line.over : la PR verte et tout fait, fusionnée, fermée — rien à reprendre) ; jamais au relecteur.
  const engine = !review && vibe && (vibe.on || (line && !line.over && !vibe.a.hidden && view.pause !== 'note')) ? (vibe.on ? (
    <button type="button" className="vc-run" data-tone="ghost" title={t.vibeStopTitle} onClick={onStopVibe}>{t.vibeStop}</button>
  ) : (
    <button type="button" className="vc-run" data-tone="vibe" disabled={!!vibe.a.disabled}
      title={vibe.a.disabled ? `${vibe.a.hint}\n— ${vibe.a.disabled}` : vibe.a.hint} onClick={onVibe}>{vibe.a.label}</button>
  )) : null;
  // Le bouton du relecteur : grisé s'il n'y a rien à lancer (view.prepare vide), la raison dite selon que des lectures courent, ou
  // que le dossier n'est pas sur la branche de la PR (le principal vide alors prepare : rien n'est lu pour autant).
  const p = t.essentialReview.prepare;
  const nothing = !view.prepare?.length;
  const elsewhere = !!view.repo && !!view.pr && view.repo.branch !== view.pr.head;
  const why = elsewhere ? t.essentialReview.statusLine.switchBranch : runningRuns(view.runs ?? []).length ? p.running : p.ready;
  const prepare = review && view.pr && onPrepare ? (
    <button type="button" className="vc-run vc-prepare" data-tone="vibe" disabled={nothing}
      title={nothing ? `${p.title}\n— ${why}` : p.title} onClick={onPrepare}>{p.label}</button>
  ) : null;
  return (
    <nav className="vc-crumbs" aria-label={t.journey}>
      <div className="vc-crumbs-line">
        <ol className="vc-steps">
          {view.steps.map((s, i) => {
            const name = stepName(t, view.flow, s.id);
            const waiting = waitingFor(view.steps, s.id);
            return (
              <li key={s.id} data-status={s.status} data-check={crumbCheck(s) ?? undefined}>
                <button type="button" className="vc-jstep" aria-current={s.id === selected ? 'step' : undefined} onClick={() => onPick(s.id)}
                  title={`${name} — ${t.stepStatus[s.status]}${s.check ? ` · ${t.stepCheck[s.check.state ?? 'none']}` : ''}${waiting ? ` · ${t.waitingFor(stepName(t, view.flow, waiting))}` : ''}${s.facts ? ` · ${s.facts}` : ''}${i < 6 ? ` (${t.shortcut(i + 1)})` : ''}`}>
                  <span className="vc-jdot" />
                  <span className="vc-jlabel">{name}</span>
                </button>
              </li>
            );
          })}
        </ol>
        {onExpress ? (
          <label className="vc-express" title={t.expressTitle}>
            <input type="checkbox" checked={!!view.express} onChange={() => onExpress(!view.express)} />{t.express}
          </label>
        ) : null}
      </div>
      {line || engine || prepare ? (
        <div className="vc-line">
          {line ? <p role="status" data-yours={line.yours}>{line.text}</p> : null}
          {engine}
          {prepare}
        </div>
      ) : null}
    </nav>
  );
}
