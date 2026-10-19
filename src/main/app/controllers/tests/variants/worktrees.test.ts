// Variants de Relire dans un worktree (note 0.8.0, F-110) : l'état du worktree
// dans le relevé, Aller au robot, Décharger (à l'agent du dépôt) et le départ
// du robot temporaire.
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, parcours) ; faux : Electron (fenêtres qui relèvent ce qu'on leur
// envoie) et le SDK de Claude Code (relève les messages et le dossier où ils
// partent ; le tour finit aussitôt).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VibeView } from 'shared/bridge';

const fake = vi.hoisted(() => {
  type Handler = (...a: unknown[]) => void;
  class Win {
    sent: [string, unknown][] = [];
    handlers = new Map<string, Handler[]>();
    visible = false;
    webContents = {
      send: (ch: string, payload?: unknown) => { this.sent.push([ch, payload]); },
      on: () => {}, setWindowOpenHandler: () => {},
    };
    on(ev: string, fn: Handler) { this.handlers.set(ev, [...(this.handlers.get(ev) || []), fn]); return this; }
    once(ev: string, fn: Handler) { return this.on(ev, fn); }
    emit(ev: string) { for (const fn of this.handlers.get(ev) || []) fn(); }
    loadFile() {} setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} setResizable() {} setBounds() {}
    getBounds() { return { x: 500, y: 500, width: 64, height: 64 }; }
    isVisible() { return this.visible; } isDestroyed() { return false; } isMinimized() { return false; }
    show() { this.visible = true; } showInactive() { this.visible = true; } hide() { this.visible = false; }
    focus() { this.emit('focus'); } restore() {} minimize() { this.visible = false; }
  }
  return { Win, userData: '', windows: [] as InstanceType<typeof Win>[], messages: [] as [string, unknown][] };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: {}, dialog: {}, clipboard: {}, nativeImage: {},
}));

vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt, options }: { prompt: AsyncIterable<{ message: { content: unknown } }>; options: { cwd: string } }) => Object.assign((async function* run() {
      for await (const m of prompt) {
        fake.messages.push([options.cwd, m.message.content]);
        yield { type: 'result', subtype: 'success', is_error: false, result: 'ok' };
      }
    }()), { setPermissionMode: async () => {}, setModel: async () => {}, interrupt: async () => {} }),
  }),
}));

vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${process.cwd()}/resources/${name}`,
}));

const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const settle = () => new Promise((r) => setTimeout(r, 150));
let repo = '';
let worktree = '';
let outA = '';
let card = '';

const AGENT = { name: 'projet', model: '', effort: '', mode: 'default', sessionId: null, view: 'vibecoder' };
const ROBOT = { ...AGENT, id: 'a2', name: 'PR #12', vibe: { flow: 'review', autonomy: 'guide', pr: 12 }, temp: { parent: 'a1', pr: 12 } };

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  fake.windows = [];
  fake.messages = [];
  fake.userData = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-worktrees-'));
  repo = path.join(fake.userData, 'projet');
  worktree = path.join(fake.userData, 'projet-worktrees', 'pr-12');
  fs.mkdirSync(repo, { recursive: true });
  fs.mkdirSync(worktree, { recursive: true });
  outA = path.join(fake.userData, 'vibecoder-out', 'a1');
  card = path.join(outA, 'pr-12-worktree.json');
  write(path.join(outA, 'pr-12.json'), JSON.stringify({ number: 12, title: 'Essai', state: 'OPEN' }));
  write(card, JSON.stringify({ dir: worktree, branch: 'pr-12' }));
  write(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agents: [{ ...AGENT, id: 'a1', dir: repo, vibe: { flow: 'review', autonomy: 'guide', pr: 12 } }, { ...ROBOT, dir: worktree }],
    agentFolders: [{ dir: repo, color: '#22c55e' }, { dir: worktree, color: '#22c55e' }],
  }));
});
afterEach(() => { vi.useRealTimers(); });

// Le panneau ouvert sur un agent, la page prête : ses relevés reçus.
async function open(id: string) {
  const { state } = await import('app/state');
  const { openConversation } = await import('app/windows');
  const { panelReady } = await import('app/controllers');
  state.icon = new fake.Win() as never;
  openConversation(id);
  const panel = fake.windows.at(-1)!;
  panel.emit('ready-to-show');
  await panelReady();
  await settle();
  return () => panel.sent.filter(([ch]) => ch === 'conv:vibe').at(-1)?.[1] as VibeView | null;
}

describe('Relire dans un worktree', () => {
  it('sur le robot : son badge, et Décharger part à l’agent du dépôt, avec ses sorties', async () => {
    const view = await open('a2');
    expect(view()!.worktree).toEqual({ state: 'robot', temp: true, dir: worktree });
    const { runVibeAction } = await import('app/controllers');
    expect(runVibeAction('unload-worktree', {})).toEqual({ ok: true });
    await settle();
    expect(fake.messages).toEqual([
      [repo, `/vibecoder:retirer-worktree fr ${outA} 12`],
      [repo, expect.stringMatching(/^VibeCoder : « .* » terminée/)],   // l'avis de fin, à la conversation de l'agent du dépôt
    ]);
  });

  it('la fiche partie : le robot part, son dossier quitte les favoris, son brouillon revient, le panneau passe à l’agent du dépôt', async () => {
    await open('a2');
    const { draftVibe, syncWorktrees } = await import('app/controllers');
    draftVibe({ add: { target: 'note', text: 'à revoir' } });
    fs.rmSync(card);
    await syncWorktrees();
    const { loadConfig, vibeStore } = await import('app/settings');
    const { state } = await import('app/state');
    const cfg = loadConfig();
    expect(cfg.agents.map((a) => a.id)).toEqual(['a1']);
    expect(cfg.agentFolders).toEqual([{ dir: repo, color: '#22c55e' }]);
    expect(vibeStore().drafts.a1?.[12]).toEqual([{ id: expect.any(Number), target: 'note', text: 'à revoir' }]);
    expect(state.convView?.agentId).toBe('a1');
  });

  it('la fiche là : le robot reste', async () => {
    await open('a2');
    const { syncWorktrees } = await import('app/controllers');
    await syncWorktrees();
    const { loadConfig } = await import('app/settings');
    expect(loadConfig().agents.map((a) => a.id)).toEqual(['a1', 'a2']);
  });

  it('sur l’agent du dépôt : son robot là, Aller au robot l’affiche', async () => {
    const view = await open('a1');
    expect(view()!.worktree).toEqual({ state: 'robot', temp: false, dir: worktree });
    const { setVibe } = await import('app/controllers');
    const { state } = await import('app/state');
    setVibe({ worktree: true });
    expect(state.convView?.agentId).toBe('a2');
  });

  it('l’état sur l’agent du dépôt : en création (demandé, au travail), ouverte sans robot, rien', async () => {
    const { worktreeState, wantWorktree } = await import('app/controllers');
    const { loadConfig, saveConfig } = await import('app/settings');
    saveConfig({ agents: loadConfig().agents.filter((a) => a.id === 'a1') });
    const a1 = loadConfig().agents[0];
    expect(worktreeState(a1, 12, false)).toEqual({ state: 'open', temp: false, dir: worktree });
    fs.rmSync(card);
    expect(worktreeState(a1, 12, true)).toBeNull();
    wantWorktree('a1', 12);
    expect(worktreeState(a1, 12, true)).toEqual({ state: 'creating', temp: false, dir: '' });
    expect(worktreeState(a1, 12, false)).toBeNull();   // le tour a fini sans fiche
    expect(worktreeState(a1, null, true)).toBeNull();
  });
});
