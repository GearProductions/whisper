/** runs — les courses : une action d'étape qui court à part de la conversation,
 *  sous sa propre entrée du runtime des agents, `<agent>~<clé>` (runKey).
 *  Lancer (startRun : si aucune course vivante ni action directe en cours ne
 *  la retient, blockedBy ; retenue, elle rend aussi sa clé, reason (lockCode : same, busy, changing) et by (qui retient) ; elle retient le module qu'elle génère, Run.module,
 *  pour codeLock ; le robot suit dès le départ ; un processus neuf, suivi des fichiers écrits ;
 *  ses droits (runRights) : le mode qui ne demande jamais, quel que soit celui de l'agent, la liste de son skill
 *  et des commandes du projet (core/vibecoder rights : le skill de son gabarit, `note` pour answers ; AGENTS.md ;
 *  le préfixe des actions), le contrôle de ses fichiers (core/vibecoder bounds : le projet, ses sorties, le plugin ;
 *  une action en lecture n'écrit que dans ses sorties) ; seulement les sorties de l'agent en dossier de travail,
 *  pas le dossier des artefacts du projet (que la conversation garde) ;
 *  le message part avec ses images ({ text, images }) ;
 *  modèle et effort du skill que son texte appelle, sinon ceux de l'agent ; answers reprend la session de la course de la note),
 *  suivre (son état d'après runPhase : en cours tant que son processus travaille ou que le runtime lui voit des
 *  tâches de fond — hors repos, le plus haut des comptes, runTasks —, aucune limite de temps ; son avancement,
 *  Run.progress d'après les tâches du runtime et le total de modules restants au départ (action modules), gardé
 *  après sa fin, jamais lu pour son état ; ses tâches de fond tombées à 0 hors tour, GRACE_MS laissés au tour
 *  qu'elles réveillent ; un sous-agent relancé par SendMessage la tient en cours (core/agents tasks, T-32) ; sa fin, revenue
 *  au repos après avoir travaillé, ou son échec avant même son tour : fermée, en échec si elle a essuyé un refus qui n'est
 *  pas une lecture, d'elle ou d'un sous-agent, pendant ou hors tour (failingDenials), ou si un sous-agent a fini sans
 *  qu'aucun tour relise sa réponse (unreadAgents) — une ligne en tête de sa réponse le dit (denialLine, unreadLine ;
 *  des lectures refusées seules : citées, sans échec) —, et un avis à la conversation de l'agent, gardé tant qu'elle
 *  travaille, I-25), agir sur une course (runOp : l'arrêter — son
 *  processus et son verrou restent —, la garder ou l'annuler — rewind, puis
 *  fermée —, répondre à sa demande d'autorisation : la porte de l'écran de la CLI seulement, run.allow ; une course
 *  n'en pose plus, l'onglet Actions n'en montre aucune, runPending retiré). Plus de boîte aux lettres (0.15.0) : ni <sorties>/actions/ lu, ni
 *  <sorties>/actions.json écrit, ni avis de demande refusée ; l'orchestrateur passe par la CLI (controllers/commands).
 *  Le signal des courses sur le robot (F-55, runSignal) : chacune retient l'état où on l'a vue (noticed) ; runsTab :
 *  l'agent dont l'onglet Actions est ouvert, ses courses vues d'office (une question reste jusqu'à sa
 *  réponse) ; runSignalOf (pour pushAgents) ; à chaque changement d'une course, le robot suit si son signal a changé.
 *  runsShown : l'agent est affiché, ou sa conversation lue (controllers/agents) : ses courses finies sont vues
 *  (noticedOnShow), pas celles en échec, qui gardent leur « ! » jusqu'à l'onglet Actions (T-18) ; runTasksOf : les
 *  tâches de fond de ses courses vivantes (le robot, T-13).
 *  Le mode Vibe de chaque agent (F-103 ; vibe-mode) : vibeStart (on), vibeStop (halted : la file d'attente jetée,
 *  rien d'interrompu), vibeOn (on seulement) ; au repos (une conversation qui finit son tour, après ses
 *  avis ; vibeStop ; une course arrêtée) : nextVibeMode, avec les questions ouvertes de
 *  <sorties>/questions.md (parseQuestions, comme le parcours) ; quitter on : un relevé forcé d'abord (ses ✓).
 *  La file d'attente (0.15.0 ; waits) : queueStart met une demande en file derrière l'action qui retient (by), queuedOf la
 *  rend (action, by), releaseWaits la relit au relevé du panneau (refreshVibe), retryWaits relève le robot à neuf (surveyAgent) puis la
 *  relit, à la fin d'une course ou d'un tour de la conversation, et quand garder ou annuler libère le dossier, sans dépendre de l'affichage
 *  (panneau caché, écran verrouillé : T-31) : ce qui peut partir part seul (startAction, comme un clic), ce que la course ou l'action
 *  directe retient reste (busy, changing), tout autre refus (grisée, same, invalide…) quitte la file ; vibeStop la vide, et arrêté (halted), rien ne part de la file ni par la porte agent (vibeHalted). runEnd (run.wait) : la fin d'une course en cours, ou en attente puis partie (état done,
 *  failed ou stopped, sa réponse) ; null : ni l'une ni l'autre, ou la demande n'a plus de course (file vidée, invalide, agent oublié).
 *  Courses, avis, file et mode Vibe : en mémoire. closeRuns : l'agent oublié.
 *  Une course dont le skill a `context: fork` part sans tâches de fond (forked :
 *  CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1, le fork attend ses commandes) ; si une
 *  commande d'arrière-plan a quand même été coupée à sa fin, elle finit en échec et
 *  sa réponse le dit en tête (cutCommands, cutLine). Une course part avec l'environnement
 *  de son robot (launchOptions : son jeton, jamais un autre), le fork y ajoutant sa variable.
 *  Ne connaît pas : la page, les fenêtres.
 *  Utilisé par : controllers/vibecoder (releaseWaits), controllers/agents,
 *  controllers/module-code, controllers/commands (runOp, runEnd, queuedOf), menus/agent-menus. */
import fs from 'node:fs';
import path from 'node:path';
import type { RunSignal, SendResult, VibeArgs, VibeRunOp, VibeView } from 'shared/bridge';
import { EMPTY_LOG, runProgress, shortTarget, type AgentConfig, type RunRights } from 'core/agents';
import { agentList, vibeLang, type Config } from 'core/config';
import type { PreparedImage } from 'core/conversation';
import {
  cutCommands, cutLine, endNotice, GRACE_MS, headField, LOCKING, lockCode, lockText, nextVibeMode, ownRun, parseQuestions, runKey, skillModel,
  noticedOnShow, remainingModules, runPhase, runSignal, runTasks, type ActionDef, type Run, type RunState, type VibeMode,
} from 'core/vibecoder';
import { loadConfig, vibeActions, vibeOutDir, vibePluginDir } from 'app/settings';
import { agents, CLAUDE_MISSING, isBusy, launchOptions, pushAgents, sendToAgent } from './agents';
import { directLocks, lastView, refreshVibe, startAction, surveyAgent } from './vibecoder';

/** La fin d'une course, ce que rend run.wait. */
export type RunEnd = { action: string; state: 'done' | 'failed' | 'stopped'; reply: string };

// Une course, et ce que la règle et sa fin en retiennent : `reads` (elle lit seulement), `seen` (son tour a commencé),
// `tasks` (ses tâches de fond comptées au dernier changement, runTasks), `forked` (son skill est en sous-contexte), `grace` (le minuteur du délai de grâce, s'il court),
// `noticed` (l'état où l'utilisateur l'a vue, null : jamais).
type Live = Run & { reads: boolean; seen: boolean; forked: boolean; tasks: number; noticed: RunState | null; grace?: NodeJS.Timeout };

const stopGrace = (run: Live) => { clearTimeout(run.grace); run.grace = undefined; };

const all = new Map<string, Map<string, Live>>();                       // par agent, par clé : la dernière course
const waits = new Map<string, { id: string; args: VibeArgs; by: string }[]>();   // par agent : la file d'attente, dans l'ordre (queueStart)
const ends = new Map<string, { action: string; resolve: (end: RunEnd | null) => void }[]>();   // par agent : ceux qui attendent une fin (runEnd)
const notices = new Map<string, string[]>();                            // par agent : les avis pas encore envoyés
const wasBusy = new Set<string>();                                      // les conversations au travail au dernier changement
const signals = new Map<string, RunSignal>();                           // par agent : le signal montré au dernier changement
const modes = new Map<string, VibeMode>();                              // par agent : le mode Vibe (absent : off)
const sending = new Set<string>();                                      // un avis parti, le tour pas encore commencé (await du SDK)
let tab: string | null = null;                                          // l'agent dont l'onglet Actions est ouvert

const entryId = (agentId: string, key: string) => `${agentId}~${key}`;
const mine = (agentId: string) => [...(all.get(agentId)?.values() ?? [])];

// Le signal des courses de l'agent sur son robot (pushAgents).
export const runSignalOf = (agentId: string): RunSignal | null => runSignal(mine(agentId));

// Une course de l'agent a changé : vue d'office si son onglet Actions est ouvert ; le robot suit si son signal a changé.
function signalFollow(agentId: string) {
  if (tab === agentId) for (const r of mine(agentId)) r.noticed = r.state;
  const signal = runSignalOf(agentId);
  if (signal === (signals.get(agentId) ?? null)) return;
  if (signal) signals.set(agentId, signal); else signals.delete(agentId);
  pushAgents();
}

// L'agent est affiché, ou sa conversation lue : ses courses finies sont vues (noticedOnShow), le robot suit.
export function runsShown(agentId: string) {
  for (const r of mine(agentId)) r.noticed = noticedOnShow(r);
  signalFollow(agentId);
}

// Les tâches de fond des courses vivantes de l'agent (runTasks, au dernier changement de chacune).
export const runTasksOf = (agentId: string) =>
  mine(agentId).filter((r) => r.state === 'running' || r.state === 'asking').reduce((n, r) => n + r.tasks, 0);

// L'onglet Actions ouvert sur cet agent (null : fermé) : ses courses vues aussitôt.
export function runsTab(agentId: string | null) {
  tab = agentId;
  if (agentId) signalFollow(agentId);
}

// Les courses de l'agent (pour le relevé, l'onglet Actions).
export const runsOf = (agent: Pick<AgentConfig, 'id'>): Run[] => mine(agent.id);

// Celles qui retiennent les autres (LOCKING), pour blockedBy, le parcours et codeLock (module).
export const lockingRuns = (agentId: string) => mine(agentId).filter((r) => LOCKING.includes(r.state))
  .map((r) => ({ id: r.id, reads: r.reads, module: r.module }));

// La demande d'autorisation en attente de la course d'une action, pour runViews.
export const runPending = (agentId: string) => (id: string) => {
  const p = agents.pendingPermission(entryId(agentId, runKey(id)));
  return p ? { tool: p.tool, target: shortTarget(p.input) } : null;
};

// Le SKILL.md du skill qu'appelle un gabarit (« /vibecoder:<nom> … ») ; null pour un autre texte.
export function skillMd(template: string) {
  const name = /^\/vibecoder:([\w-]+)/.exec(template)?.[1];
  try { return name ? fs.readFileSync(path.join(vibePluginDir(), 'skills', name, 'SKILL.md'), 'utf8') : null; } catch { return null; }
}

// Ceux qui attendent la fin de `action` (runEnd) : résolus avec `end` (null : la demande n'aura pas de course).
function settle(agentId: string, action: string, end: RunEnd | null) {
  const list = ends.get(agentId) ?? [];
  for (const w of list.filter((x) => x.action === action)) w.resolve(end);
  ends.set(agentId, list.filter((x) => x.action !== action));
}

// run.wait : la fin de la course de l'action, en cours ou en attente (puis partie) ; null : ni l'une ni l'autre.
export function runEnd(agentId: string, action: string): Promise<RunEnd | null> {
  const live = mine(agentId).some((r) => r.id === action && (r.state === 'running' || r.state === 'asking'));
  if (!live && !waits.get(agentId)?.some((w) => w.id === action)) return Promise.resolve(null);
  return new Promise((resolve) => { ends.set(agentId, [...(ends.get(agentId) ?? []), { action, resolve }]); });
}

// Une demande qui doit attendre : en file derrière `by` (l'action qui retient) ; elle part seule (retryWaits).
export function queueStart(agent: Pick<AgentConfig, 'id'>, id: string, args: VibeArgs, by: string) {
  if (waits.get(agent.id)?.some((w) => w.id === id)) return;   // déjà en file : une seule fois
  waits.set(agent.id, [...(waits.get(agent.id) ?? []), { id, args, by }]);
}

// La file de l'agent, pour runs.
export const queuedOf = (agentId: string) => (waits.get(agentId) ?? []).map((w) => ({ action: w.id, by: w.by }));

// Une action partie à la demande de l'orchestrateur, comme au clic : vibe lance le mode, le relevé suit.
export function afterStart(agent: AgentConfig, id: string) {
  if (id === 'vibe') vibeStart(agent);
  void refreshVibe({ now: true });
}

// La file, dans l'ordre, contre l'état vivant et le relevé `view` : ce qui part (startAction, comme un clic) quitte la file, et ce
// qu'une course ou une action directe retient (busy, changing) y reste ; tout autre refus (grisée au relevé : PR fusionnée, étape
// passée ; same ; relecteur ; invalide, hors du catalogue) la quitte aussi, rien ne la retiendrait plus.
// Appelée par le relevé du panneau (refreshVibe) ; retryWaits en donne un neuf.
export function releaseWaits(agent: AgentConfig, view: VibeView) {
  const queue = waits.get(agent.id);
  if (!queue?.length) return;
  if (vibeHalted(agent.id)) { for (const w of queue) settle(agent.id, w.id, null); waits.delete(agent.id); return; }   // arrêté : rien ne part
  const cfg = loadConfig();
  const defs = vibeActions(vibeLang(cfg));
  const left = queue.filter((w) => {
    const def = defs.find((d) => d.id === w.id);
    const sent = def && startAction(agent, def, w.args, view, cfg);
    if (sent && sent.ok) {
      afterStart(agent, w.id);
      if (!ownRun(def)) settle(agent.id, w.id, null);   // pas une course : rien à attendre
      return false;
    }
    if (sent && (sent.reason === 'busy' || sent.reason === 'changing')) return true;   // retenue : elle reste
    settle(agent.id, w.id, null);   // refusée pour une autre raison : plus de course à attendre
    return false;
  });
  waits.set(agent.id, left);
}

// À la fin d'une course ou d'un tour, quand garder ou annuler libère le dossier : le robot relevé à neuf (affiché ou non, le panneau
// caché ou l'écran verrouillé n'y change rien), puis la file relue d'après ce relevé.
export async function retryWaits(agent: AgentConfig) {
  if (!waits.get(agent.id)?.length) return;
  const view = await surveyAgent(agent);
  if (view) releaseWaits(agent, view);
}

// Les droits de la course de l'action `def` lancée avec le gabarit `template` (rights : listSkill, runRules — le
// SKILL.md de ce skill, son dossier, l'AGENTS.md du dossier de l'agent, promptPrefix ; bounds : fileDecision sur les
// chemins réels du dossier de l'agent, de ses sorties et du plugin, def.reads).
export function runRights(agent: AgentConfig, def: ActionDef, template: string, cfg: Config): RunRights {
  void [agent, def, template, cfg];
  throw new Error('not implemented');
}

// Lance l'action `def` (son message déjà rempli : le texte, et les images qui partent avec lui) dans sa course,
// si aucune course vivante ni action directe en cours de l'agent ne la retient. Modèle et effort : ceux du skill
// que le texte appelle (la variante du modèle choisi, /vibecoder:<nom>--<modèle>), sinon ceux de l'agent.
// `module` : celui qu'elle génère (runModule), retenu tant qu'elle court.
// Retenue par une course ou une action directe : son texte (error) et sa clé (reason : lockCode, by : celle qui retient).
export function startRun(
  agent: AgentConfig, def: ActionDef, message: { text: string; images: PreparedImage[] }, cfg: Config, module: string | null = null,
): SendResult & { reason?: 'same' | 'busy' | 'changing'; by?: string } {
  const lang = vibeLang(cfg);
  const locks = [...lockingRuns(agent.id), ...directLocks(agent.id, vibeActions(lang))];
  const lock = lockCode(def, locks);
  if (lock) return { ok: false, error: lockText(lock, lang), reason: lock.code, by: lock.by };
  if (!agents.isAvailable(cfg.agentCommand)) return { ok: false, error: CLAUDE_MISSING };
  const key = runKey(def.id);
  const runs = all.get(agent.id) ?? new Map<string, Live>();
  all.set(agent.id, runs);
  const md = skillMd(message.text);
  const forked = headField(md, 'context') === 'fork';
  const run: Live = {
    id: def.id, key, since: Date.now(), end: null, state: 'running', reply: '', reads: !!def.reads, seen: false, forked, tasks: 0, noticed: null, module,
    total: def.id === 'modules' ? remainingModules(lastView(agent.id)?.modules ?? []) : null,
    sessionId: def.id === 'answers' ? runs.get(key)?.sessionId ?? null : null,
  };
  runs.set(key, run);   // tout de suite : un second clic la voit (blockedBy)
  signalFollow(agent.id);   // le robot clignote dès le départ
  const entry: AgentConfig = {
    ...agent, id: entryId(agent.id, key), name: `${agent.name} ~ ${def.id}`, sessionId: run.sessionId,
    model: skillModel(md) ?? agent.model, effort: headField(md, 'effort') || agent.effort,
  };
  // Un processus neuf par course : rewind ramène au premier message de CELLE-CI.
  // Ses tâches de fond oubliées : celles d'une course précédente, tuée en route, la tiendraient en cours.
  const launch = launchOptions(agent, cfg);   // le jeton est celui du robot, pas de la course
  agents.close(entry.id).then(() => agents.forgetReply(entry.id)).then(() => agents.send(entry, message, {
    ...launch, checkpoint: true,
    // Un fork qui lance une commande de fond la verrait tuée à sa réponse : il l'attend au premier plan.
    // env remplace celui du processus (le SDK ne fusionne pas) : celui du robot, sinon process.env recopié.
    ...(forked && { env: { ...(launch.env ?? process.env), CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1' } }),
    onChange: () => changed(agent.id, run),
    onSession: (id) => { run.sessionId = id; },
    onPermission: () => { refreshVibe(); },
  })).catch((err) => {
    // Partie en échec avant son tour : une fin comme une autre, l'orchestrateur en est prévenu.
    if (run.state !== 'running') return;
    finish(agent.id, run, err instanceof Error ? err.message : String(err));
    refreshVibe();
  });
  return { ok: true };
}

// Un changement de l'entrée d'une course (son tour, ses tâches de fond) : son état suit (runPhase) ; revenue au
// repos après avoir travaillé, sans qu'on l'ait arrêtée : sa fin. Pas de limite de temps : on l'arrête à la main.
// Ses tâches de fond tombées à 0 hors tour (grace) : elle reste en cours GRACE_MS, le temps du tour qu'elles
// réveillent ; un tour qui commence annule le minuteur, au bout son état relu (ce même chemin) la finit au repos.
// Un processus mort emporte ses tâches de fond (core/agents) : la course revient au repos.
function changed(agentId: string, run: Live) {
  const before = run.tasks;
  if (run.state === 'running' || run.state === 'asking') {
    const { status, tasks } = agents.state(entryId(agentId, run.key));
    const phase = runPhase(status, tasks, run.tasks);
    run.tasks = runTasks(status, tasks, run.tasks);
    const log = agents.tasks(entryId(agentId, run.key));
    if (run.total != null && (log !== EMPTY_LOG || !run.progress)) run.progress = { ...runProgress(log), total: run.total };   // gardé après la fin, et après la mort du processus (log vidé)
    if (phase === 'grace') run.grace ??= setTimeout(() => { run.grace = undefined; changed(agentId, run); }, GRACE_MS);
    else if (phase !== 'idle') { stopGrace(run); Object.assign(run, { seen: true, state: phase }); }
    else if (run.seen && !run.grace) finish(agentId, run);
  }
  signalFollow(agentId);
  if (run.tasks !== before) pushAgents();   // le robot compte ses tâches de fond (runTasksOf)
  refreshVibe();
}

// Fin d'une course : sa réponse (ou `failure` : elle n'a pas pu partir), son processus fermé, l'avis à la
// conversation, les demandes revues. Un fork dont une commande de fond a été coupée (la variable n'a pas agi) :
// en échec, sa réponse le dit en tête ; les tâches sont lues avant la fermeture, qui les emporte.
function finish(agentId: string, run: Live, failure?: string) {
  stopGrace(run);
  const entry = entryId(agentId, run.key);
  const cfg = loadConfig();
  const lang = vibeLang(cfg);
  const last = failure === undefined ? agents.lastReply(entry) : { error: true, text: failure };
  const cut = run.forked && failure === undefined ? cutCommands(agents.tasks(entry).tasks) : 0;
  Object.assign(run, { state: cut || last?.error ? 'failed' : 'done', reply: (cut ? `${cutLine(cut, lang)}\n` : '') + (last?.text ?? ''), end: Date.now() });
  void agents.close(entry);
  signalFollow(agentId);
  settle(agentId, run.id, { action: run.id, state: run.state as 'done' | 'failed', reply: run.reply });
  const def = vibeActions(lang).find((d) => d.id === run.id);
  notify(agentId, endNotice(run, def, lang));
  const agent = agentList(cfg).find((a) => a.id === agentId);
  if (!agent) return;
  deliver(agent, cfg);
  void retryWaits(agent);
}

// Un avis à l'orchestrateur (fin de course), envoyé par deliver.
const notify = (agentId: string, notice: string) => notices.set(agentId, [...(notices.get(agentId) ?? []), notice]);

// Les avis en attente, d'un message, si la conversation est libre (I-25) et qu'aucun avis n'est en envoi.
function deliver(agent: AgentConfig, cfg: Config) {
  const queued = notices.get(agent.id);
  if (!queued?.length || isBusy(agent.id) || sending.has(agent.id)) return;
  notices.delete(agent.id);
  if (!sendToAgent(agent, { text: queued.join('\n'), images: [] }, cfg).ok) notices.set(agent.id, queued);
  else sending.add(agent.id);
}

// Le mode Vibe de l'agent est en cours (le relevé, la bannière) ; arrêté (halted) : non.
export const vibeOn = (agentId: string) => modes.get(agentId) === 'on';

// Le mode Vibe de l'agent est arrêté (halted) : rien de nouveau ne part, ni de la file ni par sa porte (controllers/commands).
export const vibeHalted = (agentId: string) => modes.get(agentId) === 'halted';

// Vibe lancé (l'action vibe partie).
export const vibeStart = (agent: Pick<AgentConfig, 'id'>) => { modes.set(agent.id, 'on'); };

// La bannière : Vibe arrêté ; la file d'attente jetée, la course en cours finit ; déjà au repos : off.
export function vibeStop(agent: Pick<AgentConfig, 'id'>) {
  const mode = modes.get(agent.id);
  if (!mode) return;
  modes.set(agent.id, nextVibeMode(mode, 'stop'));
  for (const w of waits.get(agent.id) ?? []) settle(agent.id, w.id, null);
  waits.delete(agent.id);
  void rest(agent);
}

// Le mode où irait l'agent au repos (nextVibeMode) ; undefined : hors Vibe. Vivante : une course qui travaille
// (arrêtée, elle attend Garder ou Annuler sans rien faire). Un avis qui vient de partir compte comme un tour
// (son tour commence après un await). Les questions : celles de <sorties>/questions.md, lues comme le parcours,
// que l'orchestrateur a pu écrire pendant le tour qui finit.
function restMode(agentId: string) {
  const mode = modes.get(agentId);
  if (!mode) return undefined;
  let questions = 0;
  try { questions = parseQuestions(fs.readFileSync(path.join(vibeOutDir(agentId), 'questions.md'), 'utf8')).length; } catch { /* aucune */ }
  return nextVibeMode(mode, {
    busy: isBusy(agentId) || sending.has(agentId), live: mine(agentId).filter((r) => r.state === 'running' || r.state === 'asking').length,
    waiting: waits.get(agentId)?.length ?? 0, questions,
  });
}

// Un point de repos : le mode suit (restMode) ; changé, la page aussi. Quitter on : un relevé forcé d'abord,
// encore en Vibe, pour les ✓ des dernières étapes faites (vibeMarks, F-102), puis le mode revu.
// ponytail: un envoi qui échoue après coup laisse `sending` posé jusqu'au tour suivant ; à lever s'il arrive.
async function rest(agent: Pick<AgentConfig, 'id'>) {
  const mode = modes.get(agent.id);
  if (restMode(agent.id) === mode) return;
  if (mode === 'on') await refreshVibe({ now: true });
  const now = modes.get(agent.id);
  const next = restMode(agent.id);
  if (!next || next === now) return;
  if (next === 'off') modes.delete(agent.id); else modes.set(agent.id, next);
  refreshVibe();
}

// À chaque changement des agents (pushAgents) : un tour de conversation fini → la file revue ; une
// conversation libre → ses avis de fin ; puis, tour fini, le mode Vibe au repos (rest).
export function runsFollow(list: AgentConfig[], cfg: Config) {
  for (const agent of list) {
    const busy = isBusy(agent.id);
    const ended = !busy && wasBusy.delete(agent.id);
    if (ended) void retryWaits(agent);
    if (busy) { wasBusy.add(agent.id); sending.delete(agent.id); }
    deliver(agent, cfg);
    if (ended) void rest(agent);
  }
}

// Agir sur une course de l'agent (l'id de son action) : l'arrêter (en cours), la garder ou l'annuler
// (arrêtée), répondre à sa demande d'autorisation. false : rien à faire.
export async function runOp(agent: AgentConfig, id: string, op: VibeRunOp): Promise<boolean> {
  const run = mine(agent.id).find((r) => r.id === id);
  if (!run) return false;
  const entry = entryId(agent.id, run.key);
  if (op === 'stop' && (run.state === 'running' || run.state === 'asking')) {
    stopGrace(run);
    Object.assign(run, { state: 'stopped', end: Date.now() });   // avant interrupt : sa fin n'en est pas une
    agents.interrupt(entry);
    settle(agent.id, run.id, { action: run.id, state: 'stopped', reply: run.reply });
  } else if ((op === 'keep' || op === 'undo') && run.state === 'stopped') {
    if (op === 'undo') {
      const back = await agents.rewind(entry);   // retient encore (stopped) pendant l'attente
      Object.assign(run, back.ok ? { state: 'undone' } : { state: 'failed', reply: back.error ?? '' });
    } else run.state = 'kept';
    void agents.close(entry);
  } else if (op === 'allow' || op === 'always' || op === 'deny') {
    if (!agents.answer(entry, op)) return false;
  } else return false;
  signalFollow(agent.id);
  refreshVibe({ now: true });
  if (op === 'stop') void rest(agent);   // arrêtée : ni avis ni tour, le repos est ici
  else if (op === 'keep' || op === 'undo') void retryWaits(agent);   // le dossier est libéré
  return true;
}

// Les courses et actions directes qui retenaient au relevé `view` (ce que le parcours a passé à blockedBy).
export const viewLocks = (view: VibeView, defs: ActionDef[]) => [
  ...(view.runs ?? []).filter((r) => LOCKING.includes(r.state)).map((r) => r.id),
  ...view.actions.filter((a) => a.direct?.running).map((a) => a.id),
].map((id) => ({ id, reads: !!defs.find((d) => d.id === id)?.reads }));

// L'agent oublié (retiré, nouvelle session, robot d'un worktree retiré) : ses courses fermées et oubliées.
export function closeRuns(agent: Pick<AgentConfig, 'id'>) {
  for (const r of mine(agent.id)) { stopGrace(r); agents.forget(entryId(agent.id, r.key)); }
  for (const w of ends.get(agent.id) ?? []) w.resolve(null);
  for (const m of [all, waits, ends, notices, signals, modes]) m.delete(agent.id);
  wasBusy.delete(agent.id);
  sending.delete(agent.id);
}
