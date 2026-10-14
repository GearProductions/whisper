/** runtime — les agents au travail. Un processus Claude Code par agent, lancé
 *  au premier message et gardé entre les tours : les messages suivants passent
 *  par son entrée (une file ouverte tant qu'il vit). Une tâche de fond survit
 *  ainsi au tour qui l'a lancée ; sa notification fait parfois repartir
 *  l'agent de lui-même : c'est un tour comme un autre, dont la réponse arrive
 *  non lue. Le premier processus crée la session, les suivants la reprennent
 *  (`resume`). Ce qu'un processus vivant ne peut pas changer (dossier, effort,
 *  consigne, commande : launchKey) le fait relancer au message suivant.
 *
 *  Mode « manuel » : l'agent demande l'autorisation avant d'agir (canUseTool) ;
 *  la demande remonte à l'appli, qui répond par answer(). Plusieurs demandes
 *  peuvent arriver à la fois (outils lancés en parallèle) : elles attendent en
 *  FILE et se montrent l'une après l'autre. Une demande sans réponse bloque
 *  Claude Code indéfiniment : aucune ne doit se perdre (I-17).
 *
 *  Le mode et le modèle changés s'appliquent aussitôt au processus, tour en
 *  cours ou non (setMode, setModel). Interrompre = demander à Claude Code
 *  d'arrêter son tour ; fermer = fermer son entrée ; on ne tue qu'en dernier
 *  recours (I-19).
 *  Ses tâches de fond sont tenues à jour d'après chaque message du flux (tasks).
 *  Ne connaît pas : Electron, les fenêtres ; SDK, lancement et journal injectés.
 *  Utilisé par : app/controllers (agents, conversation), app/lifecycle. */
import { createQueue, type AsyncQueue } from 'helpers/async-queue';
import { AUDIO_RULES, EDIT_TOOLS, MODES } from './constants';
import { launchKey, queryOptions, userMessage } from './options';
import { describeRules, sessionRules, type SessionRule } from './permissions';
import { shortTarget, splitReply } from './reply';
import { applyTaskEvent, EMPTY_LOG, runningTasks, type TaskLog } from './tasks';
import type { AgentConfig, JournalFn, Launch, OutgoingMessage, Sdk, SdkMessage, SdkQuery, TurnHooks } from './types';

export type AgentStatus = 'idle' | 'working' | 'asking' | 'error';
export type Reply = { text: string; audio: string; error?: boolean; asked: string };
type Response = Record<string, unknown>;
type Pending = { key: number; tool: string; input: unknown; rules: SessionRule[]; resolve: (r: Response) => void; at: number };
// Le processus de l'agent : `input` son entrée, `key` sa launchKey, `ended` sa fin.
type Proc = { id: string; query: SdkQuery; input: AsyncQueue<SdkMessage>; abort: AbortController; key: string; ended: Promise<void> };
// Le tour en cours : `asked` le message envoyé ('' : tour commencé par l'agent).
type Turn = { asked: string; since: number; resolve: () => void; permissionFailures: number; interrupted: boolean };
type Runtime = {
  status: AgentStatus;
  process: Proc | null;
  turn: Turn | null;
  hooks: TurnHooks | null; // ceux du dernier send : le processus les sert entre les tours
  pending: Pending[];
  last: Reply | null;
  sent?: OutgoingMessage | null;
  unread: boolean;
  name?: string;
  contextWindow?: number | null;
  contextUsed?: number | null;
  tasks: TaskLog; // ses tâches de fond, d'après le flux du processus
};

export type RuntimeDeps = {
  loadSdk(): Promise<Sdk>;
  launcher(command: unknown): Launch | null;
  journal: JournalFn;
};

const INTERRUPT_GRACE_MS = 5000;
const PROBE_MS = 30000;

export function createAgentRuntime({ loadSdk, launcher, journal }: RuntimeDeps) {
  // id → état ; `pending` : la file des demandes d'autorisation, la plus ancienne en tête.
  const runtime = new Map<string, Runtime>();
  const closing = new Set<Promise<void>>(); // processus en train de sortir (cf. close) : la fermeture de l'appli les attend
  let nextKey = 1; // numéro des demandes d'autorisation (cf. answer)

  const rt = (id: string) => {
    if (!runtime.has(id)) runtime.set(id, { status: 'idle', process: null, turn: null, hooks: null, pending: [], last: null, unread: false, tasks: EMPTY_LOG });
    return runtime.get(id)!;
  };
  const changed = (r: Runtime) => { if (r.hooks) r.hooks.onChange(); };

  // `since` : début du tour en cours (ms), pour le temps écoulé ; `contextWindow` :
  // la taille de la fenêtre de contexte, connue après un tour (ou une sonde).
  // `contextUsed` : le contexte occupé selon la dernière sonde (cf. probe).
  const state = (id: string) => {
    const r = rt(id);
    return {
      status: r.status, unread: r.unread, hasReply: !!r.last, since: r.turn ? r.turn.since : null,
      contextWindow: r.contextWindow || null, contextUsed: Number.isFinite(r.contextUsed) ? r.contextUsed! : null,
      tasks: runningTasks(r.tasks),
    };
  };

  // Retire `p` de la file et répond à Claude Code. false si déjà réglée.
  function settle(r: Runtime, p: Pending, response: Response) {
    const i = r.pending.indexOf(p);
    if (i < 0) return false;
    r.pending.splice(i, 1);
    if (r.status === 'asking' && !r.pending.length) r.status = 'working';
    p.resolve(response);
    return true;
  }

  // Une demande d'autorisation : en file. Claude Code peut l'annuler lui-même
  // (`signal` : outil abandonné, tour interrompu) — elle quitte alors la file.
  // Une par processus ; prévient par les hooks du dernier send.
  const asker = (r: Runtime, id: string) => (tool: string, input: unknown, { suggestions, signal }: { suggestions?: unknown; signal?: AbortSignal } = {}) => new Promise<Response>((resolve) => {
    const p: Pending = { key: nextKey++, tool, input, rules: sessionRules(suggestions), resolve, at: Date.now() };
    const who = { id, name: r.name };
    r.pending.push(p);
    r.status = 'asking';
    journal(who, 'autorisation demandée', `${tool} ${shortTarget(input)} (${r.pending.length} en attente)`);
    if (signal) {
      signal.addEventListener('abort', () => {
        const head = r.pending[0] === p;
        if (!settle(r, p, { behavior: 'deny', message: 'Annulé.' })) return;
        journal(who, 'autorisation annulée par Claude Code', `${tool} ${shortTarget(input)}`);
        changed(r);
        if (head && r.pending[0]) r.hooks!.onPermission(r.pending[0]); // la suivante prend sa place
      }, { once: true });
    }
    changed(r);
    // Le panneau montre la tête de file : on ne prévient que pour la première.
    if (r.pending[0] === p) r.hooks!.onPermission({ tool, input });
  });

  function begin(r: Runtime, id: string, asked: string, resolve: () => void) {
    r.turn = { asked, since: Date.now(), resolve, permissionFailures: 0, interrupted: false };
    r.status = 'working';
    journal({ id, name: r.name }, 'tour commencé', asked ? '' : 'par l\'agent lui-même (tâche de fond)');
    changed(r);
  }

  // Fin du tour en cours : `reply` la réponse, ou `failure` la raison de l'échec.
  function end(r: Runtime, id: string, reply: string | null, failure: string | null) {
    const t = r.turn!;
    r.turn = null;
    // Interrompu à notre demande : Claude Code finit son tour par une erreur ou
    // une réponse partielle, c'est une interruption.
    if (t.interrupted) { failure = 'interrupted'; reply = null; }
    // Fin du tour : une demande restée sans réponse n'a plus d'objet.
    for (const p of [...r.pending]) settle(r, p, { behavior: 'deny', message: 'Tour terminé.' });
    journal({ id, name: r.name }, 'tour fini', `${reply !== null ? 'réponse' : failure} en ${Math.round((Date.now() - t.since) / 1000)} s`
      + `${t.permissionFailures ? `, ${t.permissionFailures} demande(s) d'autorisation en échec` : ''}`);
    r.sent = null;
    const { asked } = t;
    // Après /compact, la dernière mesure du contexte ne vaut plus.
    if (/^\/compact\b/.test(asked)) r.contextUsed = null;
    // Une commande sans réponse écrite (/compact…) : on dit qu'elle est faite.
    if (reply === '' && /^\//.test(asked)) reply = `${asked.split(/\s/)[0]} : fait.`;
    if (reply !== null) {
      r.last = { ...splitReply(reply), asked };
      // Dit dans la réponse elle-même qu'une action n'a pas pu être autorisée.
      if (t.permissionFailures) {
        r.last.text += `\n\n⚠ ${t.permissionFailures} demande(s) d'autorisation n'ont pas pu aboutir : l'agent n'a pas pu faire ces actions (détails dans le journal des agents).`;
      }
      r.status = 'idle';
    } else {
      const messages: Record<string, string> = {
        interrupted: 'Interrompu.',
        error_max_turns: 'L\'agent s\'est arrêté : trop d\'étapes.',
        error_during_execution: 'L\'agent a rencontré une erreur pendant l\'exécution.',
      };
      const text = messages[failure!] || `L'agent n'a pas pu répondre : ${failure || 'erreur inconnue'}.`;
      r.last = { text, audio: text, error: true, asked };
      r.status = failure === 'interrupted' ? 'idle' : 'error';
    }
    r.unread = true;
    changed(r);
    t.resolve();
  }

  // Lit le processus jusqu'à sa fin. Mort (de lui-même, fermé ou tué), il est
  // oublié : le message suivant en relance un.
  async function loop(r: Runtime, id: string, proc: Proc) {
    let failure = 'erreur';
    try {
      for await (const m of proc.query) {
        const before = runningTasks(r.tasks);
        r.tasks = applyTaskEvent(r.tasks, m, Date.now());
        if (runningTasks(r.tasks) !== before) changed(r); // l'icône suit
        if (m.type === 'system' && m.subtype === 'init' && m.session_id) r.hooks!.onSession(m.session_id);
        // L'agent repart sans message de notre part (une tâche de fond l'a notifié).
        if (m.type === 'assistant' && !r.turn) begin(r, id, '', () => {});
        if (m.type === 'assistant' || m.type === 'user') r.hooks!.onProgress?.();
        // Un outil refusé faute d'avoir pu demander l'autorisation (Claude Code ne
        // reçoit plus les réponses) : à signaler, c'est le symptôme d'un blocage.
        if (m.type === 'user' && r.turn && Array.isArray(m.message && m.message.content)) {
          for (const b of m.message.content) {
            const text = b && b.type === 'tool_result' ? JSON.stringify(b.content || '') : '';
            if (text.includes('Tool permission request failed') && !r.turn.interrupted && !proc.abort.signal.aborted) {
              r.turn.permissionFailures++;
              journal({ id, name: r.name }, 'ÉCHEC d\'une demande d\'autorisation', text.slice(0, 200));
            }
          }
        }
        if (m.type === 'result') {
          const windows = Object.values((m.modelUsage || {}) as Record<string, SdkMessage>).map((u) => u.contextWindow).filter(Number.isFinite);
          if (windows.length) r.contextWindow = Math.max(...windows);
          if (!r.turn) continue;
          if (m.subtype === 'success' && !m.is_error) end(r, id, m.result, null);
          else end(r, id, null, m.subtype === 'success' ? String(m.result || 'erreur') : m.subtype);
        }
      }
    } catch (err) {
      failure = (err instanceof Error && err.message) || failure;
    }
    if (r.process === proc) r.process = null;
    journal({ id, name: r.name }, 'processus terminé', proc.abort.signal.aborted ? 'tué' : '');
    if (r.turn) end(r, id, null, proc.abort.signal.aborted ? 'interrupted' : failure);
  }

  // Envoie `message` à l'agent. Résout quand le tour est fini ; rejette 'busy'
  // ou 'notInstalled'. `instructions` : la consigne ajoutée au prompt système
  // (AUDIO_RULES par défaut ; '' : aucune).
  async function send(agent: AgentConfig, message: OutgoingMessage, hooks: TurnHooks) {
    const { command, instructions = AUDIO_RULES } = hooks;
    const r = rt(agent.id);
    if (r.turn) throw new Error('busy');
    const launch = launcher(command);
    if (!launch) throw new Error('notInstalled');
    const sdk = await loadSdk();
    r.hooks = hooks;
    r.name = agent.name;
    const key = launchKey(agent, command, instructions);
    if (r.process && r.process.key !== key) await close(agent.id);
    if (r.process) {
      await r.process.query.setPermissionMode(agent.mode || 'default').catch(() => {});
      await r.process.query.setModel(agent.model || undefined).catch(() => {});
    }
    if (r.turn) throw new Error('busy'); // un autre send est passé pendant l'attente

    if (!r.process) {
      const input = createQueue<SdkMessage>();
      const abort = new AbortController();
      const query = sdk.query({ prompt: input, options: { ...queryOptions(agent, launch, instructions), abortController: abort, canUseTool: asker(r, agent.id) } });
      r.process = { id: agent.id, query, input, abort, key, ended: Promise.resolve() };
      r.process.ended = loop(r, agent.id, r.process); // ne lit rien avant le tour ouvert ci-dessous (pas d'await entre)
      journal(agent, 'processus lancé', `mode ${agent.mode || 'default'}${agent.sessionId ? `, reprise ${agent.sessionId.slice(0, 8)}` : ', nouvelle session'}`);
    }
    // Le message envoyé, gardé avec la réponse : une commande (« /context ») s'y
    // reconnaît (cf. app/controllers/conversation).
    r.sent = message; // affiché tant que la transcription ne l'a pas (cf. core/conversation)
    const done = new Promise<void>((resolve) => begin(r, agent.id, message.text || '', resolve));
    r.process.input.push(userMessage(message));
    return done;
  }

  // Réponse à la demande en tête de file : 'allow', 'always' (ne plus demander,
  // dans cette session, ce que décrivent les règles) ou 'deny'. `key` : le
  // numéro de la demande que l'utilisateur a sous les yeux ; si ce n'est plus la
  // tête de file (annulée entre-temps), rien n'est répondu (I-15).
  function answer(id: string, decision: 'allow' | 'always' | 'deny', key?: number) {
    const r = rt(id);
    const p = r.pending[0];
    if (!p || (key !== undefined && p.key !== key)) return false;
    settle(r, p, decision === 'deny' ? { behavior: 'deny', message: 'Refusé par l\'utilisateur.' }
      : { behavior: 'allow', updatedInput: p.input, ...(decision === 'always' && p.rules.length ? { updatedPermissions: p.rules } : {}) });
    journal({ id, name: r.name }, 'autorisation répondue', `${decision} ${p.tool} ${shortTarget(p.input)} après ${Math.round((Date.now() - p.at) / 1000)} s`
      + `${r.pending.length ? ` (${r.pending.length} encore en attente)` : ''}`);
    changed(r);
    return true;
  }

  // La demande en tête de file : `always` liste ce que « Toujours autoriser »
  // accorderait, vide si rien à proposer ; `waiting` : combien attendent derrière.
  function pendingPermission(id: string) {
    const r = rt(id);
    const p = r.pending[0];
    if (!p) return null;
    return { key: p.key, tool: p.tool, input: p.input, always: describeRules(p.rules), waiting: r.pending.length - 1 };
  }

  // Mode changé : le processus le suit aussitôt, tour en cours ou non. Une
  // demande en attente que le nouveau mode n'aurait pas posée (modifier un
  // fichier, passé en « accepter les modifications ») est accordée.
  function setMode(id: string, mode: string) {
    const r = runtime.get(id);
    if (!r || !r.process || !MODES.some(([v]) => v === mode)) return;
    r.process.query.setPermissionMode(mode).catch(() => { /* processus fini entre-temps */ });
    if (mode !== 'acceptEdits') return;
    for (const p of r.pending.filter((x) => EDIT_TOOLS.has(x.tool))) settle(r, p, { behavior: 'allow', updatedInput: p.input });
    changed(r);
  }

  // Modèle changé : pris en compte dès le prochain appel du processus.
  function setModel(id: string, model: string) {
    const r = runtime.get(id);
    if (r && r.process) r.process.query.setModel(model || undefined).catch(() => {});
  }

  // Interrompre : c'est Claude Code qui arrête son tour (query.interrupt), et
  // avec lui les commandes qu'il a lancées ; le processus, lui, reste.
  // Tuer le processus ne suffit pas : lancé par une commande enveloppe
  // (« distrobox enter dev -- claude »), seule l'enveloppe meurt — Claude Code et
  // sa commande continuent dans le conteneur, sans plus personne pour répondre à
  // ses demandes d'autorisation (« Stream closed »). On ne tue qu'en dernier
  // recours, s'il n'a pas obéi au bout de INTERRUPT_GRACE_MS (le message suivant
  // relance alors un processus).
  function interrupt(id: string) {
    const r = runtime.get(id);
    if (!r) return;
    for (const p of [...r.pending]) settle(r, p, { behavior: 'deny', message: 'Interrompu par l\'utilisateur.' });
    const { turn, process: proc } = r;
    if (!turn || !proc || turn.interrupted) return;
    turn.interrupted = true;
    journal({ id, name: r.name }, 'interruption demandée');
    proc.query.interrupt().catch(() => {});
    killLater(r, proc, () => r.turn === turn, 'interruption FORCÉE', `Claude Code n'a pas arrêté son tour en ${INTERRUPT_GRACE_MS / 1000} s : processus tué (une commande enveloppe peut lui survivre)`);
  }

  // Tue le processus après le délai de grâce, si `still()` dit qu'on l'attend encore.
  function killLater(r: Runtime, proc: Proc, still: () => boolean, event: string, detail: string) {
    const timer = setTimeout(() => {
      if (!still()) return; // Claude Code a obéi entre-temps
      journal({ id: proc.id, name: r.name }, event, detail);
      proc.abort.abort();
    }, INTERRUPT_GRACE_MS);
    timer.unref?.();
    return timer;
  }

  // Ferme le processus de l'agent : fin de son entrée, d'où Claude Code sort de
  // lui-même (comme la sonde) ; tué s'il est encore là après INTERRUPT_GRACE_MS.
  // Résout quand il est sorti. L'état de l'agent (dernière réponse…) est gardé.
  function close(id: string): Promise<void> {
    const r = runtime.get(id);
    const proc = r && r.process;
    if (!r || !proc) return Promise.resolve();
    if (r.turn) interrupt(id);
    proc.input.close();
    const timer = killLater(r, proc, () => r.process === proc, 'fermeture FORCÉE', `Claude Code n'est pas sorti en ${INTERRUPT_GRACE_MS / 1000} s : processus tué`);
    const ended = proc.ended.finally(() => { clearTimeout(timer); closing.delete(ended); });
    closing.add(ended);
    return ended;
  }

  // À la fermeture de l'appli : ferme tous les processus, et résout quand ils
  // sont sortis (ou peu après le délai de grâce, où ils ont été tués).
  function stop() {
    return Promise.race([
      Promise.all([...[...runtime.keys()].map(close), ...closing]).then(() => {}),
      new Promise<void>((ok) => { const t = setTimeout(ok, INTERRUPT_GRACE_MS + 1000); if (t.unref) t.unref(); }),
    ]);
  }

  async function askProbe(r: Runtime, q: SdkQuery) {
    const [commands, context] = await Promise.all([q.supportedCommands!(), q.getContextUsage!({ detail: 'full' })]);
    if (context && context.maxTokens) r.contextWindow = context.maxTokens;
    if (context && Number.isFinite(context.totalTokens)) r.contextUsed = context.totalTokens;
    return { commands: commands as SdkMessage[] | undefined, context };
  }

  // Les commandes de l'agent (« /compact », ses skills…) et le détail de son
  // contexte. Processus vivant : c'est à lui qu'on demande. Sinon, Claude Code
  // est lancé le temps des deux questions, sans message : la conversation n'en
  // est pas touchée. Lance 'notInstalled' ou une erreur.
  async function probe(agent: AgentConfig, { command, instructions = AUDIO_RULES }: { command?: unknown; instructions?: string } = {}) {
    const r = rt(agent.id);
    if (r.process) return askProbe(r, r.process.query);
    const launch = launcher(command);
    if (!launch) throw new Error('notInstalled');
    const sdk = await loadSdk();
    const held = createQueue<SdkMessage>(); // entrée vide, fermée à la fin : Claude Code sort
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), PROBE_MS);
    const q = sdk.query({ prompt: held, options: { ...queryOptions(agent, launch, instructions), abortController: abort } });
    try {
      return await askProbe(r, q);
    } finally {
      clearTimeout(timer);
      held.close();
      (async () => { try { for await (const _m of q) { /* Claude Code se ferme */ } } catch { /* déjà fermé */ } })();
    }
  }

  return {
    isAvailable: (command: unknown) => !!launcher(command),
    state,
    lastReply: (id: string) => rt(id).last,
    // Les tâches de fond de l'agent, finies comprises.
    tasks: (id: string) => rt(id).tasks,
    // Le message du tour en cours, null hors tour (à part de state : pas d'images vers l'icône).
    sent: (id: string) => rt(id).sent || null,
    markRead: (id: string) => { rt(id).unread = false; },
    // Session changée : la dernière réponse connue, et les tâches, étaient celles de l'autre.
    forgetReply: (id: string) => { const r = rt(id); r.last = null; r.unread = false; r.tasks = EMPTY_LOG; },
    forget: (id: string) => { void close(id); runtime.delete(id); },
    close,
    // Le nombre de processus vivants, ceux qui sortent compris.
    active: () => [...runtime.values()].filter((r) => r.process).length + closing.size,
    send,
    answer,
    pendingPermission,
    setMode,
    setModel,
    interrupt,
    stop,
    probe,
  };
}

export type AgentRuntime = ReturnType<typeof createAgentRuntime>;
