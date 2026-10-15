/** git — lire un dépôt, sans jamais le modifier : `git` lancé sans shell
 *  (execFile, I-27), 5 s au plus, null s'il manque ou échoue (I-29) ; une
 *  liste fermée de sous-commandes en lecture (GIT_READ) ; aucun ref ni chemin
 *  venu d'ailleurs ne peut devenir une option. Les faits d'une branche : son
 *  nom, sa base (origin/HEAD, sinon main ou master), HEAD, les fichiers
 *  changés, ses commits et leurs fichiers.
 *  Ne connaît pas : VibeCoder, Electron.
 *  Utilisé par : app/controllers/vibecoder. */

// Les seules sous-commandes lancées : toutes en lecture.
export const GIT_READ = ['rev-parse', 'status', 'diff', 'log', 'show', 'ls-tree', 'merge-base', 'for-each-ref', 'cat-file'] as const;

// Lance git (args[0] : la sous-commande) → sa sortie, ou null.
export type Run = (args: string[]) => Promise<string | null>;

export type GitFacts = {
  branch: string;
  base: string;
  head: string;
  changed: string[];
  commits: { hash: string; subject: string; files: string[] }[];
};

// Squelette : chaque fonction s'écrit dans le commit de son module.
const todo = (..._args: unknown[]): never => { throw new Error('à implémenter'); };

// git -C <dir> --no-optional-locks <args> : sans shell, 5 s, null en cas d'échec.
export function gitRun(dir: string): Run { return todo(dir); }

// Tout passe par `run`, args[0] dans GIT_READ. Un ref ou un chemin qui commence
// par '-' ou contient un NUL, un ref qui contient '..' ou sort de
// [A-Za-z0-9._/-] : refusé (null) sans lancer git ; --end-of-options là où git
// le permet. facts(ref) : la branche (HEAD par défaut) ou une PR chargée ;
// show : le contenu d'un fichier à ce ref ; blob : son empreinte.
export function gitReader(run: Run): {
  facts(ref?: string): Promise<GitFacts | null>;
  show(ref: string, path: string): Promise<string | null>;
  blob(ref: string, path: string): Promise<string | null>;
} {
  return todo(run);
}
