// Invariant de la commande vibecoder (note 0.15.0,
// docs/tickets/feat/0.15.0-cli.md, « Ce que ça ne doit pas faire ») :
//   - qu'un robot trouve l'appli par live.json : son port et son jeton viennent
//     de son environnement (VIBECODER_PORT, VIBECODER_TOKEN). Sinon un
//     programme qui réécrirait le port dans live.json, que tout programme de
//     la machine peut lire et écrire, recevrait le jeton du robot.
// Le jeton d'un robot jamais écrit, jamais vers la page :
// app/controllers/tests/invariants/agent-tokens.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur la fonction pure (callFrom, de plugin/bin/cli.mjs : le lecteur de
// live.json lui est donné) et sur le vrai script (plugin/bin/vibecoder.mjs,
// lancé par node, sans shell) ; deux serveurs TCP d'essai sur 127.0.0.1 relèvent
// ce qu'ils reçoivent : celui que désigne l'environnement, et un leurre que
// désigne live.json.
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { afterEach, describe, expect, it, vi } from 'vitest';

const BIN = path.resolve(__dirname, '../../resources/vibecoder/plugin/bin');
type Call = { port: number; token: string } | { error: string };
// callFrom, chargé à chaque cas : un .mjs sans types, lancé tel quel par node.
const cli = async () => await import(pathToFileURL(path.join(BIN, 'cli.mjs')).href) as {
  callFrom(env: Record<string, string | undefined>, readLiveFile: () => string | null): Call;
};

// Le jeton d'un robot (son environnement), et le jeton extérieur de live.json : distincts.
const ROBOT = 'a'.repeat(64);
const OUTSIDE = 'b'.repeat(64);

// Un serveur TCP d'essai : il relève chaque ligne reçue et répond ok à chacune.
const servers: net.Server[] = [];
async function serve() {
  const lines: string[] = [];
  const server = net.createServer((sock) => {
    let buffer = '';
    sock.on('error', () => {});
    sock.on('data', (d) => {
      buffer += d.toString();
      for (let end = buffer.indexOf('\n'); end >= 0; end = buffer.indexOf('\n')) {
        lines.push(buffer.slice(0, end));
        buffer = buffer.slice(end + 1);
        sock.write('{"ok":true,"result":{}}\n');
      }
    });
  });
  servers.push(server);
  await new Promise<void>((ok) => server.listen(0, '127.0.0.1', ok));
  return { port: (server.address() as net.AddressInfo).port, received: () => lines.join('\n') };
}
afterEach(async () => { await Promise.all(servers.splice(0).map((s) => new Promise((ok) => s.close(ok)))); });

// Un dossier de configuration d'essai (XDG_CONFIG_HOME, APPDATA, HOME), son live.json écrit.
function configWithLive(live: object) {
  const dir = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-cli-env-')));
  fs.mkdirSync(path.join(dir, 'whisper-dictation'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'whisper-dictation', 'live.json'), JSON.stringify(live));
  return dir;
}

// Le vrai script, lancé par node (sans shell) depuis `cwd`, avec cet environnement ; son échec n'arrête pas le cas.
function vibecoder(cwd: string, env: Record<string, string>, ...argv: string[]) {
  return new Promise<void>((done) => {
    execFile(process.execPath, [path.join(BIN, 'vibecoder.mjs'), ...argv], { cwd, env, timeout: 10_000 }, () => done());
  });
}

describe('callFrom : un robot ne lit jamais live.json', () => {
  it('avec VIBECODER_PORT et VIBECODER_TOKEN, le lecteur de live.json n’est jamais appelé', async () => {
    const { callFrom } = await cli();
    const readLive = vi.fn(() => JSON.stringify({ port: 40001, pid: 1, token: OUTSIDE }));

    callFrom({ VIBECODER_PORT: '40002', VIBECODER_TOKEN: ROBOT }, readLive);

    // live.json n'est pas lu
    expect(readLive).not.toHaveBeenCalled();
  });

  // live.json désigne un autre port : c'est celui de l'environnement qui reçoit le jeton du robot.
  it('avec VIBECODER_PORT et VIBECODER_TOKEN, le jeton du robot va au port de l’environnement', async () => {
    const { callFrom } = await cli();

    const call = callFrom({ VIBECODER_PORT: '40002', VIBECODER_TOKEN: ROBOT }, () => JSON.stringify({ port: 40001, pid: 1, token: OUTSIDE }));

    // le port et le jeton sont ceux de l'environnement
    expect(call).toEqual({ port: 40002, token: ROBOT });
  });

  // Le port manque à l'environnement : le jeton du robot ne doit pas partir vers le port de live.json.
  it('VIBECODER_TOKEN sans VIBECODER_PORT : le jeton du robot n’est pas associé au port de live.json', async () => {
    const { callFrom } = await cli();

    const call = callFrom({ VIBECODER_TOKEN: ROBOT }, () => JSON.stringify({ port: 40001, pid: 1, token: OUTSIDE }));

    // le jeton du robot n'est pas dans ce que rend callFrom
    expect(JSON.stringify(call)).not.toContain(ROBOT);
  });
});

describe('le script vibecoder : le port de live.json ne reçoit jamais le jeton d’un robot', () => {
  it('avec VIBECODER_PORT et VIBECODER_TOKEN, le serveur de l’environnement reçoit la commande, celui de live.json rien', async () => {
    const app = await serve();
    const decoy = await serve();
    const home = configWithLive({ port: decoy.port, pid: process.pid, token: OUTSIDE });
    const env = { PATH: process.env.PATH ?? '', HOME: home, XDG_CONFIG_HOME: home, APPDATA: home,
      VIBECODER_PORT: String(app.port), VIBECODER_TOKEN: ROBOT };

    await vibecoder(home, env, 'status');

    // témoin : la commande est partie, avec le jeton du robot, vers le port de l'environnement
    expect(app.received()).toContain(ROBOT);
    // le port de live.json n'a rien reçu
    expect(decoy.received()).toBe('');
  });

  // Le port manque à l'environnement : le script peut se replier sur live.json, jamais avec le jeton du robot.
  it('VIBECODER_TOKEN sans VIBECODER_PORT : le port de live.json ne reçoit pas le jeton du robot', async () => {
    const decoy = await serve();
    const home = configWithLive({ port: decoy.port, pid: process.pid, token: OUTSIDE });
    const env = { PATH: process.env.PATH ?? '', HOME: home, XDG_CONFIG_HOME: home, APPDATA: home, VIBECODER_TOKEN: ROBOT };

    await vibecoder(home, env, 'status');

    // le port de live.json n'a pas reçu le jeton du robot
    expect(decoy.received()).not.toContain(ROBOT);
  });
});
