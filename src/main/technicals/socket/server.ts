/** server — le serveur TCP : sur 127.0.0.1 seulement, un port libre, un jeton
 *  tiré à chaque appel (32 octets aléatoires, hexa) ; chaque ligne lue par
 *  readLine : une enveloppe → handle, sa réponse en une ligne, dans l'ordre
 *  des lignes de la connexion ; un refus → la réponse, puis la connexion
 *  fermée ; pas une commande, close, ou handle qui rejette : la connexion
 *  fermée sans réponse.
 *  Ne connaît pas : la table, l'exécuteur, les robots, le disque, Electron.
 *  Utilisé par : app/controllers (socket). */
import { randomBytes } from 'node:crypto';
import net from 'node:net';
import { LINE_MAX, readLine, writeLine, type Envelope } from './protocol';

export type Server = { port: number; token: string; close(): Promise<void> };

export async function listen(handle: (env: Envelope) => Promise<unknown>): Promise<Server> {
  const token = randomBytes(32).toString('hex');
  const sockets = new Set<net.Socket>();
  const server = net.createServer((sock) => {
    sockets.add(sock);
    sock.on('close', () => sockets.delete(sock));
    sock.on('error', () => {}); // une connexion qui casse ne doit jamais faire tomber le processus
    sock.setEncoding('utf8');
    let buffer = '';
    let queue: Promise<void> = Promise.resolve(); // une ligne après l'autre : les réponses suivent l'ordre des lignes
    sock.on('data', (chunk: string) => {
      if (sock.destroyed) return;
      // on ne cherche la fin de ligne que dans le morceau reçu (pas dans tout le tampon : une grosse ligne serait quadratique)
      let start = 0;
      let end: number;
      while ((end = chunk.indexOf('\n', start)) >= 0) {
        const line = buffer + chunk.slice(start, end);
        buffer = '';
        start = end + 1;
        queue = queue.then(() => answer(line));
      }
      buffer += chunk.slice(start);
      if (buffer.length > LINE_MAX) sock.destroy(); // trop longue pour être une commande : pas d'attente de sa fin
    });
    async function answer(line: string) {
      if (sock.destroyed || sock.writableEnded) return;
      const read = readLine(line, token);
      if ('close' in read) return void sock.destroy();
      if ('refuse' in read) return void sock.end(writeLine(read.refuse));
      try {
        const answer = await handle(read.envelope);
        if (!sock.destroyed) sock.write(writeLine(answer));
      } catch {
        sock.destroy();
      }
    }
  });
  await new Promise<void>((done, fail) => {
    server.once('error', fail);
    server.listen(0, '127.0.0.1', done);
  });
  return {
    port: (server.address() as net.AddressInfo).port,
    token,
    close: () => new Promise<void>((done) => {
      server.close(() => done());
      for (const s of sockets) s.destroy();
    }),
  };
}
