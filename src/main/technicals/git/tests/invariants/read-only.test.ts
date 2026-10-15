// Invariant de git dans VibeCoder. Protégé : si un test échoue, corriger le code.
//   Note 0.8.0, « Ce que ça ne doit pas faire » : modifier le dépôt depuis le
//   principal — il ne lance git qu'en lecture, sur une liste fermée de
//   sous-commandes, sans qu'un argument venu d'ailleurs puisse devenir une
//   option ; commit, push, rebase, checkout passent par l'agent, dans la
//   conversation, avec ses autorisations.
// Les appels relevés au passage (Run) ; et sur du réel : un dépôt temporaire
// (git init, commits), le vrai git.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { GIT_READ, gitReader, gitRun, type Run } from 'technicals/git';

const READ: readonly string[] = GIT_READ;

// Un Run qui relève ses appels, sans rien lancer.
function recorder() {
  const calls: string[][] = [];
  const run: Run = async (args) => { calls.push(args); return null; };
  return { calls, run };
}

describe('seulement des sous-commandes en lecture', () => {
  it('GIT_READ ne contient aucune commande qui écrit', () => {
    const WRITE = ['commit', 'push', 'pull', 'fetch', 'checkout', 'switch', 'reset', 'rebase', 'merge', 'branch', 'tag', 'clean',
      'stash', 'config', 'remote', 'add', 'rm', 'mv', 'gc', 'update-ref', 'worktree'];
    // aucune commande qui écrit dans la liste fermée
    expect(READ.filter((c) => WRITE.includes(c))).toEqual([]);
  });
});

describe('un argument venu d’ailleurs ne devient jamais une option', () => {
  it('facts : un ref qui commence par « - » (--output=…) est refusé sans lancer git', async () => {
    const { calls, run } = recorder();
    // refusé
    expect(await gitReader(run).facts('--output=/tmp/x')).toBeNull();
    // sans que git soit lancé
    expect(calls).toEqual([]);
  });

  it('show : un ref qui commence par « - » est refusé sans lancer git', async () => {
    const { calls, run } = recorder();
    // refusé
    expect(await gitReader(run).show('--output=/tmp/x', 'a.txt')).toBeNull();
    // sans que git soit lancé
    expect(calls).toEqual([]);
  });

  it('show : un chemin qui commence par « - » est refusé sans lancer git', async () => {
    const { calls, run } = recorder();
    // refusé
    expect(await gitReader(run).show('HEAD', '--output=/tmp/x')).toBeNull();
    // sans que git soit lancé
    expect(calls).toEqual([]);
  });

  it('blob : un ref qui commence par « - » est refusé sans lancer git', async () => {
    const { calls, run } = recorder();
    // refusé
    expect(await gitReader(run).blob('--output=/tmp/x', 'a.txt')).toBeNull();
    // sans que git soit lancé
    expect(calls).toEqual([]);
  });

  it('blob : un chemin qui commence par « - » est refusé sans lancer git', async () => {
    const { calls, run } = recorder();
    // refusé
    expect(await gitReader(run).blob('HEAD', '--output=/tmp/x')).toBeNull();
    // sans que git soit lancé
    expect(calls).toEqual([]);
  });

  it('un ref qui contient « .. » est refusé sans lancer git', async () => {
    const { calls, run } = recorder();
    // refusé
    expect(await gitReader(run).show('refs/../../x', 'a.txt')).toBeNull();
    // sans que git soit lancé
    expect(calls).toEqual([]);
  });

  it('un ref qui contient un NUL est refusé sans lancer git', async () => {
    const { calls, run } = recorder();
    // refusé
    expect(await gitReader(run).show('HEAD\0--output=/tmp/x', 'a.txt')).toBeNull();
    // sans que git soit lancé
    expect(calls).toEqual([]);
  });

  it('un chemin qui contient un NUL est refusé sans lancer git', async () => {
    const { calls, run } = recorder();
    // refusé
    expect(await gitReader(run).show('HEAD', 'a.txt\0--output=/tmp/x')).toBeNull();
    // sans que git soit lancé
    expect(calls).toEqual([]);
  });

  it('un ref hors de [A-Za-z0-9._/-] (« HEAD; rm -rf ~ ») est refusé sans lancer git', async () => {
    const { calls, run } = recorder();
    // refusé
    expect(await gitReader(run).facts('HEAD; rm -rf ~')).toBeNull();
    // sans que git soit lancé
    expect(calls).toEqual([]);
  });
});

describe('sur un vrai dépôt', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecoder-git-'));
  afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
  // git pour préparer et observer un dépôt (le test, pas le code testé).
  const git = (dir: string, ...args: string[]) => execFileSync('git',
    ['-C', dir, '-c', 'user.name=Essai', '-c', 'user.email=essai@exemple.fr', '-c', 'commit.gpgsign=false', ...args], { encoding: 'utf8' });

  // Un dépôt neuf par cas : main, puis une branche feat/x avec un commit ; une
  // modification non commitée, un fichier non suivi, et un fichier suivi
  // touché sans être modifié (un `git status` ordinaire réécrirait l'index
  // pour le rafraîchir).
  let n = 0;
  function repo() {
    const dir = path.join(tmp, `depot-${n++}`);
    fs.mkdirSync(dir);
    git(dir, 'init', '-q', '-b', 'main');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'un\n');
    git(dir, 'add', 'a.txt');
    git(dir, 'commit', '-q', '-m', 'premier');
    git(dir, 'checkout', '-q', '-b', 'feat/x');
    fs.writeFileSync(path.join(dir, 'b.txt'), 'deux\n');
    git(dir, 'add', 'b.txt');
    git(dir, 'commit', '-q', '-m', 'second');
    fs.writeFileSync(path.join(dir, 'a.txt'), 'un, modifié\n');
    fs.writeFileSync(path.join(dir, 'c.txt'), 'pas suivi\n');
    const hourAgo = new Date(Date.now() - 3_600_000);
    fs.utimesSync(path.join(dir, 'b.txt'), hourAgo, hourAgo);
    return dir;
  }

  // Le vrai git d'un dépôt neuf, chaque appel relevé.
  function recordedGit() {
    const real = gitRun(repo());
    const calls: string[][] = [];
    const run: Run = (args) => { calls.push(args); return real(args); };
    return { calls, run };
  }
  const outside = (calls: string[][]) => calls.map((a) => a[0]).filter((c) => !READ.includes(c));

  it('facts() : chaque appel est une sous-commande de GIT_READ', async () => {
    const { calls, run } = recordedGit();
    await gitReader(run).facts();
    // git a bien été interrogé
    expect(calls.length).toBeGreaterThan(0);
    // et seulement en lecture
    expect(outside(calls)).toEqual([]);
  });

  it('facts(ref) : chaque appel est une sous-commande de GIT_READ', async () => {
    const { calls, run } = recordedGit();
    await gitReader(run).facts('main');
    // git a bien été interrogé
    expect(calls.length).toBeGreaterThan(0);
    // et seulement en lecture
    expect(outside(calls)).toEqual([]);
  });

  it('show() : chaque appel est une sous-commande de GIT_READ', async () => {
    const { calls, run } = recordedGit();
    await gitReader(run).show('HEAD', 'b.txt');
    // git a bien été interrogé
    expect(calls.length).toBeGreaterThan(0);
    // et seulement en lecture
    expect(outside(calls)).toEqual([]);
  });

  it('blob() : chaque appel est une sous-commande de GIT_READ', async () => {
    const { calls, run } = recordedGit();
    await gitReader(run).blob('HEAD', 'b.txt');
    // git a bien été interrogé
    expect(calls.length).toBeGreaterThan(0);
    // et seulement en lecture
    expect(outside(calls)).toEqual([]);
  });

  it('un relevé laisse l’état, les références et l’index du dépôt tels quels', async () => {
    const dir = repo();
    // ce que git en montre (sans prendre de verrou), ses références, son index
    const snapshot = () => [
      git(dir, '--no-optional-locks', 'status', '--porcelain', '--branch'),
      git(dir, 'for-each-ref'),
      fs.readFileSync(path.join(dir, '.git', 'index')).toString('base64'),
    ];
    const before = snapshot();
    const reader = gitReader(gitRun(dir));
    await reader.facts();
    await reader.show('HEAD', 'b.txt');
    await reader.blob('HEAD', 'b.txt');
    // rien n'a bougé
    expect(snapshot()).toEqual(before);
  });
});
