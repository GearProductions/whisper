/** runs — les courses : une action d'étape (`kind: "send"`) qui court à part de
 *  la conversation, sous sa propre entrée du runtime. Ce qu'est une course
 *  (Run), si une action en est une (ownRun), sous quelle clé (runKey : answers
 *  reprend la course de la note), la règle qui décide si elle peut partir
 *  (blockedBy : une modification attend toute course en cours, arrêtée non
 *  tranchée comprise ; une lecture n'attend qu'une modification ; la même
 *  action déjà en cours), les courses à l'écran (runViews), le texte de
 *  <sorties>/actions.json pour l'orchestrateur (runsFile), son avis de fin
 *  (endNotice), la lecture d'une demande de l'orchestrateur
 *  (<sorties>/actions/<id>.start | .stop : parseRequest), et où en est une
 *  course d'après son entrée du runtime (runPhase : en cours tant qu'elle
 *  travaille ou que des tâches de fond tournent ; pas de limite de temps).
 *  Ne connaît pas : Electron, le disque, le runtime des agents (tout est passé).
 *  Utilisé par : core/vibecoder (journey), app/controllers/runs. */
import type { VibeArgs, VibeLang, VibeRun } from 'shared/bridge';
import type { ActionDef } from './actions';

export type RunState = VibeRun['state'];
export type Run = {
  id: string;                  // l'id de son action
  key: string;                 // son entrée du runtime (runKey)
  since: number;
  end: number | null;
  state: RunState;
  reply: string;
  sessionId: string | null;
};

// Les états qui retiennent les autres : en cours, une autorisation attend, arrêtée pas encore tranchée.
export const LOCKING: RunState[] = ['running', 'asking', 'stopped'];

// Court à part : une action envoyée d'une étape ; vibe, guide, ask, propose-run restent dans la conversation.
export const ownRun = (def: Pick<ActionDef, 'kind' | 'step'>) => def.kind === 'send' && def.step !== null;

// Les réponses aux questions de la note vont à l'agent qui l'a rédigée.
export const runKey = (actionId: string) => (actionId === 'answers' ? 'note' : actionId);

const TEXT = {
  fr: {
    same: 'Cette action est déjà en cours', busy: 'Une autre action est en cours', changing: 'Une action modifie la branche',
    end: { done: 'terminée', failed: 'en échec' }, notice: 'VibeCoder :', state: 'État :',
    quote: (s: string) => `« ${s} »`,
  },
  en: {
    same: 'This action is already running', busy: 'Another action is running', changing: 'An action is changing the branch',
    end: { done: 'finished', failed: 'failed' }, notice: 'VibeCoder:', state: 'State:',
    quote: (s: string) => `“${s}”`,
  },
};

// Pourquoi l'action ne peut pas partir, d'après les courses qui retiennent (états LOCKING) ; null : elle part.
export function blockedBy(def: Pick<ActionDef, 'id' | 'reads'>, running: { id: string; reads: boolean }[], lang: VibeLang): string | null {
  const T = TEXT[lang];
  if (running.some((r) => runKey(r.id) === runKey(def.id))) return T.same;
  if (!def.reads && running.length) return T.busy;
  if (running.some((r) => !r.reads)) return T.changing;
  return null;
}

type Shown = Pick<ActionDef, 'id' | 'label'> & { who?: string };

// Les courses à l'écran, la plus récente d'abord ; libellé et qui travaille d'après leur action
// (sans `who` : 'agent') ; pending : sa demande d'autorisation en attente.
export function runViews(runs: Run[], defs: Shown[],
  pending: (id: string) => { tool: string; target: string } | null): VibeRun[] {
  return [...runs].sort((a, b) => b.since - a.since).map((r) => {
    const def = defs.find((d) => d.id === r.id);
    return {
      id: r.id, label: def?.label ?? r.id, who: def?.who ?? 'agent', state: r.state, since: r.since, end: r.end,
      reply: r.reply, permission: pending(r.id),
    };
  });
}

// Le texte de <sorties>/actions.json : les actions qui courent à part, les courses, les demandes retenues.
export function runsFile(runs: Run[], defs: ActionDef[], waiting: { id: string; reason: string }[]): string {
  const def = (id: string) => defs.find((d) => d.id === id);
  return JSON.stringify({
    actions: defs.filter(ownRun).map((d) => ({ id: d.id, label: d.label, reads: !!d.reads })),
    runs: runs.map((r) => ({
      id: r.id, label: def(r.id)?.label ?? r.id, state: r.state, reads: !!def(r.id)?.reads, since: r.since, end: r.end, reply: r.reply,
    })),
    waiting,
  }, null, 2);
}

// Le délai de grâce d'une course dont les tâches de fond viennent de tomber à 0 hors tour.
export const GRACE_MS = 10_000;

// Où en est une course d'après son entrée du runtime (status, nombre de tâches de fond en cours) :
// une autorisation attend d'abord ; en cours tant qu'elle travaille ou que ses tâches de fond tournent ;
// sinon au repos (sa fin, si elle a travaillé).
export function runPhase(status: string, tasks: number): 'running' | 'asking' | 'idle' {
  if (status === 'asking') return 'asking';
  return status === 'working' || tasks > 0 ? 'running' : 'idle';
}

const REPLY_MAX = 300;

// L'avis de fin pour l'orchestrateur, une ligne : l'action, comment elle a fini, sa réponse en bref, où lire l'état.
export function endNotice(run: Run, def: Pick<ActionDef, 'label'> | undefined, lang: VibeLang, out: string): string {
  const T = TEXT[lang];
  const how = run.state === 'done' ? T.end.done : T.end.failed;
  const flat = run.reply.replace(/\s+/g, ' ').trim();
  const reply = flat.length > REPLY_MAX ? `${flat.slice(0, REPLY_MAX - 1)}…` : flat;
  const said = `${T.notice} ${T.quote(def?.label ?? run.id)} ${how}${reply ? ` — ${reply}` : ''}`;
  return `${said}${/[.!?…]$/.test(said) ? '' : '.'} ${T.state} ${out}/actions.json`;
}

const REQUEST = /^([a-z0-9-]+)\.(start|stop)$/;
const isInt = (v: unknown) => Number.isInteger(v);
const isStr = (v: unknown) => typeof v === 'string';
// Les arguments qu'une demande peut porter, chacun avec son type ; jamais direct (F-114 : un clic seulement).
const KEEP: Record<string, (v: unknown) => boolean> = {
  text: isStr, module: isInt, commit: isStr, file: isStr, pr: isInt, model: isStr,
  answers: (v) => Array.isArray(v) && v.every(isStr),
};

// Une demande de l'orchestrateur (<sorties>/actions/<nom>) : <id>.start (son texte : les arguments en JSON,
// vide : aucun) ou <id>.stop ; un autre nom, un JSON illisible ou qui n'est pas un objet : null. Les
// arguments inconnus ou d'un autre type sont ignorés ; buildMessage vérifie encore chacun.
export function parseRequest(name: string, text: string): { id: string; op: 'start' | 'stop'; args: VibeArgs } | null {
  const m = REQUEST.exec(name);
  if (!m) return null;
  const op = m[2] as 'start' | 'stop';
  if (op === 'stop' || !text.trim()) return { id: m[1], op, args: {} };
  let raw: unknown;
  try { raw = JSON.parse(text); } catch { return null; }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const args = Object.fromEntries(Object.entries(raw).filter(([k, v]) => Object.hasOwn(KEEP, k) && KEEP[k](v)));
  return { id: m[1], op, args };
}
