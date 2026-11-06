import { describe, expect, it } from 'vitest';
import { agentWhere, beepFor, signalKeys, treeMark } from 'core/switcher';
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
  const list = [agent('a', { activity: 'asking' }), agent('b', { activity: 'done' }), agent('c', { activity: 'failed' }),
    agent('d', { activity: 'working' }), agent('e'), agent('f', { activity: 'done' })];
  expect(signalKeys(list, 'f')).toEqual(['a~asking', 'b~done', 'c~failed']);
});

describe('beepFor : le bip des autres agents', () => {
  it('quitter l\'agent affiché, rien de nouveau depuis : pas de bip', () => {
    const list = [agent('a', { activity: 'done' }), agent('b')];
    const onA = beepFor(new Set(), list, 'a');   // on est sur a : son signal est retenu, sans bip
    expect(onA.beep).toBe(false);
    expect(beepFor(onA.heard, list, 'b').beep).toBe(false);   // on le quitte : rien de neuf
  });

  it('un autre agent qui finit, échoue ou attend : un bip, une fois', () => {
    for (const activity of ['done', 'failed', 'asking'] as const) {
      const first = beepFor(new Set(), [agent('a'), agent('b')], 'a');
      const list = [agent('a'), agent('b', { activity })];
      const next = beepFor(first.heard, list, 'a');
      expect(next.beep).toBe(true);
      expect(beepFor(next.heard, list, 'a').beep).toBe(false);
    }
  });

  it('un signal retenu qui s\'efface puis revient : un nouveau bip', () => {
    const on = beepFor(new Set(), [agent('b', { activity: 'done' })], 'a');
    const cleared = beepFor(on.heard, [agent('b')], 'a');
    expect(cleared.beep).toBe(false);
    expect(beepFor(cleared.heard, [agent('b', { activity: 'done' })], 'a').beep).toBe(true);
  });
});
