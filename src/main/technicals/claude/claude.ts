/** claude — lancer le Claude Code DE L'UTILISATEUR (déjà installé et connecté :
 *  pas de clé API, rien d'embarqué) et charger le SDK officiel. La commande est
 *  réglable (`agentCommand`) : `claude` par défaut ; par exemple
 *  `distrobox enter dev -- claude` quand les outils du projet vivent dans un
 *  conteneur. Le SDK est un module ES : chargé par import(), jamais require.
 *  Ne connaît pas : les agents, les tours. Utilisé par : app/controllers/agents. */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import { splitCommand } from 'helpers';
import { which } from 'technicals/paths';

export type SpawnOptions = { args: string[]; cwd?: string; env: Record<string, string | undefined>; signal: AbortSignal };
export type Launch = { executable: string; spawn?: (o: SpawnOptions) => ReturnType<typeof spawn> };

// { executable, spawn } pour le SDK, ou null si Claude Code est introuvable.
// Commande personnalisée : le SDK prépare ses arguments, on les passe derrière
// la commande de l'utilisateur ; stdin et stdout tels quels.
export function launcher(command: unknown): Launch | null {
  const argv = splitCommand(command);
  if (!argv.length) {
    const claude = which('claude');
    return claude ? { executable: claude } : null;
  }
  const program = which(argv[0]) || (fs.existsSync(argv[0]) ? argv[0] : null);
  if (!program) return null;
  return {
    executable: program,
    spawn: ({ args, cwd, env, signal }) => spawn(program, [...argv.slice(1), ...args],
      { cwd, env, signal, stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true }),
  };
}

type Sdk = typeof import('@anthropic-ai/claude-agent-sdk');
let sdk: Sdk | null = null;
export const loadSdk = async () => { if (!sdk) sdk = await import('@anthropic-ai/claude-agent-sdk'); return sdk; };
