/** commands — le mince branchement de l'exécuteur, pour un robot donné :
 *  runCommand lit la table (vibeCommands), le catalogue (vibeActions), le
 *  relevé (lastView), puis appelle execute de core/commands avec les
 *  opérations existantes : start → startAction (vibe parti → vibeStart ; parti
 *  → refreshVibe, comme runVibeAction), direct → runDirect, run → runOp, proc
 *  → processOp. commandFromSocket : la porte « écran » par le socket, le robot
 *  de la cible de l'enveloppe (le robot affiché s'il est sur ce dossier, sinon
 *  le premier, chemins réels comparés).
 *  Ne connaît pas : la page, le socket lui-même, la boîte aux lettres.
 *  Utilisé par : lifecycle (le socket). */
import type { VibeView } from 'shared/bridge';
import type { AgentConfig } from 'core/agents';
import { vibeLang } from 'core/config';
import { execute, type CommandOps, type CommandRequest, type CommandResponse, type OpOutcome } from 'core/commands';
import type { Envelope } from 'technicals/socket';
import { loadConfig, vibeActions, vibeCommands } from 'app/settings';
import { processOp } from './processes';
import { runOp, vibeStart } from './runs';
import { lastView, refreshVibe, runDirect, startAction } from './vibecoder';

export async function runCommand(agent: AgentConfig, req: CommandRequest): Promise<CommandResponse> {
  const cfg = loadConfig();   // une fois par appel
  const defs = vibeActions(vibeLang(cfg));
  const view = lastView(agent.id);
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
  };
  return execute(vibeCommands(), req, { view, defs }, ops);
}

export async function commandFromSocket(_env: Envelope): Promise<CommandResponse> {
  throw new Error('not implemented');
}
