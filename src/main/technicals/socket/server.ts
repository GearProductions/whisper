/** server — le serveur TCP : sur 127.0.0.1 seulement, un port libre, un jeton
 *  tiré à chaque appel (32 octets aléatoires, hexa) ; chaque ligne lue par
 *  readLine : une enveloppe → handle, sa réponse en une ligne, dans l'ordre ;
 *  un refus → la réponse, puis la connexion fermée ; pas une commande, ou
 *  handle qui rejette : la connexion fermée sans réponse.
 *  Ne connaît pas : la table, l'exécuteur, les robots, le disque, Electron.
 *  Utilisé par : app/controllers (socket). */
import type { Envelope } from './protocol';

export type Server = { port: number; token: string; close(): Promise<void> };

export async function listen(_handle: (env: Envelope) => Promise<unknown>): Promise<Server> {
  throw new Error('not implemented');
}
