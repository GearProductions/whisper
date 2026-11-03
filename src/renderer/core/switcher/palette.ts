/** palette — la palette Ctrl+K, sans le DOM : ce qu'elle liste (les agents par dépôt avec leurs worktrees
 *  et PR, les branches du dépôt et l'agent qui les tient, les PR, les actions), sa portée (Tab), sa
 *  recherche (chaque mot, sans casse : searchMatch) et ce que fait Entrée / Maj+Entrée sur chaque ligne.
 *  Les initiales de la pastille d'un agent (initials). Les groupes et les actions portent une clé stable : les libellés sont ceux de la page (i18n).
 *  Ne connaît pas : le DOM, React, le pont. Utilisé par : app/panel/vibecoder (palette). */
import { searchMatch, type PaletteAction } from 'core/vibecoder';
import type { AgentView, VibeArgs, VibeView } from 'technicals/bridge';

export type Scope = 'all' | 'agents' | 'branches' | 'prs';

export type PaletteItem =
  | { kind: 'agent'; key: string; agent: AgentView }
  | { kind: 'branch'; key: string; branch: string; current: boolean; agent: AgentView | null }
  | { kind: 'pr'; key: string; number: number; title: string; author: string; agent: AgentView | null }
  | { kind: 'action'; key: PaletteAction };
export type PaletteGroup = { id: string; items: PaletteItem[] };   // id : 'agents:<dépôt>', 'branches', 'prs', 'actions'
export type PaletteMove =
  | { show: string }
  | { run: string; args: VibeArgs }
  | { open: 'branches' }
  | { add: true };

export const SCOPES: Scope[] = ['all', 'agents', 'branches', 'prs'];
const ACTIONS: PaletteAction[] = ['new-agent', 'create-branch', 'branches', 'stash'];

// Deux initiales (la pastille d'un agent) : celles des deux premiers mots du nom, sinon ses deux premières lettres.
export const initials = (name: string) => {
  const words = name.split(/[\s\-_.]+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] ?? '?').slice(0, 2)).toUpperCase();
};

export const nextScope = (s: Scope): Scope => SCOPES[(SCOPES.indexOf(s) + 1) % SCOPES.length];

// `label` : le libellé d'une action dans la langue de la page (la requête s'y compare).
export const paletteItems = (agents: AgentView[], view: VibeView | null, scope: Scope, query: string,
  label: (k: PaletteAction) => string = (k) => k.replace('-', ' ')): PaletteGroup[] => {
  const all = scope === 'all';
  const groups: PaletteGroup[] = [];
  const found = (...fields: (string | null | undefined)[]) => searchMatch(query, ...fields.map((f) => f ?? ''));
  if (all || scope === 'agents') {
    for (const a of agents) {
      if (!found(a.name, a.repo, a.branch, a.pr ? `#${a.pr}` : '')) continue;
      const id = `agents:${a.repo}`;
      let g = groups.find((x) => x.id === id);
      if (!g) groups.push(g = { id, items: [] });
      g.items.push({ kind: 'agent', key: a.id, agent: a });
    }
  }
  // Les branches et les PR sont celles du dépôt de l'agent affiché : seuls ses agents les tiennent.
  const repo = agents.find((a) => a.id === view?.agentId)?.repo;
  const ofRepo = agents.filter((a) => repo === undefined || a.repo === repo);
  if ((all || scope === 'branches') && view?.branches?.length) {
    const items = view.branches.flatMap((b): PaletteItem[] => {
      const agent = ofRepo.find((a) => a.branch === b) ?? null;
      return found(b, agent?.name) ? [{ kind: 'branch', key: b, branch: b, current: b === view.repo?.branch, agent }] : [];
    });
    if (items.length) groups.push({ id: 'branches', items });
  }
  if ((all || scope === 'prs') && view?.prs) {
    const seen = new Set<number>();
    const items = [...view.prs.mine, ...view.prs.review, ...view.prs.all].flatMap((p): PaletteItem[] => {
      if (seen.has(p.number)) return [];
      seen.add(p.number);
      const agent = ofRepo.find((a) => a.title === 'pr' && a.pr === p.number) ?? null;
      return found(`#${p.number}`, p.title, p.author, agent?.name)
        ? [{ kind: 'pr', key: String(p.number), number: p.number, title: p.title, author: p.author, agent }] : [];
    });
    if (items.length) groups.push({ id: 'prs', items });
  }
  if (all) {
    const items = ACTIONS.filter((k) => found(label(k))).map((key): PaletteItem => ({ kind: 'action', key }));
    if (items.length) groups.push({ id: 'actions', items });
  }
  return groups;
};

// Entrée : aller à l'agent, ou basculer ici. Maj+Entrée sur une branche libre : aucune action existante n'ouvre
// un worktree sur une branche locale (new-worktree en crée une, d'un nom saisi) : la vue des branches s'ouvre.
// Les actions sont directes (comme branches-view : { direct: true }), jamais par l'agent.
export const pick = (item: PaletteItem, shift: boolean): PaletteMove => {
  switch (item.kind) {
    case 'agent': return { show: item.agent.id };
    case 'branch':
      if (item.agent) return { show: item.agent.id };
      return shift ? { open: 'branches' } : { run: 'switch-branch', args: { branch: item.branch, direct: true } };
    // Une PR sans agent : la suivre (set({ pr })) puis load-pr / pr-worktree font deux messages, pas un coup :
    // on ouvre la vue des branches, qui les enchaîne.
    case 'pr': return item.agent ? { show: item.agent.id } : { open: 'branches' };
    case 'action':
      return item.key === 'new-agent' ? { add: true }
        : item.key === 'stash' ? { run: 'stash', args: { direct: true } }
        : { open: 'branches' }; // « Créer une branche… » ouvre la même vue
  }
};
