/** socket — la porte de l'écran : openSocket écoute (technicals/socket), puis
 *  écrit live.json avec le port seul (jamais le jeton) ; un échec est
 *  journalisé, l'appli reste ouverte, le socket fermé. closeSocket : live.json
 *  supprimé (synchrone, à la sortie), le serveur fermé. screenSend : une
 *  commande du contrat envoyée par le client TCP, le jeton gardé ici en
 *  mémoire, la cible = le chemin réel du dossier du robot (le chemin donné si
 *  le dossier a disparu : l'exécuteur ne trouve aucun robot, no-survey) ; null :
 *  socket indisponible (pas ouvert, une erreur de connexion), jamais d'appel
 *  direct en repli. SOCKET_DOWN et socketDown(lang) : le texte de cette panne
 *  (un seul, fr et en) et la boîte de dialogue qui le montre, pour un bouton
 *  qui ne rend rien à la page.
 *  Ne connaît pas : la page, l'exécuteur, la table.
 *  Utilisé par : lifecycle, controllers (vibecoder, processes). */
import fs from 'node:fs';
import { dialog } from 'electron';
import type { VibeLang } from 'shared/bridge';
import type { AgentConfig } from 'core/agents';
import type { CommandResponse } from 'core/commands';
import { createJournal } from 'technicals/journal';
import { listen, send, type Envelope, type Server } from 'technicals/socket';
import { journalFile, liveFile } from 'app/settings';

const journal = createJournal(() => journalFile());
// Le serveur ouvert, avec son jeton : il ne sort jamais d'ici (ni page, ni disque).
let server: Server | null = null;

export async function openSocket(handle: (env: Envelope) => Promise<CommandResponse>): Promise<void> {
  try {
    server = await listen(handle);
    fs.writeFileSync(liveFile(), JSON.stringify({ port: server.port }));
  } catch (e) {
    journal({ id: 'socket' }, 'socket-failed', String(e));
    closeSocket();
  }
}

export function closeSocket(): void {
  fs.rmSync(liveFile(), { force: true });
  void server?.close(); // ponytail: la fermeture n'est pas attendue (sortie synchrone) ; l'appli s'arrête de toute façon
  server = null;
}

// Le texte de la panne du socket, le même pour tout bouton qu'elle atteint.
export const SOCKET_DOWN: Record<VibeLang, string> = {
  fr: 'Socket indisponible : l\'action n\'est pas partie. Relancez l\'appli.',
  en: 'Socket unavailable: nothing was sent. Restart the app.',
};

// Ce que l'écran ne montre à personne : le socket indisponible, pour un bouton qui ne rend rien à la page.
export const socketDown = (lang: VibeLang) => dialog.showMessageBox({ type: 'error', message: SOCKET_DOWN[lang] });

export async function screenSend(agent: AgentConfig, command: string, args?: unknown): Promise<CommandResponse | null> {
  if (!server) return null;
  // /home → /var/home : la cible est le chemin réel ; un dossier disparu : le chemin donné. Pas `real` de ./agents : il
  // importe ce module (par processes et vibecoder), et ce cycle laisserait SOCKET_DOWN indéfini à leur chargement.
  let target = agent.dir;
  try { target = fs.realpathSync.native(agent.dir); } catch { /* disparu : le chemin donné */ }
  try {
    return await send(server.port, { cmd: command, args, token: server.token, target }) as CommandResponse;
  } catch {
    return null;
  }
}
