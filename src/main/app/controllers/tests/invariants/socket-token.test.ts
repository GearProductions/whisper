// Invariants du jeton du socket (note 0.15.0,
// docs/tickets/feat/0.15.0-socket-interface.md, « Ce que ça ne doit pas
// faire ») :
//   - donner le jeton à la page (par un canal, un relevé, un message) : le
//     jeton de l'écran ouvre la porte qui répond aux autorisations ;
//   - écrire le jeton sur le disque (live.json compris) : un agent qui le
//     lirait pourrait répondre lui-même à ses demandes.
// Le serveur (127.0.0.1, le jeton exigé, la connexion fermée) :
// technicals/socket/tests/invariants/server.test.ts ; live.json supprimé à la
// sortie : app/tests/variants/live-file.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (écoute des canaux, contrôleurs, fenêtres, état,
// réglages et fichiers sur disque, git réel sur un dépôt d'essai, le vrai
// socket TCP et son client, les actions et la table livrées), par le décor
// commun (app/tests/harness) ; faux :
// Electron (la fenêtre et les boîtes de message relèvent ce qu'on leur
// montre, ipcMain relève les gestionnaires posés) et le SDK de Claude Code
// (chaque message reçu ouvre un tour, qui dure jusqu'à interrupt()). Le
// serveur est le vrai : son lancement est seulement relevé (le port et le
// jeton qu'il rend, les enveloppes qu'il passe), pour savoir quel texte
// chercher.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeAll, fakeClaude, fakeElectron, openPanel, profile, repo, repoResources, settle, write, writeConfig } from 'app/tests/harness';

// Les boîtes de message montrées (tous leurs arguments : le décor ne garde que le dernier).
const boxes: unknown[] = [];
// Chaque serveur lancé : son port et son jeton ; les enveloppes qu'il a passées.
const servers: { port: number; token: string }[] = [];
const envelopes: unknown[] = [];

const electron = fakeElectron({
  dialog: {
    showMessageBox: async (...a: unknown[]) => { boxes.push(a); return { response: 0 }; },
    showMessageBoxSync: (...a: unknown[]) => { boxes.push(a); return 0; },
    showErrorBox: (...a: unknown[]) => { boxes.push(a); },
  },
});
vi.mock('electron', () => electron.module);

// Claude Code : un tour par message reçu, qui ne finit qu'à interrupt().
const claude = fakeClaude();
vi.mock('technicals/claude', () => claude.module);

// Le vrai serveur, dont on relève le port, le jeton et les enveloppes passées.
vi.mock('technicals/socket', async (original) => {
  const real = await original<typeof import('technicals/socket')>();
  return {
    ...real,
    listen: async (handle: Parameters<typeof real.listen>[0]) => {
      const server = await real.listen((env) => { envelopes.push(env); return handle(env); });
      servers.push({ port: server.port, token: server.token });
      return server;
    },
  };
});

vi.mock('technicals/paths', () => repoResources());

let root = '';

// Le jeton du serveur ouvert par l'appli.
const token = () => servers[0].token;
// Tout ce que la fenêtre a reçu, et toutes les boîtes de message montrées.
const shown = () => JSON.stringify([electron.windows.map((w) => w.sent), boxes]);
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
const liveJson = () => path.join(root, 'live.json');

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  boxes.length = 0;
  servers.length = 0;
  envelopes.length = 0;
  root = profile('whisper-socket-token-');
  // Un dépôt sur une branche dont la note est écrite : la Forme est possible.
  const dir = path.join(root, 'projet');
  repo(dir);
  writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }]);
});
afterEach(closeAll);

// L'appli lancée comme au démarrage : le socket ouvert sur la vraie porte de
// l'écran, les canaux écoutés, le panneau ouvert sur l'agent, en VibeCoder.
async function launched() {
  const { registerIpc } = await import('app/ipc');
  registerIpc();
  await openPanel('a1');
}

// Un message de la page, sur un canal, comme le pont l'envoie.
async function fromPage(channel: string, ...args: unknown[]) {
  const answer = await electron.ipc.get(channel)!({ sender: electron.windows.at(-1)!.webContents }, ...args);
  await settle();
  return JSON.stringify(answer ?? null);
}

describe('le jeton ne va jamais vers la page', () => {
  it('Lancer une action (conv:vibeRun) : ni sa réponse ni ce que reçoit la fenêtre ne portent le jeton', async () => {
    await launched();

    const answer = await fromPage('conv:vibeRun', 'forme', {});

    // témoin : la commande est passée par le socket
    expect(envelopes.length).toBeGreaterThan(0);
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
    expect(envelopes.length).toBeGreaterThan(0);
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
    expect(envelopes.length).toBeGreaterThanOrEqual(2);
    // rien de ce que la fenêtre a reçu, ni une boîte de message, ne porte le jeton
    expect(shown()).not.toContain(token());
  });

  it('Déposer un fichier (conv:vibeDrop) : ni sa réponse ni ce que reçoit la fenêtre ne portent le jeton', async () => {
    await launched();
    const dropped = path.join(root, 'depose.md');
    write(dropped, '# déposé\n');

    const answer = await fromPage('conv:vibeDrop', [dropped]);

    // témoin : la commande est passée par le socket
    expect(envelopes.length).toBeGreaterThan(0);
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
    expect(envelopes.length).toBeGreaterThan(0);
    // rien de ce que la fenêtre a reçu, ni une boîte de message, ne porte le jeton
    expect(shown()).not.toContain(token());
  });

  it('le relevé poussé à la page (conv:vibeRefresh) ne porte pas le jeton', async () => {
    await launched();
    // témoin : le socket est ouvert, son jeton connu
    expect(servers).toHaveLength(1);

    await fromPage('conv:vibeRefresh');

    // témoin : un relevé a bien été poussé à la fenêtre
    expect(electron.windows.at(-1)!.sent.length).toBeGreaterThan(0);
    // rien de ce que la fenêtre a reçu ne porte le jeton
    expect(shown()).not.toContain(token());
  });
});

describe('le jeton n’est jamais écrit sur le disque', () => {
  it('live.json porte le port, pas le jeton', async () => {
    await launched();

    // témoin : live.json existe et désigne le port où l'on se connecte
    expect(JSON.parse(fs.readFileSync(liveJson(), 'utf8')).port).toBe(servers[0].port);
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
    expect(envelopes.length).toBeGreaterThanOrEqual(3);
    // témoin : le dossier de l'appli est bien sous le dossier parcouru
    expect(root.startsWith(fs.realpathSync.native(os.tmpdir()))).toBe(true);
    // aucun fichier ne porte le jeton
    expect(found).toEqual([]);
  });
});
