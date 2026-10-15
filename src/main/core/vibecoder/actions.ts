/** actions — les boutons de VibeCoder, des données (actions.<langue>.json) :
 *  leurs entrées valides, et le message qu'une action envoie à l'agent — son
 *  gabarit, chaque variable remplacée par une valeur vérifiée, rien d'autre.
 *  Seul {{text}} (le champ, écrit ou relu par l'utilisateur, I-2) est libre ;
 *  un commit, un module, une PR ne sont pris que dans le dernier relevé ; une
 *  variable inconnue fait refuser l'action (l'agent lance des commandes avec
 *  ces valeurs).
 *  Ne connaît pas : Electron, le disque, l'agent (le message est rendu, pas envoyé).
 *  Utilisé par : core/vibecoder (journey), app/controllers/vibecoder. */
import type { VibeAction, VibeArgs, VibeLang, VibeStepId, VibeView } from 'shared/bridge';

export type ActionDef = {
  id: string;
  flow: 'create' | 'review' | 'both';
  step: VibeStepId | null;
  kind: 'send' | 'prefill';
  needs: VibeAction['needs'];
  label: string;
  hint: string;
  text: string;                // le gabarit
};

export type MessageContext = { view: VibeView; out: string; lang: VibeLang };
// La variable qui manque ou ne va pas ; 'variable' : une variable inconnue.
export type MessageError = 'text' | 'module' | 'commit' | 'pr' | 'answers' | 'verdict' | 'draft' | 'files' | 'note' | 'repo' | 'variable';

// Squelette : chaque fonction s'écrit dans le commit de son module.
const todo = (..._args: unknown[]): never => { throw new Error('à implémenter'); };

// Les entrées valides, dans leur ordre ; les autres sont ignorées.
export function parseActions(json: unknown): ActionDef[] { return todo(json); }

// Les variables, liste fermée (une autre → 'variable') :
//   {{text}}           args.text trimé ; requis si needs = 'text' ; ≤ 20 000 caractères → sinon 'text'
//   {{out}} {{lang}}   le dossier de sorties de l'agent ; fr ou en
//   {{branch}} {{base}}  du relevé → 'repo' sans dépôt
//   {{note}}           le chemin de la note → 'note' sans note
//   {{ref}}            WORKTREE (Créer) ou refs/vibecoder/pr/<n> (Relire)
//   {{files}}          les tests d'invariants pas encore lus, « chemin@blob » séparés par des espaces → 'files' si aucun
//   {{module}}         args.module (rang dans view.modules), sinon le premier non touché : « chemin — contrat » → 'module'
//   {{commit}}         args.commit, un hash de view.commits ; absent : WORKTREE → sinon 'commit'
//   {{pr}}             args.pr (entier > 0), sinon view.pr.number → sinon 'pr'
//   {{answers}}        args.answers en « 1. …\n2. … » → 'answers' s'il manque
//   {{verdict}}        approve, comment ou request-changes → sinon 'verdict'
//   {{draft}}          view.draft, une ligne « - [cible] texte » par remarque → 'draft' s'il est vide
//   {{quote}}          ('prefill') ce que la page cite, rempli par elle
export function buildMessage(def: ActionDef, args: VibeArgs, ctx: MessageContext): { text: string } | { error: MessageError } {
  return todo(def, args, ctx);
}
