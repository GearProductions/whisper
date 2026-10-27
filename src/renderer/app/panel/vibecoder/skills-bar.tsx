/** skills-bar — au-dessus du champ, en VibeCoder : de petits liens discrets,
 *  Demander sans modifier, Nouvelle demande dans un worktree (son dernier
 *  échec à côté, comme une action directe) et Retour →
 *  fixup (s'ils sont au relevé, ni masqués). Les
 *  skills, eux, se trouvent par « / » dans le champ. Une action prend le
 *  texte du champ s'il lui en faut un (panel-app).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : panel-app. */
import { Fragment } from 'react';
import type { VibeView } from 'technicals/bridge';

const SHOWN = ['ask', 'new-worktree', 'fix'];

type Props = { view: VibeView; busy: boolean; onRun(id: string): void };

export function SkillsBar({ view, busy, onRun }: Props) {
  const actions = view.actions.filter((a) => SHOWN.includes(a.id) && !a.hidden);
  if (!actions.length) return null;
  return (
    <div className="vc-skills">
      {actions.map((a) => {
        const failed = a.direct?.last && !a.direct.last.ok ? a.direct.last.line : null;
        return (
          <Fragment key={a.id}>
            <button type="button" className="vc-barlink" disabled={!!a.disabled || (busy && a.kind === 'send')}
              title={a.disabled ? `${a.hint}\n— ${a.disabled}` : a.hint} onClick={() => onRun(a.id)}>{a.label}</button>
            {failed ? <span className="vc-direct-res" data-state="ko" title={failed}><span className="vc-direct-mark">✗</span> {failed}</span> : null}
          </Fragment>
        );
      })}
    </div>
  );
}
