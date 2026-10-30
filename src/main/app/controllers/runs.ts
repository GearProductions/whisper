/** runs — les courses : une action d'étape qui court à part de la conversation,
 *  sous sa propre entrée du runtime des agents, `<agent>~<clé>` (runKey).
 *  Lancer (startRun : si aucune course vivante ni action directe en cours ne
 *  la retient, blockedBy ; elle retient le module qu'elle génère, Run.module,
 *  pour codeLock ; le robot suit dès le départ ; un processus neuf, suivi des fichiers écrits ;
 *  modèle et effort du skill que son message appelle, sinon ceux de l'agent ; answers reprend la session de la course de la note),
 *  suivre (son état d'après runPhase : en cours tant que son processus travaille ou que le runtime lui voit des
 *  tâches de fond — hors repos, le plus haut des comptes, runTasks —, aucune limite de temps ; son avancement,
 *  Run.progress d'après les tâches du runtime et le total de modules restants au départ (action modules), gardé
 *  après sa fin, jamais lu pour son état ; ses tâches de fond tombées à 0 hors tour, GRACE_MS laissés au tour
 *  qu'elles réveillent ; sa fin, revenue au repos après avoir travaillé, ou son échec avant
 *  même son tour : fermée, et un avis à la conversation de l'agent, gardé tant qu'elle travaille, I-25), agir sur une course (runOp : l'arrêter — son
 *  processus et son verrou restent —, la garder ou l'annuler — rewind, puis
 *  fermée —, répondre à sa demande d'autorisation), les demandes de
 *  l'orchestrateur (runRequests : <sorties>/actions/<id>.start | .stop ; un
 *  .start retenu reste, « en attente » ; il part comme un clic, par
 *  startAction de controllers/vibecoder, I-38 ; une demande illisible, inconnue,
 *  pas proposée, pas une course, déjà en cours ou invalide est supprimée, et
 *  l'agent prévenu (requestNotice, comme un avis de fin) ; partie avec des
 *  arguments ignorés, prévenu aussi), et <sorties>/actions.json, réécrit à chaque changement.
 *  Le signal des courses sur le robot (F-55, runSignal) : chacune retient l'état où on l'a vue (noticed) ; runsTab :
 *  l'agent dont l'onglet Actions est ouvert, ses courses vues d'office (une question reste jusqu'à sa
 *  réponse) ; runSignalOf (pour pushAgents) ; à chaque changement d'une course, le robot suit si son signal a changé.
 *  Le mode Vibe de chaque agent (F-103 ; vibe-mode) : vibeStart (on), vibeStop (halted : les demandes
 *  retenues et leurs .start jetés, rien d'interrompu), vibeOn (on seulement) ; arrêté, chaque .start est
 *  refusé ('halted'), les .stop toujours lus ; au repos (une conversation qui finit son tour, après ses
 *  demandes et ses avis ; vibeStop ; une course arrêtée) : nextVibeMode, avec les questions ouvertes de
 *  <sorties>/questions.md (parseQuestions, comme le parcours) ; quitter on : un relevé forcé d'abord (ses ✓).
 *  Courses, avis, demandes retenues et mode Vibe : en mémoire. closeRuns : l'agent oublié.
 *  Une course dont le skill a `context: fork` part sans tâches de fond (forked :
 *  CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1, le fork attend ses commandes) ; si une
 *  commande d'arrière-plan a quand même été coupée à sa fin, elle finit en échec et
 *  sa réponse le dit en tête (cutCommands, cutLine).
 *  Ne connaît pas : la page, les fenêtres.
 *  Utilisé par : controllers/vibecoder, controllers/agents,
 *  controllers/module-code, menus/agent-menus. */
import fs from 'node:fs';
import path from 'node:path';
import type { RunSignal, SendResult, VibeRunOp, VibeView } from 'shared/bridge';
import { EMPTY_LOG, runProgress, shortTarget, type AgentConfig } from 'core/agents';
import { agentList, vibeLang, type Config } from 'core/config';
import {
  blockedBy, cutCommands, cutLine, endNotice, GRACE_MS, headField, LOCKING, nextVibeMode, ownRun, parseQuestions, parseRequest, requestNotice, runKey, skillModel,
  remainingModules, runPhase, runsFile, runSignal, runTasks, type ActionDef, type Run, type RunState, type VibeMode,
} from 'core/vibecoder';
import { loadConfig, vibeActions, vibeOutDir, vibePluginDir } from 'app/settings';
import { agents, CLAUDE_MISSING, isBusy, launchOptions, pushAgents, sendToAgent } from './agents';
import { directLocks, lastView, refreshVibe, startAction } from './vibecoder';

const REQUEST_MAX = 64 * 1024;   // une demande plus grosse n'est pas lue

// Une course, et ce que la règle et sa fin en retiennent : `reads` (elle lit seulement), `seen` (son tour a commencé),
// `tasks` (ses tâches de fond comptées au dernier changement, runTasks), `forked` (son skill est en sous-contexte), `grace` (le minuteur du délai de grâce, s'il court),
// `noticed` (l'état où l'utilisateur l'a vue, null : jamais).
type Live = Run & { reads: boolean; seen: boolean; forked: boolean; tasks: number; noticed: RunState | null; grace?: NodeJS.Timeout };

const stopGrace = (run: Live) => { clearTimeout(run.grace); run.grace = undefined; };

const all = new Map<string, Map<string, Live>>();                       // par agent, par clé : la dernière course
const waits = new Map<string, { id: string; reason: string }[]>();      // par agent : les .start retenus
const notices = new Map<string, string[]>();                            // par agent : les avis pas encore envoyés
const views = new Map<string, VibeView>();                              // par agent : le dernier relevé (runRequests)
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

// <sorties>/actions.json, pour l'orchestrateur.
function save(agentId: string) {
  try {
    fs.writeFileSync(path.join(vibeOutDir(agentId), 'actions.json'),
      runsFile(mine(agentId), vibeActions(vibeLang(loadConfig())), waits.get(agentId) ?? []));
  } catch (err) { console.error(`VibeCoder : actions.json (${err instanceof Error ? err.message : err})`); }
}

// Lance l'action `def` (son message déjà rempli) dans sa course, si aucune course vivante ni action directe
// en cours de l'agent ne la retient. Modèle et effort : ceux du skill que le message appelle (la variante
// du modèle choisi à l'écran, /vibecoder:<nom>--<modèle>), sinon ceux de l'agent. `module` : celui qu'elle
// génère (runModule), retenu tant qu'elle court.
export function startRun(agent: AgentConfig, def: ActionDef, message: string, cfg: Config, module: string | null = null): SendResult {
  const lang = vibeLang(cfg);
  const held = blockedBy(def, [...lockingRuns(agent.id), ...directLocks(agent.id, vibeActions(lang))], lang);
  if (held) return { ok: false, error: held };
  if (!agents.isAvailable(cfg.agentCommand)) return { ok: false, error: CLAUDE_MISSING };
  const key = runKey(def.id);
  const runs = all.get(agent.id) ?? new Map<string, Live>();
  all.set(agent.id, runs);
  const md = skillMd(message);
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
  agents.close(entry.id).then(() => agents.forgetReply(entry.id)).then(() => agents.send(entry, { text: message, images: [] }, {
    ...launchOptions(agent, cfg), checkpoint: true,
    // Un fork qui lance une commande de fond la verrait tuée à sa réponse : il l'attend au premier plan.
    // env remplace celui du processus (le SDK ne fusionne pas) : process.env recopié.
    ...(forked && { env: { ...process.env, CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1' } }),
    onChange: () => changed(agent.id, run),
    onSession: (id) => { run.sessionId = id; },
    onPermission: () => { refreshVibe(); },
  })).catch((err) => {
    // Partie en échec avant son tour : une fin comme une autre, l'orchestrateur en est prévenu.
    if (run.state !== 'running') return;
    finish(agent.id, run, err instanceof Error ? err.message : String(err));
    save(agent.id);
    refreshVibe();
  });
  save(agent.id);
  return { ok: true };
}

// Un changement de l'entrée d'une course (son tour, ses tâches de fond) : son état suit (runPhase) ; revenue au
// repos après avoir travaillé, sans qu'on l'ait arrêtée : sa fin. Pas de limite de temps : on l'arrête à la main.
// Ses tâches de fond tombées à 0 hors tour (grace) : elle reste en cours GRACE_MS, le temps du tour qu'elles
// réveillent ; un tour qui commence annule le minuteur, au bout son état relu (ce même chemin) la finit au repos.
// Un processus mort emporte ses tâches de fond (core/agents) : la course revient au repos.
function changed(agentId: string, run: Live) {
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
  save(agentId);
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
  const def = vibeActions(lang).find((d) => d.id === run.id);
  notify(agentId, endNotice(run, def, lang, vibeOutDir(agentId)));
  const agent = agentList(cfg).find((a) => a.id === agentId);
  if (!agent) return;
  deliver(agent, cfg);
  runRequests(agent);
}

// Un avis à l'orchestrateur (fin de course, demande refusée ou aux arguments ignorés), envoyé par deliver.
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

// Vibe lancé (l'action vibe partie).
export const vibeStart = (agent: Pick<AgentConfig, 'id'>) => { modes.set(agent.id, 'on'); };

// La bannière : Vibe arrêté ; les demandes retenues et leurs .start jetés, la course en cours finit ; déjà au repos : off.
export function vibeStop(agent: Pick<AgentConfig, 'id'>) {
  const mode = modes.get(agent.id);
  if (!mode) return;
  modes.set(agent.id, nextVibeMode(mode, 'stop'));
  for (const w of waits.get(agent.id) ?? []) fs.rmSync(path.join(vibeOutDir(agent.id), 'actions', `${w.id}.start`), { force: true });
  waits.delete(agent.id);
  save(agent.id);
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

// À chaque changement des agents (pushAgents) : un tour de conversation fini → les demandes revues ; une
// conversation libre → ses avis de fin ; puis, tour fini, le mode Vibe au repos (rest).
export function runsFollow(list: AgentConfig[], cfg: Config) {
  for (const agent of list) {
    const busy = isBusy(agent.id);
    const ended = !busy && wasBusy.delete(agent.id);
    if (ended) runRequests(agent);
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
  save(agent.id);
  refreshVibe({ now: true });
  if (op === 'stop') void rest(agent);   // arrêtée : ni avis ni tour, le repos est ici
  return true;
}

// Les courses et actions directes qui retenaient au relevé `view` (ce que le parcours a passé à blockedBy).
export const viewLocks = (view: VibeView, defs: ActionDef[]) => [
  ...(view.runs ?? []).filter((r) => LOCKING.includes(r.state)).map((r) => r.id),
  ...view.actions.filter((a) => a.direct?.running).map((a) => a.id),
].map((id) => ({ id, reads: !!defs.find((d) => d.id === id)?.reads }));

// Un fichier ordinaire, petit : son texte ; null sinon (parti entre-temps, dossier, lien…).
function readRequest(file: string) {
  try {
    const st = fs.lstatSync(file);
    return st.isFile() && st.size <= REQUEST_MAX ? fs.readFileSync(file, 'utf8') : null;
  } catch { return null; }
}

// Les demandes de l'orchestrateur, une à une contre l'état vivant (les .stop d'abord) : un .stop arrête la
// course et retire le .start de la même action ; un .start part comme un clic (startAction), ou reste en
// attente si quelque chose le retient (une course, une raison de l'écran : PR fusionnée…) ; illisible,
// invalide, ou pour une action déjà en cours (elle repartirait à sa fin) : supprimé, et l'agent prévenu ;
// partie avec des arguments ignorés : prévenu aussi (deliver ici si aucune course ne vit ; sinon au prochain
// passage où la conversation est libre, runsFollow ou la fin d'une course). `view` : le relevé (retenu pour
// les passages sans relevé). true : une course est partie.
export function runRequests(agent: AgentConfig, view = views.get(agent.id)): boolean {
  if (!view) return false;
  views.set(agent.id, view);
  const dir = path.join(vibeOutDir(agent.id), 'actions');
  let names: string[];
  try { names = fs.readdirSync(dir); } catch { return false; }
  const cfg = loadConfig();
  const lang = vibeLang(cfg);
  const defs = vibeActions(lang);
  const waiting: { id: string; reason: string }[] = [];
  let started = false;
  for (const name of names.sort((a, b) => Number(b.endsWith('.stop')) - Number(a.endsWith('.stop')))) {
    const file = path.join(dir, name);
    const drop = () => fs.rmSync(file, { force: true, recursive: true });   // un dossier aussi
    const refuse = (id: string, why: string) => { drop(); notify(agent.id, requestNotice(id, { refused: why }, lang)); };
    const text = readRequest(file);
    if (text === null) { if (fs.lstatSync(file, { throwIfNoEntry: false })) refuse(name, 'unreadable'); continue; }   // disparu : rien à dire
    const req = parseRequest(name, text);
    if (!req) { refuse(name, 'unreadable'); continue; }
    if (req.op === 'stop') {
      void runOp(agent, req.id, 'stop');
      fs.rmSync(path.join(dir, `${req.id}.start`), { force: true });
      drop();
      continue;
    }
    const def = defs.find((d) => d.id === req.id);
    const shown = view.actions.find((a) => a.id === req.id);
    const live = lockingRuns(agent.id);
    if (modes.get(agent.id) === 'halted') { refuse(req.id, 'halted'); continue; }
    if (!def) { refuse(req.id, 'unknown'); continue; }
    const why = !shown ? 'hidden' : !ownRun(def) ? 'direct' : live.some((r) => runKey(r.id) === runKey(def.id)) ? 'same' : null;
    if (why) { refuse(req.id, why); continue; }
    const sent = startAction(agent, def, req.args, view, cfg);
    if (!sent.ok && 'invalid' in sent) { refuse(req.id, sent.error ?? ''); continue; }
    if (!sent.ok) { waiting.push({ id: req.id, reason: sent.error ?? '' }); continue; }
    started = true;
    drop();
    if (sent.ignored?.length) notify(agent.id, requestNotice(req.id, { ignored: sent.ignored }, lang));
  }
  waits.set(agent.id, waiting);
  save(agent.id);
  if (!lockingRuns(agent.id).length) deliver(agent, cfg);   // une course vit : l'avis attend runsFollow ou sa fin
  return started;
}

// L'agent oublié (retiré, nouvelle session, robot d'un worktree retiré) : ses courses fermées et oubliées.
export function closeRuns(agent: Pick<AgentConfig, 'id'>) {
  for (const r of mine(agent.id)) { stopGrace(r); agents.forget(entryId(agent.id, r.key)); }
  for (const m of [all, waits, notices, views, signals, modes]) m.delete(agent.id);
  wasBusy.delete(agent.id);
  sending.delete(agent.id);
  save(agent.id);
}
