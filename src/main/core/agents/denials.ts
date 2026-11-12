/** denials — le classement d'un refus, d'après le flux du processus (mesuré le
 *  12 novembre, note 0.15.0-courses-droits, « Où ça casse ») : un tool_result en
 *  erreur dont le texte commence par celui d'un refus — le mode qui ne demande
 *  jamais ou une règle (« Permission to use … »), une règle de chemin de
 *  l'utilisateur (« <tool_use_error>File is in a directory that is denied by your
 *  permission settings. »), le contrôle de l'appli ou un autre crochet
 *  (« PreToolUse:<outil> hook error: ») —, celui de l'agent comme d'un sous-agent
 *  (parent_tool_use_id), pendant un tour ou hors tour. L'outil vient du tool_use
 *  de même id ; un refus de Read, Glob ou Grep est une lecture (citée), tout autre
 *  fait échouer la course. L'appli ne lit pas la commande refusée : elle la cite.
 *  Pur. Ne connaît pas : le mode, la liste, les règles qui ont refusé (le SDK ne
 *  les nomme pas), Electron.
 *  Utilisé par : core/agents (tasks : TaskLog.denials). */

import { shortTarget } from './reply';

export type Denial = { toolUseId: string; tool: string; target: string; read: boolean };

// Les débuts de texte d'un tool_result en erreur qui disent un refus.
export const DENIED = ['Permission to use ', '<tool_use_error>File is in a directory that is denied by your permission settings.'] as const;
export const HOOK_DENIED = /^PreToolUse:\w+ hook error: /;

// Les outils de lecture et d'exploration : leur refus est cité, la course n'échoue pas.
export const READ_TOOLS = new Set(['Read', 'Glob', 'Grep']);

// Le refus que dit un bloc tool_result (son texte `text`, son tool_use `tool`, absent :
// outil inconnu) ; pas en erreur, ou un autre texte : null.
export function denialOf(block: { tool_use_id: string; is_error?: boolean }, text: string, tool: { name: string; input: unknown } | undefined): Denial | null {
  if (!block.is_error || !(DENIED.some((d) => text.startsWith(d)) || HOOK_DENIED.test(text))) return null;
  const name = tool?.name ?? '?';
  return { toolUseId: block.tool_use_id, tool: name, target: shortTarget(tool?.input), read: READ_TOOLS.has(name) };
}
