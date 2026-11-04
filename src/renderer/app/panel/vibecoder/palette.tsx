/** palette — la palette Ctrl+K : un champ de recherche, les portées (Tab), les lignes par groupe
 *  (agents d'un dépôt, branches, PR, actions), flèches, Entrée, Maj+Entrée, Échap. Elle tient sa
 *  recherche, sa portée (`scope` n'est que la portée d'ouverture) et la ligne en surbrillance ; ce
 *  qu'elle liste et ce que fait Entrée viennent de core/switcher (paletteItems, pick).
 *  Échap ou un clic à côté : onClose. Entrée ou un clic sur une ligne : onPick(le déplacement),
 *  l'appelant ferme la palette. L'allure de la vue C : chaque agent sa pastille (initiales, couleur ;
 *  un worktree ou une PR plus petit, sous son dossier principal : ├ └) avec « étape · état » ; chaque
 *  branche son icône, et la pastille de l'agent qui la tient s'il n'est pas l'affiché, avec ce que
 *  fait Entrée au bout (branche actuelle, aller à l'agent, basculer ici) ; une PR tenue, la pastille
 *  de son agent ; l'aide des touches au pied.
 *  Ne connaît pas : le pont (que des rappels). Utilisé par : panel-app. */
import { useState } from 'react';
import { nextScope, paletteItems, pick, SCOPES, treeMark, type PaletteItem, type PaletteMove, type Scope } from 'core/switcher';
import type { PaletteAction, Strings } from 'core/vibecoder';
import type { AgentView, VibeView } from 'technicals/bridge';
import { Avatar } from './avatar';
import { Icon } from './icons';
import './palette.css';

type Props = { agents: AgentView[]; view: VibeView | null; scope: Scope; t: Strings; onPick(move: PaletteMove): void; onClose(): void };

export function Palette({ agents, view, scope: first, t, onPick, onClose }: Props) {
  const [scope, setScope] = useState(first);
  const [query, setQuery] = useState('');
  const [at, setAt] = useState(0);
  const groups = paletteItems(agents, view, scope, query, (k) => t.paletteActions[k].label);
  const rows = groups.flatMap((g) => g.items);
  const current = Math.min(at, rows.length - 1);

  const onKeyDown = (e: React.KeyboardEvent) => {
    const go = (i: number) => { e.preventDefault(); setAt(rows.length ? (i + rows.length) % rows.length : 0); };
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose(); }
    else if (e.key === 'Tab') { e.preventDefault(); setScope(nextScope(scope)); setAt(0); }
    else if (e.key === 'ArrowDown') go(current + 1);
    else if (e.key === 'ArrowUp') go(current - 1);
    else if (e.key === 'Enter' && rows[current]) { e.preventDefault(); onPick(pick(rows[current], e.shiftKey)); }
  };

  const here = view?.agentId ?? null;
  const keys = t.paletteKeys;
  return (
    <div className="vc-pal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vc-pal" role="dialog" aria-modal="true" aria-label={t.paletteHint} onKeyDown={onKeyDown}>
        <label className="vc-pal-search">
          <Icon name="search" />
          <input className="vc-pal-input" autoFocus value={query} placeholder={t.paletteHint} aria-label={t.paletteHint}
            onChange={(e) => { setQuery(e.target.value); setAt(0); }} />
        </label>
        <div className="vc-pal-scopes" role="tablist">
          {SCOPES.map((s) => (
            <button key={s} type="button" role="tab" tabIndex={-1} aria-selected={s === scope} data-on={s === scope || undefined}
              onClick={() => { setScope(s); setAt(0); }}>{t.paletteScopes[s]}</button>
          ))}
        </div>
        <div className="vc-pal-list" role="listbox">
          {rows.length === 0 && <p className="vc-pal-empty">{t.noResult}</p>}
          {groups.map((g) => {
            const tree = g.items.flatMap((x) => (x.kind === 'agent' ? [x.agent] : []));
            return (
              <div key={g.id} role="group">
                <div className="vc-pal-group">{g.id.startsWith('agents:') ? g.id.slice(7) : t.paletteGroups[g.id as 'branches' | 'prs' | 'actions']}</div>
                {g.items.map((item) => {
                  const i = rows.indexOf(item);
                  return (
                    <div key={item.key} role="option" className="vc-pal-row" data-kind={item.kind} aria-selected={i === current}
                      ref={i === current ? (el) => el?.scrollIntoView?.({ block: 'nearest' }) : undefined}
                      onMouseMove={() => setAt(i)} onClick={() => onPick(pick(item, false))}>
                      <Row item={item} t={t} here={here} selected={i === current}
                        mark={item.kind === 'agent' ? treeMark(tree, tree.indexOf(item.agent)) : ''} />
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
        <div className="vc-pal-keys">
          {keys.map(([k, what], i) => (
            <span key={k} className={i === keys.length - 1 ? 'vc-pal-keys-last' : undefined}><kbd>{k}</kbd> {what}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

const ICONS: Record<PaletteAction, string> = { 'new-agent': '+', 'create-branch': '+', branches: '⎇', stash: '⤓' };

type RowProps = { item: PaletteItem; t: Strings; here: string | null; selected: boolean; mark: string };

function Row({ item, t, here, selected, mark }: RowProps) {
  switch (item.kind) {
    case 'agent': {
      const a = item.agent;
      return (<>
        <span className="vc-pal-tree" data-child={a.parent ? true : undefined} aria-hidden="true">{mark}</span>
        <Avatar agent={a} size={a.parent ? 's' : 'm'} />
        <span className="vc-pal-main">
          <span className="vc-pal-name"><strong>{a.parent ? t.agentTitle(a.title, a.pr) : a.repo}</strong>
            {a.branch ? <span className="vc-pal-branch">{a.branch}</span> : null}</span>
          <span className="vc-pal-sub" data-activity={a.activity}>{t.agentStatus(a.step && t.steps[a.step], t.activity[a.activity])}</span>
        </span>
        <span className="vc-pal-end">{a.id === here ? t.paletteHere : ''}</span>
      </>);
    }
    case 'branch': {
      const other = item.agent && item.agent.id !== here ? item.agent : null;
      return (<>
        <span className="vc-pal-icon" aria-hidden="true"><Icon name="branch" /></span>
        <span className="vc-pal-name vc-mono">{item.branch}</span>
        {other ? <Avatar agent={other} size="xs" title={t.heldBy(other.name)} /> : null}
        <span className="vc-pal-end" data-here={item.current || undefined}>
          {item.current ? t.branchHere : other ? t.branchHeld : selected ? t.branchFree : ''}
        </span>
      </>);
    }
    case 'pr': {
      const other = item.agent && item.agent.id !== here ? item.agent : null;
      return (<>
        <span className="vc-pal-num vc-mono">#{item.number}</span>
        <span className="vc-pal-name">{item.title}</span>
        {other ? <Avatar agent={other} size="xs" title={t.heldBy(other.name)} /> : null}
        <span className="vc-pal-end">{other ? t.prHeld : item.author}</span>
      </>);
    }
    case 'action':
      return (<>
        <span className="vc-pal-icon vc-pal-act" aria-hidden="true">{ICONS[item.key]}</span>
        <span className="vc-pal-name">{t.paletteActions[item.key].label}</span>
        <span className="vc-pal-end vc-mono">{t.paletteActions[item.key].keys}</span>
      </>);
  }
}
