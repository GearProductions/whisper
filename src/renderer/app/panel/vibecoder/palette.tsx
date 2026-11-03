/** palette — la palette Ctrl+K : un champ de recherche, les portées (Tab), les lignes par groupe
 *  (agents d'un dépôt, branches, PR, actions), flèches, Entrée, Maj+Entrée, Échap. Elle tient sa
 *  recherche, sa portée (`scope` n'est que la portée d'ouverture) et la ligne en surbrillance ; ce
 *  qu'elle liste et ce que fait Entrée viennent de core/switcher (paletteItems, pick).
 *  Échap ou un clic à côté : onClose. Entrée ou un clic sur une ligne : onPick(le déplacement),
 *  l'appelant ferme la palette.
 *  Ne connaît pas : le pont (que des rappels). Utilisé par : panel-app. */
import { useState } from 'react';
import { initials, nextScope, paletteItems, pick, type PaletteItem, type PaletteMove, type Scope } from 'core/switcher';
import type { Strings } from 'core/vibecoder';
import type { AgentView, VibeView } from 'technicals/bridge';
import './palette.css';

type Props = { agents: AgentView[]; view: VibeView | null; scope: Scope; t: Strings; onPick(move: PaletteMove): void; onClose(): void };

const SCOPES: Scope[] = ['all', 'agents', 'branches', 'prs'];

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

  return (
    <div className="vc-pal-back" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="vc-pal" role="dialog" aria-modal="true" onKeyDown={onKeyDown}>
        <input className="vc-pal-input" autoFocus value={query} placeholder={t.paletteHint} aria-label={t.paletteHint}
          onChange={(e) => { setQuery(e.target.value); setAt(0); }} />
        <div className="vc-pal-scopes">
          {SCOPES.map((s) => (
            <button key={s} type="button" tabIndex={-1} data-on={s === scope || undefined} onClick={() => { setScope(s); setAt(0); }}>{t.paletteScopes[s]}</button>
          ))}
        </div>
        <div className="vc-pal-list" role="listbox">
          {rows.length === 0 && <p className="vc-pal-empty">{t.noResult}</p>}
          {groups.map((g) => (
            <div key={g.id} role="group">
              <div className="vc-pal-group">{g.id.startsWith('agents:') ? g.id.slice(7) : t.paletteGroups[g.id as 'branches' | 'prs' | 'actions']}</div>
              {g.items.map((item) => {
                const i = rows.indexOf(item);
                return (
                  <div key={item.key} role="option" className="vc-pal-row" aria-selected={i === current}
                    ref={i === current ? (el) => el?.scrollIntoView?.({ block: 'nearest' }) : undefined}
                    onMouseMove={() => setAt(i)} onClick={() => onPick(pick(item, false))}>
                    <Row item={item} t={t} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="vc-pal-keys">{t.paletteKeys}</div>
      </div>
    </div>
  );
}

function AgentDot({ agent }: { agent: AgentView }) {
  return <span className="vc-pal-dot" style={{ background: agent.color }}>{initials(agent.name)}</span>;
}

function Row({ item, t }: { item: PaletteItem; t: Strings }) {
  switch (item.kind) {
    case 'agent': {
      const a = item.agent;
      return (<>
        <AgentDot agent={a} />
        <span className="vc-pal-name">{a.name}</span>
        <span className="vc-pal-meta">{t.agentTitle(a.title, a.pr)}</span>
        {a.branch && <span className="vc-pal-branch">{a.branch}</span>}
        <span className="vc-pal-end">{t.activity[a.activity]}</span>
      </>);
    }
    case 'branch':
      return (<>
        {item.agent && <AgentDot agent={item.agent} />}
        <span className="vc-pal-name vc-mono">{item.branch}</span>
        {item.agent && <span className="vc-pal-end">{t.heldBy(item.agent.name)}</span>}
      </>);
    case 'pr':
      return (<>
        {item.agent && <AgentDot agent={item.agent} />}
        <span className="vc-pal-name">#{item.number} {item.title}</span>
        <span className="vc-pal-meta">{item.author}</span>
        {item.agent && <span className="vc-pal-end">{t.heldBy(item.agent.name)}</span>}
      </>);
    case 'action':
      return (<>
        <span className="vc-pal-name">{t.paletteActions[item.key].label}</span>
        <span className="vc-pal-end">{t.paletteActions[item.key].keys}</span>
      </>);
  }
}
