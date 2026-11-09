// Le principal réel démarré sans fenêtre : les canaux de la page et le socket ouverts comme au lancement, le panneau ouvert, un
// bouton de l'écran, les demandes de l'orchestrateur (par la porte de son robot), l'attente du relevé, la fermeture.
// Ne connaît pas : ce que vérifient les tests (aucun expect, aucun témoin).
// Utilisé par : le barrel (harness). Les imports de l'appli sont dynamiques : après vi.resetModules() du cas.
import { vi } from 'vitest';
import { slow } from 'app/controllers/tests/slow';
import { windows, type FakeWin } from './electron';

let closeSocket = () => {};

// Le délai du relevé (git, fs.watch, le SDK factice), triplé sur la CI Windows (slow).
export const settle = (ms = 300): Promise<void> => new Promise((r) => setTimeout(r, slow(ms)));

// Le socket ouvert comme au lancement, le panneau ouvert sur l'agent, son premier relevé reçu.
export async function openPanel(agentId: string): Promise<FakeWin> {
  const { openConversation } = await import('app/windows');
  const { panelReady, openSocket, commandFromSocket, closeSocket: close } = await import('app/controllers');
  (await import('app/ipc')).registerIpc();   // les canaux de la page, comme au lancement (les réglages changés par la page)
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

// L'orchestrateur demande des actions comme le fait sa CLI : run.start par la porte du robot dont <out> est le dossier de
// sorties (le jeton d'un robot : l'appelant, commandFromSocket), une demande après l'autre ; puis un relevé. Le seul endroit
// que la CLI retouche.
export async function orchestratorAsks(out: string, ...ids: string[]): Promise<void> {
  const { commandFromSocket, refreshVibe } = await import('app/controllers');
  const { agentList } = await import('core/config');
  const { loadConfig, vibeOutDir } = await import('app/settings');
  const robot = agentList(loadConfig()).find((a) => vibeOutDir(a.id) === out);
  if (!robot) throw new Error(`aucun robot ne sort dans ${out}`);
  for (const id of ids) await commandFromSocket({ cmd: 'run.start', args: { action: id }, token: '', target: '' }, robot.id);
  await refreshVibe({ now: true });
  await settle();
}

// À appeler après chaque cas (afterEach) : le socket fermé, les minuteries rendues.
export function closeAll(): void {
  closeSocket();
  closeSocket = () => {};
  vi.useRealTimers();
}
