// Variants des agents : removeAgent (synchrone) oublie l'agent, le dossier d'un
// robot de PR, et laisse leur parent aux enfants. Le signal des courses
// (note fix/0.11.0-vibecoder-invariants-existants-et-courses) : l'état de
// l'agent par-dessus sa conversation au repos ; showAgent (id vérifié) ;
// la liste du sélecteur envoyée au panneau, et la notification du système (0.14.0).
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque) ; faux : Electron (fenêtres qui relèvent ce qu'on leur envoie), le signal
// des courses de chaque agent (runSignalOf, variants dans runs.test.ts).
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
    focused = false;
    isFocused() { return this.focused; }
    isVisible() { return false; } isDestroyed() { return false; } isMinimized() { return false; }
    minimized = false;
    minimize() { this.minimized = true; }
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
    agentSelected: 'a1',
    agents: [
      { ...AGENT, id: 'a1', name: 'projet', dir: repo },
      { ...AGENT, id: 'a2', name: 'essai', dir: wt, parent: { id: 'a1' } },
      { ...AGENT, id: 'a3', name: 'PR #12', dir: pr, temp: { parent: 'a1', pr: 12 } }, // ancien format
    ],
    agentFolders: [{ dir: repo, color: '#22c55e' }, { dir: wt, color: '#3b82f6' }, { dir: pr, color: '#22c55e' }],
  }));
});

describe('removeAgent', () => {
  it('removeAgent du parent : la sélection part, ses enfants restent avec leur parent, en agents ordinaires', async () => {
    const { removeAgent } = await import('app/controllers');
    await removeAgent('a1');
    const { loadConfig } = await import('app/settings');
    const cfg = loadConfig();
    expect(cfg.agentSelected).toBeNull();
    expect(cfg.agents.map((a) => [a.id, a.parent ?? a.temp])).toEqual([['a2', { id: 'a1' }], ['a3', { parent: 'a1', pr: 12 }]]);
    expect(cfg.agentFolders).toEqual([{ dir: repo, color: '#22c55e' }, { dir: wt, color: '#3b82f6' }, { dir: pr, color: '#22c55e' }]);
  });

  it('removeAgent d’un enfant : le dossier d’un agent de PR quitte les favoris, celui d’un enfant sans PR reste', async () => {
    const { removeAgent } = await import('app/controllers');
    await removeAgent('a3');
    await removeAgent('a2');
    await removeAgent('inconnu');
    const { loadConfig } = await import('app/settings');
    expect(loadConfig().agents.map((a) => a.id)).toEqual(['a1']);
    expect(loadConfig().agentFolders).toEqual([{ dir: repo, color: '#22c55e' }, { dir: wt, color: '#3b82f6' }]);
  });
});

describe('showAgent', () => {
  it.each(['asking', 'done', 'failed'])('showAgent : une course %s, le panneau montre l’agent', async (signal) => {
    fake.signals = { a2: signal };
    const { state } = await import('app/state');
    state.panel = new fake.Win() as never;
    const { showAgent } = await import('app/controllers');
    showAgent('a2');
    expect(state.convView?.agentId).toBe('a2');
  });

  it('showAgent : un id inconnu (ou qui n’est pas un id) est ignoré', async () => {
    const { state } = await import('app/state');
    state.panel = new fake.Win() as never;
    const { showAgent } = await import('app/controllers');
    showAgent('inconnu'); showAgent({ dir: '/etc' }); showAgent(undefined);
    expect(state.convView).toBeFalsy();
  });
});

describe('l’agent affiché retiré', () => {
  it('le premier qui reste prend sa place et devient l’agent retenu ; plus aucun : l’accueil, la fenêtre n’est jamais réduite', async () => {
    const { state } = await import('app/state');
    const win = new fake.Win();
    state.panel = win as never;
    const { removeAgent, showAgent } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    const shown = () => win.sent.filter(([ch]) => ch === 'agents:state').at(-1)?.[1] as AgentsState;
    showAgent('a1');
    removeAgent('a1');
    expect(state.convView?.agentId).toBe('a2');
    expect(loadConfig().agentSelected).toBe('a2');
    expect(shown().shown).toBe('a2');
    removeAgent('a3');   // un autre : l’affiché ne bouge pas
    expect(state.convView?.agentId).toBe('a2');
    removeAgent('a2');
    expect(state.convView).toBeNull();
    expect(shown()).toMatchObject({ shown: null, agents: [] });
    expect(win.minimized).toBe(false);
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

  it('pushAgents : le panneau reçoit la liste (famille) et l’affiché', async () => {
    const { win, pushAgents, last, state } = await panel();
    state.convView = { agentId: 'a2', sessionId: null };
    pushAgents();
    expect(last().shown).toBe('a2');
    expect(last().agents.map((a) => [a.id, a.title, a.branch, a.parent, a.activity])).toEqual([
      ['a1', 'main', 'master', null, 'idle'], ['a2', 'worktree', 'feat/essai', 'a1', 'idle'], ['a3', 'pr', null, 'a1', 'idle'],
    ]);
    expect(win.sent.some(([ch]) => ch === 'agents:state')).toBe(true);
  });

  it('un autre agent échoue, fenêtre sans le focus : notification du système ; le clic le montre', async () => {
    const { state, pushAgents } = await panel();
    state.convView = { agentId: 'a1', sessionId: null };
    pushAgents();
    fake.signals = { a2: 'failed', a1: 'failed' }; // l'affiché ne produit pas d'événement
    pushAgents();
    expect(fake.Notif.shown.map((n) => n.opts)).toEqual([{ title: 'essai', body: 'a échoué' }]);
    fake.Notif.shown[0].handlers.click();
    expect(state.convView?.agentId).toBe('a2');
  });

  it('fenêtre qui a le focus : pas de notification', async () => {
    const { state, win, pushAgents } = await panel();
    state.convView = { agentId: 'a1', sessionId: null };
    win.focused = true;
    pushAgents();
    fake.signals = { a2: 'asking' };
    pushAgents();
    expect(fake.Notif.shown).toEqual([]);
  });

  it('une fin (done) ne vaut pas de notification du système', async () => {
    const { state, pushAgents } = await panel();
    state.convView = { agentId: 'a1', sessionId: null };
    pushAgents();
    fake.signals = { a2: 'done' };
    pushAgents();
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
