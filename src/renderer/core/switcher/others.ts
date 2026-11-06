/** others — les agents vus de l'en-tête (vue C), sans le DOM : où ils sont (agentWhere : « dépôt · branche »),
 *  la marque d'arbre d'un worktree ou d'une PR sous son dossier principal (treeMark : ├ └), et les signaux qui
 *  méritent le bip de la réponse (signalKeys, F-55 : un autre agent que l'affiché qui attend, a fini ou a échoué ;
 *  une clé par agent et par signal), et beepFor : le bip lui-même, pour ne biper que ce qui vient d'apparaître (les
 *  signaux déjà entendus, ceux de l'affiché compris : le quitter ne fait pas sonner ce qu'on a sous les yeux),
 *  et tasksShown : quand montrer les tâches de fond (au repos seulement).
 *  Ne connaît pas : le DOM, React, le pont. Utilisé par : app/panel/vibecoder (palette, agent-notices), app/panel (panel-app). */
import type { AgentActivity, AgentView } from 'technicals/bridge';

export const agentWhere = (a: AgentView): string => (a.branch ? `${a.repo} · ${a.branch}` : a.repo);

// `list` : les agents d'un groupe dans l'ordre du relevé (le dossier principal, puis ses enfants).
// Un dossier principal : rien ; un enfant suivi d'un autre enfant du même parent : ├ ; le dernier : └.
export const treeMark = (list: AgentView[], i: number): '' | '├' | '└' => {
  const a = list[i];
  if (!a?.parent) return '';
  return list[i + 1]?.parent === a.parent ? '├' : '└';
};

// Les tâches de fond qu'on montre (le robot qui pulse, l'infobulle, la palette) : seulement au repos ; au travail le
// robot clignote déjà, et un agent qui a fini ou échoué montre sa pastille (la règle de la note, point 1, T-13).
export const tasksShown = (a: AgentView): number => (a.activity === 'idle' ? a.tasks ?? 0 : 0);

const SIGNALS: AgentActivity[] = ['asking', 'done', 'failed'];

export const signalKeys = (agents: AgentView[], shown: string | null): string[] =>
  agents.filter((a) => a.id !== shown && SIGNALS.includes(a.activity)).map((a) => `${a.id}~${a.activity}`);

// `heard` : les signaux déjà entendus (tous les agents, l'affiché compris : on le quitte sans bip).
// beep : un signal d'un autre agent que l'affiché n'y était pas ; heard : les signaux d'aujourd'hui, à repasser la fois suivante.
export function beepFor(heard: ReadonlySet<string>, agents: AgentView[], shown: string | null): { beep: boolean; heard: Set<string> } {
  const now = signalKeys(agents, null);
  const others = new Set(signalKeys(agents, shown));
  return { beep: now.some((k) => others.has(k) && !heard.has(k)), heard: new Set(now) };
}
