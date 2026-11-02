/** role — le rôle de l'utilisateur sur la PR : créateur (auteur ou assigné) ou
 *  relecteur (tous les autres, demandés en relecture ou non), d'après le dernier
 *  relevé de gh. Les identifiants GitHub se comparent sans tenir compte de la casse.
 *  Ne connaît pas : gh, git, Electron, le disque.
 *  Utilisé par : core/vibecoder (journey), app/controllers/vibecoder. */
import type { VibeFlow } from 'shared/bridge';

export type PrPeople = { author: string; assignees: string[] };

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
const isAssigned = (people: PrPeople, login: string) => people.assignees.some((a) => same(a, login));

// Pas de PR ouverte : créateur. Personnes ou identifiant inconnus : `was`, le rôle d'avant.
export function vibeRole({ open, people, login, was }: { open: boolean; people: PrPeople | null; login: string | null; was: VibeFlow }): VibeFlow {
  if (!open) return 'create';
  if (!people || !login) return was;
  return same(people.author, login) || isAssigned(people, login) ? 'create' : 'review';
}

// S'assigner : ni l'auteur ni déjà assigné.
export function canAssign(people: PrPeople | null, login: string | null): boolean {
  return !!people && !!login && !same(people.author, login) && !isAssigned(people, login);
}

// Se retirer : assigné, et pas l'auteur.
export function unassignable(people: PrPeople | null, login: string | null): boolean {
  return !!people && !!login && !same(people.author, login) && isAssigned(people, login);
}
