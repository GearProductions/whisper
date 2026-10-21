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
});
