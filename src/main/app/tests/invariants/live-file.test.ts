// Invariant du fichier de découverte (note 0.15.0,
// docs/tickets/feat/0.15.0-socket-interface.md, « Ce que ça ne doit pas
// faire ») : laisser live.json après la sortie de l'appli (SPEC I-43 : rien de
// ce que l'appli a lancé ne survit à sa sortie). Un live.json resté désignerait
// un port que plus rien n'écoute, ou qu'un autre programme a repris.
// Le jeton jamais dans live.json : app/controllers/tests/invariants/socket-token.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai démarrage et la vraie sortie (app/lifecycle : start, puis les
// évènements before-quit et will-quit, dans l'ordre d'Electron), le vrai
// socket et le vrai disque ; faux : Electron (app relève ses gestionnaires
// d'évènements, une fenêtre qui ne charge rien), le SDK de Claude Code,
// Pocket TTS et l'emplacement des fichiers livrés.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { slow } from '../../controllers/tests/slow';

const fake = vi.hoisted(() => {
  class Win {
    webContents = { send: () => {}, on: () => {}, once: () => {}, setWindowOpenHandler: () => {} };
    on() { return this; } once() { return this; }
    isDestroyed() { return false; } isVisible() { return true; } isMinimized() { return false; } isFocused() { return true; }
    loadFile() {} show() {} showInactive() {} hide() {} focus() {} restore() {} setBounds() {}
    getBounds() { return { x: 500, y: 500, width: 900, height: 700 }; }
  }
  return {
    Win, userData: '',
    // Les gestionnaires d'évènements posés sur app, par évènement.
    events: new Map<string, ((...a: unknown[]) => void)[]>(),
  };
});

vi.mock('electron', () => ({
  app: {
    getPath: () => fake.userData, getAppPath: () => process.cwd(), getAppMetrics: () => [], getVersion: () => '0.0.0',
    isPackaged: true, requestSingleInstanceLock: () => true, whenReady: () => Promise.resolve(), quit: () => {},
    on: (ev: string, fn: (...a: unknown[]) => void) => { fake.events.set(ev, [...(fake.events.get(ev) || []), fn]); },
  },
  session: { defaultSession: { setPermissionRequestHandler: () => {}, setPermissionCheckHandler: () => {} } },
  protocol: { registerSchemesAsPrivileged: () => {}, handle: () => {} },
  BrowserWindow: fake.Win,
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  ipcMain: { on: () => {}, handle: () => {} },
  Menu: { buildFromTemplate: () => ({ popup: () => {} }), setApplicationMenu: () => {} },
  Notification: class { static isSupported() { return false; } on() {} show() {} },
  shell: { openPath: async () => '', openExternal: async () => {}, showItemInFolder: () => {} },
  dialog: { showMessageBox: async () => ({ response: 0 }) }, clipboard: {}, nativeImage: {},
}));

// Claude Code : trouvé, aucun agent ne travaille.
vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({ getSessionInfo: async () => null, getSessionMessages: async () => [] }),
}));

// Pocket TTS : rien à lancer ni à arrêter.
vi.mock('technicals/pocket-tts', async (original) => ({
  ...await original<typeof import('technicals/pocket-tts')>(),
  isInstalled: () => false, setDirs: () => {}, stop: () => {}, warmUp: () => {}, cancel: () => {},
}));

vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${process.cwd()}/resources/${name}`,
}));

const liveJson = () => path.join(fake.userData, 'live.json');
// Electron qui émet un évènement de app : chaque gestionnaire posé, dans l'ordre.
const emit = (ev: string, ...a: unknown[]) => { for (const fn of fake.events.get(ev) || []) fn(...a); };
// La sortie telle qu'Electron la déroule : before-quit, puis will-quit.
function quit() {
  emit('before-quit', { preventDefault: () => {} });
  emit('will-quit', { preventDefault: () => {} });
}
// L'appli lancée, jusqu'à ce que live.json apparaisse (ou un délai).
async function launched() {
  const { start } = await import('app/lifecycle');
  start();
  for (let i = 0; i < 20 && !fs.existsSync(liveJson()); i++) await new Promise((r) => setTimeout(r, slow(100)));
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé et la guérison du son ne tournent pas
  fake.events = new Map();
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-live-file-')));
  fs.writeFileSync(path.join(fake.userData, 'config.json'), JSON.stringify({ agents: [] }));
});
afterEach(() => { vi.useRealTimers(); });

describe('live.json ne survit pas à la sortie de l’appli (I-43)', () => {
  it('témoin : au lancement, live.json est écrit dans le dossier de l’appli', async () => {
    await launched();

    // le fichier de découverte existe
    expect(fs.existsSync(liveJson())).toBe(true);
  });

  // L'appli s'arrête juste après will-quit : rien d'asynchrone n'aurait le temps de finir.
  it('quittée : live.json n’existe plus dès la fin des évènements de sortie', async () => {
    await launched();
    // témoin : il existait avant de quitter
    expect(fs.existsSync(liveJson())).toBe(true);

    quit();

    // il est supprimé, sans rien attendre
    expect(fs.existsSync(liveJson())).toBe(false);
  });
});
