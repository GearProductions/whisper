import { describe, expect, it } from 'vitest';
import type { AgentConfig } from 'core/agents';
import type { Config } from 'core/config';
import type { AgentView } from 'shared/bridge';
import { activityOf, agentEvents, switcherAgents } from 'core/switcher';

const agent = (id: string, more: Partial<AgentConfig> = {}): AgentConfig =>
  ({ id, dir: `/${id}`, name: id, model: 'sonnet', effort: 'medium', mode: 'default', sessionId: null, ...more });
const st = (status: 'idle' | 'working' | 'asking' | 'error' = 'idle', unread = false, signal: 'asking' | 'done' | 'failed' | 'working' | null = null, tasks = 0) => ({ status, unread, signal, tasks });

describe('activityOf', () => {
  it('une erreur ou une course échouée donne failed, jamais paused', () => {
    expect(activityOf(st('error'))).toBe('failed');
    expect(activityOf(st('idle', false, 'failed'))).toBe('failed');
    expect(activityOf(st('error', true, 'done'))).toBe('failed');
  });

  it('la première règle gagne', () => {
    expect(activityOf(st('asking', false, 'working'))).toBe('asking');
    expect(activityOf(st('idle', false, 'asking'))).toBe('asking');
    expect(activityOf(st('working', true, 'failed'))).toBe('working');
    expect(activityOf(st('idle', false, 'working'))).toBe('working');
    expect(activityOf(st('error', true))).toBe('failed');
    expect(activityOf(st('idle', true, 'failed'))).toBe('failed');
    expect(activityOf(st('idle', true))).toBe('done');
    expect(activityOf(st('idle', false, 'done'))).toBe('done');
    expect(activityOf(st())).toBe('idle');
  });
});

describe('switcherAgents', () => {
  it('tasks : celles que le relevé rend pour l’agent (sa conversation plus ses courses)', () => {
    const cfg2 = { agents: [agent('a'), agent('b')] } as unknown as Config;
    const tasks: Record<string, number> = { a: 3, b: 0 };
    const list = switcherAgents(cfg2, {
      state: (id) => st('idle', false, null, tasks[id]), step: () => null, branch: () => null, question: () => null,
    });
    expect(list.map((v) => v.tasks ?? 0)).toEqual([3, 0]);
  });

  const cfg = { agents: [agent('b', { parent: { id: 'a' } }), agent('a', { name: 'repo' }), agent('c', { parent: { id: 'a', pr: 7 } }), agent('d')] } as unknown as Config;
  const states: Record<string, ReturnType<typeof st>> = { a: st('asking'), b: st('working'), c: st(), d: st() };
  const read = {
    state: (id: string) => states[id], step: (id: string) => (id === 'a' ? 'modules' as const : null),
    branch: (dir: string) => `br${dir}`, question: (id: string) => `q-${id}`,
  };
  it('par famille : la tête puis ses enfants, titre, couleur de la tête, question seulement si elle attend', () => {
    const list = switcherAgents(cfg, read);
    expect(list.map((v) => [v.id, v.repo, v.title, v.pr, v.parent])).toEqual([
      ['a', 'repo', 'main', undefined, null], ['b', 'repo', 'worktree', undefined, 'a'], ['c', 'repo', 'pr', 7, 'a'], ['d', 'd', 'main', undefined, null],
    ]);
    expect(list.map((v) => v.detail)).toEqual(['q-a', null, null, null]);
    expect(list.map((v) => v.activity)).toEqual(['asking', 'working', 'idle', 'idle']);
    expect(list[0]).toMatchObject({ branch: 'br/a', step: 'modules' });
    expect(list[1].color).toBe(list[0].color);
  });
});

describe('agentEvents', () => {
  const v = (id: string, activity: AgentView['activity'], detail: string | null = null): AgentView =>
    ({ id, name: id, color: '', repo: id, title: 'main', branch: null, step: 'forme', activity, detail, parent: null });
  it('un changement vers question, échec (failed → l’évènement error) ; pas une fin, pas l’affiché, pas un état inchangé', () => {
    const before = [v('a', 'working'), v('b', 'working'), v('c', 'asking'), v('s', 'working')];
    const after = [v('a', 'done'), v('b', 'failed'), v('c', 'asking'), v('s', 'done'), v('n', 'asking', 'ok ?')];
    expect(agentEvents(before, after, 's')).toEqual([
      { agentId: 'b', kind: 'error', detail: null },
      { agentId: 'n', kind: 'asking', detail: 'ok ?' },
    ]);
  });
  it('vers working ou idle : rien', () => {
    expect(agentEvents([v('a', 'done')], [v('a', 'idle')], null)).toEqual([]);
    expect(agentEvents([], [v('a', 'working')], null)).toEqual([]);
  });
});
