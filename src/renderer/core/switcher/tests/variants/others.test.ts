import { expect, it } from 'vitest';
import { agentWhere, signalKeys, treeMark } from 'core/switcher';
import type { AgentView } from 'technicals/bridge';

const agent = (id: string, o: Partial<AgentView> = {}): AgentView => ({
  id, name: id, color: '#fff', repo: 'gear', title: 'main', branch: null, step: null, activity: 'idle', detail: null, parent: null, ...o,
});

it('agentWhere : « dépôt · branche », le dépôt seul sans branche', () => {
  expect([agentWhere(agent('a', { branch: 'fix/x' })), agentWhere(agent('a'))]).toEqual(['gear · fix/x', 'gear']);
});

it('treeMark : rien pour un dossier principal, ├ entre deux enfants, └ pour le dernier', () => {
  const list = [agent('a'), agent('b', { parent: 'a' }), agent('c', { parent: 'a' }), agent('d'), agent('e', { parent: 'd' })];
  expect(list.map((_, i) => treeMark(list, i))).toEqual(['', '├', '└', '', '└']);
});

it('signalKeys : attend, a fini, a échoué ; ni l\'affiché, ni qui travaille ou se repose', () => {
  const list = [agent('a', { activity: 'asking' }), agent('b', { activity: 'done' }), agent('c', { activity: 'paused' }),
    agent('d', { activity: 'working' }), agent('e'), agent('f', { activity: 'done' })];
  expect(signalKeys(list, 'f')).toEqual(['a~asking', 'b~done', 'c~paused']);
});
