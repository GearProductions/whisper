import { describe, expect, it } from 'vitest';
import { agentTitle } from 'app/icon/components';
import type { AgentView } from 'technicals/bridge';

const robot = (o: Partial<AgentView> = {}): AgentView => ({
  id: 'a', name: 'alpha', color: '#22c55e', selected: false, status: 'idle', unread: false, tasks: 0, badge: null, children: [], ...o,
});

describe('agentTitle', () => {
  it('porte la pastille d\'un enfant (branche ou PR)', () => {
    expect(agentTitle(robot({ badge: 'feat/x' }))).toBe('alpha (feat/x) — cliquer pour lui parler');
    expect(agentTitle(robot({ badge: 'PR #12', status: 'working' }))).toBe('alpha (PR #12) — au travail…');
  });
  it('sans pastille : le nom seul', () => {
    expect(agentTitle(robot({ unread: true }))).toBe('alpha — a répondu : cliquer pour lire');
  });
  it('le signal des courses quand la conversation ne dit rien', () => {
    expect(agentTitle(robot({ signal: 'asking', status: 'asking' }))).toBe('alpha — une action attend une autorisation');
    expect(agentTitle(robot({ signal: 'failed', status: 'error' }))).toBe('alpha — une action a échoué');
    expect(agentTitle(robot({ signal: 'done', unread: true }))).toBe('alpha — une action est finie');
    expect(agentTitle(robot({ signal: 'working', status: 'working' }))).toBe('alpha — une action travaille');
  });
  it('la conversation d\'abord', () => {
    expect(agentTitle(robot({ signal: 'asking', status: 'working' }))).toBe('alpha — au travail…');
    expect(agentTitle(robot({ signal: 'done', status: 'asking' }))).toBe('alpha — attend une autorisation');
    expect(agentTitle(robot({ signal: null, unread: true }))).toBe('alpha — a répondu : cliquer pour lire');
  });
});
