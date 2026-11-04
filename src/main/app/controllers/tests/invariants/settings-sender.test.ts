// Invariant de la page des réglages (note 0.14.0,
// docs/tickets/feat/0.14.0-allegement-interface-settings.md, « Ce que ça ne
// doit pas faire ») : écouter la page des réglages ailleurs que par
// listenFrom, expéditeur vérifié (SPEC I-20). Le canal `settings` écrit la
// configuration : un message qui ne vient pas de la fenêtre du panneau
// n'écrit rien. Les listes de canaux : tests/invariants/bridges.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (écoute, contrôleurs, état, réglages sur disque) ;
// faux : Electron (ipcMain relève les gestionnaires posés, par canal), le SDK
// de Claude Code, whisper-cli et Pocket TTS (les faits que lit la page).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { slow } from '../slow';

const fake = vi.hoisted(() => {
  class Win {
    webContents = { send: () => {}, on: () => {}, setWindowOpenHandler: () => {} };
    on() { return this; } once() { return this; }
    isDestroyed() { return false; } isVisible() { return true; } isMinimized() { return false; } isFocused() { return true; }
    loadFile() {} show() {} hide() {} focus() {} restore() {} setBounds() {}
    getBounds() { return { x: 500, y: 500, width: 900, height: 700 }; }
  }
  return {
    Win, userData: '',
    // Les gestionnaires posés sur ipcMain, par canal.
    ipc: new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>(),
  };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData, getAppMetrics: () => [], getVersion: () => '0.0.0', quit: () => {} },
  BrowserWindow: fake.Win,
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  ipcMain: {
    on: (ch: string, fn: (e: { sender: unknown }, ...a: unknown[]) => unknown) => { fake.ipc.set(ch, fn); },
    handle: (ch: string, fn: (e: { sender: unknown }, ...a: unknown[]) => unknown) => { fake.ipc.set(ch, fn); },
  },
  Menu: { buildFromTemplate: () => ({ popup: () => {} }), setApplicationMenu: () => {} },
  Notification: class { static isSupported() { return false; } on() {} show() {} },
  shell: { openPath: async () => '', openExternal: async () => {}, showItemInFolder: () => {} },
  clipboard: {}, dialog: {}, nativeImage: {},
}));

// Claude Code : trouvé, aucun agent ne travaille.
vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({ getSessionInfo: async () => null, getSessionMessages: async () => [] }),
}));

// whisper : installé.
vi.mock('technicals/whisper-cli', async (original) => ({
  ...await original<typeof import('technicals/whisper-cli')>(),
  locateWhisper: () => ({ cli: '/whisper/whisper-cli', model: '/whisper/ggml-base.bin' }),
}));

// Pocket TTS : installé, ne lit rien.
vi.mock('technicals/pocket-tts', async (original) => ({
  ...await original<typeof import('technicals/pocket-tts')>(),
  isInstalled: () => true, speak: () => 1, warmUp: () => {}, cancel: () => {},
}));

vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${process.cwd()}/resources/${name}`,
}));

const settle = () => new Promise((r) => setTimeout(r, slow(200)));
const configFile = () => path.join(fake.userData, 'config.json');
// Un réglage que la page montre, à une valeur qu'elle peut écrire : la langue des agents en anglais.
const OP = { set: 'agentLang', value: 'en' };

beforeEach(() => {
  vi.resetModules();
  fake.ipc = new Map();
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-settings-sender-')));
  fs.writeFileSync(configFile(), JSON.stringify({ vibeLang: 'fr', agentLang: 'fr' }));
});

// Le principal écoute, la fenêtre du panneau ouverte.
async function listening() {
  const { registerIpc } = await import('app/ipc');
  const { state } = await import('app/state');
  const panel = new fake.Win();
  state.panel = panel as never;
  registerIpc();
  return panel;
}

describe('la page des réglages, écoutée par listenFrom, expéditeur vérifié (I-20)', () => {
  it('le canal settings est écouté', async () => {
    await listening();

    // Un gestionnaire est posé sur settings.
    expect(fake.ipc.has('settings')).toBe(true);
  });

  it('un message settings venu d’une autre fenêtre n’écrit rien', async () => {
    await listening();
    const other = new fake.Win();
    const before = fs.readFileSync(configFile(), 'utf8');

    const answer = await fake.ipc.get('settings')!({ sender: other.webContents }, OP);
    await settle();

    // Aucune réponse à une autre fenêtre.
    expect(answer).toBeUndefined();
    // config.json n'a pas changé.
    expect(fs.readFileSync(configFile(), 'utf8')).toBe(before);
  });

  it('témoin : le même message, venu du panneau, est écrit', async () => {
    const panel = await listening();
    const before = fs.readFileSync(configFile(), 'utf8');

    await fake.ipc.get('settings')!({ sender: panel.webContents }, OP);
    await settle();

    // config.json a changé : c'est bien l'expéditeur qui retenait l'autre message.
    expect(fs.readFileSync(configFile(), 'utf8')).not.toBe(before);
  });
});
