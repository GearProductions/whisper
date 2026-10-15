/** skills-bar — au-dessus du champ, en VibeCoder : deux petits liens discrets,
 *  Demander sans modifier et Retour → fixup (s'ils sont au relevé). Les
 *  skills, eux, se trouvent par « / » dans le champ. Une action prend le
 *  texte du champ s'il lui en faut un (panel-app).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : panel-app. */
import type { VibeView } from 'technicals/bridge';

const SHOWN = ['ask', 'fix'];

type Props = { view: VibeView; busy: boolean; onRun(id: string): void };

export function SkillsBar({ view, busy, onRun }: Props) {
  const actions = view.actions.filter((a) => SHOWN.includes(a.id));
  if (!actions.length) return null;
  return (
    <div className="vc-skills">
      {actions.map((a) => (
        <button key={a.id} type="button" className="vc-barlink" disabled={!!a.disabled || (busy && a.kind === 'send')}
          title={a.disabled ? `${a.hint}\n— ${a.disabled}` : a.hint} onClick={() => onRun(a.id)}>{a.label}</button>
      ))}
    </div>
  );
}
