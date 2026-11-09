/** runs — les courses : une action d'étape (`kind: "send"`) qui court à part de
 *  la conversation, sous sa propre entrée du runtime. Ce qu'est une course
 *  (Run), si une action en est une (ownRun), sous quelle clé (runKey : answers
 *  reprend la course de la note), la règle qui décide si elle peut partir
 *  (lockCode : sans langue, le code same | busy | changing et l'action qui
 *  retient ; une modification attend toute course en cours, arrêtée non
 *  tranchée comprise ; une lecture n'attend qu'une modification ; la même
 *  action déjà en cours ; blockedBy en est le texte), les courses à l'écran (runViews), l'avis de fin
 *  pour l'orchestrateur (endNotice : une ligne, l'action, sa fin, sa réponse en bref ; aucun fichier à lire),
 *  REQUEST_ARGS (les clés qu'un run.start garde, verdict compris : approve, comment ou request-changes), et où en est une
 *  course d'après son entrée du runtime (runPhase : en cours tant qu'elle
 *  travaille ou que des tâches de fond tournent ; pas de limite de temps ;
 *  grace quand ses tâches de fond viennent de tomber à 0 hors tour, le délai
 *  GRACE_MS que le contrôleur laisse au tour qu'elles réveillent ; runTasks :
 *  combien de tâches de fond lui compter, le plus haut de l'actuel et du
 *  précédent hors repos). Son avancement (Run.progress, recopié par runViews) et
 *  les modules qu'il reste au départ (remainingModules : Run.total). Le module
 *  qu'une course génère (runModule : Run.module) et pourquoi Voir le code est
 *  grisé (codeLock : un tour de la conversation, une course qui génère ce module ;
 *  sans module — la note, un test — n'importe quelle course qui retient).
 *  Les commandes d'arrière-plan coupées par la fin d'une course (cutCommands : les
 *  local_bash `stopped` de ses tâches) et la ligne qui le dit en tête de sa réponse
 *  (cutLine).
 *  Ne connaît pas : Electron, le disque, le runtime des agents (tout est passé).
 *  Utilisé par : core/vibecoder (journey), core/commands (REQUEST_ARGS : le schéma de
 *  run.start), app/controllers (runs : lockCode, endNotice ; vibecoder : lockCode ; module-code). */
import type { VibeArgs, VibeLang, VibeModule, VibeRun, VibeRunProgress } from 'shared/bridge';
import { targetModule, type ActionDef } from './actions';

export type RunState = VibeRun['state'];
export type Run = {
  id: string;                  // l'id de son action
  key: string;                 // son entrée du runtime (runKey)
  since: number;
  end: number | null;
  state: RunState;
  reply: string;
  sessionId: string | null;
  module: string | null;       // le chemin (Forme) du module qu'elle génère, '*' : tous, null : aucun
  total?: number | null;       // les modules restants au départ (action modules), null : sans objet
  progress?: VibeRunProgress;  // son avancement d'après le fil de l'agent, absent : inconnu
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
    end: { done: 'terminée', failed: 'en échec' }, notice: 'VibeCoder :',
    quote: (s: string) => `« ${s} »`,
    talking: 'La conversation travaille', generating: 'Ce module est en cours de génération',
    running: 'Une action de l’agent est en cours',
    cut: (n: number) => `${n} commande${n > 1 ? 's' : ''} en arrière-plan coupée${n > 1 ? 's' : ''} à la fin de l’action : le travail est peut-être incomplet.`,
  },
  en: {
    same: 'This action is already running', busy: 'Another action is running', changing: 'An action is changing the branch',
    end: { done: 'finished', failed: 'failed' }, notice: 'VibeCoder:',
    quote: (s: string) => `“${s}”`,
    talking: 'The conversation is working', generating: 'This module is being generated',
    running: 'An action of the agent is running',
    cut: (n: number) => `${n} background command${n > 1 ? 's' : ''} cut when the action ended: the work may be incomplete.`,
  },
};

// Pourquoi l'action ne peut pas partir, d'après les courses qui retiennent (états LOCKING), sans langue :
// le code et l'action qui retient ; null : elle part.
export function lockCode(def: Pick<ActionDef, 'id' | 'reads'>, running: { id: string; reads: boolean }[]):
  { code: 'same' | 'busy' | 'changing'; by: string } | null {
  const same = running.find((r) => runKey(r.id) === runKey(def.id));
  if (same) return { code: 'same', by: same.id };
  if (!def.reads && running.length) return { code: 'busy', by: running[0].id };
  const writer = running.find((r) => !r.reads);
  return writer ? { code: 'changing', by: writer.id } : null;
}

// Le texte du code d'une retenue (lockCode) dans la langue de l'appli.
export const lockText = (lock: { code: 'same' | 'busy' | 'changing' }, lang: VibeLang) => TEXT[lang][lock.code];

// Le texte de lockCode ; null : elle part.
export const blockedBy = (def: Pick<ActionDef, 'id' | 'reads'>, running: { id: string; reads: boolean }[], lang: VibeLang): string | null => {
  const lock = lockCode(def, running);
  return lock && lockText(lock, lang);
};

// Le module que génère une action : module → celui que vise son message (targetModule) ;
// modules → '*' (tous) ; une autre, ou un rang inconnu → null.
export function runModule(actionId: string, args: VibeArgs, modules: VibeModule[]): string | null {
  if (actionId === 'modules') return '*';
  if (actionId !== 'module') return null;
  return targetModule(args, modules)?.path ?? null;
}

// Pourquoi le code du module ne s'édite pas : un tour de la conversation (busy), une course qui le
// génère (son chemin ou '*') ; null : éditable. module null (la note, un test d'invariant) : un tour,
// ou n'importe quelle course qui retient (note 0.11.0-editer-invariants-et-note).
export function codeLock(module: string | null, busy: boolean, running: { module?: string | null }[], lang: VibeLang): string | null {
  const T = TEXT[lang];
  if (busy) return T.talking;
  if (module === null) return running.length ? T.running : null;
  return running.some((r) => r.module === module || r.module === '*') ? T.generating : null;
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
      reply: r.reply, permission: pending(r.id), ...(r.progress && { progress: r.progress }),
    };
  });
}

// Le délai de grâce d'une course dont les tâches de fond viennent de tomber à 0 hors tour.
export const GRACE_MS = 10_000;

// Où en est une course d'après son entrée du runtime (status, nombre de tâches de fond en cours) :
// une autorisation attend d'abord ; en cours tant qu'elle travaille ou que ses tâches de fond tournent ;
// before : ses tâches de fond au changement précédent ; tombées à 0 hors tour, grace (le tour qu'elles
// réveillent peut suivre) ; sinon au repos (sa fin, si elle a travaillé).
export function runPhase(status: string, tasks: number, before = 0): 'running' | 'asking' | 'idle' | 'grace' {
  if (status === 'asking') return 'asking';
  if (status === 'working' || tasks > 0) return 'running';
  return before > 0 ? 'grace' : 'idle';
}

// Les tâches de fond d'une course à compter : hors repos (au travail, une autorisation attend), le plus haut
// de tasks et before (une tâche tombée pendant un tour reste comptée jusqu'à sa fin) ; au repos, tasks.
export const runTasks = (status: string, tasks: number, before: number) =>
  status === 'working' || status === 'asking' ? Math.max(tasks, before) : tasks;

// Les modules qu'il reste à générer : ni commit ni modification (la règle du skill modules).
export const remainingModules = (modules: VibeModule[]) => modules.filter((m) => !m.touched && !m.uncommitted).length;

// Les commandes d'arrière-plan qu'a coupées la fin d'une course : les local_bash arrêtés de ses tâches.
export const cutCommands = (tasks: { type: string; status: string }[]) =>
  tasks.filter((t) => t.type === 'local_bash' && t.status === 'stopped').length;

// La ligne en tête de la réponse d'une course coupée (n : cutCommands, au moins 1).
export const cutLine = (n: number, lang: VibeLang) => TEXT[lang].cut(n);

const REPLY_MAX = 300;

// L'avis de fin pour l'orchestrateur, une ligne : l'action, comment elle a fini, sa réponse en bref.
export function endNotice(run: Run, def: Pick<ActionDef, 'label'> | undefined, lang: VibeLang): string {
  const T = TEXT[lang];
  const how = run.state === 'done' ? T.end.done : T.end.failed;
  const flat = run.reply.replace(/\s+/g, ' ').trim();
  const reply = flat.length > REPLY_MAX ? `${flat.slice(0, REPLY_MAX - 1)}…` : flat;
  const said = `${T.notice} ${T.quote(def?.label ?? run.id)} ${how}${reply ? ` — ${reply}` : ''}`;
  return `${said}${/[.!?…]$/.test(said) ? '' : '.'}`;
}

// Les arguments qu'un run.start garde (le schéma de run.start) ; jamais direct (F-114 : un clic seulement) ;
// buildMessage vérifie encore chacun.
export const REQUEST_ARGS: readonly string[] = ['text', 'module', 'commit', 'file', 'pr', 'model', 'effort', 'check', 'answers', 'verdict'];
