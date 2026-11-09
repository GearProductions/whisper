// Variants du fichier de découverte (note 0.15.0, docs/tickets/feat/0.15.0-socket-interface.md) :
// live.json est écrit au lancement et n'existe plus à la sortie de l'appli (F-116 ; la clause de
// SPEC I-43, rien de ce que l'appli a lancé ne survit à sa sortie, y est tenue). Le jeton jamais
// dans live.json : app/controllers/tests/invariants/socket-token.test.ts.
// Ne connaît pas : le socket que par live.json ; Electron, le SDK et Pocket TTS sont faux.
// Sur le vrai démarrage et la vraie sortie (app/lifecycle : start, puis les évènements
// before-quit et will-quit, dans l'ordre d'Electron), le vrai socket et le vrai disque, par le
// décor commun (app/tests/harness) ; faux : Electron (app relève ses gestionnaires d'évènements,
// une fenêtre qui ne charge rien), le SDK de Claude Code, Pocket TTS et l'emplacement des
// fichiers livrés.
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeAll, fakeClaude, fakeElectron, profile, repoResources, settle, writeConfig } from 'app/tests/harness';

// Les gestionnaires d'évènements posés sur app, par évènement.
const events = new Map<string, ((...a: unknown[]) => void)[]>();

const electron = fakeElectron({
  app: {
    getAppPath: () => process.cwd(), isPackaged: true, requestSingleInstanceLock: () => true, whenReady: () => Promise.resolve(),
    on: (ev: string, fn: (...a: unknown[]) => void) => { events.set(ev, [...(events.get(ev) || []), fn]); },
  },
  session: { defaultSession: { setPermissionRequestHandler: () => {}, setPermissionCheckHandler: () => {} } },
});
vi.mock('electron', () => electron.module);

// Claude Code : trouvé, aucun agent ne travaille.
const claude = fakeClaude();
vi.mock('technicals/claude', () => claude.module);

// Pocket TTS : rien à lancer ni à arrêter.
vi.mock('technicals/pocket-tts', async (original) => ({
  ...await original<typeof import('technicals/pocket-tts')>(),
  isInstalled: () => false, setDirs: () => {}, stop: () => {}, warmUp: () => {}, cancel: () => {},
}));

vi.mock('technicals/paths', () => repoResources());

let root = '';
const liveJson = () => path.join(root, 'live.json');
// Electron qui émet un évènement de app : chaque gestionnaire posé, dans l'ordre.
const emit = (ev: string, ...a: unknown[]) => { for (const fn of events.get(ev) || []) fn(...a); };
// La sortie telle qu'Electron la déroule : before-quit, puis will-quit.
function quit() {
  emit('before-quit', { preventDefault: () => {} });
  emit('will-quit', { preventDefault: () => {} });
}
// L'appli lancée, jusqu'à ce que live.json apparaisse (ou un délai).
async function launched() {
  const { start } = await import('app/lifecycle');
  start();
  for (let i = 0; i < 20 && !fs.existsSync(liveJson()); i++) await settle(100);
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé et la guérison du son ne tournent pas
  events.clear();
  root = profile('whisper-live-file-');
  writeConfig(root, []);
});
afterEach(closeAll);

describe('live.json ne survit pas à la sortie de l’appli', () => {
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
