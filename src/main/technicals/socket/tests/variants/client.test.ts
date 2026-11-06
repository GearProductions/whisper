// Le client TCP : la réponse du serveur, un port fermé, une connexion fermée sans réponse, une réponse illisible.
import net from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { BAD_TOKEN, listen, send } from 'technicals/socket';

const closers: (() => Promise<void>)[] = [];
afterEach(async () => { await Promise.all(closers.splice(0).map((c) => c())); });

const env = (token: string) => ({ cmd: 'status', args: { a: 1 }, token, target: '/p' });

// Un faux serveur brut : à la première donnée reçue, `reply` agit sur la connexion.
async function raw(reply: (sock: net.Socket) => void) {
  const server = net.createServer((sock) => { sock.on('error', () => {}); sock.once('data', () => reply(sock)); });
  await new Promise<void>((done) => server.listen(0, '127.0.0.1', done));
  closers.push(() => new Promise<void>((done) => server.close(() => done())));
  return (server.address() as net.AddressInfo).port;
}

describe('send', () => {
  it('avec listen : la réponse de handle', async () => {
    const server = await listen(async (e) => ({ echo: e.cmd, args: e.args }));
    closers.push(server.close);

    expect(await send(server.port, env(server.token))).toEqual({ echo: 'status', args: { a: 1 } });
  });

  it('un mauvais jeton : se résout avec la réponse BAD_TOKEN, ne rejette pas', async () => {
    const server = await listen(async () => ({}));
    closers.push(server.close);

    expect(await send(server.port, env('faux'))).toEqual(BAD_TOKEN);
  });

  it('un port fermé : rejette', async () => {
    const server = await listen(async () => ({}));
    const { port, token } = server;
    await server.close();

    await expect(send(port, env(token))).rejects.toThrow(/ECONNREFUSED/);
  });

  it('une connexion fermée sans réponse : rejette', async () => {
    const port = await raw((sock) => sock.destroy());

    await expect(send(port, env('t'))).rejects.toThrow(/closed/);
  });

  it('une réponse qui n\'est pas du JSON : rejette', async () => {
    const port = await raw((sock) => sock.write('pas du json\n'));

    await expect(send(port, env('t'))).rejects.toThrow(/JSON/);
  });

  it('la première ligne seulement : les suivantes sont ignorées', async () => {
    const port = await raw((sock) => sock.write('{"n":1}\n{"n":2}\n'));

    expect(await send(port, env('t'))).toEqual({ n: 1 });
  });

  it('une réponse coupée en deux paquets : recollée', async () => {
    const port = await raw((sock) => { sock.write('{"n":'); setTimeout(() => sock.write('1}\n'), 20); });

    expect(await send(port, env('t'))).toEqual({ n: 1 });
  });
});
