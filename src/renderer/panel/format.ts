/** format — ce que le panneau écrit : heures, durées, jetons, jauge du
 *  contexte, intitulé, et le début du fil en réduit.
 *  Ne connaît pas : le DOM, le pont. Utilisé par : les composants du panneau. */
import type { AgentStatus, ContextUse, ConvMode, Message, Thread } from '../bridge';

export const isBusy = (status: AgentStatus) => status === 'working' || status === 'asking';

export const titleOf = (t: Pick<Thread, 'title' | 'live'>) => t.title || (t.live ? 'Nouvelle conversation' : 'Conversation sans titre');

// « 14:32 », ou « 30 sept., 21:18 » un autre jour.
export function clock(ms: number | null | undefined, today = new Date()) {
  if (!ms) return '';
  const d = new Date(ms);
  const same = d.toDateString() === today.toDateString();
  return d.toLocaleString('fr-FR', same ? { timeStyle: 'short' } : { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const fullDate = (ms: number) => new Date(ms).toLocaleString('fr-FR', { dateStyle: 'full', timeStyle: 'medium' });
export const when = (ms: number) => new Date(ms).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' });

// « 12 s », « 1 min 05 s ».
export function elapsed(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s`;
}

// « 45 k »
export const kTokens = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 100000 ? 0 : 1).replace('.0', '')} k` : String(n));

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
