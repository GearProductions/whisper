// Le principal réel démarré sans fenêtre : le socket ouvert comme au lancement, le panneau ouvert, un
// bouton de l'écran, la boîte aux lettres de l'orchestrateur, l'attente du relevé, la fermeture.
// Ne connaît pas : ce que vérifient les tests (aucun expect, aucun témoin).
// Utilisé par : le barrel (harness). Les imports de l'appli sont dynamiques : après vi.resetModules() du cas.
import path from 'node:path';
import { vi } from 'vitest';
import { slow } from 'app/controllers/tests/slow';
import { windows, type FakeWin } from './electron';
import { write } from './profile';

let closeSocket = () => {};

// Le délai du relevé (git, fs.watch, le SDK factice), triplé sur la CI Windows (slow).
export const settle = (ms = 300): Promise<void> => new Promise((r) => setTimeout(r, slow(ms)));

// Le socket ouvert comme au lancement, le panneau ouvert sur l'agent, son premier relevé reçu.
export async function openPanel(agentId: string): Promise<FakeWin> {
  const { openConversation } = await import('app/windows');
  const { panelReady, openSocket, commandFromSocket, closeSocket: close } = await import('app/controllers');
  await openSocket(commandFromSocket);
  closeSocket = close;
  openConversation(agentId);
  const panel = windows().at(-1)!;
  panel.emit('ready-to-show');
  await panelReady();
  await settle();
  return panel;
}

// Un clic sur un bouton de l'écran (passe args tel quel : { direct: true } pour une action directe).
export async function click(id: string, args: object = {}): Promise<void> {
  const { runVibeAction } = await import('app/controllers');
  runVibeAction(id, args);
}

// La boîte aux lettres : l'orchestrateur demande des actions (son skill écrit <sorties>/actions/<id>.start),
// puis un relevé les lit. Le seul endroit que la CLI retouchera.
export async function orchestratorAsks(out: string, ...ids: string[]): Promise<void> {
  const { refreshVibe } = await import('app/controllers');
  for (const id of ids) write(path.join(out, 'actions', `${id}.start`), '{}');
  await refreshVibe({ now: true });
  await settle();
}

// À appeler après chaque cas (afterEach) : le socket fermé, les minuteries rendues.
export function closeAll(): void {
  closeSocket();
  closeSocket = () => {};
  vi.useRealTimers();
}
