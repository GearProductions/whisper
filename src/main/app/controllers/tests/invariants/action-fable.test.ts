// Invariant du coût (note 0.14.0,
// docs/tickets/feat/0.14.0-allegement-interface-settings.md, « Ce que ça ne
// doit pas faire ») : faire travailler Fable par le choix d'une action, même
// écrit à la main dans config.json (SPEC I-36). La page n'écrit jamais Fable
// (settings-patch.test.ts) ; ici, la lecture : un choix « fable » glissé à la
// main dans actionModels ne part pas chez l'agent.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages sur disque, git
// réel sur un dépôt d'essai, les actions et skills livrés dans resources/) ;
// faux : Electron (fenêtres qui relèvent ce qu'on leur envoie), le SDK de
// Claude Code (chaque message, les options de chaque session et chaque
// changement de modèle sont relevés).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Les boutons de l'écran passent par le socket (0.15.0) : ouvert comme au lancement, fermé après chaque cas.
let closeSocket = () => {};
import { slow } from '../slow';

const fake = vi.hoisted(() => {
  type Handler = (...a: unknown[]) => void;
  class Win {
    handlers = new Map<string, Handler[]>();
    visible = false;
    webContents = { send: () => {}, on: () => {}, setWindowOpenHandler: () => {} };
    on(ev: string, fn: Handler) { this.handlers.set(ev, [...(this.handlers.get(ev) || []), fn]); return this; }
    once(ev: string, fn: Handler) { return this.on(ev, fn); }
    emit(ev: string) { for (const fn of this.handlers.get(ev) || []) fn(); }
    loadFile() {} setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} setResizable() {} setBounds() {}
    getBounds() { return { x: 500, y: 500, width: 900, height: 700 }; }
    isVisible() { return this.visible; } isDestroyed() { return false; } isMinimized() { return false; }
    isFocused() { return this.visible; }
    show() { this.visible = true; } showInactive() { this.visible = true; } hide() { this.visible = false; }
    focus() { this.emit('focus'); } restore() {} minimize() { this.visible = false; }
  }
  return {
    Win, userData: '', windows: [] as InstanceType<typeof Win>[],
    // Tout ce que le SDK a reçu : chaque message, les options de chaque session, chaque setModel.
    toSdk: [] as unknown[],
  };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData, getAppMetrics: () => [], getVersion: () => '0.0.0' },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  ipcMain: { on: () => {}, handle: () => {} },
  Menu: { buildFromTemplate: () => ({ popup: () => {} }), setApplicationMenu: () => {} },
  Notification: class { static isSupported() { return false; } on() {} show() {} },
  clipboard: {}, shell: {}, dialog: {}, nativeImage: {},
}));

// Claude Code : les options de la session, chaque message et chaque changement de modèle sont relevés.
vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt, options }: { prompt: AsyncIterable<{ message: { content: unknown } }>; options?: unknown }) => {
      fake.toSdk.push(options);
      return Object.assign((async function* run() {
        for await (const m of prompt) {
          fake.toSdk.push(m.message.content);
          yield { type: 'result', subtype: 'success', is_error: false };
        }
      }()), { setPermissionMode: async () => {}, setModel: async (m: unknown) => { fake.toSdk.push(m); }, interrupt: async () => {} });
    },
  }),
}));

// Les actions et les skills livrés.
vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${process.cwd()}/resources/${name}`,
}));

const settle = () => new Promise((r) => setTimeout(r, slow(200)));
const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });
// Ce que le SDK a reçu, en un texte.
const sent = () => JSON.stringify(fake.toSdk);

// Un agent en VibeCoder sur une branche dont la note est écrite ; config.json
// porte, écrit à la main, le choix d'une action : Fable.
function project(actionModels: Record<string, string>) {
  const dir = path.join(fake.userData, 'projet');
  fs.mkdirSync(path.join(dir, 'docs/tickets/feat'), { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
  git(dir, 'checkout', '-q', '-b', 'feat/0.14.0-essai');
  fs.writeFileSync(path.join(dir, 'docs/tickets/feat/0.14.0-essai.md'), '# 0.14.0 — essai\n\n## Ce que ça fait\n\n- un essai\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'note');
  fs.writeFileSync(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true, agentSelected: 'a1', actionModels,
    agents: [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'create', pr: null } }],
  }));
}

// Le panneau ouvert sur l'agent, en VibeCoder, son premier relevé reçu.
async function open() {
  const { openConversation } = await import('app/windows');
  const { panelReady, openSocket, commandFromSocket, closeSocket: close } = await import('app/controllers');
  await openSocket(commandFromSocket);
  closeSocket = close;
  openConversation('a1');
  fake.windows.at(-1)!.emit('ready-to-show');
  await panelReady();
  await settle();
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  fake.windows = [];
  fake.toSdk = [];
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-action-model-')));
});
afterEach(() => { closeSocket(); closeSocket = () => {}; vi.useRealTimers(); });

describe('jamais Fable par le choix d’une action, même écrit à la main dans config.json (I-36)', () => {
  it('la Forme, choisie sur Fable à la main, ne fait pas travailler Fable', async () => {
    project({ forme: 'fable' });
    await open();
    const { runVibeAction } = await import('app/controllers');

    runVibeAction('forme', { text: 'le texte du champ' });
    await settle();

    // L'action est bien partie (l'absence qui suit porte sur un envoi).
    expect(sent()).toContain('/vibecoder:forme');
    // Rien de ce que le SDK a reçu (message, session, changement de modèle) ne nomme Fable.
    expect(sent()).not.toMatch(/fable/i);
  });

  // Une action dont le skill fixe son modèle (opus) : celle dont la page propose le choix.
  it('une action au modèle fixé par son skill, choisie sur Fable à la main, ne fait pas travailler Fable', async () => {
    project({ invariants: 'fable' });
    await open();
    const { runVibeAction } = await import('app/controllers');

    runVibeAction('invariants', { text: 'le texte du champ' });
    await settle();

    // L'action est bien partie (l'absence qui suit porte sur un envoi).
    expect(sent()).toContain('/vibecoder:invariants');
    // Rien de ce que le SDK a reçu (message, session, changement de modèle) ne nomme Fable.
    expect(sent()).not.toMatch(/fable/i);
  });
});
