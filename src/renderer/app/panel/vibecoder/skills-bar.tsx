/** skills-bar — au-dessus du champ, en VibeCoder : de petits liens discrets,
 *  Demander sans modifier et Retour → fixup (s'ils sont au relevé, ni
 *  masqués) ; Nouvelle demande ne s'y montre plus (Rédiger la note la
 *  remplace). Une nouvelle demande retenue (view.request) : « Voulez-vous
 *  créer la branche … ? », son nom prérempli et modifiable (état local, remis
 *  à view.request.branch quand elle change), ses choix du relevé (new-here,
 *  new-worktree avec { direct: true, branch: le nom saisi } ; stash avec
 *  { direct: true }, F-114), grisés avec leur raison, absents si masqués ; le
 *  dernier échec de chaque lien à côté. Les skills, eux, se trouvent par « / »
 *  dans le champ. Une action prend le texte du champ s'il lui en faut un
 *  (panel-app).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : panel-app. */
import { Fragment, useState, type ReactElement } from 'react';
import type { VibeAction, VibeArgs, VibeView } from 'technicals/bridge';

const SHOWN = ['ask', 'fix'];
// Les choix d'une nouvelle demande retenue, faits par l'appli elle-même.
const CHOICES = ['new-here', 'new-worktree', 'stash'];
const NAMED = ['new-here', 'new-worktree'];

type Props = { view: VibeView; busy: boolean; onRun(id: string, args?: VibeArgs): void };
type Link = (a: VibeAction, args?: VibeArgs, off?: boolean) => ReactElement;

export function SkillsBar({ view, busy, onRun }: Props) {
  const pick = (ids: string[]) => view.actions.filter((a) => ids.includes(a.id) && !a.hidden);
  const actions = pick(SHOWN);
  if (!actions.length && !view.request) return null;
  const link: Link = (a, args, off) => {
    const failed = a.direct?.last && !a.direct.last.ok ? a.direct.last.line : null;
    return (
      <Fragment key={a.id}>
        <button type="button" className="vc-barlink" disabled={!!a.disabled || !!off || (busy && a.kind === 'send')}
          title={a.disabled ? `${a.hint}\n— ${a.disabled}` : a.hint} onClick={() => onRun(a.id, args)}>{a.label}</button>
        {failed ? <span className="vc-direct-res" data-state="ko" title={failed}><span className="vc-direct-mark">✗</span> {failed}</span> : null}
      </Fragment>
    );
  };
  return (
    <div className="vc-skills">
      {actions.map((a) => link(a))}
      {view.request ? <Request key={view.request.branch} branch={view.request.branch} en={view.lang === 'en'} choices={pick(CHOICES)} link={link} /> : null}
    </div>
  );
}

// Remonté (key) à chaque nouvelle branche proposée : le nom saisi repart d'elle.
function Request({ branch, en, choices, link }: { branch: string; en: boolean; choices: VibeAction[]; link: Link }) {
  const [name, setName] = useState(branch);
  const typed = name.trim();
  const label = en ? 'Branch name' : 'Nom de la branche';
  return (
    <>
      <span className="vc-barlink">{en ? 'Create the branch' : 'Voulez-vous créer la branche'}</span>
      <input className="vc-mono" value={name} aria-label={label} title={label} spellCheck={false} onChange={(e) => setName(e.target.value)} />
      <span className="vc-barlink">?</span>
      {choices.map((a) => (NAMED.includes(a.id) ? link(a, { direct: true, branch: typed }, !typed) : link(a, { direct: true })))}
    </>
  );
}
