/** permission-guard — garde des réponses aux demandes d'autorisation : une réponse
 *  ne vaut que pour la demande affichée (`key`, SPEC I-15), et un clic parti
 *  dans les CLICK_GUARD_MS qui suivent l'arrivée d'une NOUVELLE demande est
 *  ignoré : il visait ce qu'on n'a pas lu (I-16).
 *  Ne connaît pas : le DOM, le pont (send est passé). Utilisé par : app/panel (panel-app). */
import type { Decision } from 'technicals/bridge';

export const CLICK_GUARD_MS = 600;

export function createPermissionGuard(guardMs = CLICK_GUARD_MS, now = () => Date.now()) {
  let shown: number | null = null;
  let since = 0;
  return {
    // La demande affichée (null : aucune). Réaffichée, elle garde son heure d'arrivée.
    show(key: number | null) {
      if (key !== shown) { shown = key; since = now(); }
    },
    // true si la réponse est partie.
    answer(key: number, decision: Decision, send: (decision: Decision, key: number) => void) {
      if (shown === null || key !== shown || now() - since < guardMs) return false;
      send(decision, key);
      return true;
    },
  };
}
