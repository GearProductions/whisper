import { describe, expect, it } from 'vitest';
import { nextScope, paletteItems, pick } from 'core/switcher';
import type { AgentView, VibeView } from 'technicals/bridge';

const agent = (id: string, o: Partial<AgentView> = {}): AgentView => ({
  id, name: id, color: '#fff', repo: 'gear', title: 'main', branch: null, step: null, activity: 'idle', detail: null, parent: null, ...o,
});
const agents = [
  agent('a', { name: 'Gear', branch: 'main' }),
  agent('b', { name: 'Gear wt', title: 'worktree', branch: 'feat/x', parent: 'a' }),
  agent('c', { name: 'PR 7', title: 'pr', pr: 7, branch: 'pr-7', parent: 'a' }),
  agent('d', { name: 'Autre', repo: 'other', branch: 'feat/x' }),
];
const view = {
  agentId: 'a', repo: { branch: 'main', base: 'main', changed: 0 }, branches: ['main', 'feat/x', 'fix/y'],
  prs: { mine: [{ number: 7, title: 'Ajout', author: 'moi', url: '' }], review: [{ number: 9, title: 'Autre', author: 'lui', url: '' }], all: [{ number: 7, title: 'Ajout', author: 'moi', url: '' }] },
} as unknown as VibeView;
const ids = (scope: Parameters<typeof paletteItems>[2], q = '', v: VibeView | null = view) => paletteItems(agents, v, scope, q).map((g) => g.id);

describe('nextScope', () => {
  it('tourne : all → agents → branches → prs → all', () => {
    expect(['all', 'agents', 'branches', 'prs'].map((s) => nextScope(s as never))).toEqual(['agents', 'branches', 'prs', 'all']);
  });
});

describe('paletteItems', () => {
  it('all : les agents par dépôt, les branches, les PR (sans doublon), les actions', () => {
    const g = paletteItems(agents, view, 'all', '');
    expect(g.map((x) => x.id)).toEqual(['agents:gear', 'agents:other', 'branches', 'prs', 'actions']);
    expect(g[0].items).toHaveLength(3);
    expect(g[3].items.map((i) => i.key)).toEqual(['7', '9']);
    expect(g[4].items.map((i) => i.key)).toEqual(['new-agent', 'create-branch', 'branches', 'stash']);
  });
  it('une portée : son groupe seul, sans actions', () => {
    expect(ids('agents')).toEqual(['agents:gear', 'agents:other']);
    expect(ids('branches')).toEqual(['branches']);
    expect(ids('prs')).toEqual(['prs']);
  });
  it('une branche et une PR portent l\'agent du dépôt qui les tient', () => {
    const g = paletteItems(agents, view, 'all', '');
    const br = g[2].items.map((i) => i.kind === 'branch' ? [i.branch, i.agent?.id ?? null, i.current] : null);
    expect(br).toEqual([['main', 'a', true], ['feat/x', 'b', false], ['fix/y', null, false]]);   // d, d'un autre dépôt, ne tient pas feat/x
    expect(g[3].items[0]).toMatchObject({ number: 7, agent: { id: 'c' } });
    expect(g[3].items[1]).toMatchObject({ number: 9, agent: null });
  });
  it('sans relevé, sans branches ou sans PR (false, null) : pas de groupe', () => {
    expect(ids('all', '', null)).toEqual(['agents:gear', 'agents:other', 'actions']);
    expect(ids('all', '', { ...view, branches: undefined, prs: false } as VibeView)).toEqual(['agents:gear', 'agents:other', 'actions']);
  });
  it('les actions : la requête se compare à leur libellé', () => {
    const fr = { 'new-agent': 'Nouvel agent…', 'create-branch': 'Créer une branche…', branches: 'Gérer les branches', stash: 'Mettre de côté' } as const;
    const g = paletteItems([], null, 'all', 'nouvel', (k) => fr[k]);
    expect(g.map((x) => x.items.map((i) => i.key))).toEqual([['new-agent']]);
  });
  it('chaque mot, sans casse', () => {
    expect(paletteItems(agents, view, 'all', 'FEAT gear').flatMap((g) => g.items.map((i) => i.key))).toEqual(['b', 'feat/x']);
    expect(ids('all', '#9')).toEqual(['prs']);
    expect(ids('all', 'zzz')).toEqual([]);
  });
});

describe('pick', () => {
  const items = paletteItems(agents, view, 'all', '').flatMap((g) => g.items);
  const of = (key: string) => items.find((i) => i.key === key)!;
  it('un agent, une branche ou une PR tenue : aller à l\'agent, Maj+Entrée aussi', () => {
    for (const k of ['a', 'feat/x', '7']) expect(pick(of(k), false)).toEqual(pick(of(k), true));
    expect(pick(of('feat/x'), false)).toEqual({ show: 'b' });
    expect(pick(of('7'), false)).toEqual({ show: 'c' });
  });
  it('une branche libre : basculer ici, Maj+Entrée la vue des branches', () => {
    expect(pick(of('fix/y'), false)).toEqual({ run: 'switch-branch', args: { branch: 'fix/y', direct: true } });
    expect(pick(of('fix/y'), true)).toEqual({ open: 'branches' });
  });
  it('une PR sans agent : la vue des branches', () => {
    expect(pick(of('9'), false)).toEqual({ open: 'branches' });
  });
  it('les actions', () => {
    expect(pick(of('new-agent'), false)).toEqual({ add: true });
    expect(pick(of('create-branch'), false)).toEqual({ open: 'branches' });
    expect(pick(of('branches'), false)).toEqual({ open: 'branches' });
    expect(pick(of('stash'), false)).toEqual({ run: 'stash', args: { direct: true } });
  });
});
