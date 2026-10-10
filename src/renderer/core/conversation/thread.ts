/** thread — une conversation : agent occupé, intitulé, jauge du contexte, début
 *  du fil en réduit, descente du fil.
 *  Ne connaît pas : le DOM, le pont. Utilisé par : app/panel. */
import { kTokens } from 'helpers';
import type { AgentStatus, ContextUse, ConvMode, Message, Thread } from 'technicals/bridge';

export const isBusy = (status: AgentStatus) => status === 'working' || status === 'asking';

export const titleOf = (t: Pick<Thread, 'title' | 'live'>) => t.title || (t.live ? 'Nouvelle conversation' : 'Conversation sans titre');

// La jauge de l'en-tête : la part de la fenêtre de contexte occupée (orange à
// 80 %, rouge à 90 % : l'agent compactera bientôt de lui-même).
export function gauge(c: ContextUse | undefined) {
  const known = !!c && Number.isFinite(c.used) && !!c.max;
  const pct = known ? Math.min(100, Math.round((c!.used! / c!.max) * 100)) : 0;
  return {
    pct,
    level: !known ? 'unknown' : pct >= 90 ? 'high' : pct >= 80 ? 'warn' : 'ok',
    label: known ? `Contexte ${pct} %` : 'Contexte',
    title: known ? `Contexte utilisé : ${kTokens(c!.used!)} sur ${kTokens(c!.max)} jetons — cliquer pour le détail`
      : 'Contexte : cliquer pour le mesurer',
  };
}

// Réduit : le dernier échange — votre dernier message et ce qui l'a suivi.
export function visibleFrom(messages: Message[], mode: ConvMode) {
  if (mode !== 'compact') return 0;
  const lastUser = messages.map((m) => m.role).lastIndexOf('user');
  return Math.max(0, lastUser >= 0 ? lastUser : messages.length - 1);
}

// Descendre le fil après ce rendu : autre conversation, réduit, changement de
// taille (⤢ s'ouvre sur le dernier échange), demande d'autorisation. Sinon, rester
// en bas quand un message arrive, sans arracher la lecture d'un message plus ancien.
export function followsEnd(before: Thread | null, next: Thread, { atEnd, working }: { atEnd: boolean; working: boolean }) {
  if (!before || next.key !== before.key || next.mode === 'compact' || next.mode !== before.mode || next.permission) return true;
  return atEnd && (working || next.messages.length !== before.messages.length);
}
