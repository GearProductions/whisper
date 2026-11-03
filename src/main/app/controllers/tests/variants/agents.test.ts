// Variants des familles côté robots (note 0.10.0) : pushAgents envoie à l'icône chaque
// parent avec ses enfants et leur pastille (branche lue dans .git, ou « PR #n »),
// la fenêtre suit la rangée d'enfants ; removeAgent (synchrone) oublie l'agent, le dossier
// d'un robot de PR, et laisse leur parent aux enfants. Le signal des courses
// sur le robot (note fix/0.11.0-vibecoder-invariants-existants-et-courses) :
// l'état du robot par-dessus sa conversation au repos ; showAgent (id vérifié) ;
// la liste du sélecteur envoyée au panneau, et la notification du système (0.14.0).
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque) ; faux : Electron (fenêtres qui relèvent ce qu'on leur envoie), le signal
// des courses de chaque agent (runSignalOf, variants dans runs.test.ts).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentsState, IconAgentsState } from 'shared/bridge';

const fake = vi.hoisted(() => {
  class Win {
    sent: [string, unknown][] = [];
    bounds = { x: 500, y: 500, width: 64, height: 64 };
    webContents = { send: (ch: string, payload?: unknown) => { this.sent.push([ch, payload]); }, on: () => {} };
    on() { return this; } once() { return this; }
    getBounds() { return this.bounds; } setBounds(b: typeof this.bounds) { this.bounds = b; }
    focused = false;
    isFocused() { return this.focused; }
    isVisible() { return false; } isDestroyed() { return false; } isMinimized() { return false; }
    setResizable() {} show() {} focus() {} hide() {} showInactive() {}
  }
  class Notif {
    static shown: Notif[] = [];
    handlers: Record<string, () => void> = {};
    constructor(public opts: { title: string; body: string }) {}
    static isSupported() { return true; }
    on(ev: string, fn: () => void) { this.handlers[ev] = fn; }
    show() { Notif.shown.push(this); }
  }
  return { Win, Notif, userData: '', signals: {} as Record<string, string> };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: fake.Win,
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  Notification: fake.Notif,
  shell: {}, dialog: {}, clipboard: {}, nativeImage: {},
}));

vi.mock('app/controllers/runs', async (orig) => ({
  ...(await orig<object>()), runSignalOf: (id: string) => fake.signals[id] ?? null,
}));

const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const AGENT = { model: '', effort: '', mode: 'default', sessionId: null };
let repo = '';
let wt = '';
let pr = '';

beforeEach(() => {
  vi.resetModules();
  fake.signals = {};
  fake.Notif.shown = [];
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
  return { state, win, last: () => win.sent.filter(([ch]) => ch === 'agents:state').at(-1)?.[1] as IconAgentsState };
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
    expect(state.agentSlots).toBe(3); // deux enfants, une place chacun ; « + »
    const tall = win.bounds.height;
    const { removeAgent } = await import('app/controllers');
    await removeAgent('a2');
    await removeAgent('a3');
    expect(state.childRow).toBe(false);
    expect(win.bounds.height).toBeLessThan(tall);
  });

  it('removeAgent du parent : la sélection part, ses enfants restent avec leur parent, en robots ordinaires', async () => {
    const { last } = await icon();
    const { removeAgent } = await import('app/controllers');
    await removeAgent('a1');
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
    await removeAgent('a3');
    await removeAgent('a2');
    await removeAgent('inconnu');
    const { loadConfig } = await import('app/settings');
    expect(loadConfig().agents.map((a) => a.id)).toEqual(['a1']);
    expect(loadConfig().agentFolders).toEqual([{ dir: repo, color: '#22c55e' }, { dir: wt, color: '#3b82f6' }]);
  });
});

describe('le signal des courses sur le robot', () => {
  it('par-dessus une conversation au repos : asking → « ? », failed → erreur, done → pastille ; le signal suit', async () => {
    fake.signals = { a1: 'done', a2: 'asking', a3: 'failed' };
    const { last } = await icon();
    const { pushAgents } = await import('app/controllers');
    pushAgents();
    const [a1] = last().agents!;
    expect([a1, ...a1.children].map((a) => [a.id, a.status, a.unread, a.signal])).toEqual([
      ['a1', 'idle', true, 'done'], ['a2', 'asking', false, 'asking'], ['a3', 'error', false, 'failed'],
    ]);
  });

  it.each(['asking', 'done', 'failed'])('showAgent : une course %s, le panneau montre le robot', async (signal) => {
    fake.signals = { a2: signal };
    const { state } = await icon();
    state.panel = new fake.Win() as never;
    const { showAgent } = await import('app/controllers');
    showAgent('a2');
    expect(state.convView?.agentId).toBe('a2');
  });

  it('showAgent : un id inconnu (ou qui n’est pas un id) est ignoré', async () => {
    const { state } = await icon();
    state.panel = new fake.Win() as never;
    const { showAgent } = await import('app/controllers');
    showAgent('inconnu'); showAgent({ dir: '/etc' }); showAgent(undefined);
    expect(state.convView).toBeFalsy();
  });
});

describe('la liste du panneau', () => {
  async function panel() {
    const { state } = await import('app/state');
    const win = new fake.Win();
    state.panel = win as never;
    const { pushAgents } = await import('app/controllers');
    return { state, win, pushAgents, last: () => win.sent.filter(([ch]) => ch === 'agents:state').at(-1)?.[1] as AgentsState };
  }

  it('pushAgents : sans icône, le panneau reçoit la liste (famille), l’affiché et les événements', async () => {
    const { win, pushAgents, last, state } = await panel();
    state.convView = { agentId: 'a2', sessionId: null };
    pushAgents();
    expect(last().shown).toBe('a2');
    expect(last().events).toEqual([]);
    expect(last().agents.map((a) => [a.id, a.title, a.branch, a.parent, a.activity])).toEqual([
      ['a1', 'main', 'master', null, 'idle'], ['a2', 'worktree', 'feat/essai', 'a1', 'idle'], ['a3', 'pr', null, 'a1', 'idle'],
    ]);
    expect(win.sent.some(([ch]) => ch === 'agents:state')).toBe(true);
  });

  it('un autre agent échoue, fenêtre sans le focus : événement au panneau et notification du système ; le clic le montre', async () => {
    const { state, pushAgents, last } = await panel();
    state.convView = { agentId: 'a1', sessionId: null };
    pushAgents();
    fake.signals = { a2: 'failed', a1: 'failed' }; // l'affiché ne produit pas d'événement
    pushAgents();
    expect(last().events).toMatchObject([{ agentId: 'a2', kind: 'error' }]);
    expect(fake.Notif.shown.map((n) => n.opts)).toEqual([{ title: 'essai', body: 'a échoué' }]);
    fake.Notif.shown[0].handlers.click();
    expect(state.convView?.agentId).toBe('a2');
  });

  it('fenêtre qui a le focus : l’événement part au panneau, pas de notification', async () => {
    const { state, win, pushAgents, last } = await panel();
    state.convView = { agentId: 'a1', sessionId: null };
    win.focused = true;
    pushAgents();
    fake.signals = { a2: 'asking' };
    pushAgents();
    expect(last().events).toMatchObject([{ agentId: 'a2', kind: 'asking' }]);
    expect(fake.Notif.shown).toEqual([]);
  });

  it('une fin (done) ne vaut pas de notification du système', async () => {
    const { state, pushAgents, last } = await panel();
    state.convView = { agentId: 'a1', sessionId: null };
    pushAgents();
    fake.signals = { a2: 'done' };
    pushAgents();
    expect(last().events).toMatchObject([{ agentId: 'a2', kind: 'done' }]);
    expect(fake.Notif.shown).toEqual([]);
  });
});

describe('la consigne de la conversation', () => {
  it('launchOptions : la consigne audio, puis la ligne du questionnaire avec le dossier de sorties de l’agent', async () => {
    const { launchOptions } = await import('app/controllers');
    const { loadConfig, vibeOutDir } = await import('app/settings');
    const cfg = loadConfig();
    const { instructions } = launchOptions(cfg.agents![0] as never, cfg);
    expect(instructions).toContain('<audio>');
    expect(instructions).toContain(`${vibeOutDir('a1')}/questions.md`);
    expect(instructions.indexOf('<audio>')).toBeLessThan(instructions.indexOf('questions.md'));
  });

  it('launchOptions : les sorties de l’agent, puis le dossier d’artefacts de son projet', async () => {
    const { launchOptions, projectArtifactsPath } = await import('app/controllers');
    const { loadConfig, vibeOutDir } = await import('app/settings');
    const cfg = loadConfig();
    expect(launchOptions(cfg.agents![1] as never, cfg).dirs).toEqual([vibeOutDir('a2'), projectArtifactsPath(wt)]);
  });
});
