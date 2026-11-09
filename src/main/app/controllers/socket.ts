/** socket — les portes : openSocket écoute (technicals/socket) avec la table des
 *  jetons (les robots de la config → leur id, l'extérieur → 'outside', relue à
 *  chaque ligne), puis écrit live.json (writeLive) ; un échec est journalisé,
 *  l'appli reste ouverte, le socket fermé. Le jeton de l'écran : jamais sur le
 *  disque ni vers la page. robotToken(agentId) : le jeton d'un robot, tiré à la
 *  première demande, en mémoire seulement (jamais sur le disque) ; forgetRobot :
 *  oublié ; robotAccess : { port, token } pour lui le lancer, null socket fermé.
 *  writeLive(cfg) : live.json = { port, pid }, plus le jeton extérieur si
 *  outsideAgents (le seul endroit où il est écrit ; tiré à l'activation, oublié
 *  à la désactivation : un nouveau la fois suivante). closeSocket : live.json
 *  supprimé (synchrone, à la sortie), le serveur fermé. screenSend : une
 *  commande du contrat envoyée par le client TCP, le jeton gardé ici en
 *  mémoire, la cible = le chemin réel du dossier du robot (le chemin donné si
 *  le dossier a disparu : l'exécuteur ne trouve aucun robot, no-survey) ; null :
 *  socket indisponible (pas ouvert, une erreur de connexion), jamais d'appel
 *  direct en repli. SOCKET_DOWN et socketDown(lang) : le texte de cette panne
 *  (un seul, fr et en) et la boîte de dialogue qui le montre, pour un bouton
 *  qui ne rend rien à la page.
 *  Ne connaît pas : la page (aucun jeton vers elle), l'exécuteur, la table.
 *  Utilisé par : lifecycle, controllers (vibecoder, processes). */
import fs from 'node:fs';
import { dialog } from 'electron';
import type { VibeLang } from 'shared/bridge';
import type { AgentConfig } from 'core/agents';
import type { Config } from 'core/config';
import type { CommandResponse } from 'core/commands';
import { createJournal } from 'technicals/journal';
import { drawToken, listen, send, type Envelope, type Server } from 'technicals/socket';
import { journalFile, liveFile, loadConfig } from 'app/settings';

const journal = createJournal(() => journalFile());
// Le serveur ouvert, avec son jeton : il ne sort jamais d'ici (ni page, ni disque).
let server: Server | null = null;
// En mémoire seulement : le jeton de chaque robot, et l'extérieur (null : réglage désactivé).
const robots = new Map<string, string>();
let outside: string | null = null;

// Les jetons qui ouvrent le socket, relus à chaque ligne : les robots (un robot retiré est oublié par forgetRobot ; callerRobot refuse
// un id qui n'est plus dans la config), l'extérieur s'il est activé.
const tokens = () => (outside ? new Map(robots).set('outside', outside) : robots);

export async function openSocket(handle: (env: Envelope, caller?: string) => Promise<CommandResponse>): Promise<void> {
  try {
    server = await listen(handle, tokens);
    writeLive(loadConfig());
  } catch (e) {
    journal({ id: 'socket' }, 'socket-failed', String(e));
    closeSocket();
  }
}

// live.json : où se connecter (port), quel processus (pid), et le jeton extérieur si le réglage est activé (jamais un autre).
export function writeLive(cfg: Config): void {
  if (!server) return;
  outside = cfg.outsideAgents === true ? outside ?? drawToken() : null;
  fs.writeFileSync(liveFile(), JSON.stringify({ port: server.port, pid: process.pid, ...(outside && { token: outside }) }), { mode: 0o600 });
}

// Le jeton d'un robot : tiré à sa première demande, en mémoire seulement.
export function robotToken(agentId: string): string {
  if (!robots.has(agentId)) robots.set(agentId, drawToken());
  return robots.get(agentId)!;
}

export const forgetRobot = (agentId: string): void => void robots.delete(agentId);

// Ce qu'il faut à un robot pour parler au socket ; null : socket fermé.
export const robotAccess = (agentId: string): { port: number; token: string } | null =>
  server ? { port: server.port, token: robotToken(agentId) } : null;

export function closeSocket(): void {
  fs.rmSync(liveFile(), { force: true });
  outside = null;   // le jeton extérieur ne survit pas à live.json
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
