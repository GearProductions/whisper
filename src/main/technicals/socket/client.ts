/** client — une commande envoyée au serveur : une connexion à
 *  127.0.0.1:port, une ligne, la première ligne reçue, fermée ; refusée,
 *  fermée sans réponse ou illisible : rejette.
 *  Ne connaît pas : la table, le jeton d'où il vient, Electron.
 *  Utilisé par : app/controllers (socket). */
import type { Envelope } from './protocol';

export async function send(_port: number, _env: Envelope): Promise<unknown> {
  throw new Error('not implemented');
}
