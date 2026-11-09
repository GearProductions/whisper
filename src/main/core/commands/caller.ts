/** caller — qui appelle, et sur quel robot : la règle des boutons (robotAt : le
 *  robot affiché s'il couvre la cible, sinon le premier qui la couvre), la porte
 *  de l'appelant (écran, ou agent), l'environnement d'un robot lancé.
 *  Ne connaît pas : les jetons (le serveur les a reconnus), le disque (les
 *  dossiers sont déjà réels, l'appelant les résout), Electron.
 *  Utilisé par : app/controllers (commands, agents, runs). */
import path from 'node:path';

export function robotEnv(base: Record<string, string | undefined>, port: number, token: string): Record<string, string | undefined> {
  return { ...base, VIBECODER_PORT: String(port), VIBECODER_TOKEN: token };
}

type Robot = { id: string; dir: string };

// Couvrir : le même dossier ou un sous-dossier (/p ne couvre pas /p2).
const covers = (dir: string, target: string) => target === dir || target.startsWith(dir.endsWith(path.sep) ? dir : dir + path.sep);

export function robotAt(target: string, robots: Robot[], shown: string | null): string | null {
  const here = robots.filter((r) => covers(r.dir, target));
  return (here.find((r) => r.id === shown) ?? here[0])?.id ?? null;
}

export function callerRobot(caller: string, target: string, robots: Robot[], shown: string | null, outside: boolean):
  { robot: string | null; door: 'screen' | 'agent' } | null {
  if (caller === 'screen') return { robot: robotAt(target, robots, shown), door: 'screen' };
  if (caller === 'outside') return outside ? { robot: robotAt(target, robots, shown), door: 'agent' } : null;
  return robots.some((r) => r.id === caller) ? { robot: caller, door: 'agent' } : null;
}
