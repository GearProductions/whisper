// Variants de la porte de l'écran (note 0.15.0, « Ce que ça fait », le socket et live.json) :
// sur le vrai socket TCP et son client, le vrai disque ; faux : Electron (le dossier userData) ;
// le serveur est le vrai, son lancement est relevé (le port, le jeton) ou fait échouer à la demande.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AgentConfig } from 'core/agents';

const fake = vi.hoisted(() => ({ userData: '', servers: [] as { port: number; token: string; close(): Promise<void> }[], failListen: false }));
vi.mock('electron', () => ({ app: { getPath: () => fake.userData } }));
vi.mock('technicals/socket', async (original) => {
  const real = await original<typeof import('technicals/socket')>();
  return {
    ...real,
    listen: async (handle: Parameters<typeof real.listen>[0]) => {
      if (fake.failListen) throw new Error('listen failed');
      const server = await real.listen(handle);
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
  it('live.json ne contient que port, le port où l’on se connecte', async () => {
    await socket.openSocket(async () => ok);

    expect(JSON.parse(fs.readFileSync(liveJson(), 'utf8'))).toEqual({ port: fake.servers[0].port });
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
