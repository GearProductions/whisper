// Invariant de Relire dans un worktree (SPEC F-110, I-41, I-23) : le robot
// temporaire d'une PR ne naît que de la fiche que le skill worktree-pr a
// écrite dans les sorties de l'agent du dépôt, après une demande de l'écran,
// si son dossier existe et est la racine d'un worktree du même dépôt (autre
// que le dossier de l'agent), et seulement après la question de confiance
// acceptée. Aucune page ne donne le dossier.
// Protégé : si ce test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, réglages et fichiers sur disque, git
// réel sur des dépôts d'essai) ; faux : Electron (fenêtres, et la boîte de
// dialogue, qui relève ses questions et répond ce que le cas règle) et le SDK
// de Claude Code (le tour finit aussitôt, sans rien écrire).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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
  return { Win, userData: '', windows: [] as InstanceType<typeof Win>[], answer: 0, asked: [] as { title: string; detail: string }[] };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: {}, clipboard: {}, nativeImage: {},
  dialog: { showMessageBox: async (o: { title: string; detail: string }) => { fake.asked.push(o); return { response: fake.answer }; } },
}));

vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt }: { prompt: AsyncIterable<unknown> }) => Object.assign((async function* run() {
      for await (const _ of prompt) yield { type: 'result', subtype: 'success', is_error: false, result: 'ok' };
    }()), { setPermissionMode: async () => {}, setModel: async () => {}, interrupt: async () => {} }),
  }),
}));

vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${process.cwd()}/resources/${name}`,
}));

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const settle = () => new Promise((r) => setTimeout(r, 150));
let root = '';
let repo = '';
let worktree = '';
let out = '';

function newRepo(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  fake.windows = [];
  fake.asked = [];
  fake.answer = 1;
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-worktree-')));
  root = fake.userData;
  repo = path.join(root, 'projet');
  newRepo(repo);
  worktree = path.join(root, 'projet-worktrees', 'pr-7');
  git(repo, 'worktree', 'add', '-q', '-b', 'pr-7', worktree);
  out = path.join(root, 'vibecoder-out', 'a1');
  write(path.join(out, 'pr-7.json'), JSON.stringify({ number: 7, title: 'Essai', base: 'main', head: 'feat/x', state: 'OPEN' }));
  write(path.join(root, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agents: [{ id: 'a1', dir: repo, name: 'projet', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'review', autonomy: 'guide', pr: 7 } }],
  }));
});
afterEach(() => { vi.useRealTimers(); });

const card = (dir: string, where = out) => write(path.join(where, 'pr-7-worktree.json'), JSON.stringify({ dir, branch: 'pr-7' }));
const agents = async () => (await import('app/settings')).loadConfig().agents;

// L'écran a demandé le worktree de la PR 7 à a1 ; la fiche est là (ou non) : un passage.
async function sync() {
  const { syncWorktrees, wantWorktree } = await import('app/controllers');
  wantWorktree('a1', 7);
  await syncWorktrees();
}

describe('le robot d’une PR dans un worktree', () => {
  it('jamais sans la question de confiance : Annuler → aucun robot', async () => {
    fake.answer = 0;
    card(worktree);
    await sync();
    expect(fake.asked).toHaveLength(1);
    expect(fake.asked[0].detail).toContain(worktree);
    expect(fake.asked[0].detail).toMatch(/PR #7.*\.claude|\.claude.*PR #7/s);   // les réglages de la PR se chargeront
    expect(await agents()).toHaveLength(1);
  });

  it('la question est posée même pour un dossier déjà favori', async () => {
    fake.answer = 0;
    write(path.join(root, 'config.json'), JSON.stringify({
      ...JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8')), agentFolders: [{ dir: worktree, color: '#22c55e' }],
    }));
    card(worktree);
    await sync();
    expect(fake.asked).toHaveLength(1);
    expect(await agents()).toHaveLength(1);
  });

  it('confiance accordée : le robot « PR #7 » sur ce worktree, rattaché à l’agent du dépôt', async () => {
    card(worktree);
    await sync();
    expect(fake.asked).toHaveLength(1);
    const list = await agents();
    expect(list).toHaveLength(2);
    expect(list[1]).toMatchObject({
      dir: worktree, name: 'PR #7', model: 'opus', effort: 'high', mode: 'default', view: 'vibecoder',
      vibe: { flow: 'review', autonomy: 'guide', pr: 7 }, temp: { parent: 'a1', pr: 7 },
    });
  });

  it.each([
    ['un dossier qui n’existe pas', () => path.join(root, 'nulle-part')],
    ['un autre dépôt', () => { const other = path.join(root, 'autre'); newRepo(other); return other; }],
    ['le dossier de l’agent du dépôt', () => repo],
    ['un sous-dossier du dépôt', () => { fs.mkdirSync(path.join(repo, 'src')); return path.join(repo, 'src'); }],
    ['un sous-dossier du worktree', () => { fs.mkdirSync(path.join(worktree, 'src')); return path.join(worktree, 'src'); }],
    ['un fichier du worktree', () => { write(path.join(worktree, 'a.txt'), 'a'); return path.join(worktree, 'a.txt'); }],
    ['un dossier hors de tout dépôt', () => { fs.mkdirSync(path.join(root, 'vide')); return path.join(root, 'vide'); }],
    ['un chemin relatif', () => 'projet-worktrees/pr-7'],
  ])('%s : ni question, ni robot', async (_, dir) => {
    card(dir());
    await sync();
    expect(fake.asked).toEqual([]);
    expect(await agents()).toHaveLength(1);
  });

  it('seulement la fiche des sorties de cet agent : celle d’un autre dossier de sorties, ou un lien, ne compte pas', async () => {
    card(worktree, path.join(root, 'vibecoder-out', 'a2'));
    await sync();
    write(path.join(root, 'ailleurs.json'), JSON.stringify({ dir: worktree }));
    fs.symlinkSync(path.join(root, 'ailleurs.json'), path.join(out, 'pr-7-worktree.json'));
    await sync();
    expect(fake.asked).toEqual([]);
    expect(await agents()).toHaveLength(1);
  });

  it('sans demande de l’écran, la fiche seule ne fait rien', async () => {
    card(worktree);
    const { syncWorktrees } = await import('app/controllers');
    await syncWorktrees();
    expect(fake.asked).toEqual([]);
    expect(await agents()).toHaveLength(1);
  });

  it('une page ne donne jamais le dossier : un chemin dans un réglage ou dans les arguments d’une action est ignoré', async () => {
    const { state } = await import('app/state');
    const { openConversation } = await import('app/windows');
    const { panelReady, runVibeAction, setVibe, syncWorktrees } = await import('app/controllers');
    state.icon = new fake.Win() as never;
    openConversation('a1');
    const panel = fake.windows.at(-1)!;
    panel.emit('ready-to-show');
    await panelReady();
    await settle();
    setVibe({ worktree: worktree });
    setVibe({ worktree: true, dir: worktree });
    runVibeAction('open-worktree', { dir: worktree, pr: 7 });
    await settle();
    await syncWorktrees();
    expect(fake.asked).toEqual([]);
    expect(await agents()).toHaveLength(1);
  });
});
