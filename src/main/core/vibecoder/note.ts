/** note — la note du ticket lue par ses titres, sans modèle : son titre, si
 *  « Ce que ça fait » est rédigée, ses rubriques, les lignes de « Ce que ça ne
 *  doit pas faire » et leur marque (→ invariant, variant…), les modules de la
 *  « Forme » et leur contrat, ses questions ouvertes. Et où la trouver : la clé
 *  que porte la branche (ticket ou version), le fichier de docs/tickets/ qui
 *  la nomme.
 *  Ne connaît pas : Electron, le disque, git (texte et chemins passés).
 *  Utilisé par : core/vibecoder (journey : parseNote), app/controllers/vibecoder
 *  (noteKey, findNote). */
import type { MustNotMark } from 'shared/bridge';

export type NoteFacts = {
  title: string;
  filled: boolean;                                      // « Ce que ça fait » est rédigée
  sections: { name: string; text: string }[];
  mustNot: { text: string; mark: MustNotMark }[];       // « Ce que ça ne doit pas faire »
  modules: { path: string; contract: string }[];        // la Forme : chemin, expose · ne connaît pas · utilisé par
  forme: string;
  questions: string[];
};

// Squelette : chaque fonction s'écrit dans le commit de son module.
const todo = (..._args: unknown[]): never => { throw new Error('à implémenter'); };

export function parseNote(md: string): NoteFacts { return todo(md); }

// La clé de la note d'après la branche : un ticket (G2-6675, WT-14), sinon une
// version qu'elle porte (0.8.0), sinon `version` ; null sans rien de tout ça.
export function noteKey(branch: string, version: string | null): string | null { return todo(branch, version); }

// Le premier .md sous docs/tickets/ dont le nom contient `key` en mot entier,
// sans tenir compte de la casse ; null si aucun.
export function findNote(paths: string[], key: string): string | null { return todo(paths, key); }
