// @vitest-environment happy-dom
// AgentNotices (agent-notices.tsx) : une notice par événement, la plus récente en haut ; Basculer et × rendent l'agent / l'indice.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { AgentEvent, AgentView } from 'technicals/bridge';
import { AgentNotices } from '../../agent-notices';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const agent = (id: string, name: string): AgentView =>
  ({ id, name, color: '#c00', repo: 'gear', title: 'main', branch: 'main', step: 'modules', activity: 'asking', detail: 'Quelle branche ?', parent: null });
const events: AgentEvent[] = [
  { agentId: 'a', kind: 'done', step: 'modules', detail: null },
  { agentId: 'gone', kind: 'error', step: null, detail: null },
  { agentId: 'b', kind: 'asking', step: 'note', detail: 'Quelle branche ?' },
];

it('la plus récente en haut, l\'agent disparu omis, la question montrée', async () => {
  const page = document.createElement('div');
  const shown: string[] = [], dismissed: number[] = [];
  await act(() => createRoot(page).render(createElement(AgentNotices, {
    events, agents: [agent('a', 'Alice'), agent('b', 'Bob')], t: t('fr'), onShow: (id) => shown.push(id), onDismiss: (i) => dismissed.push(i),
  })));
  expect([...page.querySelectorAll('.vc-notice-text')].map((e) => e.textContent)).toEqual(['? Bob te pose une question', '✓ Alice a fini les Modules']);
  expect(page.querySelector('.vc-notice-detail')!.textContent).toBe('Quelle branche ?');
  const [switchB, closeB] = page.querySelectorAll('.vc-notice:first-child button');
  await act(async () => { (switchB as HTMLElement).click(); (closeB as HTMLElement).click(); });
  expect([shown, dismissed]).toEqual([['b'], [2]]);
});
