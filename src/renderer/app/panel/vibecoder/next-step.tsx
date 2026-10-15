/** next-step — la carte « Prochaine étape », au bas de l'étape, légère : sur
 *  une ligne, le bouton de ce que le guide fait faire ensuite (le choix du
 *  modèle à côté s'il tourne en sous-contexte, sinon qui travaille) et son
 *  aide ; puis les actions de l'étape affichée. Une action grisée dit
 *  pourquoi ; agent au travail : « L'agent travaille… » et ⏹ Arrêter, à la
 *  même place. Rien à lancer : `idle` s'il est donné (la validation
 *  qu'attend l'étape), sinon « Rien à lancer ».
 *  ActionButton et cites servent aussi à la barre de la conversation.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : vibe-coder, skills-bar. */
import type { ReactNode } from 'react';
import type { Strings } from 'core/vibecoder';
import type { VibeAction, VibeStepId } from 'technicals/bridge';
import { ModelPick } from './model-pick';

// Une action qui cite ({{quote}}) part d'un bloc ou d'un cas, pas d'un bouton à elle.
export const cites = (a: VibeAction) => a.kind === 'prefill' && !!a.text?.includes('{{quote}}');

const titleOf = (a: VibeAction) => (a.disabled ? `${a.hint}\n— ${a.disabled}` : a.hint);

// Un bouton discret : son libellé, pourquoi il est grisé ; qui travaille au survol, ou le choix du modèle à côté.
// Préparer un message (prefill) reste possible pendant que l'agent travaille.
export function ActionButton({ a, busy, onRun }: { a: VibeAction; busy: boolean; onRun(id: string): void }) {
  const send = a.kind === 'send';
  const button = (
    <button type="button" className="vc-act" disabled={!!a.disabled || (busy && send)} title={titleOf(a)} onClick={() => onRun(a.id)}>
      {a.label}
      {a.disabled && !busy ? <span className="vc-why">{a.disabled}</span> : null}
      {send && !a.models.length ? <span className="vc-who-float">{a.who}</span> : null}
    </button>
  );
  return send && a.models.length ? <span className="vc-run-group">{button}<ModelPick a={a} /></span> : button;
}

type Props = {
  actions: VibeAction[];
  step: VibeStepId | null;     // l'étape affichée
  t: Strings;
  busy: boolean;
  asking: boolean;             // l'agent attend une autorisation
  onRun(id: string): void;
  onPick(id: VibeStepId): void;
  onStop(): void;
  idle?: ReactNode;            // à la place de « Rien à lancer » : ce qu'attend l'étape en cours
};

export function NextStep({ actions, step, t, busy, asking, onRun, onPick, onStop, idle }: Props) {
  const primary = actions.find((a) => a.primary) || null;
  const others = actions.filter((a) => a.step === step && a !== primary && !cites(a));
  const elsewhere = primary && primary.step && primary.step !== step ? primary.step : null;
  return (
    <div className="vc-next">
      <div className="vc-next-title">
        <span>{t.next}</span>
        {elsewhere ? <button type="button" className="vc-link" onClick={() => onPick(elsewhere)}>{t.steps[elsewhere]}</button> : null}
      </div>
      <div className="vc-next-row">
        {busy ? (
          <>
            <span className="vc-next-busy" role="status"><span className="vc-dots" aria-hidden="true"><i /><i /><i /></span>{asking ? t.asking : t.working}</span>
            <button type="button" className="vc-stop" title={t.stopTitle} onClick={onStop}>{t.stop}</button>
          </>
        ) : primary ? (
          <>
            <button type="button" className="vc-primary" disabled={!!primary.disabled} title={titleOf(primary)} onClick={() => onRun(primary.id)}>
              <span className="vc-label">{primary.label}</span>
              {primary.models.length ? null : <span className="vc-who" title={t.who}>{primary.who}</span>}
            </button>
            {primary.kind === 'send' ? <ModelPick a={primary} /> : null}
            <span className={primary.disabled ? 'vc-next-why warn' : 'vc-next-why'} title={primary.disabled || primary.hint}>{primary.disabled || primary.hint}</span>
          </>
        ) : idle || <span className="vc-next-none">{t.noNext}</span>}
      </div>
      {others.length ? (
        <div className="vc-secondary">{others.map((a) => <ActionButton key={a.id} a={a} busy={busy} onRun={onRun} />)}</div>
      ) : null}
    </div>
  );
}
