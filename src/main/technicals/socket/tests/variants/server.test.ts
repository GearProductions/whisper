// Le serveur TCP : l'écoute, les lignes lues dans l'ordre, les refus et les fermetures, close.
// Sur le vrai serveur et de vraies connexions (node:net) ; la sûreté (127.0.0.1 seulement, jeton, ligne
// qui n'est pas une commande) est dans tests/invariants/server.test.ts.
import net from 'node:net';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BAD_TOKEN, listen } from 'technicals/socket';

const servers: { close(): Promise<void> }[] = [];
const pause = (ms: number) => new Promise((done) => setTimeout(done, ms));

// Un serveur dont le gestionnaire répond { echo: cmd } ; la commande « slow » répond en retard.
async function serve(handle = vi.fn(async (env: { cmd: string }, _caller?: string) => { if (env.cmd === 'slow') await pause(60); return { echo: env.cmd }; }), tokens?: () => ReadonlyMap<string, string>) {
  const server = await listen(handle, tokens);
  servers.push(server);
  return { ...server, handle };
}
afterEach(async () => { await Promise.all(servers.splice(0).map((s) => s.close())); });

const command = (token: string, cmd = 'status') => JSON.stringify({ cmd, args: {}, token, target: '/p' }) + '\n';

// Écrit les paquets (20 ms entre deux), lit jusqu'à `lines` lignes ou la fermeture : les lignes reçues, et si le serveur a fermé.
function talk(port: number, packets: string[], lines = Infinity) {
  return new Promise<{ lines: string[]; closed: boolean }>((done) => {
    let received = '';
    const got = () => received.split('\n').slice(0, -1);
    const sock = net.connect(port, '127.0.0.1', async () => {
      for (const p of packets) { sock.write(p); await pause(20); }
    });
    const timer = setTimeout(() => { sock.destroy(); done({ lines: got(), closed: false }); }, 1000);
    sock.on('data', (d) => { received += d.toString(); if (got().length >= lines) { clearTimeout(timer); sock.destroy(); done({ lines: got(), closed: false }); } });
    sock.on('error', () => {});
    sock.on('close', () => { clearTimeout(timer); done({ lines: got(), closed: true }); });
  });
}

describe('listen', () => {
  it('écoute sur 127.0.0.1, un port non nul ; deux appels : deux jetons différents', async () => {
    const a = await serve();
    const b = await serve();

    // un port libre, pas 0
    expect(a.port).toBeGreaterThan(0);
    // la connexion locale aboutit
    expect((await talk(a.port, [], 0)).closed).toBe(false);
    // le jeton : 32 octets en hexa
    expect(a.token).toMatch(/^[0-9a-f]{64}$/);
    // un autre appel, un autre jeton
    expect(b.token).not.toBe(a.token);
  });

  it('une enveloppe : la réponse de handle, en une ligne', async () => {
    const { port, token, handle } = await serve();

    const { lines } = await talk(port, [command(token, 'status')], 1);

    // handle a reçu l'enveloppe
    expect(handle).toHaveBeenCalledWith({ cmd: 'status', args: {}, token, target: '/p' }, 'screen');
    // sa réponse revient en une ligne
    expect(lines.map((l) => JSON.parse(l))).toEqual([{ echo: 'status' }]);
  });

  it('deux lignes dans un même paquet : deux réponses, dans l’ordre (la première, lente, d’abord)', async () => {
    const { port, token } = await serve();

    const { lines } = await talk(port, [command(token, 'slow') + command(token, 'fast')], 2);

    // l'ordre des lignes, pas celui des fins
    expect(lines.map((l) => JSON.parse(l).echo)).toEqual(['slow', 'fast']);
  });

  it('une ligne en deux paquets : une réponse', async () => {
    const { port, token } = await serve();
    const text = command(token, 'split');

    const { lines } = await talk(port, [text.slice(0, 10), text.slice(10)], 1);

    // la ligne est lue entière
    expect(lines.map((l) => JSON.parse(l).echo)).toEqual(['split']);
  });

  it('un mauvais jeton : BAD_TOKEN, connexion fermée, handle jamais appelé', async () => {
    const { port, token, handle } = await serve();

    const { lines, closed } = await talk(port, [command('0'.repeat(64)) + command(token)]);

    // la réponse est le refus, rien d'autre
    expect(lines.map((l) => JSON.parse(l))).toEqual([BAD_TOKEN]);
    // la connexion est fermée
    expect(closed).toBe(true);
    // handle n'a rien reçu, pas même la ligne qui suivait
    expect(handle).not.toHaveBeenCalled();
  });

  it('une requête HTTP : connexion fermée sans réponse', async () => {
    const { port, handle } = await serve();

    const { lines, closed } = await talk(port, ['GET / HTTP/1.1\r\nHost: localhost\r\n\r\n']);

    // rien n'est répondu
    expect(lines).toEqual([]);
    // la connexion est fermée
    expect(closed).toBe(true);
    expect(handle).not.toHaveBeenCalled();
  });

  it('close : plus de connexion acceptée', async () => {
    const { port, close } = await serve();

    await close();

    // la connexion est refusée
    const refused = await new Promise((done) => {
      const sock = net.connect(port, '127.0.0.1');
      sock.on('connect', () => { sock.destroy(); done(false); });
      sock.on('error', () => done(true));
    });
    expect(refused).toBe(true);
  });

  // Cas trouvé en chemin : close doit finir même si un client garde sa connexion ouverte.
  it('close : ferme aussi les connexions ouvertes', async () => {
    const { port, close } = await serve();
    const open = talk(port, []);
    await pause(50);

    await close();

    // le client voit sa connexion fermée par le serveur
    expect((await open).closed).toBe(true);
  });

  // Cas trouvé en chemin : « handle qui rejette : connexion fermée sans réponse » (la Forme).
  it('handle qui rejette : connexion fermée sans réponse', async () => {
    const { port, token } = await serve(vi.fn(async () => { throw new Error('boom'); }) as never);

    const { lines, closed } = await talk(port, [command(token)]);

    expect(lines).toEqual([]);
    expect(closed).toBe(true);
  });

  it('listen(handle) seul : le jeton de l\'écran, caller \'screen\'', async () => {
    const { port, token, handle } = await serve();

    await talk(port, [command(token)], 1);

    expect(handle).toHaveBeenCalledWith(expect.anything(), 'screen');
  });

  it('un jeton de robot ajouté à la table : accepté, caller son nom ; retiré : BAD_TOKEN à la ligne suivante', async () => {
    const table = new Map<string, string>();
    const { port, handle } = await serve(undefined, () => table);
    const robot = 'r'.repeat(64);
    table.set('robot-1', robot);

    const first = await talk(port, [command(robot)], 1);
    table.delete('robot-1');
    const second = await talk(port, [command(robot)]);

    expect(first.lines.map((l) => JSON.parse(l))).toEqual([{ echo: 'status' }]);
    expect(handle).toHaveBeenCalledWith(expect.anything(), 'robot-1');
    expect(second.lines.map((l) => JSON.parse(l))).toEqual([BAD_TOKEN]);
  });

  it('un robot nommé \'screen\' ne prend pas la place du jeton de l\'écran (cas trouvé en chemin)', async () => {
    const { port, token } = await serve(undefined, () => new Map([['screen', 'x'.repeat(64)]]));

    expect((await talk(port, [command(token)], 1)).lines.map((l) => JSON.parse(l))).toEqual([{ echo: 'status' }]);
  });

  it('une réponse qui tarde : la connexion reste ouverte, la réponse arrive ; le client parti avant : le serveur ne tombe pas', async () => {
    let release!: () => void;
    const gate = new Promise<void>((done) => { release = done; });
    const { port, token } = await serve(vi.fn(async (env: { cmd: string }) => { await gate; return { echo: env.cmd }; }));

    const waiting = talk(port, [command(token, 'wait')], 1);
    await pause(300); // aucun délai ne ferme la connexion
    release();
    expect((await waiting).lines.map((l) => JSON.parse(l))).toEqual([{ echo: 'wait' }]);

    // un client parti avant la réponse : rien d'écrit, pas d'erreur
    let release2!: () => void;
    const gate2 = new Promise<void>((done) => { release2 = done; });
    const b = await serve(vi.fn(async () => { await gate2; return { late: true }; }) as never);
    const sock = net.connect(b.port, '127.0.0.1', () => { sock.write(command(b.token)); setTimeout(() => sock.destroy(), 30); });
    sock.on('error', () => {});
    await pause(100);
    release2();
    await pause(50);
    expect((await talk(port, [command(token, 'again')], 1)).lines.length).toBe(1); // le serveur répond encore
  });

  it('close() pendant une attente : la connexion fermée', async () => {
    const { port, token, close } = await serve(vi.fn(() => new Promise<unknown>(() => {})) as never);
    const waiting = talk(port, [command(token)]);
    await pause(100);

    await close();

    expect(await waiting).toEqual({ lines: [], closed: true });
  });
});
