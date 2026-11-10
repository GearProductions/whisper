/** commands — le mince branchement de l'exécuteur, pour un robot donné :
 *  runCommand lit la table (vibeCommands), le catalogue (vibeActions), le
 *  relevé (lastView), puis appelle execute de core/commands avec les
 *  opérations existantes : start → startAction (vibe parti → vibeStart ; parti
 *  → refreshVibe, comme runVibeAction), direct → runDirect, run → runOp, proc
 *  → processOp, artifact → readArtifact, draft → editDraft, wait (run.wait) → runEnd ; le relevé
 *  des demandes en attente (runs) : queuedOf. Avant une commande
 *  qui écrit, le relevé est relu (refreshVibe fresh, attendu) : l'état jugé est
 *  celui du dépôt. Sans robot (null) : no-survey, aucune opération appelée.
 *  runCommand refuse toujours busy et changing (I-44) ; à la porte agent, le mode Vibe arrêté (vibeHalted) : halted pour
 *  run.start et les commandes de départ, avant toute opération (ctx.halted de execute).
 *  commandFromSocket(env, caller) : qui appelle (callerRobot : l'écran, un robot par
 *  son jeton, ou un agent extérieur si le réglage est activé ; sinon BAD_TOKEN), et
 *  sur quel robot (l'écran et l'extérieur : celui de la cible, le robot affiché s'il
 *  est sur ce dossier ou au-dessus, sinon le premier, chemins réels ; un robot : le sien).
 *  Une porte d'agent relève d'abord le robot (surveyAgent), affiché ou non ; un run.start ou une commande de
 *  départ (START) qu'elle se voit refuser busy ou changing n'est pas refusé : il est mis en attente (queueStart),
 *  la réponse { queued: true, by } ; same, disabled, invalid-args… restent refusés tout de suite.
 *  Ne connaît pas : la page (aucun jeton vers elle), le socket lui-même (que son enveloppe et son appelant).
 *  Utilisé par : le socket (commandFromSocket, passé par lifecycle) ; controllers/vibecoder (les tests). */
import type { VibeArgs, VibeView } from 'shared/bridge';
import { agentList, vibeLang } from 'core/config';
import type { AgentConfig } from 'core/agents';
import { callerRobot, coerce, execute, START, type CommandOps, type CommandRequest, type CommandResponse, type OpOutcome } from 'core/commands';
import { BAD_TOKEN, type Envelope } from 'technicals/socket';
import { loadConfig, vibeActions, vibeCommands } from 'app/settings';
import { real, viewAgent } from './agents';
import { readArtifact } from './artifacts';
import { processOp } from './processes';
import { afterStart, queuedOf, queueStart, runEnd, runOp, vibeHalted } from './runs';
import { editDraft, lastView, runDirect, startAction, surveyAgent } from './vibecoder';

export async function runCommand(agent: AgentConfig | null, req: CommandRequest): Promise<CommandResponse> {
  const cfg = loadConfig();   // une fois par appel
  const table = vibeCommands();
  const defs = vibeActions(vibeLang(cfg));
  // Une écriture juge l'état du dépôt : le robot relevé d'abord (gh redemandé), affiché ou non.
  if (agent && table.commands.find((c) => c.name === req.command)?.kind === 'write') await surveyAgent(agent);
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
      if (sent.ok) afterStart(agent, id);
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
    wait: (id) => runEnd(agent.id, id),
  };
  return execute(table, req, { view, defs, queued: queuedOf(agent.id), halted: req.door === 'agent' && vibeHalted(agent.id) }, ops);
}

// L'appelant et son robot : callerRobot (dossiers réels, le robot affiché, le réglage) ; un jeton sans porte : BAD_TOKEN.
// Un appelant absent (le décor des tests appelle handle(env)) est l'écran. Une porte d'agent relève son robot d'abord.
export async function commandFromSocket(env: Envelope, caller = 'screen'): Promise<CommandResponse> {
  const cfg = loadConfig();
  const list = agentList(cfg);
  const robots = list.flatMap((a) => { const dir = real(a.dir); return dir ? [{ id: a.id, dir }] : []; });
  const who = callerRobot(caller, env.target, robots, viewAgent()?.id ?? null, cfg.outsideAgents === true);
  if (!who) return BAD_TOKEN as CommandResponse;
  const agent = list.find((a) => a.id === who.robot) ?? null;
  const def = vibeCommands().commands.find((c) => c.name === env.cmd);
  if (agent && who.door === 'agent' && def?.kind !== 'write') await surveyAgent(agent);   // une écriture est relevée par runCommand
  const req = { command: env.cmd, args: env.args, door: who.door };
  const res = await runCommand(agent, req);
  const by = !res.ok && (res.error.code === 'busy' || res.error.code === 'changing') ? res.error.details.by : undefined;
  if (!agent || who.door !== 'agent' || typeof by !== 'string' || !def || !(env.cmd === 'run.start' || START.includes(env.cmd))) return res;
  // Refusé après la vérification des arguments : coerce les rend tels que l'exécuteur les a passés.
  const args = coerce(def.args, env.args ?? {}) as Record<string, unknown>;
  const { action, ...rest } = args;
  if (env.cmd === 'run.start') queueStart(agent, action as string, rest as VibeArgs, by);
  else queueStart(agent, env.cmd, args as VibeArgs, by);
  return { ok: true, result: { queued: true, by } };
}
