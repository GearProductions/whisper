/** next-step — la carte « Prochaine étape », au bas de l'étape : le bouton
 *  principal (ce que le guide fait faire ensuite, et qui travaille), puis les
 *  actions de l'étape affichée. Une action grisée dit pourquoi ; agent au
 *  travail : « L'agent travaille… », à la même place (rien ne bouge).
 *  ActionButton et cites servent aussi à la barre des skills.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : vibe-coder, skills-bar. */
import type { Strings } from 'core/vibecoder';
import type { VibeAction, VibeStepId } from 'technicals/bridge';

// Une action qui cite ({{quote}}) part d'un bloc ou d'un cas, pas d'un bouton à elle.
export const cites = (a: VibeAction) => a.kind === 'prefill' && !!a.text?.includes('{{quote}}');

const titleOf = (a: VibeAction) => (a.disabled ? `${a.hint}\n— ${a.disabled}` : a.hint);

// Un bouton discret : son libellé, pourquoi il est grisé, qui travaille (au survol).
// Préparer un message (prefill) reste possible pendant que l'agent travaille.
export function ActionButton({ a, busy, onRun }: { a: VibeAction; busy: boolean; onRun(id: string): void }) {
  const send = a.kind === 'send';
  return (
    <button type="button" className="vc-act" disabled={!!a.disabled || (busy && send)} title={titleOf(a)} onClick={() => onRun(a.id)}>
      {a.label}
      {a.disabled && !busy ? <span className="vc-why">{a.disabled}</span> : null}
      {send ? <span className="vc-who-float">{a.who}</span> : null}
    </button>
  );
}

type Props = {
  actions: VibeAction[];
  step: VibeStepId | null;     // l'étape affichée
  t: Strings;
  busy: boolean;
  asking: boolean;             // l'agent attend une autorisation
  onRun(id: string): void;
  onPick(id: VibeStepId): void;
};

export function NextStep({ actions, step, t, busy, asking, onRun, onPick }: Props) {
  const primary = actions.find((a) => a.primary) || null;
  const others = actions.filter((a) => a.step === step && a !== primary && !cites(a));
  const elsewhere = primary && primary.step && primary.step !== step ? primary.step : null;
  const why = primary && !busy ? primary.disabled : null;
  return (
    <div className="vc-next">
      <div className="vc-next-title">
        <span>{t.next}</span>
        {elsewhere ? <button type="button" className="vc-link" onClick={() => onPick(elsewhere)}>{t.steps[elsewhere]}</button> : null}
      </div>
      {primary ? (
        <>
          <button type="button" className="vc-primary" disabled={busy || !!primary.disabled} data-busy={busy || undefined}
            title={titleOf(primary)} onClick={() => onRun(primary.id)}>
            {busy ? <span className="vc-dots" aria-hidden="true"><i /><i /><i /></span> : null}
            <span className="vc-label">{busy ? (asking ? t.asking : t.working) : primary.label}</span>
            <span className="vc-who" title={t.who}>{primary.who}</span>
          </button>
          <div className={why ? 'vc-next-why warn' : 'vc-next-why'}>{why || primary.hint}</div>
        </>
      ) : <div className="vc-next-none">{t.noNext}</div>}
      {others.length ? (
        <div className="vc-secondary">{others.map((a) => <ActionButton key={a.id} a={a} busy={busy} onRun={onRun} />)}</div>
      ) : null}
    </div>
  );
}
