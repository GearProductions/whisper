// Invariants des jetons des agents (note 0.15.0, docs/tickets/feat/0.15.0-cli.md,
// « Ce que ça ne doit pas faire ») :
//   - écrire le jeton d'un robot sur le disque, live.json compris (le jeton
//     extérieur, distinct, y est écrit) ;
//   - écrire le jeton extérieur ailleurs que dans live.json, ou l'y écrire
//     quand le réglage « Autoriser les agents extérieurs » est désactivé ;
//   - envoyer un jeton d'agent (d'un robot ou extérieur) à la page, par un
//     canal, un relevé, un message.
// Le jeton de l'écran (I-50) : socket-token.test.ts ; 127.0.0.1 (I-49) :
// technicals/socket/tests/invariants/server.test.ts ; un robot ne lit pas
// live.json : tests/invariants/cli-robot-env.test.ts ; les portes (le
// réglage désactivé, le robot de chaque agent) : agent-doors.test.ts ; le jeton
// extérieur à la sortie de l'appli : app/tests/invariants/live-file.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (écoute des canaux, contrôleurs, fenêtres, état,
// réglages et fichiers sur disque, git réel sur un dépôt d'essai, le vrai
// socket TCP et son vrai client, les actions et la table livrées), par le
// décor commun (app/tests/harness) ; faux : Electron (la fenêtre et les boîtes
// de message relèvent ce qu'on leur montre) et le SDK de Claude Code (chaque
// message reçu ouvre un tour, qui dure jusqu'à interrupt()). Un agent parle à
// l'appli comme la CLI : une ligne sur le socket, le port et le jeton lus dans
// live.json (agent extérieur) ou donnés par l'appli (robotToken, un robot).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { send } from 'technicals/socket';
import { click, closeAll, fakeClaude, fakeElectron, openPanel, profile, repo, repoResources, settle, writeConfig } from 'app/tests/harness';

// Les boîtes de message montrées (tous leurs arguments).
const boxes: unknown[] = [];
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
vi.mock('technicals/paths', () => repoResources());

let root = '';
let dir = '';

const liveJson = () => path.join(root, 'live.json');
const live = () => JSON.parse(fs.readFileSync(liveJson(), 'utf8')) as { port: number; token?: string };
// Tout ce que la fenêtre a reçu, et toutes les boîtes de message montrées.
const shown = () => JSON.stringify([electron.windows.map((w) => w.sent), boxes]);
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

// L'appli lancée, le réglage « Autoriser les agents extérieurs » tel que donné : le socket ouvert, les
// canaux écoutés, le panneau ouvert sur le robot a1, en VibeCoder.
// undefined : le réglage absent de la config, sa valeur par défaut.
async function launched(outsideAgents: boolean | undefined) {
  writeConfig(root, [{ id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
    vibe: { flow: 'create', autonomy: 'guide', pr: null } }], outsideAgents === undefined ? {} : { outsideAgents });
  const { registerIpc } = await import('app/ipc');
  registerIpc();
  await openPanel('a1');
}

// Une commande d'un agent, comme la CLI l'envoie : une ligne sur le socket, depuis le dossier du projet.
async function agentSends(token: string | undefined, cmd: string, args: object = {}) {
  const answer = await send(live().port, { cmd, args, token: token as string, target: dir });
  await settle();
  return answer as { ok: boolean };
}

// Un message de la page, sur un canal, comme le pont l'envoie.
async function fromPage(channel: string, ...args: unknown[]) {
  const answer = await electron.ipc.get(channel)!({ sender: electron.windows.at(-1)!.webContents }, ...args);
  await settle();
  return JSON.stringify(answer ?? null);
}

// Le jeton du robot a1, tel que l'appli le donne à ce qu'elle lance pour lui.
const robotTokenOf = async (id: string) => (await import('app/controllers')).robotToken(id);

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  boxes.length = 0;
  root = profile('whisper-agent-tokens-');
  // Un dépôt sur une branche dont la note est écrite : la Forme est possible.
  dir = path.join(root, 'projet');
  repo(dir);
});
afterEach(closeAll);

describe('le jeton d’un robot n’est jamais écrit sur le disque', () => {
  it('live.json ne porte pas le jeton du robot, même quand il porte le jeton extérieur', async () => {
    await launched(true);
    const robot = await robotTokenOf('a1');

    // témoin : live.json porte bien un jeton, l'extérieur
    expect(live().token).toBeTruthy();
    // le jeton extérieur n'est pas celui du robot
    expect(live().token).not.toBe(robot);
    // live.json ne porte pas le jeton du robot
    expect(fs.readFileSync(liveJson(), 'utf8')).not.toContain(robot);
  });

  // Le robot lancé (une course : Claude Code reçoit son environnement), puis ses commandes par le socket :
  // le journal, la config, les sorties, le dépôt, les fichiers temporaires n'en gardent rien.
  it('après une course lancée et des commandes du robot, aucun fichier du dossier temporaire ne porte son jeton', async () => {
    await launched(false);
    await click('forme');
    await settle();
    const robot = await robotTokenOf('a1');
    const status = await agentSends(robot, 'status');
    await agentSends(robot, 'runs');
    await agentSends(robot, 'run.stop', { action: 'forme' });

    const found = holding(os.tmpdir(), robot);

    // témoin : le jeton du robot ouvre le socket
    expect(status.ok).toBe(true);
    // témoin : une course est partie, Claude Code lancé pour le robot
    expect(claude.turns.length).toBeGreaterThan(0);
    // témoin : le dossier de l'appli et le projet sont sous le dossier parcouru
    expect(root.startsWith(fs.realpathSync.native(os.tmpdir()))).toBe(true);
    // aucun fichier ne porte le jeton du robot
    expect(found).toEqual([]);
  });
});

describe('le jeton extérieur n’est écrit que dans live.json, et seulement réglage activé', () => {
  it('réglage activé, après des commandes de l’agent extérieur : live.json est le seul fichier qui porte son jeton', async () => {
    await launched(true);
    const outside = live().token;
    const status = await agentSends(outside, 'status');
    await agentSends(outside, 'run.start', { action: 'forme' });
    await agentSends(outside, 'runs');

    const found = holding(os.tmpdir(), outside!);

    // témoin : le jeton extérieur ouvre le socket
    expect(status.ok).toBe(true);
    // le seul fichier qui porte le jeton extérieur est live.json
    expect(found).toEqual([liveJson()]);
  });

  // Désactivé par défaut : live.json dit où se connecter (port) et quel processus (pid), rien d'autre.
  it('réglage désactivé : live.json ne porte aucun jeton', async () => {
    await launched(false);

    const fields = Object.keys(live());

    // témoin : live.json dit où se connecter
    expect(fields).toContain('port');
    // aucun autre champ que le port et le pid
    expect(fields.filter((f) => f !== 'port' && f !== 'pid')).toEqual([]);
  });

  // Désactivé par défaut : une config qui ne dit rien du réglage.
  it('réglage absent de la config (par défaut) : live.json ne porte aucun jeton', async () => {
    await launched(undefined);

    const fields = Object.keys(live());

    // témoin : live.json dit où se connecter
    expect(fields).toContain('port');
    // aucun autre champ que le port et le pid
    expect(fields.filter((f) => f !== 'port' && f !== 'pid')).toEqual([]);
  });

  it('réglage désactivé depuis la page : l’ancien jeton extérieur n’est plus sur le disque, live.json compris', async () => {
    await launched(true);
    const outside = live().token;
    // témoin : le réglage activé, live.json portait un jeton
    expect(outside).toBeTruthy();

    await fromPage('settings', { set: 'outsideAgents', value: false });
    const found = holding(os.tmpdir(), outside!);

    // témoin : live.json est toujours là (l'appli tourne)
    expect(fs.existsSync(liveJson())).toBe(true);
    // aucun fichier, live.json compris, ne porte l'ancien jeton
    expect(found).toEqual([]);
  });

  it('réglage activé depuis la page : live.json est le seul fichier qui porte le jeton extérieur', async () => {
    await launched(false);

    await fromPage('settings', { set: 'outsideAgents', value: true });
    const outside = live().token;

    // témoin : le réglage activé, live.json porte un jeton
    expect(outside).toBeTruthy();
    // le seul fichier qui le porte est live.json
    expect(holding(os.tmpdir(), outside!)).toEqual([liveJson()]);
  });
});

describe('aucun jeton d’agent ne va vers la page', () => {
  it('les commandes d’un robot et un relevé : rien de ce que reçoit la fenêtre ne porte son jeton', async () => {
    await launched(false);
    const robot = await robotTokenOf('a1');
    const status = await agentSends(robot, 'status');
    await agentSends(robot, 'run.start', { action: 'forme' });
    await agentSends(robot, 'run.allow', { action: 'forme' });

    await fromPage('conv:vibeRefresh');

    // témoin : le jeton du robot ouvre le socket
    expect(status.ok).toBe(true);
    // témoin : un relevé a bien été poussé à la fenêtre
    expect(electron.windows.at(-1)!.sent.length).toBeGreaterThan(0);
    // rien de ce que la fenêtre a reçu, ni une boîte de message, ne porte le jeton du robot
    expect(shown()).not.toContain(robot);
  });

  // Une course lancée par l'écran : Claude Code reçoit le jeton du robot dans son environnement, la page rien.
  it('une course lancée par l’écran : rien de ce que reçoit la fenêtre ne porte le jeton du robot', async () => {
    await launched(false);

    await fromPage('conv:vibeRun', 'forme', {});
    await fromPage('conv:vibeRefresh');
    const robot = await robotTokenOf('a1');

    // témoin : une course est partie, Claude Code lancé pour le robot
    expect(claude.turns.length).toBeGreaterThan(0);
    // rien de ce que la fenêtre a reçu, ni une boîte de message, ne porte le jeton du robot
    expect(shown()).not.toContain(robot);
  });

  it('les commandes de l’agent extérieur et un relevé : rien de ce que reçoit la fenêtre ne porte son jeton', async () => {
    await launched(true);
    const outside = live().token;
    const status = await agentSends(outside, 'status');
    await agentSends(outside, 'run.start', { action: 'forme' });
    await agentSends(outside, 'run.allow', { action: 'forme' });

    await fromPage('conv:vibeRefresh');

    // témoin : le jeton extérieur ouvre le socket
    expect(status.ok).toBe(true);
    // rien de ce que la fenêtre a reçu, ni une boîte de message, ne porte le jeton extérieur
    expect(shown()).not.toContain(outside);
  });

  // La page des réglages montre le réglage : jamais le jeton qu'il fait écrire.
  it('le réglage activé puis relu par la page des réglages : ses réponses ne portent pas le jeton extérieur', async () => {
    await launched(false);

    const set = await fromPage('settings', { set: 'outsideAgents', value: true });
    const read = await fromPage('settings', null);
    const outside = live().token;

    // témoin : le réglage activé, live.json porte un jeton
    expect(outside).toBeTruthy();
    // la réponse à l'écriture du réglage ne le porte pas
    expect(set).not.toContain(outside);
    // la page relue ne le porte pas
    expect(read).not.toContain(outside);
    // rien de ce que la fenêtre a reçu, ni une boîte de message, ne le porte
    expect(shown()).not.toContain(outside);
  });
});
