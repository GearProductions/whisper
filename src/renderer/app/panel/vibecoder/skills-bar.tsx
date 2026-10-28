/** skills-bar — au-dessus du champ, en VibeCoder : de petits liens discrets,
 *  Demander sans modifier, Nouvelle demande et Retour → fixup (s'ils sont au
 *  relevé, ni masqués). Une nouvelle demande retenue (view.request) : sa
 *  branche nommée et ses choix du relevé (new-here, new-worktree, stash),
 *  actions directes (onRun(id, { direct: true }), F-114), grisés avec leur
 *  raison, absents si masqués ; le dernier échec de chaque lien à côté. Les
 *  skills, eux, se trouvent par « / » dans le champ. Une action prend le
 *  texte du champ s'il lui en faut un (panel-app).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : panel-app. */
import { Fragment } from 'react';
import type { VibeAction, VibeArgs, VibeView } from 'technicals/bridge';

const SHOWN = ['ask', 'new-request', 'fix'];
// Les choix d'une nouvelle demande retenue, faits par l'appli elle-même.
const CHOICES = ['new-here', 'new-worktree', 'stash'];

type Props = { view: VibeView; busy: boolean; onRun(id: string, args?: VibeArgs): void };

export function SkillsBar({ view, busy, onRun }: Props) {
  const pick = (ids: string[]) => view.actions.filter((a) => ids.includes(a.id) && !a.hidden);
  const actions = pick(SHOWN);
  const choices = view.request ? pick(CHOICES) : [];
  if (!actions.length && !view.request) return null;
  const link = (a: VibeAction, args?: VibeArgs) => {
    const failed = a.direct?.last && !a.direct.last.ok ? a.direct.last.line : null;
    return (
      <Fragment key={a.id}>
        <button type="button" className="vc-barlink" disabled={!!a.disabled || (busy && a.kind === 'send')}
          title={a.disabled ? `${a.hint}\n— ${a.disabled}` : a.hint} onClick={() => onRun(a.id, args)}>{a.label}</button>
        {failed ? <span className="vc-direct-res" data-state="ko" title={failed}><span className="vc-direct-mark">✗</span> {failed}</span> : null}
      </Fragment>
    );
  };
  return (
    <div className="vc-skills">
      {actions.map((a) => link(a))}
      {view.request ? (
        <>
          <span className="vc-barlink">{view.lang === 'en' ? 'Branch' : 'Branche'} <code>{view.request.branch}</code></span>
          {choices.map((a) => link(a, { direct: true }))}
        </>
      ) : null}
    </div>
  );
}
