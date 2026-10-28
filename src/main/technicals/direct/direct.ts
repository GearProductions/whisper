/** direct — les actions que l'appli fait elle-même, sans agent ni
 *  modèle, au clic de leur bouton (F-114, I-39) : commiter le message
 *  préparé, publier la revue, dire si une PR vient d'un fork, charger une PR
 *  (sa fiche, puis sa seule branche : git fetch origin <tête>), revenir sur
 *  la base, aller sur une branche ou la créer depuis un point de départ (git
 *  switch [-c], le dossier propre vérifié par l'appelant), rapatrier une
 *  branche d'origin, la mettre à jour (git pull --ff-only origin), mettre les
 *  modifications de côté (git stash push -u, rien d'autre), supprimer la
 *  branche pr-<n> de l'appli (son worktree retiré) ; Pull de la branche
 *  suivie (git pull --ff-only --autostash), Rebase (git rebase --autostash
 *  <onto> ; un échec → git rebase --abort aussitôt), Pousser (git push
 *  --force-with-lease, jamais --force), Actualiser (git fetch origin), Me
 *  demander en relecture (gh pr edit <n> --add-reviewer <identifiant>).
 *  Une liste fermée de commandes (DIRECT_GIT, DIRECT_GH), aux arguments fixes ou
 *  vérifiés : une PR est un entier positif, un verdict l'un des trois, un
 *  identifiant GitHub ses seuls caractères (okLogin), une
 *  branche un ref sûr (okRef) ; un fichier est écrit par l'appli dans le
 *  dossier de sorties, jamais donné. git (au dossier du dépôt) et gh derrière
 *  le préfixe (core/runner, commandPrefix : la box, où les hooks de git
 *  trouvent Node), sans shell (execFile, I-27), 60 s au plus chacun ; chaque commande, une ligne de <out>/direct.log ; un échec
 *  s'arrête là et se rend (ok faux, la sortie), sans rien bloquer (I-29).
 *  Les réponses sont en anglais, comme celles des skills techniques (F-108).
 *  Le texte de pr-<n>.json (prCardText), le même pour l'appelant qui l'écrit.
 *  Ne connaît pas : VibeCoder (sa vue, ses actions), Electron, la configuration.
 *  Utilisé par : app/controllers/vibecoder (runDirect, depuis runVibeAction sur args.direct). */
import { execFile } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { okRef } from 'technicals/git';
import { okLogin } from 'technicals/github';

// Les seules commandes lancées : git <sous-commande>, gh pr review et gh pr edit (écrivent), gh pr view (lit).
export const DIRECT_GIT = ['commit', 'fetch', 'switch', 'pull', 'branch', 'stash', 'rebase', 'push'] as const;
export const DIRECT_GH = [['pr', 'review'], ['pr', 'view'], ['pr', 'edit']] as const;
export const VERDICTS = ['approve', 'comment', 'request-changes'] as const;

// Lance argv (sans shell) au dossier `cwd` → son code de sortie (null : pas lancé, tué, trop long) et ses sorties.
export type Launch = (argv: string[], cwd: string) => Promise<{ exit: number | null; stdout: string; stderr: string }>;
// ok, une ligne à montrer sous le bouton, le détail (les commandes et leurs sorties).
export type DirectResult = { ok: boolean; line: string; detail: string };

export const launchFile: Launch = (argv, cwd) => new Promise((resolve) => {
  try {
    execFile(argv[0], argv.slice(1), {
      cwd, timeout: 60_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    }, (err, stdout, stderr) => resolve({
      exit: !err ? 0 : typeof err.code === 'number' ? err.code : null, stdout: String(stdout), stderr: String(stderr || (err ? err.message : '')),
    }));
  } catch (err) {
    resolve({ exit: null, stdout: '', stderr: err instanceof Error ? err.message : String(err) });   // un dossier qui manque…
  }
});

const okNumber = (n: unknown): n is number => Number.isInteger(n) && (n as number) > 0;
const parse = (text: string): Record<string, unknown> | null => {
  try { const v = JSON.parse(text); return v && typeof v === 'object' ? v : null; } catch { return null; }
};
const STATE = { approve: 'APPROVED', comment: 'COMMENTED', 'request-changes': 'CHANGES_REQUESTED' } as const;
const PR_FIELDS = 'number,title,url,author,baseRefName,headRefName,body,state';

// pr-<n>.json : la fiche d'une PR, ces clés, dans cet ordre (loadPr ; app/controllers, pour suivre une PR sans la charger).
type PrCard = Record<'number' | 'title' | 'url' | 'author' | 'base' | 'head' | 'body' | 'state', unknown>;
export const prCardText = ({ number, title, url, author, base, head, body, state }: PrCard) =>
  `${JSON.stringify({ number, title, url, author, base, head, body, state }, null, 2)}\n`;

export function directRunner({ dir, out, prefix, launch = launchFile }: { dir: string; out: string; prefix: string[]; launch?: Launch }) {
  const done: string[] = [];   // le détail de l'action en cours : chaque commande et sa sortie
  // Une commande de la liste fermée (une autre : refusée, rien lancé), inscrite dans direct.log.
  async function run(tool: 'git' | 'gh', args: string[]) {
    const allowed = tool === 'git' ? (DIRECT_GIT as readonly string[]).includes(args[0])
      : DIRECT_GH.some(([a, b]) => args[0] === a && args[1] === b);
    if (!allowed) return { exit: null, stdout: '', stderr: 'refused: not in the closed list' };
    const argv = tool === 'git' ? [...prefix, 'git', '-C', dir, ...args] : [...prefix, 'gh', ...args];
    const r = await launch(argv, dir);
    const output = `${r.stdout}${r.stderr}`.trim();
    const shown = `${tool} ${args.join(' ')}`;
    done.push(`$ ${shown}  (exit ${r.exit ?? '-'})${output ? `\n${output}` : ''}`);
    try {
      fs.mkdirSync(out, { recursive: true });
      fs.appendFileSync(path.join(out, 'direct.log'),
        `${new Date().toISOString()}\t${argv.join(' ')}\t${r.exit ?? '-'}\t${output.replace(/\s+/g, ' ').slice(0, 300)}\n`);
    } catch { /* le journal n'empêche rien */ }
    return r;
  }
  const result = (ok: boolean, line: string): DirectResult => ({ ok, line, detail: done.splice(0).join('\n\n') });
  // La première ligne utile d'une sortie (en échec : d'abord l'erreur), sinon `fallback`.
  const first = (r: { exit: number | null; stdout: string; stderr: string }, fallback: string) =>
    (r.exit === 0 ? `${r.stdout}\n${r.stderr}` : `${r.stderr}\n${r.stdout}`).split('\n').map((l) => l.trim()).find(Boolean) ?? fallback;

  return {
    // git commit -F <out>/commit.md (rien d'ajouté à l'index), puis commit.md supprimé.
    async commit(): Promise<DirectResult> {
      const file = path.join(out, 'commit.md');
      let text = '';
      try { text = fs.readFileSync(file, 'utf8'); } catch { /* pas de message */ }
      if (!text.trim()) return result(false, 'No prepared message (commit.md).');
      const r = await run('git', ['commit', '-F', file]);
      if (r.exit !== 0) return result(false, first(r, 'git commit failed.'));
      fs.rmSync(file, { force: true });
      return result(true, first(r, 'Committed.'));
    },

    // gh pr review <n> --<verdict> --body-file <le brouillon, écrit ici>, puis <out>/pr-<n>-review.json.
    async publish(n: unknown, verdict: unknown, body: string, url: string): Promise<DirectResult> {
      if (!okNumber(n) || !(VERDICTS as readonly unknown[]).includes(verdict) || !body.trim()) return result(false, 'Refused: PR, verdict or draft missing.');
      const file = path.join(out, `pr-${n}-review-body.md`);
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(file, body);
      const r = await run('gh', ['pr', 'review', String(n), `--${verdict}`, '--body-file', file]);
      if (r.exit !== 0) return result(false, first(r, 'gh pr review failed.'));
      const state = STATE[verdict as keyof typeof STATE];
      fs.writeFileSync(path.join(out, `pr-${n}-review.json`), `${JSON.stringify({ state, url })}\n`);
      return result(true, `${state} ${url}`.trim());
    },

    // gh pr view <n> --json isCrossRepository : ok si la branche de la PR est sur ce dépôt ; d'un fork, refusé.
    async sameRepo(n: unknown): Promise<DirectResult> {
      if (!okNumber(n)) return result(false, 'Refused: the PR is not a positive integer.');
      const v = await run('gh', ['pr', 'view', '--json', 'isCrossRepository', '--', String(n)]);
      const p = v.exit === 0 ? parse(v.stdout) : null;
      if (!p) return result(false, first(v, `gh pr view ${n} failed.`));
      if (p.isCrossRepository === true) return result(false, `Refused: PR #${n} comes from a fork; only PRs whose branch is on origin load.`);
      return result(true, `#${n} is on origin.`);
    },

    // gh pr view <n> → <out>/pr-<n>.json, puis git fetch origin <tête> (une PR d'un fork : sa branche n'est pas sur origin, échec).
    async loadPr(n: unknown): Promise<DirectResult> {
      if (!okNumber(n)) return result(false, 'Refused: the PR is not a positive integer.');
      const v = await run('gh', ['pr', 'view', '--json', PR_FIELDS, '--', String(n)]);
      const p = v.exit === 0 ? parse(v.stdout) : null;
      if (!p || p.number !== n) return result(false, first(v, `gh pr view ${n} failed.`));
      const base = String(p.baseRefName ?? '');
      const head = String(p.headRefName ?? '');
      if (!okRef(base) || !okRef(head)) return result(false, `Refused: unexpected base or head « ${base} », « ${head} ».`);
      const author = (p.author as { login?: unknown } | null)?.login ?? '';
      fs.mkdirSync(out, { recursive: true });
      fs.writeFileSync(path.join(out, `pr-${n}.json`), prCardText({ number: n, title: p.title, url: p.url, author, base, head, body: p.body, state: p.state }));
      const f = await run('git', ['fetch', 'origin', head]);
      if (f.exit !== 0) return result(false, first(f, 'git fetch failed.'));
      return result(true, `#${n} ${String(p.title ?? '')} (${head} → ${base})${p.state === 'OPEN' ? '' : `, ${String(p.state)}`}`);
    },

    // Seulement si la PR de `branch` est MERGED : git switch <base>, git pull --ff-only, git branch -d <branch>.
    async toBase(branch: unknown, base: unknown): Promise<DirectResult> {
      if (typeof branch !== 'string' || typeof base !== 'string' || !okRef(branch) || !okRef(base) || branch === base) {
        return result(false, 'Refused: branch or base missing or unsafe.');
      }
      const v = await run('gh', ['pr', 'view', '--json', 'state', '--', branch]);
      const state = v.exit === 0 ? parse(v.stdout)?.state : null;
      if (state !== 'MERGED') {
        return result(false, state ? `The PR of ${branch} is ${String(state)}, not merged: nothing done.` : first(v, `No PR found for ${branch}: nothing done.`));
      }
      for (const args of [['switch', base], ['pull', '--ff-only'], ['branch', '-d', branch]]) {
        const r = await run('git', args);
        if (r.exit !== 0) return result(false, first(r, `git ${args[0]} failed.`));
      }
      return result(true, `On ${base}, up to date; ${branch} deleted.`);
    },

    // git fetch origin <branch> : origin/<branch> à jour.
    async fetchBranch(branch: unknown): Promise<DirectResult> {
      if (typeof branch !== 'string' || !okRef(branch)) return result(false, 'Refused: branch missing or unsafe.');
      const r = await run('git', ['fetch', 'origin', branch]);
      if (r.exit !== 0) return result(false, first(r, 'git fetch failed.'));
      return result(true, `origin/${branch} fetched.`);
    },

    // git pull --ff-only origin <branch> (remote et branche nommés : une branche locale sans suivi passe) ; non fast-forward : l'échec.
    async pullBranch(branch: unknown): Promise<DirectResult> {
      if (typeof branch !== 'string' || !okRef(branch)) return result(false, 'Refused: branch missing or unsafe.');
      const r = await run('git', ['pull', '--ff-only', 'origin', branch]);
      if (r.exit !== 0) return result(false, first(r, 'git pull failed.'));
      return result(true, `${branch} up to date with origin.`);
    },

    // git switch <branch> ; avec `start` : git switch -c <branch> <start> (le dossier propre : à l'appelant de l'avoir vérifié).
    async switchTo(branch: unknown, start?: unknown): Promise<DirectResult> {
      if (typeof branch !== 'string' || !okRef(branch)) return result(false, 'Refused: branch missing or unsafe.');
      if (start !== undefined && (typeof start !== 'string' || !okRef(start))) return result(false, 'Refused: start point unsafe.');
      const r = await run('git', start === undefined ? ['switch', branch] : ['switch', '-c', branch, start]);
      if (r.exit !== 0) return result(false, first(r, 'git switch failed.'));
      return result(true, `On ${branch}.`);
    },

    // git stash push -u, arguments fixes (aucune autre forme de stash) ; le dossier relu par l'appelant.
    async stash(): Promise<DirectResult> {
      const r = await run('git', ['stash', 'push', '-u']);
      if (r.exit !== 0) return result(false, first(r, 'git stash failed.'));
      return result(true, first(r, 'Changes stashed.'));
    },

    // git pull --ff-only --autostash : la branche suivie, aucun argument donné ; pas d'avance rapide : l'échec.
    async pull(): Promise<DirectResult> {
      const r = await run('git', ['pull', '--ff-only', '--autostash']);
      if (r.exit !== 0) return result(false, first(r, 'git pull failed.'));
      return result(true, first(r, 'Up to date.'));
    },

    // git rebase --autostash <onto> (onto : okRef) ; un échec → git rebase --abort aussitôt, puis l'échec rendu.
    async rebase(onto: unknown): Promise<DirectResult> {
      if (typeof onto !== 'string' || !okRef(onto)) return result(false, 'Refused: branch missing or unsafe.');
      const r = await run('git', ['rebase', '--autostash', onto]);
      if (r.exit === 0) return result(true, `Rebased on ${onto}.`);
      const a = await run('git', ['rebase', '--abort']);
      return result(false, `${first(r, 'git rebase failed.')}${a.exit === 0 ? ' (rebase aborted)' : ' (git rebase --abort failed too)'}`);
    },

    // git push --force-with-lease, arguments fixes (jamais --force).
    async push(): Promise<DirectResult> {
      const r = await run('git', ['push', '--force-with-lease']);
      if (r.exit !== 0) return result(false, first(r, 'git push failed.'));
      return result(true, 'Pushed.');
    },

    // git fetch origin : tout le distant (Actualiser, au clic seulement).
    // gh pr edit <n> --add-reviewer <identifiant> : s'ajouter en relecteur.
    async requestReview(n: unknown, login: unknown): Promise<DirectResult> {
      if (!okNumber(n) || !okLogin(login)) return result(false, 'Refused: PR or GitHub login missing.');
      const r = await run('gh', ['pr', 'edit', String(n), '--add-reviewer', login]);
      if (r.exit !== 0) return result(false, first(r, 'gh pr edit failed.'));
      return result(true, `Review requested from ${login} on #${n}.`);
    },

    async fetchAll(): Promise<DirectResult> {
      const r = await run('git', ['fetch', 'origin']);
      if (r.exit !== 0) return result(false, first(r, 'git fetch failed.'));
      return result(true, 'origin fetched.');
    },

    // git branch -D pr-<n> : la branche de l'appli, son worktree retiré (jamais une autre).
    async dropPrBranch(n: unknown): Promise<DirectResult> {
      if (!okNumber(n)) return result(false, 'Refused: the PR is not a positive integer.');
      const r = await run('git', ['branch', '-D', `pr-${n}`]);
      if (r.exit !== 0) return result(false, first(r, 'git branch -D failed.'));
      return result(true, `pr-${n} deleted.`);
    },
  };
}
