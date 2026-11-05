/** socket — la porte de l'écran : openSocket écoute (technicals/socket), puis
 *  écrit live.json avec le port seul (jamais le jeton) ; un échec est
 *  journalisé, l'appli reste ouverte, le socket fermé. closeSocket : live.json
 *  supprimé (synchrone, à la sortie), le serveur fermé. screenSend : une
 *  commande du contrat envoyée par le client TCP, le jeton gardé ici en
 *  mémoire, la cible = le chemin réel du dossier du robot ; null : socket
 *  indisponible (pas ouvert, une erreur de connexion), jamais d'appel direct en
 *  repli.
 *  Ne connaît pas : la page, l'exécuteur, la table.
 *  Utilisé par : lifecycle, controllers (vibecoder, processes). */
import type { AgentConfig } from 'core/agents';
import type { CommandResponse } from 'core/commands';
import type { Envelope } from 'technicals/socket';

export async function openSocket(_handle: (env: Envelope) => Promise<CommandResponse>): Promise<void> {
  throw new Error('not implemented');
}

export function closeSocket(): void {
  throw new Error('not implemented');
}

export async function screenSend(_agent: AgentConfig, _command: string, _args?: unknown): Promise<CommandResponse | null> {
  throw new Error('not implemented');
}
