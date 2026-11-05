/** execute — l'exécuteur des commandes, pur, une seule entrée : la commande
 *  dans la table, fermée ou non à la porte agent, ses arguments convertis
 *  (coerce) puis vérifiés (schemaError), le relevé du dossier visé ; les
 *  lectures par core/commands, les écritures par les opérations injectées
 *  (ops), dont il traduit le refus en un code d'ERROR_CODES. Ne lève jamais :
 *  une erreur est une donnée, sans langue (message et todo de table.errors).
 *  Jamais d'id de robot dans une réponse. run.start : l'action au relevé, masquée
 *  ou non (la règle de la boîte aux lettres) ; les autres : au relevé et pas
 *  masquée. Une commande fermée ne s'ouvre qu'à la
 *  porte 'screen' (toute autre porte est fermée). Les gardes (course qui retient,
 *  grisé, arguments de buildMessage, okRef) ne sont pas refaites : elles restent
 *  dans les opérations injectées, dont il traduit la clé de refus (reason).
 *  Ne connaît pas : Electron, le disque, les robots, la langue de l'appli, les
 *  portes.
 *  Utilisé par : app/controllers (commands). */
import type { VibeArgs, VibeRunOp, VibeView } from 'shared/bridge';
import { DIRECT_ACTIONS, type ActionDef } from 'core/vibecoder';
import { actionsOf, logsOf, nextOf, procsOf, runsOf, statusOf } from './reads';
import { coerce, schemaError } from './schema';
import type { CommandTable } from './table';

export const ERROR_CODES = ['unknown-command', 'closed', 'invalid-args', 'no-survey', 'not-offered',
  'disabled', 'same', 'busy', 'changing', 'worktree', 'unknown-process', 'no-run', 'refused', 'failed'] as const;
export type ErrorCode = typeof ERROR_CODES[number];

export type CommandRequest = { command: string; args?: unknown; door: 'screen' | 'agent' };
/** view : le relevé du dossier visé (null : pas encore de relevé). */
export type CommandContext = { view: VibeView | null; defs: ActionDef[] };
/** reason : la clé du refus ; by : l'action qui retient ; ignored : les arguments qui ne servent pas. */
export type OpOutcome = { ok: boolean; error?: string; reason?: string; by?: string; ignored?: string[] };
export type CommandOps = {
  start(action: string, args: VibeArgs): OpOutcome;
  direct(action: string, args: VibeArgs): OpOutcome;
  run(action: string, op: VibeRunOp): Promise<boolean>;
  proc(name: string, op: 'stop' | 'restart'): Promise<boolean>;
};
/** message, todo : ceux de table.errors, en anglais, pour un modèle. */
export type CommandError = { code: ErrorCode; details: Record<string, unknown>; message: string; todo: string };
export type CommandResponse = { ok: true; result: unknown } | { ok: false; error: CommandError };

const START = ['vibe', 'guide', 'new-request', 'propose-run'];   // les commandes qui lancent leur action, sans la nommer en argument
const REFUSED = ['comment', 'case-ko', 'add-artifact'];   // remplissent le champ de la page, ou déposent sur le panneau : pas ici

export async function execute(
  table: CommandTable, req: CommandRequest, ctx: CommandContext, ops: CommandOps,
): Promise<CommandResponse> {
  const fail = (code: ErrorCode, details: Record<string, unknown> = {}): CommandResponse => {
    const e = table.errors.find((d) => d.code === code);
    return { ok: false, error: { code, details, message: e?.message ?? code, todo: e?.todo ?? '' } };
  };
  const ok = (result: unknown = null): CommandResponse => ({ ok: true, result });
  // Le refus d'une opération, traduit : sa clé (reason) d'abord, puis une clé d'argument de la commande.
  const refusal = (o: OpOutcome, props: string[]): CommandResponse => {
    if (o.ok) return ok(o.ignored?.length ? { ignored: o.ignored } : null);
    const key = o.reason;
    switch (key) {
      case 'same': case 'busy': case 'changing': case 'worktree': return fail(key, o.by === undefined ? {} : { by: o.by });
      case 'disabled': return fail('disabled', { reason: o.error });
      case 'action': return fail('not-offered');
      case 'args': return fail('invalid-args');
      default: return key && props.includes(key) ? fail('invalid-args', { arg: key }) : fail('refused', { reason: o.error ?? '' });
    }
  };
  // Les autres commandes d'action : au relevé et pas masquée (l'écran n'en montre pas le bouton).
  const shown = (view: VibeView, id: string) => view.actions.some((a) => a.id === id && !a.hidden);

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

    switch (def.name) {
      case 'status': return ok(statusOf(view));
      case 'next': return ok(nextOf(view));
      case 'actions': return ok(actionsOf(view, ctx.defs));
      case 'runs': return ok(runsOf(view));
      case 'procs': return ok(procsOf(view));
      case 'logs': {
        const log = logsOf(view, a.name as string);
        return log ? ok(log) : fail('unknown-process', { name: a.name });
      }
      case 'run.start': {
        const { action, ...rest } = a;
        // Au relevé, masquée ou non : la règle de la boîte aux lettres et de l'écran (une masquée sans griser reste
        // possible, Écrire les invariants ; une grisée, startAction la refuse).
        return view.actions.some((x) => x.id === action) ? refusal(ops.start(action as string, rest as VibeArgs), props) : fail('not-offered', { action });
      }
    }
    if (START.includes(def.name)) {
      return shown(view, def.name) ? refusal(ops.start(def.name, a as VibeArgs), props) : fail('not-offered', { action: def.name });
    }
    // run.start est traité plus haut : les autres run.* sont les opérations d'une course (stop, keep, undo, allow, always, deny).
    if (def.name.startsWith('run.')) return (await ops.run(a.action as string, def.name.slice(4) as VibeRunOp)) ? ok() : fail('no-run', { action: a.action });
    if (def.name.startsWith('proc.')) {
      const name = a.name as string;
      const known = view.processes?.some((p) => p.name === name);
      return known && (await ops.proc(name, def.name.slice(5) as 'stop' | 'restart')) ? ok() : fail('unknown-process', { name });
    }
    if (REFUSED.includes(def.name) || !DIRECT_ACTIONS.includes(def.name)) return fail(REFUSED.includes(def.name) ? 'not-offered' : 'unknown-command', { action: def.name });
    return shown(view, def.name) ? refusal(ops.direct(def.name, a as VibeArgs), props) : fail('not-offered', { action: def.name });
  } catch (error) {
    return fail('failed', { message: error instanceof Error ? error.message : String(error) });
  }
}
