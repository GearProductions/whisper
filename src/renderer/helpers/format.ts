/** format — heures, dates, durées, nombres de jetons, en français.
 *  Ne connaît pas : le DOM, le pont, les conversations. Fonctions pures.
 *  Utilisé par : core/conversation, app/panel. */

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
