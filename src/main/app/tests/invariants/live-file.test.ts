// Invariant du fichier de découverte (note 0.15.0, docs/tickets/feat/0.15.0-cli.md,
// « Ce que ça ne doit pas faire ») : laisser live.json après la sortie de
// l'appli (SPEC I-43 : rien de ce que l'appli a lancé ne survit à sa sortie) ;
// live.json porte désormais le jeton extérieur quand le réglage « Autoriser les
// agents extérieurs » est activé : à la sortie, ce jeton n'est plus nulle part
// sur le disque. Le même comportement, réglage désactivé, en variant :
// app/tests/variants/live-file.test.ts. Les jetons pendant que l'appli tourne :
// app/controllers/tests/invariants/agent-tokens.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai démarrage et la vraie sortie (app/lifecycle : start, puis les
// évènements before-quit et will-quit, dans l'ordre d'Electron), le vrai socket
// et le vrai disque, par le décor commun (app/tests/harness) ; faux : Electron
// (app relève ses gestionnaires d'évènements, une fenêtre qui ne charge rien),
// le SDK de Claude Code, Pocket TTS et l'emplacement des fichiers livrés.
import fs from 'node:fs';
import os from 'node:os';
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
// Les fichiers sous un dossier qui portent un texte (liens non suivis) ; un
// fichier effacé pendant la lecture (un autre test, dans le dossier temporaire) est passé.
function holding(from: string, text: string): string[] {
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(from, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap((e) => {
    const p = path.join(from, e.name);
    if (e.isDirectory()) return holding(p, text);
    try { return e.isFile() && fs.readFileSync(p, 'latin1').includes(text) ? [p] : []; } catch { return []; }
  });
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé et la guérison du son ne tournent pas
  events.clear();
  root = profile('whisper-live-file-inv-');
});
afterEach(closeAll);

describe('live.json ne survit pas à la sortie de l’appli', () => {
  // L'appli s'arrête juste après will-quit : rien d'asynchrone n'aurait le temps de finir.
  it('quittée : live.json n’existe plus dès la fin des évènements de sortie', async () => {
    writeConfig(root, []);
    await launched();
    // témoin : il existait avant de quitter
    expect(fs.existsSync(liveJson())).toBe(true);

    quit();

    // il est supprimé, sans rien attendre
    expect(fs.existsSync(liveJson())).toBe(false);
  });

  it('réglage activé, quittée : le jeton extérieur n’est plus sur le disque, live.json compris', async () => {
    writeConfig(root, [], { outsideAgents: true });
    await launched();
    const outside = (JSON.parse(fs.readFileSync(liveJson(), 'utf8')) as { token?: string }).token;
    // témoin : réglage activé, live.json portait un jeton
    expect(outside).toBeTruthy();

    quit();

    // aucun fichier du dossier temporaire (dont le dossier de l'appli) ne porte le jeton extérieur
    expect(holding(os.tmpdir(), outside!)).toEqual([]);
  });
});
