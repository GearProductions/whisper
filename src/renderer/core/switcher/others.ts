/** others — les agents vus de l'en-tête (vue C), sans le DOM : où ils sont (agentWhere : « dépôt · branche »),
 *  la marque d'arbre d'un worktree ou d'une PR sous son dossier principal (treeMark : ├ └), et les signaux qui
 *  méritent le bip de la réponse (signalKeys, F-55 : un autre agent que l'affiché qui attend, a fini ou a échoué ;
 *  une clé par agent et par signal, pour ne biper que ce qui vient d'apparaître).
 *  Ne connaît pas : le DOM, React, le pont. Utilisé par : app/panel/vibecoder (palette), app/panel (panel-app). */
import type { AgentActivity, AgentView } from 'technicals/bridge';

export const agentWhere = (a: AgentView): string => (a.branch ? `${a.repo} · ${a.branch}` : a.repo);

// `list` : les agents d'un groupe dans l'ordre du relevé (le dossier principal, puis ses enfants).
// Un dossier principal : rien ; un enfant suivi d'un autre enfant du même parent : ├ ; le dernier : └.
export const treeMark = (list: AgentView[], i: number): '' | '├' | '└' => {
  const a = list[i];
  if (!a?.parent) return '';
  return list[i + 1]?.parent === a.parent ? '├' : '└';
};

const SIGNALS: AgentActivity[] = ['asking', 'done', 'paused'];

export const signalKeys = (agents: AgentView[], shown: string | null): string[] =>
  agents.filter((a) => a.id !== shown && SIGNALS.includes(a.activity)).map((a) => `${a.id}~${a.activity}`);
