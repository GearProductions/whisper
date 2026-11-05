/** execute — l'exécuteur des commandes, pur, une seule entrée : la commande
 *  dans la table, fermée ou non à la porte agent, ses arguments convertis
 *  (coerce) puis vérifiés (schemaError), le relevé du dossier visé ; les
 *  lectures par core/commands, les écritures par les opérations injectées
 *  (ops), dont il traduit le refus en un code d'ERROR_CODES. Ne lève jamais :
 *  une erreur est une donnée, sans langue (message et todo de table.errors).
 *  Jamais d'id de robot dans une réponse.
 *  Ne connaît pas : Electron, le disque, les robots, la langue de l'appli, les
 *  portes.
 *  Utilisé par : app/controllers (commands). */
import type { VibeArgs, VibeRunOp, VibeView } from 'shared/bridge';
import type { ActionDef } from 'core/vibecoder';
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

export async function execute(
  _table: CommandTable, _req: CommandRequest, _ctx: CommandContext, _ops: CommandOps,
): Promise<CommandResponse> {
  throw new Error('not implemented');
}
