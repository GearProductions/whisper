// Variants de Relire dans un worktree (note 0.8.0, F-110) : l'état du worktree
// dans le relevé, Aller au robot et le départ du robot de PR (ici à l'ancien
// format `temp`) ; des familles d'agents (note 0.10.0) : un enfant sans PR
// reste, le rattachement par git (liens symboliques, `temp` réécrit en
// `parent`), les worktrees libres, Ouvrir un agent ici ; des worktrees (note
// 0.12.0) : le worktree de la PR prêt (prWorktreeReady), l'enfant d'une
// nouvelle demande (openChild), Retirer le worktree (removeWorktreeChild).
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, parcours) ; faux : Electron (fenêtres qui relèvent ce qu'on leur
// envoie, la boîte de dialogue qui répond `fake.answer`), le SDK de Claude
// Code (relève les messages et le dossier où ils partent ; le tour finit
// aussitôt) et la recette (removeWorktree répond `fake.removed`).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { VibeView } from 'shared/bridge';
import { slow } from '../slow';

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
  return { Win, userData: '', windows: [] as InstanceType<typeof Win>[], messages: [] as [string, unknown][], answer: 1, removed: { ok: true, line: '' } };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: {}, clipboard: {}, nativeImage: {},
  dialog: { showMessageBox: async () => ({ response: fake.answer }) },
}));

vi.mock('app/controllers/recipe', () => ({ removeWorktree: async () => fake.removed }));

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
const settle = () => new Promise((r) => setTimeout(r, slow(150)));
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
  fake.answer = 1;
  fake.removed = { ok: true, line: '' };
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
  it('sur le robot : son badge', async () => {
    const view = await open('a2');
    expect(view()!.worktree).toEqual({ state: 'robot', temp: true, dir: worktree });
  });

  it('Retirer le worktree, refusé par la recette : le robot et sa fiche restent', async () => {
    fake.removed = { ok: false, line: 'des modifications' };
    const { removeWorktreeChild } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    expect(await removeWorktreeChild(loadConfig().agents[1])).toEqual({ ok: false, line: 'des modifications' });
    expect(loadConfig().agents.map((a) => a.id)).toEqual(['a1', 'a2']);
    expect(fs.existsSync(card)).toBe(true);
  });

  it('Retirer le worktree du robot d’une PR : sa fiche part, le robot avec, son brouillon revient', async () => {
    await open('a2');
    const { draftVibe, removeWorktreeChild } = await import('app/controllers');
    const { loadConfig, vibeStore } = await import('app/settings');
    draftVibe({ add: { target: 'note', text: 'à revoir' } });
    expect(await removeWorktreeChild(loadConfig().agents[1])).toEqual({ ok: true, line: '' });
    expect(fs.existsSync(card)).toBe(false);
    expect(loadConfig().agents.map((a) => a.id)).toEqual(['a1']);
    expect(vibeStore().drafts.a1?.[12]).toEqual([{ id: expect.any(Number), target: 'note', text: 'à revoir' }]);
  });

  it('Retirer le worktree d’un enfant sans PR : il part, son dossier quitte les favoris, ses sorties partent, le panneau passe au parent', async () => {
    const { loadConfig, saveConfig, vibeOutDir } = await import('app/settings');
    saveConfig({ agents: loadConfig().agents.map((a) => (a.id === 'a2' ? { ...AGENT, id: 'a2', dir: worktree, parent: { id: 'a1' } } as never : a)) });
    await open('a2');
    const outB = vibeOutDir('a2');
    write(path.join(outB, 'note.md'), 'x');
    const { removeWorktreeChild } = await import('app/controllers');
    const { state } = await import('app/state');
    expect((await removeWorktreeChild(loadConfig().agents[1])).ok).toBe(true);
    const cfg = loadConfig();
    expect(cfg.agents.map((a) => a.id)).toEqual(['a1']);
    expect(cfg.agentFolders).toEqual([{ dir: repo, color: '#22c55e' }]);
    expect(fs.existsSync(outB)).toBe(false);
    expect(state.convView?.agentId).toBe('a1');
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

  it('un enfant sans PR reste au relevé : il ne part qu’à Retirer', async () => {
    const { loadConfig, saveConfig } = await import('app/settings');
    const { syncWorktrees } = await import('app/controllers');
    saveConfig({ agents: loadConfig().agents.map((a) => (a.id === 'a2' ? { ...AGENT, id: 'a2', dir: worktree, parent: { id: 'a1' } } as never : a)) });
    fs.rmSync(card);
    await syncWorktrees();
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

  it('l’état sur l’agent du dépôt : ouverte sans robot, en création (pr-worktree en cours), rien', async () => {
    const { worktreeState } = await import('app/controllers');
    const { loadConfig, saveConfig } = await import('app/settings');
    saveConfig({ agents: loadConfig().agents.filter((a) => a.id === 'a1') });
    const a1 = loadConfig().agents[0];
    expect(worktreeState(a1, 12, false)).toEqual({ state: 'open', temp: false, dir: worktree });
    fs.rmSync(card);
    expect(worktreeState(a1, 12, true)).toEqual({ state: 'creating', temp: false, dir: '' });
    expect(worktreeState(a1, 12, false)).toBeNull();   // la recette a fini sans worktree
    expect(worktreeState(a1, null, true)).toBeNull();
  });
});

describe('les artefacts d’un enfant retiré', () => {
  const left = () => JSON.parse(fs.readFileSync(path.join(fake.userData, 'artifacts-left.json'), 'utf8'));

  it('Retirer le worktree d’un enfant sans parent présent : ses artefacts restent, ses autres sorties partent', async () => {
    const { loadConfig, saveConfig, vibeOutDir } = await import('app/settings');
    saveConfig({ agents: loadConfig().agents.map((a) => (a.id === 'a2' ? { ...AGENT, id: 'a2', dir: worktree, parent: { id: 'gone' } } as never : a)) });
    const { removeWorktreeChild } = await import('app/controllers');
    const outB = vibeOutDir('a2');
    write(path.join(outB, 'artifacts', 'plan.md'), 'plan');
    write(path.join(outB, 'note.md'), 'x');
    await removeWorktreeChild(loadConfig().agents[1]);
    expect(fs.readFileSync(path.join(outB, 'artifacts', 'plan.md'), 'utf8')).toBe('plan');
    expect(fs.existsSync(path.join(outB, 'note.md'))).toBe(false);
    expect(Object.keys(left())).toEqual(['a2']);
  });

  it('Ouvrir un agent ici sur ce dossier : les artefacts laissés reviennent dans son artifacts/', async () => {
    const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });
    const root = fs.realpathSync.native(fake.userData);
    const real = path.join(root, 'g', 'projet');
    const wt = path.join(root, 'g', 'projet-wt');
    fs.mkdirSync(real, { recursive: true });
    git(real, 'init', '-q');
    git(real, 'commit', '-q', '--allow-empty', '-m', 'init');
    git(real, 'worktree', 'add', '-q', '-b', 'feat-y', wt);
    const { loadConfig, saveConfig, vibeOutDir } = await import('app/settings');
    saveConfig({ agents: [{ ...AGENT, id: 'a1', dir: real }] as never, agentFolders: [{ dir: real, color: '#ef4444' }, { dir: wt, color: '#22c55e' }] });
    write(path.join(root, 'vibecoder-out', 'gone', 'artifacts', 'plan.md'), 'plan');
    write(path.join(fake.userData, 'artifacts-left.json'), JSON.stringify({ gone: wt }));
    const { openChild } = await import('app/controllers');
    const child = await openChild(loadConfig().agents[0], wt, {});
    await settle();
    expect(fs.readFileSync(path.join(vibeOutDir(child!.id), 'artifacts', 'plan.md'), 'utf8')).toBe('plan');
    expect(left()).toEqual({});
  });
});

describe('les familles par git', () => {
  const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });
  let real = '';   // le dépôt, résolu
  let wt = '';     // son worktree, résolu
  let link = '';   // le même dossier par un lien symbolique (comme /home → /var/home)

  beforeEach(() => {
    const root = fs.realpathSync.native(fake.userData);
    real = path.join(root, 'g', 'projet');
    wt = path.join(root, 'g', 'projet-wt');
    fs.mkdirSync(real, { recursive: true });
    git(real, 'init', '-q');
    git(real, 'commit', '-q', '--allow-empty', '-m', 'init');
    git(real, 'worktree', 'add', '-q', '-b', 'feat-y', wt);
    link = path.join(root, 'lien');
    fs.symlinkSync(path.join(root, 'g'), link);
  });

  const config = async (agents: object[], agentFolders: object[] = []) => {
    const { saveConfig } = await import('app/settings');
    saveConfig({ agents: agents as never, agentFolders: agentFolders as never });
  };

  it('le rattachement : dossiers par un lien, l’ancien `temp` réécrit en `parent` (PR gardée), un sous-dossier jamais enfant', async () => {
    fs.mkdirSync(path.join(real, 'src'));
    write(path.join(outA, 'pr-3-worktree.json'), JSON.stringify({ dir: wt, branch: 'feat-y' }));   // le robot de PR garde sa fiche
    await config([
      { ...AGENT, id: 'a1', dir: path.join(link, 'projet') },
      { ...AGENT, id: 'a2', dir: path.join(link, 'projet-wt'), temp: { parent: 'a1', pr: 3 } },
      { ...AGENT, id: 'a3', dir: path.join(link, 'projet', 'src') },
    ]);
    const { syncFamilies } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    await syncFamilies();
    const [a1, a2, a3] = loadConfig().agents;
    expect(a1.parent).toBeUndefined();
    expect(a2.parent).toEqual({ id: 'a1', pr: 3 });
    expect(a2.temp).toBeUndefined();
    expect(a3.parent).toBeUndefined();
  });

  it('les worktrees libres : sans la copie principale ni un dossier qui a un agent (même par un lien)', async () => {
    await config([{ ...AGENT, id: 'a1', dir: path.join(link, 'projet') }]);
    const { freeWorktrees } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    expect((await freeWorktrees(loadConfig().agents[0]))?.free).toEqual([{ dir: wt, branch: 'feat-y' }]);
    await config([{ ...AGENT, id: 'a1', dir: path.join(link, 'projet') }, { ...AGENT, id: 'a2', dir: path.join(link, 'projet-wt') }]);
    expect((await freeWorktrees(loadConfig().agents[0]))?.free).toEqual([]);
  });

  it('les worktrees libres : null pour un agent hors de la racine de la copie principale', async () => {
    fs.mkdirSync(path.join(real, 'src'));
    await config([{ ...AGENT, id: 'a1', dir: path.join(real, 'src') }, { ...AGENT, id: 'a2', dir: wt }]);
    const { freeWorktrees } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    const [a1, a2] = loadConfig().agents;
    expect(await freeWorktrees(a1)).toBeNull();
    expect(await freeWorktrees(a2)).toBeNull();
  });

  it('Ouvrir un agent ici : l’enfant nommé par sa branche, de la couleur du parent (dossier déjà favori : pas de question)', async () => {
    await config([{ ...AGENT, id: 'a1', dir: real }], [{ dir: real, color: '#ef4444' }, { dir: wt, color: '#22c55e' }]);
    const { openHere } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    await openHere(loadConfig().agents[0], wt);
    const cfg = loadConfig();
    expect(cfg.agents[1]).toMatchObject({ dir: wt, name: 'feat-y', parent: { id: 'a1' } });
    expect(cfg.agents[1].parent).toEqual({ id: 'a1' });
    expect(cfg.agentFolders).toContainEqual({ dir: wt, color: '#ef4444' });
  });

  it('le worktree de la PR prêt : la fiche écrite par l’appli (pas à travers un lien), le robot « PR #3 » après la question', async () => {
    await config([{ ...AGENT, id: 'a1', dir: real }]);
    const target = path.join(fake.userData, 'cible.txt');
    write(target, 'intact');
    write(path.join(outA, 'pr-3.json'), '{}');
    fs.symlinkSync(target, path.join(outA, 'pr-3-worktree.json'));
    const { prWorktreeReady } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    await prWorktreeReady(loadConfig().agents[0], 3, wt, 'pr-3');
    expect(fs.readFileSync(target, 'utf8')).toBe('intact');
    expect(JSON.parse(fs.readFileSync(path.join(outA, 'pr-3-worktree.json'), 'utf8'))).toEqual({ dir: wt, branch: 'pr-3' });
    expect(loadConfig().agents[1]).toMatchObject({ dir: wt, name: 'PR #3', parent: { id: 'a1', pr: 3 } });
  });

  it('l’enfant d’une nouvelle demande : en Créer, le dossier résolu (donné par un lien), de la couleur du parent', async () => {
    await config([{ ...AGENT, id: 'a1', dir: real }], [{ dir: real, color: '#ef4444' }, { dir: wt, color: '#22c55e' }]);
    const { openChild } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    const child = await openChild(loadConfig().agents[0], path.join(link, 'projet-wt'), { name: 'feat/y', create: true });
    expect(child).toMatchObject({ dir: wt, name: 'feat/y', parent: { id: 'a1' }, view: 'vibecoder', vibe: { flow: 'create', pr: null } });
    expect(loadConfig().agents[1]).toEqual(child);
    expect(loadConfig().agentFolders).toContainEqual({ dir: wt, color: '#ef4444' });
  });

  it('l’enfant d’une nouvelle demande, question refusée : null, aucun enfant', async () => {
    fake.answer = 0;
    await config([{ ...AGENT, id: 'a1', dir: real }]);
    const { openChild } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    expect(await openChild(loadConfig().agents[0], wt, { name: 'feat/y', create: true })).toBeNull();
    expect(loadConfig().agents).toHaveLength(1);
  });
});
