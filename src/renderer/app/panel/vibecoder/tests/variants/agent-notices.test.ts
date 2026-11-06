// @vitest-environment happy-dom
// AgentNotices (agent-notices.tsx) : tous les robots dans l'ordre reçu, l'affiché en pastille allumée avec son nom (sans
// pastille d'état), les autres avec leur état ; clic : l'afficher (l'affiché : onOpen) ; clic droit : onMenu ; +.
import { act, createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { expect, it } from 'vitest';
import { t } from 'core/vibecoder';
import type { AgentView } from 'technicals/bridge';
import { AgentNotices } from '../../agent-notices';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const agent = (id: string, more: Partial<AgentView> = {}): AgentView =>
  ({ id, name: id, color: '#c00', repo: 'gear', title: 'main', branch: `fix/${id}`, step: null, activity: 'idle', detail: null, parent: null, ...more });
const agents = [agent('me', { activity: 'done' }), agent('wt', { title: 'worktree', parent: 'me', activity: 'asking', detail: 'Quelle branche ?' }), agent('b', { activity: 'working' })];

const page = document.createElement('div');
const root = createRoot(page);
const calls: string[] = [];
const draw = (shown: string) => act(() => root.render(createElement(AgentNotices, {
  agents, shown, t: t('fr'), onShow: (id) => calls.push(`show:${id}`), onOpen: () => calls.push('open'),
  onMenu: (id) => calls.push(`menu:${id}`), onAdd: () => calls.push('add'),
})));
const robots = () => [...page.querySelectorAll<HTMLElement>('.vc-agent')];

it('l\'ordre reçu ; l\'affiché : sa pastille et son nom, sans pastille d\'état ; un enfant : petit, son titre et sa question en infobulle', async () => {
  await draw('me');
  expect(robots().map((r) => [r.getAttribute('aria-pressed'), r.getAttribute('data-activity')]))
    .toEqual([['true', 'done'], ['false', 'asking'], ['false', 'working']]);
  expect(robots()[0].querySelector('.vc-agent-name')!.textContent).toBe('gear');
  expect(robots()[0].querySelector('.vc-agent-badge')).toBeNull();
  expect(robots()[1].querySelector('.vc-agent-badge')).not.toBeNull();
  expect(robots()[1].hasAttribute('data-child')).toBe(true);
  expect(robots()[1].title).toContain('gear · fix/wt (worktree) — attend ta réponse\nQuelle branche ?');
  expect(robots()[0].style.getPropertyValue('--vc-agent')).toBe('#c00');
  await draw('b');
  expect(robots().map((r) => r.getAttribute('aria-pressed'))).toEqual(['false', 'false', 'true']);
});

it('clic : un autre → onShow, l\'affiché → onOpen ; clic droit → onMenu ; + → onAdd', async () => {
  calls.length = 0;
  await draw('me');
  await act(async () => { robots()[2].click(); robots()[0].click(); });
  const menu = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
  await act(async () => { robots()[1].dispatchEvent(menu); (page.querySelector('.vc-agent-add') as HTMLElement).click(); });
  expect(calls).toEqual(['show:b', 'open', 'menu:wt', 'add']);
  expect(menu.defaultPrevented).toBe(true);
});

// T-13, T-14 : l'échec (« ! », « en échec ») et les tâches de fond (data-tasks, l'infobulle les compte).
const drawOne = (a: AgentView) => act(() => root.render(createElement(AgentNotices, {
  agents: [a], shown: 'other', t: t('fr'), onShow: () => {}, onOpen: () => {}, onMenu: () => {}, onAdd: () => {},
})));

it('un agent failed : data-activity « failed » (le « ! »), l\'infobulle « en échec »', async () => {
  await drawOne(agent('x', { activity: 'failed' }));
  expect(robots()[0].getAttribute('data-activity')).toBe('failed');
  expect(robots()[0].querySelector('.vc-agent-badge')).not.toBeNull();
  expect(robots()[0].title).toContain('— en échec');
});

it('un agent au repos avec deux tâches de fond : data-tasks, l\'infobulle les compte ; fini : de même', async () => {
  await drawOne(agent('x', { activity: 'idle', tasks: 2 }));
  expect(robots()[0].getAttribute('data-tasks')).toBe('2');
  expect(robots()[0].title).toContain('surveille 2 tâches de fond');
  await drawOne(agent('x', { activity: 'done', tasks: 1 }));
  expect(robots()[0].getAttribute('data-tasks')).toBe('1');
  await drawOne(agent('x', { activity: 'idle' }));
  expect(robots()[0].hasAttribute('data-tasks')).toBe(false);
  expect(robots()[0].title).not.toContain('surveille');
});

it('un agent qui travaille : pas de data-tasks', async () => {
  await drawOne(agent('x', { activity: 'working', tasks: 2 }));
  expect(robots()[0].hasAttribute('data-tasks')).toBe(false);
});
