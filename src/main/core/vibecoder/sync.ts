/** sync — Pull, Rebase et Pousser sur la branche de l'en-tête (note 0.12.0-gestion-des-branches) :
 *  pourquoi Pull est grisé (pas de branche distante suivie, ou déjà à jour). Rebase n'est jamais grisé :
 *  sa pastille (la base distante a avancé) se lit à l'écran dans view.sync.baseAhead.
 *  Ne connaît pas : Electron, git, le disque, les libellés.
 *  Utilisé par : core/vibecoder (journey). */

export type SyncState = {
  behind: number | null;   // commits de @{u} absents de HEAD ; null : pas de branche distante suivie
  rebased: boolean;        // le dernier rebase a réussi, pas de push réussi depuis
};

export function syncReason(id: string, s: SyncState): 'noUpstream' | 'upToDate' | null {
  if (id !== 'pull') return null;
  if (s.behind === null) return 'noUpstream';
  return s.behind === 0 ? 'upToDate' : null;
}
