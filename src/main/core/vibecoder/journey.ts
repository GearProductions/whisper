/** journey — le parcours de l'écran VibeCoder, calculé sans modèle à partir du
 *  relevé (dépôt, note, tests, sorties des skills, validations) : les étapes
 *  (faite, en cours, à venir) et leurs faits en une ligne, la prochaine
 *  action, les actions possibles et pourquoi une autre est grisée — Créer ou
 *  Relire, Guide ou Vibe (les règles : la note du ticket 0.8.0).
 *  Ne connaît pas : Electron, le disque, git (tout est passé ; `exists` dit si
 *  un chemin du dossier de l'agent existe).
 *  Utilisé par : app/controllers/vibecoder (refreshVibe). */
import type { VibeAutonomy, VibeComment, VibeFlow, VibeLang, VibeView } from 'shared/bridge';
import type { ActionDef } from './actions';
import type { Marks } from './marks';

export type JourneyInput = {
  agentId: string;
  lang: VibeLang;
  flow: VibeFlow;
  pr: number | null;            // Relire : la PR suivie (vibeSet({ pr }))
  autonomy: VibeAutonomy;
  agent: { model: string; effort: string; mode: string };
  busy: boolean;                                    // l'agent travaille
  repo: { branch: string; base: string; changed: string[]; commits: { hash: string; subject: string; files: string[] }[] } | null;
  error: string | null;                             // pourquoi le dépôt manque
  note: { path: string; text: string; before: string | null } | null;
  tests: { path: string; blob: string; text: string }[];   // les tests de la branche
  readings: Record<string, string>;                 // par blob : sa lecture (<sorties>/invariants/<blob>.md)
  outputs: Record<string, { text: string; time: number }>; // par nom connu (OUTPUTS)
  marks: Marks;
  draft: VibeComment[];
  actions: ActionDef[];
  who: Record<string, string>;                      // par id d'action : qui travaille
  skills: string[];
  exists: (rel: string) => boolean;
};

// Squelette : chaque fonction s'écrit dans le commit de son module.
const todo = (..._args: unknown[]): never => { throw new Error('à implémenter'); };

export function vibeView(input: JourneyInput): VibeView { return todo(input); }
