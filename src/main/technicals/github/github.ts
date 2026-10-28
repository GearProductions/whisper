/** github — lire GitHub par `gh`, sans jamais rien modifier, sans agent ni
 *  modèle : `gh` lancé sans shell (execFile, I-27), derrière le préfixe donné
 *  (la box où gh est installé : core/runner, commandPrefix), au dossier du
 *  dépôt, 15 s au plus, null s'il manque ou échoue (I-29). Une liste fermée de
 *  sous-commandes en lecture (GH_READ : `pr view`, `pr list`) ; les autres
 *  arguments sont fixes, sauf une branche lue par git (okRef, après `--`) et
 *  un numéro de PR (un entier positif). La PR d'une branche (prForBranch), les
 *  PR ouvertes du dépôt en trois listes (openPrs : les miennes, à relire,
 *  toutes), l'état d'une PR (prState).
 *  Ne connaît pas : VibeCoder, Electron, la configuration.
 *  Utilisé par : app/controllers/vibecoder. */
import { execFile } from 'node:child_process';
import { okRef } from 'technicals/git';

// Les seules sous-commandes lancées : en lecture.
export const GH_READ = [['pr', 'view'], ['pr', 'list']] as const;

// Lance gh (args[0..1] : la sous-commande) → sa sortie, ou null.
export type GhRun = (args: string[]) => Promise<string | null>;

// La fiche d'une PR, comme pr.json et pr-<n>.json.
export type GhPr = { number: number; title: string; url: string; state: string; base: string; head: string };

// <prefix…> gh <args>, au dossier `dir` : sans shell, 15 s, null en cas
// d'échec ; une sous-commande hors de GH_READ n'est pas lancée.
export function ghRun(dir: string, prefix: string[]): GhRun {
  return (args) => new Promise((resolve) => {
    if (!GH_READ.some(([a, b]) => args[0] === a && args[1] === b)) return resolve(null);
    const argv = [...prefix, 'gh', ...args];
    try {
      execFile(argv[0], argv.slice(1), { cwd: dir, timeout: 15_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true },
        (err, stdout) => resolve(err ? null : stdout));
    } catch {
      resolve(null);   // un argument que execFile refuse d'emblée, un dossier qui manque
    }
  });
}

const parse = (text: string | null): unknown => { try { return text === null ? null : JSON.parse(text); } catch { return null; } };
const okNumber = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;

// Tout passe par `run`. Une branche hors d'okRef, un numéro qui n'est pas un
// entier positif : null sans lancer gh.
export function githubReader(run: GhRun) {
  return {
    // La PR de cette branche (ouverte, sinon la dernière), ou null.
    async prForBranch(branch: string): Promise<GhPr | null> {
      if (!okRef(branch)) return null;
      const p = parse(await run(['pr', 'view', '--json', 'number,title,url,state,baseRefName,headRefName', '--', branch])) as Record<string, unknown> | null;
      return p && okNumber(p.number) ? {
        number: p.number, title: String(p.title ?? ''), url: String(p.url ?? ''), state: String(p.state ?? ''),
        base: String(p.baseRefName ?? ''), head: String(p.headRefName ?? ''),
      } : null;
    },
    // Les PR ouvertes du dépôt, en trois listes (gh pr list --author @me ;
    // --search review-requested:@me ; sans filtre, --limit 100) ; une qui échoue → null.
    async openPrs(): Promise<{ mine: unknown[]; review: unknown[]; all: unknown[] } | null> {
      const list = async (filter: string[]) => {
        const l = parse(await run(['pr', 'list', ...filter, '--json', 'number,title,author,url']));
        return Array.isArray(l) ? l : null;
      };
      const [mine, review, all] = await Promise.all([
        list(['--author', '@me']), list(['--search', 'review-requested:@me']), list(['--limit', '100']),
      ]);
      return mine && review && all ? { mine, review, all } : null;
    },
    // OPEN, CLOSED ou MERGED, ou null.
    async prState(n: unknown): Promise<string | null> {
      if (!okNumber(n)) return null;
      const state = (parse(await run(['pr', 'view', '--json', 'state', '--', String(n)])) as { state?: unknown } | null)?.state;
      return state === 'OPEN' || state === 'CLOSED' || state === 'MERGED' ? state : null;
    },
  };
}
