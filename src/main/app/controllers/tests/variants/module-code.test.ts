// Variants de module-code (note 0.11.0) : le fichier suivi poussé à chaque
// changement (écriture directe ou par renommage), trop gros → text null, un
// seul suivi à la fois, Enregistrer refusé pour un texte invalide.
// Sur le vrai principal et un vrai dépôt git ; faux : Electron (fenêtres qui
// relèvent ce qu'on leur envoie) et le SDK de Claude Code (aucun tour).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  type Handler = (...a: unknown[]) => void;
  class Win {
    sent: [string, unknown][] = [];
    handlers = new Map<string, Handler[]>();
    visible = false;
    webContents = { send: (ch: string, payload?: unknown) => { this.sent.push([ch, payload]); }, on: () => {}, setWindowOpenHandler: () => {} };
    on(ev: string, fn: Handler) { this.handlers.set(ev, [...(this.handlers.get(ev) || []), fn]); return this; }
    once(ev: string, fn: Handler) { return this.on(ev, fn); }
    emit(ev: string) { for (const fn of this.handlers.get(ev) || []) fn(); }
    loadFile() {} setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} setResizable() {} setBounds() {}
    getBounds() { return { x: 500, y: 500, width: 64, height: 64 }; }
    isVisible() { return this.visible; } isDestroyed() { return false; } isMinimized() { return false; }
    show() { this.visible = true; } showInactive() { this.visible = true; } hide() { this.visible = false; }
    focus() { this.emit('focus'); } restore() {} minimize() { this.visible = false; }
  }
  return { Win, userData: '', windows: [] as InstanceType<typeof Win>[] };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: {}, dialog: {}, clipboard: {}, nativeImage: {},
}));
vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({ getSessionInfo: async () => null, getSessionMessages: async () => [], query: () => Object.assign((async function* run() {}()), {}) }),
}));
vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${process.cwd()}/resources/${name}`,
}));

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const settle = () => new Promise((r) => setTimeout(r, 300));
const HELLO = 'src/core/hello/index.ts';
const GREET = 'src/core/hello/greet.ts';
let dir = '';

const panel = () => fake.windows.at(-1)!;
const codes = () => panel().sent.filter(([ch]) => ch === 'conv:vibeCode').map(([, c]) => c as { id: string; text: string | null } | null);
const idOf = (rel: string) => {
  const view = panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as { modules: { files?: { id: string; path: string }[] }[] };
  return view.modules.flatMap((m) => m.files ?? []).find((f) => f.path === rel)!.id;
};

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  fake.windows = [];
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-module-code-v-')));
  dir = path.join(fake.userData, 'projet');
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  write(path.join(dir, HELLO), 'HELLO_MAIN');
  write(path.join(dir, GREET), 'GREET_MAIN');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  git(dir, 'checkout', '-q', '-b', 'feat/0.11.0-essai');
  write(path.join(dir, 'docs/tickets/feat/0.11.0-essai.md'), '# 0.11.0 — essai\n\n## Forme\n\n```\nsrc/core/hello    hello() · ne connaît pas : le DOM\n```\n');
  write(path.join(dir, HELLO), 'HELLO_TEXTE');
  write(path.join(dir, GREET), 'GREET_TEXTE');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'hello');
  write(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agents: [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'create', autonomy: 'guide', pr: null } }],
  }));
  const { state } = await import('app/state');
  const { openConversation } = await import('app/windows');
  const { panelReady } = await import('app/controllers');
  state.icon = new fake.Win() as never;
  openConversation('a1');
  fake.windows.at(-1)!.emit('ready-to-show');
  await panelReady();
  await settle();
});
afterEach(async () => { (await import('app/controllers')).followCode(null); vi.useRealTimers(); });

it('le fichier suivi est poussé à chaque changement, écrit directement ou par renommage', async () => {
  const { followCode } = await import('app/controllers');
  followCode(idOf(HELLO));
  write(path.join(dir, HELLO), 'HELLO_DIRECT');
  await settle();
  write(path.join(dir, 'src/core/hello/.tmp'), 'HELLO_RENOMME');
  fs.renameSync(path.join(dir, 'src/core/hello/.tmp'), path.join(dir, HELLO));
  await settle();
  const texts = codes().map((c) => c?.text);
  expect(texts[0]).toBe('HELLO_TEXTE');
  expect(texts).toContain('HELLO_DIRECT');
  expect(texts.at(-1)).toBe('HELLO_RENOMME');
});

it('suivre un autre fichier : l’ancien n’est plus lu', async () => {
  const { followCode } = await import('app/controllers');
  followCode(idOf(HELLO));
  followCode(idOf(GREET));
  write(path.join(dir, HELLO), 'HELLO_CHANGE');
  await settle();
  expect(JSON.stringify(codes())).not.toContain('HELLO_CHANGE');
  expect(codes().at(-1)).toMatchObject({ id: idOf(GREET), text: 'GREET_TEXTE' });
});

it('un fichier plus gros que READ_MAX : text null', async () => {
  const { followCode, READ_MAX } = await import('app/controllers');
  write(path.join(dir, HELLO), 'x'.repeat(READ_MAX + 1));
  followCode(idOf(HELLO));
  expect(codes().at(-1)).toMatchObject({ id: idOf(HELLO), text: null });
});

it('un id qui ne désigne rien : null poussé', async () => {
  const { followCode } = await import('app/controllers');
  followCode('m99/0');
  expect(codes().at(-1)).toBeNull();
});

it('Enregistrer : refusé pour un texte qui n’est pas une chaîne ou trop gros ; accepté sinon', async () => {
  const { followCode, saveCode, READ_MAX } = await import('app/controllers');
  followCode(idOf(HELLO));
  expect(saveCode(idOf(HELLO), 42).ok).toBe(false);
  expect(saveCode(idOf(HELLO), 'x'.repeat(READ_MAX + 1)).ok).toBe(false);
  expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_TEXTE');
  expect(saveCode(idOf(HELLO), 'HELLO_OK')).toEqual({ ok: true });
  expect(fs.readFileSync(path.join(dir, HELLO), 'utf8')).toBe('HELLO_OK');
});

it('Enregistrer : le fichier suivi supprimé n’est pas recréé', async () => {
  const { followCode, saveCode } = await import('app/controllers');
  followCode(idOf(HELLO));
  fs.rmSync(path.join(dir, HELLO));
  expect(saveCode(idOf(HELLO), 'HELLO_RECREE').ok).toBe(false);
  expect(fs.existsSync(path.join(dir, HELLO))).toBe(false);
});
