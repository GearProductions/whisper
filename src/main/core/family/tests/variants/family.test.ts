import { describe, expect, it } from 'vitest';
import type { AgentConfig } from 'core/agents';
import { agentParent, childAgent, familyGroups, familyHead, familyLinks, familyOwner, heldBy } from 'core/family';

const agent = (id: string, dir = `/${id}`, more: Partial<AgentConfig> = {}): AgentConfig =>
  ({ id, dir, name: id, model: 'sonnet', effort: 'medium', mode: 'default', sessionId: null, ...more });

describe('agentParent', () => {
  it('parent, sinon l’ancien temp ; mal formé : null', () => {
    expect(agentParent(agent('a'))).toBeNull();
    expect(agentParent(agent('b', '/b', { parent: { id: 'a' } }))).toEqual({ id: 'a', pr: null });
    expect(agentParent(agent('b', '/b', { parent: { id: 'a', pr: 7 } }))).toEqual({ id: 'a', pr: 7 });
    expect(agentParent(agent('b', '/b', { temp: { parent: 'a', pr: 7 } }))).toEqual({ id: 'a', pr: 7 });
    expect(agentParent(agent('b', '/b', { parent: { id: 'a', pr: 0 } }))).toBeNull();
    expect(agentParent(agent('b', '/b', { parent: { id: '' } }))).toBeNull();
    expect(agentParent(agent('b', '/b', { parent: 'cassé' as never }))).toBeNull();
    expect(agentParent(agent('b', '/b', { temp: { parent: 'a', pr: 1.5 } }))).toBeNull();
  });
});

describe('childAgent', () => {
  const parent = agent('a', '/p', { model: 'opus', effort: 'high', mode: 'plan', vibe: { flow: 'create', autonomy: 'vibe', pr: null } });
  it('un enfant : les réglages du parent, son parent durable', () => {
    expect(childAgent(parent, '/w/x', 'b', { name: 'x' })).toEqual({
      id: 'b', dir: '/w/x', name: 'x', model: 'opus', effort: 'high', mode: 'plan', sessionId: null, parent: { id: 'a' },
    });
  });
  it('avec pr : le robot de la PR (F-110), « PR #n », en Relire, l’autonomie du parent', () => {
    const robot = childAgent(parent, '/w/pr-12', 'b', { name: 'pr-12', pr: 12 });
    expect(robot).toEqual({
      id: 'b', dir: '/w/pr-12', name: 'PR #12', model: 'opus', effort: 'high', mode: 'plan', sessionId: null,
      view: 'vibecoder', vibe: { flow: 'review', autonomy: 'vibe', pr: 12 }, parent: { id: 'a', pr: 12 },
    });
    expect(agentParent(robot)).toEqual({ id: 'a', pr: 12 });
    expect(childAgent(agent('a'), '/w', 'b', { name: 'w', pr: 3 }).vibe?.autonomy).toBe('guide');
  });
});

describe('familles', () => {
  const a = agent('a');
  const b = agent('b', '/b', { parent: { id: 'a' } });
  const c = agent('c');
  const d = agent('d', '/d', { temp: { parent: 'a', pr: 4 } });
  const orphan = agent('o', '/o', { parent: { id: 'parti' } });
  it('familyHead : son parent présent, sinon lui', () => {
    const list = [a, b, c, d, orphan];
    expect(familyHead(b, list)).toBe(a);
    expect(familyHead(d, list)).toBe(a);
    expect(familyHead(a, list)).toBe(a);
    expect(familyHead(orphan, list)).toBe(orphan);
  });
  it('familyGroups : ordre de config, enfants sous leur parent, orphelin seul', () => {
    expect(familyGroups([b, c, orphan, a, d])).toEqual([
      { agent: c, children: [] },
      { agent: orphan, children: [] },
      { agent: a, children: [b, d] },
    ]);
  });
  it('config retouchée : ni boucle, ni chaîne, ni robot perdu', () => {
    const self = agent('s', '/s', { parent: { id: 's' } });
    const x = agent('x', '/x', { parent: { id: 'y' } });
    const y = agent('y', '/y', { parent: { id: 'x' } });
    const chain = agent('z', '/z', { parent: { id: 'b' } });
    const groups = familyGroups([a, b, chain, self, x, y]);
    expect(groups.map((g) => [g.agent.id, g.children.map((k) => k.id)])).toEqual([['a', ['b']], ['z', []], ['s', []], ['x', []], ['y', []]]);
  });
  it('heldBy : le membre de la famille (autre que lui) où la commande tourne', () => {
    const list = [a, b, c, d];
    const running = (where: string[]) => (id: string, name: string) => name === 'web' && where.includes(id);
    expect(heldBy('web', b, list, running(['a']))).toBe(a);
    expect(heldBy('web', b, list, running(['d']))).toBe(d);
    expect(heldBy('web', a, list, running(['b']))).toBe(b);
    expect(heldBy('web', b, list, running(['b', 'c']))).toBeNull();   // lui-même, une autre famille
    expect(heldBy('api', b, list, running(['a']))).toBeNull();
    // self relu ailleurs (une autre lecture de la config) : reconnu par son id
    expect(heldBy('web', { ...a }, list, running(['a', 'b']))).toBe(b);
    // le parent retiré : ses enfants restent une famille
    expect(heldBy('web', b, [b, c, d], running(['d']))).toBe(d);
  });
  it('familyOwner : le parent présent, sinon le premier de la famille, sinon lui', () => {
    expect(familyOwner(d, [a, b, c, d])).toBe(a);
    expect(familyOwner(a, [a, b])).toBe(a);
    expect(familyOwner(d, [c, b, d])).toBe(b);
    expect(familyOwner(orphan, [c, orphan])).toBe(orphan);
    expect(familyOwner(c, [])).toBe(c);
  });
});

describe('familyLinks', () => {
  const main = { common: '/p/.git', top: '/p' };
  const wt = (top: string) => ({ common: '/p/.git', top });
  const a = agent('a', '/p');
  it('enfant : la racine d’un worktree dont la copie principale a un agent ; seuls les changements', () => {
    const b = agent('b', '/w/x');
    const sub = agent('s', '/w/x/src');
    const other = agent('o', '/q');
    expect(familyLinks([a, b, sub, other], { a: main, b: wt('/w/x'), s: wt('/w/x'), o: { common: '/q/.git', top: '/q' } }))
      .toEqual([{ id: 'b', parent: { id: 'a' } }]);
    expect(familyLinks([a, { ...b, parent: { id: 'a' } }], { a: main, b: wt('/w/x') })).toEqual([]);
  });
  it('sans agent sur la copie principale : pas d’enfant', () => {
    const subMain = agent('m', '/p/src');
    expect(familyLinks([subMain, agent('b', '/w/x')], { m: main, b: wt('/w/x') })).toEqual([]);
  });
  it('repo inconnu : inchangé ; parent absent ou au dépôt inconnu : gardé', () => {
    const b = agent('b', '/w/x', { parent: { id: 'a', pr: 3 } });
    expect(familyLinks([a, agent('c', '/w/y')], { a: main, c: null })).toEqual([]);
    expect(familyLinks([b], { b: wt('/w/x') })).toEqual([]);
    expect(familyLinks([a, b], { a: null, b: wt('/w/x') })).toEqual([]);
  });
  it('plus enfant (parent présent, connu) : parent retiré', () => {
    const b = agent('b', '/w/x', { parent: { id: 'a' } });
    expect(familyLinks([a, b], { a: main, b: { common: '/q/.git', top: '/w/x' } })).toEqual([{ id: 'b', parent: null }]);
  });
  it('le robot d’une PR : lié à sa fiche, pas à git ; temp réécrit en parent', () => {
    const b = agent('b', '/w/x', { parent: { id: 'a', pr: 3 } });
    expect(familyLinks([a, b], { a: main, b: wt('/w/x') })).toEqual([]);
    const d = agent('d', '/w/x', { temp: { parent: 'a', pr: 3 } });
    expect(familyLinks([a, d], { a: main, b: wt('/w/x'), d: wt('/w/x') })).toEqual([{ id: 'd', parent: { id: 'a', pr: 3 } }]);
    const moved = agent('b', '/w/x', { parent: { id: 'vieux', pr: 3 } });
    expect(familyLinks([agent('vieux', '/v'), a, moved], { vieux: { common: '/v/.git', top: '/v' }, a: main, b: wt('/w/x') })).toEqual([]);
    // son parent sur un sous-dossier de la copie principale : gardé aussi
    const sub = agent('m', '/p/src');
    expect(familyLinks([sub, agent('b', '/w/x', { parent: { id: 'm', pr: 3 } })], { m: main, b: wt('/w/x') })).toEqual([]);
  });
});
