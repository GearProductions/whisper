/** execute — l'exécuteur des commandes, pur, une seule entrée : la commande
 *  dans la table, fermée ou non à la porte agent, ses arguments convertis
 *  (coerce) puis vérifiés (schemaError), le relevé du dossier visé ; les
 *  lectures par core/commands, les écritures par les opérations injectées
 *  (ops), dont il traduit le refus en un code d'ERROR_CODES. Ne lève jamais :
 *  une erreur est une donnée, sans langue (message et todo de table.errors).
 *  Jamais d'id de robot dans une réponse. run.wait : une lecture, la fin de la course par ops.wait (null : no-run) ;
 *  runs montre aussi les demandes en attente (ctx.queued). run.start : l'action au relevé, masquée
 *  ou non (l'écran n'en montre pas toujours le bouton) ; ctx.halted (le mode Vibe arrêté, porte agent) : run.start et les
 *  commandes de départ rendent halted, rien n'est appelé ; les autres : au relevé et pas
 *  masquée, sauf à la porte 'screen' (au relevé suffit, comme l'écran d'avant). Les
 *  artefacts, le brouillon de revue et le démarrage d'un processus passent par leurs
 *  opérations (artifact, draft, proc). bad-token est un code du protocole du socket,
 *  jamais rendu ici. Une commande fermée ne s'ouvre qu'à la
 *  porte 'screen' (toute autre porte est fermée). Les gardes (course qui retient,
 *  grisé, arguments de buildMessage, okRef) ne sont pas refaites : elles restent
 *  dans les opérations injectées, dont il traduit la clé de refus (reason) :
 *  'unknown-artifact' et 'failed' (un artefact) en leur code, une clé d'argument
 *  en invalid-args, toute autre en refused. Une opération qui rend done (une
 *  action d'artefact) : sa fin attendue, puis traduite de même.
 *  Ne connaît pas : Electron, le disque, les robots, la langue de l'appli, les
 *  portes.
 *  Utilisé par : app/controllers (commands, vibecoder : START). */
import type { VibeArgs, VibeRunOp, VibeView } from 'shared/bridge';
import { DIRECT_ACTIONS, type ActionDef } from 'core/vibecoder';
import { actionsOf, artifactsOf, draftOf, logsOf, nextOf, procsOf, runsOf, statusOf } from './reads';
import { coerce, schemaError } from './schema';
import type { CommandTable } from './table';

export const ERROR_CODES = ['unknown-command', 'closed', 'invalid-args', 'no-survey', 'not-offered',
  'disabled', 'same', 'busy', 'changing', 'halted', 'worktree', 'unknown-process', 'no-run', 'refused', 'failed',
  'no-pr', 'unknown-artifact', 'bad-token'] as const;   // bad-token : rendu par le protocole du socket, jamais par execute
export type ErrorCode = typeof ERROR_CODES[number];

export type CommandRequest = { command: string; args?: unknown; door: 'screen' | 'agent' };
/** view : le relevé du dossier visé (null : pas encore de relevé) ; queued : les demandes en attente d'une course (runs) ;
 *  halted : le mode Vibe du robot est arrêté, à la porte agent : run.start et les commandes de départ sont refusés. */
export type CommandContext = { view: VibeView | null; defs: ActionDef[]; queued?: { action: string; by: string }[]; halted?: boolean };
/** reason : la clé du refus ; by : l'action qui retient ; ignored : les arguments qui ne servent pas ;
 *  done : la fin du travail, attendue avant de répondre (les artefacts), son refus rendu comme les autres. */
export type OpOutcome = { ok: boolean; error?: string; reason?: string; by?: string; ignored?: string[]; done?: Promise<OpOutcome> };
/** L'opération sur le brouillon de revue de la PR suivie : ajouter, changer le texte d'une remarque, la retirer. */
export type DraftOp = { add: { target: string; text: string } } | { edit: { id: number; text: string } } | { remove: number };
export type CommandOps = {
  start(action: string, args: VibeArgs): OpOutcome;
  direct(action: string, args: VibeArgs): OpOutcome;
  run(action: string, op: VibeRunOp): Promise<boolean>;
  proc(name: string, op: 'start' | 'stop' | 'restart'): Promise<boolean>;
  /** Le contenu d'un artefact du dernier relevé ; null : id inconnu, ou un lien. */
  artifact(id: string): Promise<object | null>;
  draft(op: DraftOp): OpOutcome;
  /** run.wait : la fin de la course de l'action, en cours ou en attente ; null : ni l'un ni l'autre. Optionnelle : absente, no-run. */
  wait?(action: string): Promise<object | null>;
};
/** message, todo : ceux de table.errors, en anglais, pour un modèle. */
export type CommandError = { code: ErrorCode; details: Record<string, unknown>; message: string; todo: string };
export type CommandResponse = { ok: true; result: unknown } | { ok: false; error: CommandError };

export const START = ['vibe', 'guide', 'new-request', 'propose-run'];   // les commandes qui lancent leur action, sans la nommer en argument (l'écran, controllers/vibecoder, les envoie sous leur nom)

export async function execute(
  table: CommandTable, req: CommandRequest, ctx: CommandContext, ops: CommandOps,
): Promise<CommandResponse> {
  const fail = (code: ErrorCode, details: Record<string, unknown> = {}): CommandResponse => {
    const e = table.errors.find((d) => d.code === code);
    return { ok: false, error: { code, details, message: e?.message ?? code, todo: e?.todo ?? '' } };
  };
  const ok = (result: unknown = null): CommandResponse => ({ ok: true, result });
  // Le refus d'une opération, traduit : sa clé (reason) d'abord, puis une clé d'argument de la commande.
  // Un départ accepté qui rend done : sa fin attendue, traduite de même (un done qui rejette : le catch, failed).
  const refusal = async (start: OpOutcome, props: string[]): Promise<CommandResponse> => {
    let o = start;
    if (o.ok && o.done) { const end = await o.done; o = { ...end, ignored: end.ignored ?? start.ignored }; }
    if (o.ok) return ok(o.ignored?.length ? { ignored: o.ignored } : null);
    const key = o.reason;
    switch (key) {
      case 'unknown-artifact': return fail('unknown-artifact', { reason: o.error ?? '' });
      case 'failed': return fail('failed', { message: o.error ?? '' });
      case 'same': case 'busy': case 'changing': case 'worktree': return fail(key, o.by === undefined ? {} : { by: o.by });
      case 'disabled': return fail('disabled', { reason: o.error });
      case 'action': return fail('not-offered');
      case 'no-pr': return fail('no-pr');
      case 'args': return fail('invalid-args');
      default: return key && props.includes(key) ? fail('invalid-args', { arg: key }) : fail('refused', { reason: o.error ?? '' });
    }
  };
  // Les autres commandes d'action : au relevé et pas masquée (l'écran n'en montre pas le bouton) ; à la porte écran, au
  // relevé suffit, masquée ou non (comme runVibeAction : les gardes de ce qu'il appelle jugent le reste).
  const shown = (view: VibeView, id: string) => view.actions.some((a) => a.id === id && (req.door === 'screen' || !a.hidden));

  try {
    const def = table.commands.find((c) => c.name === req.command);
    if (!def) return fail('unknown-command');
    if (def.agent === false && req.door !== 'screen') return fail('closed', { reason: def.reason });
    const args = coerce(def.args, req.args ?? {});
    const fault = schemaError(def.args, args);
    if (fault) return fail('invalid-args', { fault });
    const { view } = ctx;
    if (!view) return fail('no-survey');
    const a = args as Record<string, unknown>;
    const props = Object.keys(def.args.properties ?? {});
    if (ctx.halted && (def.name === 'run.start' || START.includes(def.name))) return fail('halted');

    switch (def.name) {
      case 'status': return ok(statusOf(view));
      case 'next': return ok(nextOf(view));
      case 'actions': return ok(actionsOf(view, ctx.defs));
      case 'runs': return ok(runsOf(view, ctx.queued));
      case 'run.wait': {
        const ended = await ops.wait?.(a.action as string);
        return ended ? ok(ended) : fail('no-run', { action: a.action });
      }
      case 'procs': return ok(procsOf(view));
      case 'artifacts': return ok(artifactsOf(view));
      case 'draft': return ok(draftOf(view));
      case 'artifact': {
        const found = await ops.artifact(a.artifact as string);
        return found ? ok(found) : fail('unknown-artifact', { artifact: a.artifact });
      }
      case 'logs': {
        const log = logsOf(view, a.name as string);
        return log ? ok(log) : fail('unknown-process', { name: a.name });
      }
      case 'run.start': {
        const { action, ...rest } = a;
        // Au relevé, masquée ou non : la règle de l'écran (une masquée sans griser reste
        // possible, Écrire les invariants ; une grisée, startAction la refuse).
        return view.actions.some((x) => x.id === action) ? await refusal(ops.start(action as string, rest as VibeArgs), props) : fail('not-offered', { action });
      }
    }
    if (START.includes(def.name)) {
      return shown(view, def.name) ? await refusal(ops.start(def.name, a as VibeArgs), props) : fail('not-offered', { action: def.name });
    }
    // run.start et run.wait sont traités plus haut : les autres run.* sont les opérations d'une course (stop, keep, undo, allow, always, deny).
    if (def.name.startsWith('run.')) return (await ops.run(a.action as string, def.name.slice(4) as VibeRunOp)) ? ok() : fail('no-run', { action: a.action });
    if (def.name.startsWith('draft.')) {
      const op: DraftOp = def.name === 'draft.add' ? { add: { target: a.target as string, text: a.text as string } }
        : def.name === 'draft.edit' ? { edit: { id: a.id as number, text: a.text as string } } : { remove: a.id as number };
      return await refusal(ops.draft(op), props);
    }
    if (def.name.startsWith('proc.')) {
      const name = a.name as string;
      const known = view.processes?.some((p) => p.name === name);
      return known && (await ops.proc(name, def.name.slice(5) as 'start' | 'stop' | 'restart')) ? ok() : fail('unknown-process', { name });
    }
    if (!DIRECT_ACTIONS.includes(def.name)) return fail('unknown-command', { action: def.name });
    return shown(view, def.name) ? await refusal(ops.direct(def.name, a as VibeArgs), props) : fail('not-offered', { action: def.name });
  } catch (error) {
    return fail('failed', { message: error instanceof Error ? error.message : String(error) });
  }
}
