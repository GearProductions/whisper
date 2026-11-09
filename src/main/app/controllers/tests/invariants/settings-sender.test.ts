// Invariant de la page des réglages (note 0.14.0,
// docs/tickets/feat/0.14.0-allegement-interface-settings.md, « Ce que ça ne
// doit pas faire ») : écouter la page des réglages ailleurs que par
// listenFrom, expéditeur vérifié (SPEC I-20). Le canal `settings` écrit la
// configuration : un message qui ne vient pas de la fenêtre du panneau
// n'écrit rien. Les listes de canaux : tests/invariants/bridges.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (écoute, contrôleurs, état, réglages sur disque), par le
// décor commun (app/tests/harness) ; faux : Electron (ipcMain relève les
// gestionnaires posés, par canal), le SDK de Claude Code, whisper-cli et Pocket
// TTS (les faits que lit la page).
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeClaude, fakeElectron, FakeWin, profile, repoResources, settle as wait, write } from 'app/tests/harness';

const electron = fakeElectron();
vi.mock('electron', () => electron.module);

// Claude Code : trouvé, aucun agent ne travaille.
const claude = fakeClaude();
vi.mock('technicals/claude', () => claude.module);

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

vi.mock('technicals/paths', () => repoResources());

let root = '';
const settle = () => wait(200);
const configFile = () => path.join(root, 'config.json');
// Un réglage que la page montre, à une valeur qu'elle peut écrire : la langue des agents en anglais.
const OP = { set: 'agentLang', value: 'en' };

beforeEach(() => {
  vi.resetModules();
  root = profile('whisper-settings-sender-');
  write(configFile(), JSON.stringify({ vibeLang: 'fr', agentLang: 'fr' }));
});

// Le principal écoute, la fenêtre du panneau ouverte.
async function listening() {
  const { registerIpc } = await import('app/ipc');
  const { state } = await import('app/state');
  const panel = new FakeWin();
  state.panel = panel as never;
  registerIpc();
  return panel;
}

describe('la page des réglages, écoutée par listenFrom, expéditeur vérifié (I-20)', () => {
  it('le canal settings est écouté', async () => {
    await listening();

    // Un gestionnaire est posé sur settings.
    expect(electron.ipc.has('settings')).toBe(true);
  });

  it('un message settings venu d’une autre fenêtre n’écrit rien', async () => {
    await listening();
    const other = new FakeWin();
    const before = fs.readFileSync(configFile(), 'utf8');

    const answer = await electron.ipc.get('settings')!({ sender: other.webContents }, OP);
    await settle();

    // Aucune réponse à une autre fenêtre.
    expect(answer).toBeUndefined();
    // config.json n'a pas changé.
    expect(fs.readFileSync(configFile(), 'utf8')).toBe(before);
  });

  it('témoin : le même message, venu du panneau, est écrit', async () => {
    const panel = await listening();
    const before = fs.readFileSync(configFile(), 'utf8');

    await electron.ipc.get('settings')!({ sender: panel.webContents }, OP);
    await settle();

    // config.json a changé : c'est bien l'expéditeur qui retenait l'autre message.
    expect(fs.readFileSync(configFile(), 'utf8')).not.toBe(before);
  });
});
