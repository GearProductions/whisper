/** role — le rôle de l'utilisateur sur la PR : créateur (auteur ou assigné) ou
 *  relecteur (tous les autres, demandés en relecture ou non), d'après le dernier
 *  relevé de gh. Les identifiants GitHub se comparent sans tenir compte de la casse.
 *  Ne connaît pas : gh, git, Electron, le disque.
 *  `roleRule` : la ligne de la consigne d'un agent qui dit le rôle affiché.
 *  Utilisé par : core/vibecoder (journey), app/controllers/vibecoder, app/controllers/agents. */
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

// La ligne de la consigne d'un agent qui dit le rôle affiché (T-19) : le créateur
// ne se voit rien interdire, le relecteur remarque au brouillon sans toucher la branche.
export function roleRule(flow: VibeFlow): string {
  return flow === 'create'
    ? 'VibeCoder: the user is the creator of this branch (author or assignee of its pull request).'
    : 'VibeCoder: the user is a reviewer of this pull request: do not modify the branch; propose remarks to the review draft instead, with `vibecoder draft` (read it), `vibecoder draft.add target=… text=…`, `vibecoder draft.edit id=… text=…` and `vibecoder draft.remove id=…`.';
}

// La ligne de la consigne d'un créateur qui dit comment développer : par le parcours de VibeCoder, d'office. Vu le
// 19 novembre sur Gear Authenticator : prié d'utiliser VibeCoder, l'agent avait lu ses skills puis écrit lui-même tout
// le code, sans note par l'action, ni Forme, ni invariants, ni modules. Les exceptions ne viennent que de l'utilisateur.
export function flowRule(): string {
  return 'VibeCoder: develop through VibeCoder by default. A change of the project\'s code starts from a ticket note — '
    + 'the `note` action with the user\'s request as its text — and goes on through the screen\'s actions (forme, '
    + 'invariants, first commit, modules and their commits, checks, fixups, PR, CI), started with the `vibecoder` command '
    + '(skill `actions`), or with `vibe` once the user validated the note; the actions write the code, you orchestrate, '
    + 'check and report. Writing the code yourself in this conversation is for what the user explicitly asks to do that '
    + 'way: a quick fix or an express PR, a change of docs or of a skill\'s text only, or a correction after their test. '
    + 'A request that writes no code (a question, an artifact, a review) needs none of it. In doubt, ask.';
}
