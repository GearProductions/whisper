// Variants des portes du socket (note 0.15.0, « Ce que ça fait », le socket, live.json et les jetons) :
// sur le vrai socket TCP et son client, le vrai disque ; faux : Electron (le dossier userData) ;
// le serveur est le vrai, son lancement est relevé (le port, le jeton) ou fait échouer à la demande.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from 'core/agents';
import type { Config } from 'core/config';
import { send } from 'technicals/socket';

const fake = vi.hoisted(() => ({ userData: '', servers: [] as { port: number; token: string; close(): Promise<void> }[], failListen: false }));
vi.mock('electron', () => ({ app: { getPath: () => fake.userData } }));
vi.mock('technicals/socket', async (original) => {
  const real = await original<typeof import('technicals/socket')>();
  return {
    ...real,
    listen: async (...a: Parameters<typeof real.listen>) => {
      if (fake.failListen) throw new Error('listen failed');
      const server = await real.listen(...a);
      fake.servers.push(server);
      return server;
    },
  };
});

const ok = { ok: true as const, result: 'fait' };
const liveJson = () => path.join(fake.userData, 'live.json');
let dir: string;
let agent: AgentConfig;
let socket: typeof import('app/controllers/socket');

beforeEach(async () => {
  vi.resetModules();
  fake.servers = [];
  fake.failListen = false;
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-socket-')));
  dir = path.join(fake.userData, 'projet');
  fs.mkdirSync(dir);
  agent = { id: 'a1', name: 'essai', dir, mode: 'default', model: '', effort: '', sessionId: null };
  socket = await import('app/controllers/socket');
});
afterEach(() => { socket.closeSocket(); });

describe('openSocket', () => {
  it('live.json : port et pid, réglage désactivé ; plus token activé ; désactivé à nouveau : le token retiré et refusé', async () => {
    const seen: (string | undefined)[] = [];
    await socket.openSocket(async (_env, caller) => { seen.push(caller); return ok; });
    const live = () => JSON.parse(fs.readFileSync(liveJson(), 'utf8')) as { port: number; pid: number; token?: string };
    const ask = async (token: string) => (await send(fake.servers[0].port, { cmd: 'status', token, target: dir }) as { ok: boolean }).ok;

    expect(live()).toEqual({ port: fake.servers[0].port, pid: process.pid });

    socket.writeLive({ outsideAgents: true } as Config);
    const outside = live().token!;
    expect(live()).toEqual({ port: fake.servers[0].port, pid: process.pid, token: outside });
    expect(outside).not.toBe(fake.servers[0].token);
    expect(await ask(outside)).toBe(true);
    expect(seen).toEqual(['outside']);

    socket.writeLive({ outsideAgents: true } as Config);   // toujours activé : le même jeton
    expect(live().token).toBe(outside);

    socket.writeLive({ outsideAgents: false } as Config);
    expect(live()).toEqual({ port: fake.servers[0].port, pid: process.pid });
    expect(await ask(outside)).toBe(false);

    socket.writeLive({ outsideAgents: true } as Config);   // réactivé : un nouveau jeton
    expect(live().token).not.toBe(outside);
  });
});

describe('les jetons des robots', () => {
  it('deux robots : deux jetons distincts, ni celui de l’écran ni l’extérieur ; forgetRobot : le sien refusé ensuite', async () => {
    fs.writeFileSync(path.join(fake.userData, 'config.json'), JSON.stringify({ agents: [agent, { ...agent, id: 'a2' }] }));
    const seen: (string | undefined)[] = [];
    await socket.openSocket(async (_env, caller) => { seen.push(caller); return ok; });
    socket.writeLive({ outsideAgents: true } as Config);
    const outside = JSON.parse(fs.readFileSync(liveJson(), 'utf8')).token as string;
    const screen = fake.servers[0].token;
    const asks = async (token: string) => (await send(fake.servers[0].port, { cmd: 'status', token, target: dir }) as { ok: boolean }).ok;

    const [t1, t2] = [socket.robotToken('a1'), socket.robotToken('a2')];

    expect(new Set([t1, t2, screen, outside]).size).toBe(4);
    expect(socket.robotToken('a1')).toBe(t1);   // tiré une fois
    expect(socket.robotAccess('a1')).toEqual({ port: fake.servers[0].port, token: t1 });
    expect(await asks(t1)).toBe(true);
    expect(await asks(t2)).toBe(true);
    expect(seen).toEqual(['a1', 'a2']);

    socket.forgetRobot('a1');

    expect(await asks(t1)).toBe(false);
    expect(await asks(t2)).toBe(true);
    expect(socket.robotToken('a1')).not.toBe(t1);
  });

  it('un robot qui n’est plus dans la config : son jeton est refusé, par la porte (callerRobot)', async () => {
    fs.writeFileSync(path.join(fake.userData, 'config.json'), JSON.stringify({ agents: [] }));
    const { commandFromSocket } = await import('app/controllers/commands');
    await socket.openSocket(commandFromSocket);

    const token = socket.robotToken('a1');

    expect(await send(fake.servers[0].port, { cmd: 'status', token, target: dir })).toMatchObject({ ok: false, error: { code: 'bad-token' } });
  });

  it('socket fermé : robotAccess rend null', () => {
    expect(socket.robotAccess('a1')).toBeNull();
  });
});

describe('closeSocket', () => {
  it('live.json est supprimé', async () => {
    await socket.openSocket(async () => ok);

    socket.closeSocket();

    expect(fs.existsSync(liveJson())).toBe(false);
  });

  it('rien d’ouvert : sans effet', () => {
    expect(() => socket.closeSocket()).not.toThrow();
  });
});

describe('screenSend', () => {
  it('l’enveloppe porte le jeton du serveur et le chemin réel du dossier', async () => {
    const seen: unknown[] = [];
    await socket.openSocket(async (env) => { seen.push(env); return ok; });
    const link = path.join(fake.userData, 'lien');
    fs.symlinkSync(dir, link);

    const answer = await socket.screenSend({ ...agent, dir: link }, 'forme', { a: 1 });

    expect(answer).toEqual(ok);
    expect(seen).toEqual([{ cmd: 'forme', args: { a: 1 }, token: fake.servers[0].token, target: dir }]);
  });

  it('le dossier du robot a disparu : la commande part quand même, vers le chemin donné (l’exécuteur dit no-survey)', async () => {
    const seen: unknown[] = [];
    await socket.openSocket(async (env) => { seen.push(env); return ok; });
    fs.rmdirSync(dir);

    const answer = await socket.screenSend(agent, 'forme');

    expect(answer).toEqual(ok);
    expect(seen).toMatchObject([{ cmd: 'forme', target: dir }]);
  });

  it('pas ouvert : null, sans appel direct', async () => {
    expect(await socket.screenSend(agent, 'forme')).toBeNull();
  });

  it('listen en échec : null, handle jamais appelé, live.json absent', async () => {
    fake.failListen = true;
    const handle = vi.fn(async () => ok);

    await socket.openSocket(handle);

    expect(await socket.screenSend(agent, 'forme')).toBeNull();
    expect(handle).not.toHaveBeenCalled();
    expect(fs.existsSync(liveJson())).toBe(false);
  });

  it('une erreur de connexion (serveur fermé sous le contrôleur) : null', async () => {
    await socket.openSocket(async () => ok);
    await fake.servers[0].close();

    expect(await socket.screenSend(agent, 'forme')).toBeNull();
  });
});
