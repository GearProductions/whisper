/** sync-buttons — à côté de la branche de l'en-tête : Pull, Rebase (et ▾ : sur
 *  origin/<base> par défaut, ou une branche locale → { onto }), Pousser s'il
 *  est au relevé ; boutons à icône, actions directes (onRun(id, { direct:
 *  true }), F-114), grisés avec leur raison, absents si masqués. La pastille
 *  de Rebase : view.sync.baseAhead > 0 (origin/<base> a avancé). Le dernier
 *  échec de chacun en infobulle (data-ko).
 *  Ne connaît pas : le pont (rappels passés), git. Utilisé par : vibe-coder ;
 *  originBase, par branches-view. */
import { useState } from 'react';
import type { VibeAction, VibeArgs, VibeView } from 'technicals/bridge';
import './sync-buttons.css';

const ICONS: Record<string, string> = { pull: '⇣', rebase: '⤴', push: '⇡' };
const S = {
  fr: { onto: 'Rebaser sur', ahead: (n: number, b: string) => `${b} a avancé de ${n} commit${n > 1 ? 's' : ''} : rebaser ?` },
  en: { onto: 'Rebase onto', ahead: (n: number, b: string) => `${b} moved ${n} commit${n > 1 ? 's' : ''} ahead: rebase?` },
};

// origin/<base> du relevé (repo.base : souvent déjà origin/<base>) ; '' sans base. Aussi : branches-view.
export const originBase = (view: VibeView) => {
  const base = view.repo?.base.replace(/^origin\//, '');
  return base ? `origin/${base}` : '';
};

type Props = { view: VibeView; onRun(id: string, args?: VibeArgs): void };

export function SyncButtons({ view, onRun }: Props) {
  const [picked, setOnto] = useState('');   // '' : origin/<base>, le défaut du principal
  const onto = view.branches?.includes(picked) ? picked : '';   // une branche disparue : retour au défaut
  const s = S[view.lang === 'en' ? 'en' : 'fr'];
  const shown = (id: string) => view.actions.find((a) => a.id === id && !a.hidden);
  const base = originBase(view);
  const ahead = view.sync?.baseAhead ?? 0;
  const button = (a: VibeAction, args: VibeArgs, more: string[] = [], dot = false) => {
    const failed = a.direct?.last && !a.direct.last.ok ? a.direct.last.line : null;
    const title = [a.disabled ? `${a.label} — ${a.disabled}` : a.hint || a.label, ...more, failed && `✗ ${failed}`].filter(Boolean).join('\n');
    return (
      <button key={a.id} type="button" className="vc-icon vc-sync-btn" data-ko={failed ? '' : undefined}
        disabled={!!a.disabled || !!a.direct?.running} title={title} aria-label={a.label} onClick={() => onRun(a.id, args)}>
        <span>{ICONS[a.id]}</span>
        {dot ? <span className="vc-sync-dot">{ahead}</span> : null}
      </button>
    );
  };
  const [pull, rebase, push] = ['pull', 'rebase', 'push'].map(shown);
  if (!pull && !rebase && !push) return null;
  return (
    <span className="vc-sync">
      {pull ? button(pull, { direct: true }) : null}
      {rebase ? (
        <>
          {button(rebase, onto ? { direct: true, onto } : { direct: true },
            [`${s.onto} ${onto || base}`, ahead > 0 ? s.ahead(ahead, base) : ''], ahead > 0)}
          <select className="vc-sync-onto" value={onto} title={s.onto} aria-label={s.onto} disabled={!!rebase.disabled}
            onChange={(e) => setOnto(e.target.value)}>
            <option value="">{base}</option>
            {(view.branches ?? []).filter((b) => b !== view.repo?.branch).map((b) => <option key={b} value={b}>{b}</option>)}
          </select>
        </>
      ) : null}
      {push ? button(push, { direct: true }) : null}
    </span>
  );
}
