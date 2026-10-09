/** runtime — les agents au travail. Un tour = un appel query() du SDK : le
 *  premier crée la session, les suivants la reprennent (`resume`). « Nouvelle
 *  session » oublie simplement l'identifiant.
 *
 *  Mode « manuel » : l'agent demande l'autorisation avant d'agir (canUseTool) ;
 *  la demande remonte à l'appli, qui répond par answer(). Plusieurs demandes
 *  peuvent arriver à la fois (outils lancés en parallèle) : elles attendent en
 *  FILE et se montrent l'une après l'autre. Une demande sans réponse bloque
 *  Claude Code indéfiniment : aucune ne doit se perdre (I-17).
 *
 *  Le mode et le modèle changés en cours de tour s'appliquent aussitôt
 *  (setMode, setModel). Interrompre = demander à Claude Code d'arrêter ; on ne
 *  tue qu'en dernier recours (I-19).
 *  Ne connaît pas : Electron, les fenêtres ; SDK, lancement et journal injectés.
 *  Utilisé par : app/controllers/agents. */
import { AUDIO_RULES, EDIT_TOOLS, MODES } from './constants';
import { prompt, queryOptions } from './options';
import { describeRules, sessionRules, type SessionRule } from './permissions';
import { shortTarget, splitReply } from './reply';
import type { AgentConfig, JournalFn, Launch, OutgoingMessage, Sdk, SdkMessage, SdkQuery, TurnHooks } from './types';

export type AgentStatus = 'idle' | 'working' | 'asking' | 'error';
export type Reply = { text: string; audio: string; error?: boolean; asked: string };
type Response = Record<string, unknown>;
type Pending = { key: number; tool: string; input: unknown; rules: SessionRule[]; resolve: (r: Response) => void; at: number };
type Runtime = {
  status: AgentStatus;
  abort: AbortController | null;
  query: SdkQuery | null;
  pending: Pending[];
  last: Reply | null;
  sent?: OutgoingMessage | null;
  unread: boolean;
  onChange: (() => void) | null;
  name?: string;
  since?: number | null;
  interrupted?: boolean;
  contextWindow?: number | null;
  contextUsed?: number | null;
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
  let nextKey = 1; // numéro des demandes d'autorisation (cf. answer)

  const rt = (id: string) => {
    if (!runtime.has(id)) runtime.set(id, { status: 'idle', abort: null, query: null, pending: [], last: null, unread: false, onChange: null });
    return runtime.get(id)!;
  };

  // `since` : début du tour en cours (ms), pour le temps écoulé ; `contextWindow` :
  // la taille de la fenêtre de contexte, connue après un tour (ou une sonde).
  // `contextUsed` : le contexte occupé selon la dernière sonde (cf. probe).
  const state = (id: string) => {
    const r = rt(id);
    return {
      status: r.status, unread: r.unread, hasReply: !!r.last, since: r.since || null,
      contextWindow: r.contextWindow || null, contextUsed: Number.isFinite(r.contextUsed) ? r.contextUsed! : null,
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

  // Envoie `message` à l'agent. Résout quand le tour est fini ; rejette 'busy'
  // ou 'notInstalled'. `instructions` : la consigne ajoutée au prompt système
  // (AUDIO_RULES par défaut ; '' : aucune).
  async function send(agent: AgentConfig, message: OutgoingMessage, { command, instructions = AUDIO_RULES, onChange, onSession, onPermission, onProgress = () => {} }: TurnHooks) {
    const r = rt(agent.id);
    if (r.status === 'working' || r.status === 'asking') throw new Error('busy');
    const launch = launcher(command);
    if (!launch) throw new Error('notInstalled');
    const sdk = await loadSdk();

    r.status = 'working';
    r.name = agent.name;
    // Le message envoyé, gardé avec la réponse : une commande (« /context ») s'y
    // reconnaît (cf. app/controllers/conversation).
    const asked = message.text || '';
    r.sent = message; // affiché tant que la transcription ne l'a pas (cf. core/conversation)
    r.since = Date.now();
    const abort = new AbortController();
    r.abort = abort;
    r.onChange = onChange;
    onChange();

    // Une demande d'autorisation : en file. Claude Code peut l'annuler lui-même
    // (`signal` : outil abandonné, tour interrompu) — elle quitte alors la file.
    const ask = (tool: string, input: unknown, { suggestions, signal }: { suggestions?: unknown; signal?: AbortSignal } = {}) => new Promise<Response>((resolve) => {
      const p: Pending = { key: nextKey++, tool, input, rules: sessionRules(suggestions), resolve, at: Date.now() };
      r.pending.push(p);
      r.status = 'asking';
      journal(agent, 'autorisation demandée', `${tool} ${shortTarget(input)} (${r.pending.length} en attente)`);
      if (signal) {
        signal.addEventListener('abort', () => {
          const head = r.pending[0] === p;
          if (!settle(r, p, { behavior: 'deny', message: 'Annulé.' })) return;
          journal(agent, 'autorisation annulée par Claude Code', `${tool} ${shortTarget(input)}`);
          onChange();
          if (head && r.pending[0]) onPermission(r.pending[0]); // la suivante prend sa place
        }, { once: true });
      }
      onChange();
      // Le panneau montre la tête de file : on ne prévient que pour la première.
      if (r.pending[0] === p) onPermission({ tool, input });
    });

    let reply: string | null = null;
    let failure: string | null = null;
    let permissionFailures = 0;
    try {
      const q = sdk.query({
        prompt: prompt(message),
        options: { ...queryOptions(agent, launch, instructions), abortController: abort, canUseTool: ask },
      });
      r.query = q;
      journal(agent, 'tour commencé', `mode ${agent.mode || 'default'}${agent.sessionId ? `, reprise ${agent.sessionId.slice(0, 8)}` : ', nouvelle session'}`);
      for await (const m of q) {
        if (m.type === 'assistant' || m.type === 'user') onProgress();
        // Un outil refusé faute d'avoir pu demander l'autorisation (Claude Code ne
        // reçoit plus les réponses) : à signaler, c'est le symptôme d'un blocage.
        if (m.type === 'user' && Array.isArray(m.message && m.message.content)) {
          for (const b of m.message.content) {
            const text = b && b.type === 'tool_result' ? JSON.stringify(b.content || '') : '';
            if (text.includes('Tool permission request failed') && !r.interrupted && !abort.signal.aborted) {
              permissionFailures++;
              journal(agent, 'ÉCHEC d\'une demande d\'autorisation', text.slice(0, 200));
            }
          }
        }
        if (m.type === 'system' && m.subtype === 'init' && m.session_id) onSession(m.session_id);
        if (m.type === 'result') {
          const windows = Object.values((m.modelUsage || {}) as Record<string, SdkMessage>).map((u) => u.contextWindow).filter(Number.isFinite);
          if (windows.length) r.contextWindow = Math.max(...windows);
          if (m.subtype === 'success' && !m.is_error) reply = m.result;
          else failure = m.subtype === 'success' ? String(m.result || 'erreur') : m.subtype;
        }
      }
    } catch (err) {
      failure = abort.signal.aborted ? 'interrupted' : (err instanceof Error && err.message) || 'erreur';
    }
    // Interrompu à notre demande : Claude Code finit son tour par une erreur ou
    // une réponse partielle, c'est une interruption.
    if (r.interrupted) { failure = 'interrupted'; reply = null; }
    // Fin du tour : une demande restée sans réponse n'a plus d'objet.
    for (const p of [...r.pending]) settle(r, p, { behavior: 'deny', message: 'Tour terminé.' });
    journal(agent, 'tour fini', `${reply !== null ? 'réponse' : failure} en ${Math.round((Date.now() - r.since!) / 1000)} s`
      + `${permissionFailures ? `, ${permissionFailures} demande(s) d'autorisation en échec` : ''}`);
    r.abort = null;
    r.query = null;
    r.since = null;
    r.sent = null;
    r.interrupted = false;
    // Après /compact, la dernière mesure du contexte ne vaut plus.
    if (/^\/compact\b/.test(asked)) r.contextUsed = null;
    // Une commande sans réponse écrite (/compact…) : on dit qu'elle est faite.
    if (reply === '' && /^\//.test(asked)) reply = `${asked.split(/\s/)[0]} : fait.`;
    if (reply !== null) {
      r.last = { ...splitReply(reply), asked };
      // Dit dans la réponse elle-même qu'une action n'a pas pu être autorisée.
      if (permissionFailures) {
        r.last.text += `\n\n⚠ ${permissionFailures} demande(s) d'autorisation n'ont pas pu aboutir : l'agent n'a pas pu faire ces actions (détails dans le journal des agents).`;
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
    onChange();
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
    if (r.onChange) r.onChange();
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

  // Mode changé : le tour en cours le suit aussitôt. Une demande en attente que
  // le nouveau mode n'aurait pas posée (modifier un fichier, passé en
  // « accepter les modifications ») est accordée.
  function setMode(id: string, mode: string) {
    const r = runtime.get(id);
    if (!r || !r.query || !MODES.some(([v]) => v === mode)) return;
    r.query.setPermissionMode(mode).catch(() => { /* tour fini entre-temps */ });
    if (mode !== 'acceptEdits') return;
    for (const p of r.pending.filter((x) => EDIT_TOOLS.has(x.tool))) settle(r, p, { behavior: 'allow', updatedInput: p.input });
    if (r.onChange) r.onChange();
  }

  // Modèle changé : pris en compte dès le prochain appel du tour en cours.
  function setModel(id: string, model: string) {
    const r = runtime.get(id);
    if (r && r.query) r.query.setModel(model || undefined).catch(() => {});
  }

  // Interrompre : c'est Claude Code qui arrête son tour (query.interrupt), et
  // avec lui les commandes qu'il a lancées ; il se ferme ensuite de lui-même.
  // Tuer le processus ne suffit pas : lancé par une commande enveloppe
  // (« distrobox enter dev -- claude »), seule l'enveloppe meurt — Claude Code et
  // sa commande continuent dans le conteneur, sans plus personne pour répondre à
  // ses demandes d'autorisation (« Stream closed »). On ne tue qu'en dernier
  // recours, s'il n'a pas obéi au bout de INTERRUPT_GRACE_MS.
  function interrupt(id: string) {
    const r = runtime.get(id);
    if (!r) return;
    for (const p of [...r.pending]) settle(r, p, { behavior: 'deny', message: 'Interrompu par l\'utilisateur.' });
    const { abort, query } = r;
    if (!abort || r.interrupted) return;
    r.interrupted = true;
    journal({ id, name: r.name }, 'interruption demandée');
    if (query) query.interrupt().catch(() => {});
    const timer = setTimeout(() => {
      if (r.abort !== abort) return; // tour fini entre-temps : Claude Code a obéi
      journal({ id, name: r.name }, 'interruption FORCÉE', `Claude Code n'a pas arrêté son tour en ${INTERRUPT_GRACE_MS / 1000} s : processus tué (une commande enveloppe peut lui survivre)`);
      abort.abort();
    }, query ? INTERRUPT_GRACE_MS : 0);
    if (timer.unref) timer.unref();
  }

  // À la fermeture de l'appli : interrompt tous les agents, et résout quand leurs
  // tours sont finis (ou au bout du délai de grâce, où ils ont été tués).
  function stop() {
    const busy = [...runtime.keys()].filter((id) => runtime.get(id)!.abort);
    busy.forEach(interrupt);
    return new Promise<void>((resolve) => {
      const started = Date.now();
      const check = () => {
        if (busy.every((id) => !runtime.has(id) || !runtime.get(id)!.abort) || Date.now() - started > INTERRUPT_GRACE_MS + 1000) resolve();
        else setTimeout(check, 100);
      };
      check();
    });
  }

  async function askProbe(r: Runtime, q: SdkQuery) {
    const [commands, context] = await Promise.all([q.supportedCommands!(), q.getContextUsage!({ detail: 'full' })]);
    if (context && context.maxTokens) r.contextWindow = context.maxTokens;
    if (context && Number.isFinite(context.totalTokens)) r.contextUsed = context.totalTokens;
    return { commands: commands as SdkMessage[] | undefined, context };
  }

  // Les commandes de l'agent (« /compact », ses skills…) et le détail de son
  // contexte. Agent au travail : demandé à son tour en cours. Sinon, Claude Code
  // est lancé le temps des deux questions, sans message : la conversation n'en
  // est pas touchée. Lance 'notInstalled' ou une erreur.
  async function probe(agent: AgentConfig, { command, instructions = AUDIO_RULES }: { command?: unknown; instructions?: string } = {}) {
    const r = rt(agent.id);
    if (r.query) return askProbe(r, r.query);
    const launch = launcher(command);
    if (!launch) throw new Error('notInstalled');
    const sdk = await loadSdk();
    let release: () => void = () => {};
    const held = (async function* wait() { await new Promise<void>((ok) => { release = ok; }); }()) as AsyncIterable<SdkMessage>;
    const abort = new AbortController();
    const timer = setTimeout(() => abort.abort(), PROBE_MS);
    const q = sdk.query({ prompt: held, options: { ...queryOptions(agent, launch, instructions), abortController: abort } });
    try {
      return await askProbe(r, q);
    } finally {
      clearTimeout(timer);
      release();
      (async () => { try { for await (const _m of q) { /* Claude Code se ferme */ } } catch { /* déjà fermé */ } })();
    }
  }

  return {
    isAvailable: (command: unknown) => !!launcher(command),
    state,
    lastReply: (id: string) => rt(id).last,
    // Le message du tour en cours, null hors tour (à part de state : pas d'images vers l'icône).
    sent: (id: string) => rt(id).sent || null,
    markRead: (id: string) => { rt(id).unread = false; },
    // Session changée : la dernière réponse connue était celle de l'autre.
    forgetReply: (id: string) => { const r = rt(id); r.last = null; r.unread = false; },
    forget: (id: string) => { interrupt(id); runtime.delete(id); },
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
