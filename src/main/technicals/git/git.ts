/** git — lire un dépôt, sans jamais le modifier : `git` lancé sans shell
 *  (execFile, I-27), 5 s au plus (ou le délai donné), null s'il manque ou échoue (I-29) ; une
 *  liste fermée de sous-commandes en lecture (GIT_READ), plus `worktree list`
 *  seul (tout autre `worktree` : null sans lancer git) ; aucun ref ni chemin
 *  venu d'ailleurs ne peut devenir une option ; diff, show et log sans
 *  programme externe (--no-ext-diff, --no-textconv), sans verrou
 *  (--no-optional-locks : status ne réécrit pas l'index). Les faits d'une
 *  branche : son nom, sa base (origin/HEAD, sinon main ou master), HEAD, les
 *  fichiers changés, ses commits et leurs fichiers — sans un chemin que git
 *  cite ou qui contient un caractère de contrôle. Un fichier à un ref (show) ;
 *  un commit et son diff (commit) ; le commit où la branche part d'une base
 *  (forkPoint, par log --boundary : GIT_READ n'a rien gagné, I-39).
 *  Ne connaît pas : VibeCoder, Electron.
 *  Utilisé par : app/controllers/vibecoder (gitRun, gitReader, okRef),
 *  app/controllers/worktrees (gitRun : rev-parse, worktree list),
 *  app/controllers/module-code (gitReader : show, forkPoint). */
import { execFile } from 'node:child_process';
import { okRef } from 'helpers';

// Les seules sous-commandes lancées : toutes en lecture.
export const GIT_READ = ['rev-parse', 'status', 'diff', 'log', 'show'] as const;

// Lance git (args[0] : la sous-commande) → sa sortie, ou null.
export type Run = (args: string[]) => Promise<string | null>;

export type GitFacts = {
  branch: string;
  base: string;                // '' : ni origin/HEAD, ni main, ni master
  head: string;
  changed: string[];
  dirty: string[];             // changés hors de tout commit (status) ; [] pour une PR chargée
  commits: { hash: string; subject: string; files: string[] }[];   // de la base au ref, le plus ancien d'abord
};

// git -C <dir> --no-optional-locks <args> : sans shell, `timeout` ms, null en cas
// d'échec ; une sous-commande hors de GIT_READ n'est pas lancée, sauf
// `worktree list` (worktree seul : add, remove, prune… écrivent).
export function gitRun(dir: string, timeout = 5000): Run {
  return (args) => new Promise((resolve) => {
    const ok = (GIT_READ as readonly string[]).includes(args[0]) || (args[0] === 'worktree' && args[1] === 'list');
    if (!ok) return resolve(null);
    try {
      execFile('git', ['-C', dir, '--no-optional-locks', ...args], { timeout, maxBuffer: 64 * 1024 * 1024, windowsHide: true },
        (err, stdout) => resolve(err ? null : stdout));
    } catch {
      resolve(null);   // un argument que execFile refuse d'emblée
    }
  });
}

// Un ref : okRef (helpers, réexporté pour direct et app/controllers/vibecoder) ;
// un chemin : ni « - » en tête, ni NUL.
export { okRef };
const okPath = (path: string) => path !== '' && !path.startsWith('-') && !path.includes('\0');
const NO_PROGRAM = ['--no-ext-diff', '--no-textconv'];
// Un chemin que git rend cité (« "… ») ou qui contient un caractère de contrôle
// (saut de ligne…) : écarté, il finirait dans un message à l'agent.
const plainPath = (path: string) => path !== '' && !path.startsWith('"') && !/[\0-\x1f\x7f]/.test(path);

// Tout passe par `run`, args[0] dans GIT_READ. Un ref ou un chemin qui commence
// par '-' ou contient un NUL, un ref qui contient '..' ou sort de
// [A-Za-z0-9._/-] : refusé (null) sans lancer git ; --end-of-options là où git
// le permet. facts(ref, base) : la branche (HEAD et la copie de travail par
// défaut) ou une PR chargée, comparée à `base` (par défaut origin/HEAD, sinon
// main ou master), ses chemins cités ou à caractère de contrôle écartés ;
// show : le contenu d'un fichier à ce ref ; commit : un commit, ses fichiers
// (--stat) et son diff ; forkPoint : le commit commun à HEAD et à `base` — la
// première limite de base..HEAD, sinon HEAD s'il n'a rien en propre.
export function gitReader(run: Run): {
  facts(ref?: string, base?: string): Promise<GitFacts | null>;
  show(ref: string, path: string): Promise<string | null>;
  commit(ref: string): Promise<string | null>;
  forkPoint(base: string): Promise<string | null>;
} {
  const exists = async (ref: string) => (await run(['rev-parse', '--verify', '--quiet', '--end-of-options', ref])) !== null;
  const defaultBase = async () => (await run(['rev-parse', '--abbrev-ref', 'origin/HEAD']))?.trim()
    || ((await exists('main')) ? 'main' : (await exists('master')) ? 'master' : '');
  return {
    async facts(ref, base) {
      if ((ref !== undefined && !okRef(ref)) || (base !== undefined && !okRef(base))) return null;
      const tip = ref ?? 'HEAD';
      const head = (await run(['rev-parse', '--verify', '--end-of-options', tip]))?.trim();
      if (!head) return null;
      const branch = ref ?? ((await run(['rev-parse', '--abbrev-ref', 'HEAD']))?.trim() || 'HEAD');
      const from = base ?? await defaultBase();
      const [diff, log, status] = await Promise.all([
        from ? run(['diff', '--name-only', '-z', '-M', ...NO_PROGRAM, '--end-of-options', `${from}...${tip}`, '--']) : null,
        from ? run(['log', '--reverse', '--name-only', '-z', '-M', ...NO_PROGRAM, '--format=%x01%H%x09%s', '--end-of-options', `${from}..${tip}`, '--']) : null,
        ref ? null : run(['status', '--porcelain', '-z', '--untracked-files=all']),
      ]);
      const changed = new Set((diff ?? '').split('\0').filter(plainPath));
      const dirty: string[] = [];
      // status -z : « XY chemin », suivi du chemin d'origine pour un renommage ou une copie (sauté).
      const entries = (status ?? '').split('\0');
      for (let i = 0; i < entries.length; i++) {
        if (entries[i].length < 4) continue;
        if (plainPath(entries[i].slice(3))) { changed.add(entries[i].slice(3)); dirty.push(entries[i].slice(3)); }
        if (/[RC]/.test(entries[i].slice(0, 2))) i++;
      }
      // log -z : « \x01<hash>\t<sujet> » par commit, puis ses fichiers (le premier précédé d'un saut de ligne).
      const commits: GitFacts['commits'] = [];
      for (const token of (log ?? '').split('\0')) {
        const t = token.replace(/^\n/, '');
        const tab = t.indexOf('\t');
        if (t.startsWith('\x01')) commits.push({ hash: t.slice(1, tab), subject: t.slice(tab + 1), files: [] });
        else if (plainPath(t)) commits[commits.length - 1]?.files.push(t);
      }
      return { branch, base: from, head, changed: [...changed], dirty, commits };
    },
    show: async (ref, path) => (okRef(ref) && okPath(path) ? run(['show', ...NO_PROGRAM, '--end-of-options', `${ref}:${path}`]) : null),
    commit: async (ref) => (okRef(ref) ? run(['show', ...NO_PROGRAM, '--stat', '--patch', '-M', '--end-of-options', ref]) : null),
    async forkPoint(base) {
      if (!okRef(base)) return null;
      const out = await run(['log', '--boundary', '--format=%m%H', ...NO_PROGRAM, '--end-of-options', `${base}..HEAD`, '--']);
      if (out === null) return null;
      const lines = out.split('\n').filter(Boolean);
      if (!lines.length) return 'HEAD';
      return lines.find((l) => l.startsWith('-'))?.slice(1) ?? null;
    },
  };
}
