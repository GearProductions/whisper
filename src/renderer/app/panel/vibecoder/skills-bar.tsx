/** skills-bar — au-dessus du champ, en VibeCoder : les actions de partout
 *  (Demander sans modifier, Où j'en suis ?…), puis les skills du projet et
 *  de l'utilisateur en pastilles. Une pastille écrit `/<skill> ` au début du
 *  champ ; une action prend le texte du champ s'il lui en faut un (panel-app).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : panel-app. */
import { t as strings } from 'core/vibecoder';
import type { VibeView } from 'technicals/bridge';
import { ActionButton, cites } from './next-step';

type Props = { view: VibeView; busy: boolean; onSkill(name: string): void; onRun(id: string): void };

export function SkillsBar({ view, busy, onSkill, onRun }: Props) {
  const t = strings(view.lang);
  const actions = view.actions.filter((a) => a.step === null && !a.primary && !cites(a));
  if (!actions.length && !view.skills.length) return null;
  return (
    <div className="vc-skills">
      {actions.length ? (
        <div className="vc-bar-acts">{actions.map((a) => <ActionButton key={a.id} a={a} busy={busy} onRun={onRun} />)}</div>
      ) : null}
      {view.skills.length ? (
        <div className="vc-skill-list scroll">
          {view.skills.map((s) => (
            <button key={s} type="button" className="vc-skill" title={t.skillTitle(s)} onClick={() => onSkill(s)}>{`/${s}`}</button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
