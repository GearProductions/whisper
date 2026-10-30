/** worktree — le dépôt git d'un dossier et ses worktrees : son dossier git
 *  commun et la racine de sa copie (résolus), la copie principale, l'enfant
 *  légitime (I-41 : la racine d'un worktree du même dépôt, autre que la copie
 *  du parent), la liste de `git worktree list --porcelain -z`, la branche
 *  d'une copie lue sur le disque, le dossier git commun d'un dossier lu sur le
 *  disque (sans git).
 *  Ne connaît pas : Electron, git (run injecté), le disque (realpath, read
 *  injectés), la config.
 *  Utilisé par : core/family, core/vibecoder (artifacts), app/controllers (worktrees, agents), app/menus. */
import path from 'node:path';

export type Repo = { common: string; top: string };

// Le dépôt du dossier où `run` lance git : son dossier git commun et la racine
// de sa copie, résolus ; null si ce n'en est pas un.
export async function repoOf(run: (args: string[]) => Promise<string | null>, realpath: (p: string) => string): Promise<Repo | null> {
  const [common, top] = ((await run(['rev-parse', '--path-format=absolute', '--git-common-dir', '--show-toplevel'])) ?? '').split('\n');
  try { return common && top ? { common: realpath(common), top: realpath(top) } : null; } catch { return null; }
}

// La copie principale : son dossier git est <racine>/.git.
export const isMain = (repo: Repo) => path.resolve(repo.common) === path.resolve(repo.top, '.git');

// `dir` est la racine d'un worktree (`wt`) du même dépôt que `own`, autre que
// la copie `own` (I-41) : un sous-dossier n'en est jamais un.
export const childOf = (dir: string, own: Repo, wt: Repo) => wt.common === own.common && wt.top === dir && wt.top !== own.top;

// `git worktree list --porcelain -z` → les copies et leur branche (null :
// détachée) ; un dépôt nu, un chemin à caractère de contrôle : écartés.
export function parseWorktrees(porcelain: string): { dir: string; branch: string | null }[] {
  const list: { dir: string; branch: string | null; bare: boolean }[] = [];
  for (const field of porcelain.split('\0')) {
    if (field.startsWith('worktree ')) list.push({ dir: field.slice(9), branch: null, bare: false });
    else if (!list.length) continue;
    else if (field === 'bare') list[list.length - 1].bare = true;
    else if (field.startsWith('branch ')) list[list.length - 1].branch = field.slice(7).replace(/^refs\/heads\//, '');
  }
  return list.filter((w) => !w.bare && w.dir && !/[\x00-\x1f\x7f]/.test(w.dir)).map(({ dir, branch }) => ({ dir, branch }));
}

// La branche de la copie `dir`, sans lancer git : son `.git` (dossier, ou
// fichier `gitdir:` d'un worktree), puis HEAD ; null si détachée ou illisible.
export function branchOf(dir: string, read: (file: string) => string | null): string | null {
  const pointer = read(path.join(dir, '.git'));
  const gitDir = pointer?.startsWith('gitdir:') ? path.resolve(dir, pointer.slice(7).trim()) : path.join(dir, '.git');
  const m = /^ref: refs\/heads\/(.+)$/.exec(read(path.join(gitDir, 'HEAD'))?.trim() ?? '');
  return m ? m[1] : null;
}

// Le dossier git commun de `dir`, sans lancer git : on remonte comme git. Un
// `.git` dossier (on y lit HEAD) donne `<dossier>/.git` ; un `.git` fichier
// (`gitdir: X`) donne ce que dit `X/commondir`, relatif à `X`, ou `X` sans lui
// (un sous-module est son propre dépôt). Non résolu (liens : à l'appelant) ;
// null hors de tout dépôt.
export function commonDirOf(dir: string, read: (file: string) => string | null): string | null {
  for (let d = path.resolve(dir); ; d = path.dirname(d)) {
    const dotGit = path.join(d, '.git');
    const pointer = read(dotGit);
    if (pointer?.startsWith('gitdir:')) {
      const gitDir = path.resolve(d, pointer.slice(7).trim());
      const common = read(path.join(gitDir, 'commondir'))?.trim();
      return common ? path.resolve(gitDir, common) : gitDir;
    }
    if (read(path.join(dotGit, 'HEAD')) !== null) return dotGit;
    if (path.dirname(d) === d) return null;
  }
}
