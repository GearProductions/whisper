/** commands — le mince branchement de l'exécuteur, pour un robot donné :
 *  runCommand lit la table (vibeCommands), le catalogue (vibeActions), le
 *  relevé (lastView), puis appelle execute de core/commands avec les
 *  opérations existantes : start → startAction (vibe parti → vibeStart ; parti
 *  → refreshVibe, comme runVibeAction), direct → runDirect, run → runOp, proc
 *  → processOp, artifact → readArtifact, draft → editDraft. Avant une commande
 *  qui écrit, le relevé est relu (refreshVibe fresh, attendu) : l'état jugé est
 *  celui du dépôt. Sans robot (null) : no-survey, aucune opération appelée.
 *  commandFromSocket : la porte « écran » par le socket (un seul jeton : celui
 *  de l'écran), le robot de la cible de l'enveloppe (le robot affiché s'il est
 *  sur ce dossier, sinon le premier, chemins réels comparés).
 *  Ne connaît pas : la page, le socket lui-même (que son enveloppe), la boîte aux lettres.
 *  Utilisé par : le socket (commandFromSocket, passé par lifecycle) ; controllers/vibecoder (les tests). */
import type { VibeView } from 'shared/bridge';
import { agentList, vibeLang } from 'core/config';
import type { AgentConfig } from 'core/agents';
import { execute, type CommandOps, type CommandRequest, type CommandResponse, type OpOutcome } from 'core/commands';
import type { Envelope } from 'technicals/socket';
import { loadConfig, vibeActions, vibeCommands } from 'app/settings';
import { real, viewAgent } from './agents';
import { readArtifact } from './artifacts';
import { processOp } from './processes';
import { runOp, vibeStart } from './runs';
import { editDraft, lastView, refreshVibe, runDirect, startAction } from './vibecoder';

export async function runCommand(agent: AgentConfig | null, req: CommandRequest): Promise<CommandResponse> {
  const cfg = loadConfig();   // une fois par appel
  const table = vibeCommands();
  const defs = vibeActions(vibeLang(cfg));
  // Une écriture juge l'état du dépôt : relu d'abord (gh redemandé), puis le relevé.
  if (agent && table.commands.find((c) => c.name === req.command)?.kind === 'write') await refreshVibe({ fresh: true });
  const view = agent ? lastView(agent.id) : null;
  // Sans robot : execute rend no-survey avant toute opération.
  if (!agent) return execute(table, req, { view, defs }, {} as CommandOps);
  const missing: OpOutcome = { ok: false, reason: 'action' };   // hors du catalogue : execute en fait not-offered
  // execute ne les appelle qu'avec un relevé (sans lui : no-survey).
  const ops: CommandOps = {
    start(id, args) {
      const def = defs.find((d) => d.id === id);
      if (!def) return missing;
      const sent = startAction(agent, def, args, view as VibeView, cfg);
      if (sent.ok && id === 'vibe') vibeStart(agent);
      if (sent.ok) void refreshVibe({ now: true });
      return sent;
    },
    direct(id, args) {
      const def = defs.find((d) => d.id === id);
      return def ? runDirect(agent, def, args, view as VibeView, cfg) : missing;
    },
    run: (id, op) => runOp(agent, id, op),
    proc: (name, op) => processOp(agent, cfg, name, op),
    artifact: (id) => readArtifact(agent, id),
    draft: (op) => editDraft(agent, op),
  };
  return execute(table, req, { view, defs }, ops);
}

// Le robot de la cible (un chemin réel) : l'affiché s'il est sur ce dossier, sinon le premier du dossier ; un
// dossier disparu ne lève pas (real rend null). Aucun : runCommand(null) rend no-survey.
export async function commandFromSocket(env: Envelope): Promise<CommandResponse> {
  const on = (a: AgentConfig | null) => (a && real(a.dir) === env.target ? a : null);
  const agent = on(viewAgent()) ?? agentList(loadConfig()).find((a) => on(a)) ?? null;
  return runCommand(agent, { command: env.cmd, args: env.args, door: 'screen' });
}
