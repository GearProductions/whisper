// Variants des familles côté robots (note 0.10.0) : pushAgents envoie chaque
// parent avec ses enfants et leur pastille (branche lue dans .git, ou « PR #n »),
// la fenêtre suit la rangée d'enfants ; removeAgent oublie l'agent, le dossier
// d'un robot de PR, et laisse leur parent aux enfants.
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque) ; faux : Electron (fenêtres qui relèvent ce qu'on leur envoie).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentsState } from 'shared/bridge';

const fake = vi.hoisted(() => {
  class Win {
    sent: [string, unknown][] = [];
    bounds = { x: 500, y: 500, width: 64, height: 64 };
    webContents = { send: (ch: string, payload?: unknown) => { this.sent.push([ch, payload]); }, on: () => {} };
    on() { return this; } once() { return this; }
    getBounds() { return this.bounds; } setBounds(b: typeof this.bounds) { this.bounds = b; }
    isVisible() { return false; } isDestroyed() { return false; }
  }
  return { Win, userData: '' };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: fake.Win,
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: {}, dialog: {}, clipboard: {}, nativeImage: {},
}));

const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const AGENT = { model: '', effort: '', mode: 'default', sessionId: null };
let repo = '';
let wt = '';
let pr = '';

beforeEach(() => {
  vi.resetModules();
  fake.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-agents-'));
  repo = path.join(fake.userData, 'projet');
  wt = path.join(fake.userData, 'wt', 'essai');
  pr = path.join(fake.userData, 'wt', 'pr-12');
  write(path.join(repo, '.git', 'HEAD'), 'ref: refs/heads/master\n');
  write(path.join(repo, '.git', 'worktrees', 'essai', 'HEAD'), 'ref: refs/heads/feat/essai\n');
  write(path.join(wt, '.git'), `gitdir: ${path.join(repo, '.git', 'worktrees', 'essai')}\n`);
  write(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agentSelected: 'a1',
    agents: [
      { ...AGENT, id: 'a1', name: 'projet', dir: repo },
      { ...AGENT, id: 'a2', name: 'essai', dir: wt, parent: { id: 'a1' } },
      { ...AGENT, id: 'a3', name: 'PR #12', dir: pr, temp: { parent: 'a1', pr: 12 } }, // ancien format
    ],
    agentFolders: [{ dir: repo, color: '#22c55e' }, { dir: wt, color: '#3b82f6' }, { dir: pr, color: '#22c55e' }],
  }));
});

async function icon() {
  const { state } = await import('app/state');
  const win = new fake.Win();
  state.icon = win as never;
  return { state, win, last: () => win.sent.filter(([ch]) => ch === 'agents:state').at(-1)?.[1] as AgentsState };
}

describe('robots par famille', () => {
  it('pushAgents : le parent et ses enfants, chacun sa pastille ; la fenêtre gagne la rangée d’enfants', async () => {
    const { state, win, last } = await icon();
    const { pushAgents } = await import('app/controllers');
    pushAgents();
    const [a1] = last().agents!;
    expect(last().agents).toHaveLength(1);
    expect(a1).toMatchObject({ id: 'a1', badge: 'master', selected: true });
    expect(a1.children.map((c) => [c.id, c.badge, c.children])).toEqual([['a2', 'feat/essai', []], ['a3', 'PR #12', []]]);
    expect(a1.children.map((c) => c.color)).toEqual([a1.color, a1.color]); // de la couleur du parent
    expect(state.childRow).toBe(true);
    expect(state.agentSlots).toBe(2);
    const tall = win.bounds.height;
    const { removeAgent } = await import('app/controllers');
    removeAgent('a2');
    removeAgent('a3');
    expect(state.childRow).toBe(false);
    expect(win.bounds.height).toBeLessThan(tall);
  });

  it('removeAgent du parent : la sélection part, ses enfants restent avec leur parent, en robots ordinaires', async () => {
    const { last } = await icon();
    const { removeAgent } = await import('app/controllers');
    removeAgent('a1');
    const { loadConfig } = await import('app/settings');
    const cfg = loadConfig();
    expect(cfg.agentSelected).toBeNull();
    expect(cfg.agents.map((a) => [a.id, a.parent ?? a.temp])).toEqual([['a2', { id: 'a1' }], ['a3', { parent: 'a1', pr: 12 }]]);
    expect(cfg.agentFolders).toEqual([{ dir: repo, color: '#22c55e' }, { dir: wt, color: '#3b82f6' }, { dir: pr, color: '#22c55e' }]);
    expect(last().agents!.map((a) => [a.id, a.children.length])).toEqual([['a2', 0], ['a3', 0]]);
  });

  it('removeAgent d’un enfant : le dossier d’un robot de PR quitte les favoris, celui d’un enfant sans PR reste', async () => {
    await icon();
    const { removeAgent } = await import('app/controllers');
    removeAgent('a3');
    removeAgent('a2');
    removeAgent('inconnu');
    const { loadConfig } = await import('app/settings');
    expect(loadConfig().agents.map((a) => a.id)).toEqual(['a1']);
    expect(loadConfig().agentFolders).toEqual([{ dir: repo, color: '#22c55e' }, { dir: wt, color: '#3b82f6' }]);
  });
});
