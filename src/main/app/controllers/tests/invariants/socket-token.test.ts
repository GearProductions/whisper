// Invariants du jeton du socket (note 0.15.0,
// docs/tickets/feat/0.15.0-socket-interface.md, « Ce que ça ne doit pas
// faire ») :
//   - donner le jeton à la page (par un canal, un relevé, un message) : le
//     jeton de l'écran ouvre la porte qui répond aux autorisations ;
//   - écrire le jeton sur le disque (live.json compris) : un agent qui le
//     lirait pourrait répondre lui-même à ses demandes.
// Le serveur (127.0.0.1, le jeton exigé, la connexion fermée) :
// technicals/socket/tests/invariants/server.test.ts ; live.json supprimé à la
// sortie : app/tests/invariants/live-file.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (écoute des canaux, contrôleurs, fenêtres, état,
// réglages et fichiers sur disque, git réel sur un dépôt d'essai, le vrai
// socket TCP et son client, les actions et la table livrées) ; faux :
// Electron (la fenêtre et les boîtes de message relèvent ce qu'on leur
// montre, ipcMain relève les gestionnaires posés) et le SDK de Claude Code
// (chaque message reçu ouvre un tour, qui dure jusqu'à interrupt()). Le
// serveur est le vrai : son lancement est seulement relevé (le port et le
// jeton qu'il rend, les enveloppes qu'il passe), pour savoir quel texte
// chercher.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
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
  return {
    Win, userData: '', windows: [] as InstanceType<typeof Win>[],
    // Les gestionnaires posés sur ipcMain, par canal.
    ipc: new Map<string, (e: { sender: unknown }, ...a: unknown[]) => unknown>(),
    // Les boîtes de message montrées (leurs arguments).
    boxes: [] as unknown[],
    // Chaque serveur lancé : son port et son jeton ; les enveloppes qu'il a passées.
    servers: [] as { port: number; token: string }[],
    envelopes: [] as unknown[],
  };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData, getAppMetrics: () => [], getVersion: () => '0.0.0', quit: () => {} },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  ipcMain: {
    on: (ch: string, fn: (e: { sender: unknown }, ...a: unknown[]) => unknown) => { fake.ipc.set(ch, fn); },
    handle: (ch: string, fn: (e: { sender: unknown }, ...a: unknown[]) => unknown) => { fake.ipc.set(ch, fn); },
  },
  dialog: {
    showMessageBox: async (...a: unknown[]) => { fake.boxes.push(a); return { response: 0 }; },
    showMessageBoxSync: (...a: unknown[]) => { fake.boxes.push(a); return 0; },
    showErrorBox: (...a: unknown[]) => { fake.boxes.push(a); },
  },
  Menu: { buildFromTemplate: () => ({ popup: () => {} }), setApplicationMenu: () => {} },
  Notification: class { static isSupported() { return false; } on() {} show() {} },
  shell: { openPath: async () => '', openExternal: async () => {}, showItemInFolder: () => {} },
  clipboard: {}, nativeImage: {},
}));

// Claude Code : un tour par message reçu, qui ne finit qu'à interrupt().
vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt }: { prompt: AsyncIterable<unknown> }) => {
      let stop = () => {};
      return Object.assign((async function* run() {
        for await (const _m of prompt) {
          await new Promise<void>((ok) => { stop = ok; });
          yield { type: 'result', subtype: 'error_during_execution', is_error: true };
        }
      }()), {
        setPermissionMode: async () => {}, setModel: async () => {},
        interrupt: async () => { stop(); },
        rewindFiles: async () => ({ canRewind: true, filesChanged: [] }),
      });
    },
  }),
}));

// Le vrai serveur, dont on relève le port, le jeton et les enveloppes passées.
vi.mock('technicals/socket', async (original) => {
  const real = await original<typeof import('technicals/socket')>();
  return {
    ...real,
    listen: async (handle: Parameters<typeof real.listen>[0]) => {
      const server = await real.listen((env) => { fake.envelopes.push(env); return handle(env); });
      fake.servers.push({ port: server.port, token: server.token });
      return server;
    },
  };
});

vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${process.cwd()}/resources/${name}`,
}));

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const settle = () => new Promise((r) => setTimeout(r, slow(300)));

// Le jeton du serveur ouvert par l'appli.
const token = () => fake.servers[0].token;
// Tout ce que la fenêtre a reçu, et toutes les boîtes de message montrées.
const shown = () => JSON.stringify([fake.windows.map((w) => w.sent), fake.boxes]);
// Les fichiers sous un dossier qui portent un texte (liens non suivis) ; un
// fichier effacé pendant la lecture (un autre test, dans le dossier temporaire) est passé.
function holding(dir: string, text: string): string[] {
  let entries: fs.Dirent[] = [];
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return []; }
  return entries.flatMap((e) => {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) return holding(p, text);
    try { return e.isFile() && fs.readFileSync(p, 'latin1').includes(text) ? [p] : []; } catch { return []; }
  });
}
const liveJson = () => path.join(fake.userData, 'live.json');

let closeSocket = () => {};

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  fake.windows = [];
  fake.ipc = new Map();
  fake.boxes = [];
  fake.servers = [];
  fake.envelopes = [];
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-socket-token-')));
  // Un dépôt sur une branche dont la note est écrite : la Forme est possible.
  const dir = path.join(fake.userData, 'projet');
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
  git(dir, 'checkout', '-q', '-b', 'feat/0.9.0-essai');
  write(path.join(dir, 'docs/tickets/feat/0.9.0-essai.md'), '# 0.9.0 — essai\n\n## Ce que ça fait\n\n- un essai\n');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'note');
  write(path.join(fake.userData, 'config.json'), JSON.stringify({
    agents: [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'create', autonomy: 'guide', pr: null } }],
  }));
});
afterEach(() => {
  try { closeSocket(); } catch { /* pas ouvert */ }
  closeSocket = () => {};
  vi.useRealTimers();
});

// L'appli lancée comme au démarrage : le socket ouvert sur la vraie porte de
// l'écran, les canaux écoutés, le panneau ouvert sur l'agent, en VibeCoder.
async function launched() {
  const controllers = await import('app/controllers');
  const { registerIpc } = await import('app/ipc');
  const { openConversation } = await import('app/windows');
  closeSocket = controllers.closeSocket;
  await controllers.openSocket(controllers.commandFromSocket);
  registerIpc();
  openConversation('a1');
  fake.windows.at(-1)!.emit('ready-to-show');
  await controllers.panelReady();
  await settle();
}

// Un message de la page, sur un canal, comme le pont l'envoie.
async function fromPage(channel: string, ...args: unknown[]) {
  const answer = await fake.ipc.get(channel)!({ sender: fake.windows.at(-1)!.webContents }, ...args);
  await settle();
  return JSON.stringify(answer ?? null);
}

describe('le jeton ne va jamais vers la page', () => {
  it('Lancer une action (conv:vibeRun) : ni sa réponse ni ce que reçoit la fenêtre ne portent le jeton', async () => {
    await launched();

    const answer = await fromPage('conv:vibeRun', 'forme', {});

    // témoin : la commande est passée par le socket
    expect(fake.envelopes.length).toBeGreaterThan(0);
    // la réponse rendue à la page ne porte pas le jeton
    expect(answer).not.toContain(token());
    // ni rien de ce que la fenêtre a reçu, ni une boîte de message
    expect(shown()).not.toContain(token());
  });

  // Un refus traduit pour l'écran : ses détails ne doivent pas emporter l'enveloppe.
  it('une action refusée (conv:vibeRun, action inconnue) : sa réponse ne porte pas le jeton', async () => {
    await launched();

    const answer = await fromPage('conv:vibeRun', 'inconnue', {});

    // témoin : la commande est passée par le socket
    expect(fake.envelopes.length).toBeGreaterThan(0);
    // la réponse rendue à la page ne porte pas le jeton
    expect(answer).not.toContain(token());
    // ni rien de ce que la fenêtre a reçu, ni une boîte de message
    expect(shown()).not.toContain(token());
  });

  it('Arrêter une course (conv:vibeRunOp) : rien de ce que reçoit la fenêtre ne porte le jeton', async () => {
    await launched();
    await fromPage('conv:vibeRun', 'forme', {});

    await fromPage('conv:vibeRunOp', 'forme', 'stop');

    // témoin : les deux commandes sont passées par le socket
    expect(fake.envelopes.length).toBeGreaterThanOrEqual(2);
    // rien de ce que la fenêtre a reçu, ni une boîte de message, ne porte le jeton
    expect(shown()).not.toContain(token());
  });

  it('Déposer un fichier (conv:vibeDrop) : ni sa réponse ni ce que reçoit la fenêtre ne portent le jeton', async () => {
    await launched();
    const dropped = path.join(fake.userData, 'depose.md');
    write(dropped, '# déposé\n');

    const answer = await fromPage('conv:vibeDrop', [dropped]);

    // témoin : la commande est passée par le socket
    expect(fake.envelopes.length).toBeGreaterThan(0);
    // la réponse rendue à la page ne porte pas le jeton
    expect(answer).not.toContain(token());
    // ni rien de ce que la fenêtre a reçu, ni une boîte de message
    expect(shown()).not.toContain(token());
  });

  // Sans PR suivie, la remarque est refusée : le refus non plus.
  it('une remarque du brouillon de revue (conv:vibeDraft) : rien de ce que reçoit la fenêtre ne porte le jeton', async () => {
    await launched();

    await fromPage('conv:vibeDraft', { add: { target: 'a.ts', text: 'ne gère pas le cas vide' } });

    // témoin : la commande est passée par le socket
    expect(fake.envelopes.length).toBeGreaterThan(0);
    // rien de ce que la fenêtre a reçu, ni une boîte de message, ne porte le jeton
    expect(shown()).not.toContain(token());
  });

  it('le relevé poussé à la page (conv:vibeRefresh) ne porte pas le jeton', async () => {
    await launched();
    // témoin : le socket est ouvert, son jeton connu
    expect(fake.servers).toHaveLength(1);

    await fromPage('conv:vibeRefresh');

    // témoin : un relevé a bien été poussé à la fenêtre
    expect(fake.windows.at(-1)!.sent.length).toBeGreaterThan(0);
    // rien de ce que la fenêtre a reçu ne porte le jeton
    expect(shown()).not.toContain(token());
  });
});

describe('le jeton n’est jamais écrit sur le disque', () => {
  it('live.json porte le port, pas le jeton', async () => {
    await launched();

    // témoin : live.json existe et désigne le port où l'on se connecte
    expect(JSON.parse(fs.readFileSync(liveJson(), 'utf8')).port).toBe(fake.servers[0].port);
    // il ne porte pas le jeton
    expect(fs.readFileSync(liveJson(), 'utf8')).not.toContain(token());
  });

  // Le journal, la config, les sorties des agents, le dépôt, les fichiers temporaires : rien, après des
  // commandes passées par le socket. Le dossier de l'appli et le projet sont sous le dossier temporaire.
  it('après des commandes passées par le socket, aucun fichier du dossier de l’appli, du projet ni du dossier temporaire ne porte le jeton', async () => {
    await launched();
    await fromPage('conv:vibeRun', 'forme', {});
    await fromPage('conv:vibeRunOp', 'forme', 'stop');
    await fromPage('conv:vibeRun', 'inconnue', {});

    const found = holding(os.tmpdir(), token());

    // témoin : les commandes sont passées par le socket
    expect(fake.envelopes.length).toBeGreaterThanOrEqual(3);
    // témoin : le dossier de l'appli est bien sous le dossier parcouru
    expect(fake.userData.startsWith(fs.realpathSync.native(os.tmpdir()))).toBe(true);
    // aucun fichier ne porte le jeton
    expect(found).toEqual([]);
  });
});
