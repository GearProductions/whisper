/** client — une commande envoyée au serveur : une connexion à
 *  127.0.0.1:port, une ligne, la première ligne reçue, fermée ; refusée,
 *  fermée sans réponse ou illisible : rejette (c'est l'appelant qui décide
 *  quoi faire d'un socket indisponible). Une réponse BAD_TOKEN est une ligne
 *  lisible : elle se résout, l'appelant lit ok:false.
 *  Ne connaît pas : la table, le jeton d'où il vient, Electron.
 *  Utilisé par : app/controllers (socket). */
import net from 'node:net';
import { writeLine, type Envelope } from './protocol';

export function send(port: number, env: Envelope): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let buffer = '';
    const sock = net.connect(port, '127.0.0.1', () => sock.write(writeLine(env)));
    sock.setEncoding('utf8');
    sock.on('error', reject); // refusée, cassée : rejette (un second rejet ne change rien)
    sock.on('close', () => reject(new Error('connection closed without an answer')));
    sock.on('data', (chunk: string) => {
      buffer += chunk;
      const end = buffer.indexOf('\n');
      if (end < 0) return;
      sock.destroy();
      try { resolve(JSON.parse(buffer.slice(0, end))); } catch (e) { reject(e); }
    });
  });
}
