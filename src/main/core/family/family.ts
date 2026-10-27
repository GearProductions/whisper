/** family — les familles d'agents : un dépôt, ses worktrees. Le `parent`
 *  enregistré d'un agent (l'ancien `temp` lu pareil), l'enfant qu'on crée
 *  (robot d'une PR en Relire, ou d'une nouvelle demande en Créer), la tête
 *  d'une famille, les groupes affichés (ordre de config), les rattachements à
 *  écrire d'après les dépôts relevés par git, et, pour les commandes du
 *  projet, la famille par le `parent` enregistré : le membre qui en porte le
 *  fichier (jamais un worktree), celui où une commande tourne déjà (une seule
 *  à la fois).
 *  Ne connaît pas : Electron, git, le disque (les dépôts et isRunning sont
 *  donnés), la config (seulement AgentConfig).
 *  Utilisé par : core/config, app/controllers (agents, worktrees, processes,
 *  recipe, vibecoder), app/menus. */
import type { AgentConfig } from 'core/agents';
import { childOf, isMain, type Repo } from './worktree';

type Link = { id: string; pr?: number };

const isPr = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;

// Le parent enregistré d'un agent (`parent`, sinon l'ancien `temp`) et la PR
// de son robot ; null pour un agent sans parent, ou mal formé.
export function agentParent(agent: AgentConfig): { id: string; pr: number | null } | null {
  const p: Partial<Record<string, unknown>> = agent.parent && typeof agent.parent === 'object' ? agent.parent : {};
  if (typeof p.id === 'string' && p.id && (p.pr === undefined || isPr(p.pr))) return { id: p.id, pr: p.pr ?? null };
  const t: Partial<Record<string, unknown>> = agent.temp && typeof agent.temp === 'object' ? agent.temp : {};
  return typeof t.parent === 'string' && t.parent && isPr(t.pr) ? { id: t.parent, pr: t.pr } : null;
}

// L'enfant de `parent` dans le worktree `dir` : son modèle, son effort, son
// mode ; avec `pr`, le robot de cette PR (F-110) : « PR #n », en VibeCoder,
// Relire, la PR suivie, l'autonomie du parent ; avec `create`, celui d'une
// nouvelle demande : en VibeCoder, Créer.
export function childAgent(parent: AgentConfig, dir: string, id: string, o: { name?: string; pr?: number; create?: true }): AgentConfig {
  const child: AgentConfig = { id, dir, name: o.name ?? '', model: parent.model, effort: parent.effort, mode: parent.mode, sessionId: null, parent: { id: parent.id } };
  if (!o.pr) return o.create ? { ...child, view: 'vibecoder', vibe: { flow: 'create', pr: null } } : child;
  return {
    ...child, name: `PR #${o.pr}`, parent: { id: parent.id, pr: o.pr }, view: 'vibecoder',
    vibe: { flow: 'review', autonomy: parent.vibe?.autonomy === 'vibe' ? 'vibe' : 'guide', pr: o.pr },
  };
}

// Le parent présent d'un agent (autre que lui) ; undefined sinon.
const parentIn = (agent: AgentConfig, agents: AgentConfig[]) => {
  const p = agentParent(agent);
  return p ? agents.find((a) => a.id === p.id && a.id !== agent.id) : undefined;
};

// La tête de la famille : son parent présent (lui-même sans parent présent :
// pas de chaîne), sinon lui.
export function familyHead(agent: AgentConfig, agents: AgentConfig[]): AgentConfig {
  const p = parentIn(agent, agents);
  return p && !parentIn(p, agents) ? p : agent;
}

// Les robots à afficher : chaque tête, ses enfants sous elle, dans l'ordre de
// la config ; un enfant sans parent présent est un groupe à lui.
export function familyGroups(agents: AgentConfig[]): { agent: AgentConfig; children: AgentConfig[] }[] {
  const heads = agents.map((a) => familyHead(a, agents));
  return agents.filter((a, i) => heads[i] === a)
    .map((agent) => ({ agent, children: agents.filter((c, i) => c !== agent && heads[i] === agent) }));
}

// Les rattachements à écrire, d'après le dépôt de chaque agent (null :
// inconnu, inchangé). Un enfant : la racine d'un worktree dont la copie
// principale a un agent (childOf, I-41). Le robot d'une PR reste lié à sa
// fiche, pas à git : inchangé. Un parent dont l'agent manque, ou dont le
// dépôt est inconnu : gardé. Seuls les changements (un `temp` à réécrire en
// compte un).
export function familyLinks(agents: AgentConfig[], repos: Record<string, Repo | null>): { id: string; parent: Link | null }[] {
  const changes: { id: string; parent: Link | null }[] = [];
  for (const a of agents) {
    const own = repos[a.id];
    if (!own) continue;
    const now = agentParent(a);
    if (now?.pr) { if (a.temp !== undefined) changes.push({ id: a.id, parent: { id: now.id, pr: now.pr } }); continue; }
    const head = agents.find((m) => {
      const r = repos[m.id];
      return m !== a && !!r && isMain(r) && r.top === m.dir && childOf(a.dir, r, own);
    });
    let next: Link | null = null;
    if (head) next = { id: head.id };
    else if (now && !(agents.some((m) => m.id === now.id && m !== a) && repos[now.id])) continue;
    if (a.temp !== undefined || JSON.stringify(a.parent ?? null) !== JSON.stringify(next)) changes.push({ id: a.id, parent: next });
  }
  return changes;
}

// La famille d'un agent pour les commandes du projet : son parent enregistré,
// présent ou non (après Retirer du parent, ses enfants restent ensemble),
// sinon lui.
const familyId = (agent: AgentConfig) => agentParent(agent)?.id ?? agent.id;

// Le membre dont `agent` prend le fichier du projet : son parent présent ;
// sans parent enregistré, lui ; un enfant dont le parent est parti : null
// (un autre membre serait un worktree, dont une PR peut changer le fichier).
export function familyOwner(agent: AgentConfig, agents: AgentConfig[]): AgentConfig | null {
  const p = agentParent(agent);
  return p ? agents.find((a) => a.id === p.id) ?? null : agent;
}

// Le membre de la famille de `self` (autre que lui) où la commande `name`
// tourne ; null sinon. Par id : `self` peut venir d'une autre lecture de la config.
export function heldBy(name: string, self: AgentConfig, agents: AgentConfig[], isRunning: (id: string, name: string) => boolean): AgentConfig | null {
  const id = familyId(self);
  return agents.find((a) => a.id !== self.id && familyId(a) === id && isRunning(a.id, name)) ?? null;
}
