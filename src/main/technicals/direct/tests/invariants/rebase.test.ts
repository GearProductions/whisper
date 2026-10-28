// Invariant de Rebase. Protégé : si un test échoue, corriger le code.
//   Note 0.12.0 docs/tickets/feat/0.12.0-gestion-des-branches.md, « Ce que ça
//   ne doit pas faire » : « Laisser un rebase en cours après un conflit : git
//   rebase --abort aussitôt » (SPEC F-114) — un conflit, et rien ne bouge :
//   pas de rebase en cours, la branche et son commit tels quels, les
//   modifications en cours reprises (--autostash), aucune entrée de stash
//   laissée. La forme exacte des commandes : direct.test.ts.
// Sur du réel : un dépôt temporaire (git init, commits en conflit), le vrai
// git lancé par le vrai lanceur (launchFile), chaque appel relevé au passage.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { directRunner, launchFile, type Launch } from 'technicals/direct';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecoder-rebase-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
// git pour préparer et observer le dépôt (le test, pas le code testé).
const git = (dir: string, ...args: string[]) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8' }).trim();

// Un dépôt neuf par cas, sur feat/x : feat/x et main changent la même ligne de
// a.txt, chacune de son côté (un rebase de feat/x sur main est en conflit) ;
// c.txt suivi, inchangé des deux côtés.
let n = 0;
function conflicting() {
  const dir = path.join(tmp, `depot-${n++}`);
  fs.mkdirSync(dir);
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'config', 'user.name', 'Essai');
  git(dir, 'config', 'user.email', 'essai@exemple.fr');
  git(dir, 'config', 'commit.gpgsign', 'false');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'un\n');
  fs.writeFileSync(path.join(dir, 'c.txt'), 'c\n');
  git(dir, 'add', 'a.txt', 'c.txt');
  git(dir, 'commit', '-q', '-m', 'premier');
  git(dir, 'switch', '-q', '-c', 'feat/x');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'deux, la branche\n');
  git(dir, 'commit', '-q', '-am', 'la branche');
  git(dir, 'switch', '-q', 'main');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'trois, la base\n');
  git(dir, 'commit', '-q', '-am', 'la base');
  git(dir, 'switch', '-q', 'feat/x');
  return dir;
}

// Le vrai lanceur sur `dir`, chaque commande relevée.
function realRunner(dir: string) {
  const calls: string[][] = [];
  const launch: Launch = (argv, cwd) => { calls.push(argv); return launchFile(argv, cwd); };
  return { calls, runner: directRunner({ dir, out: path.join(dir, '..', `sorties-${n}`), prefix: [], launch }) };
}
// Un rebase est en cours : git en garde l'état dans rebase-merge ou rebase-apply.
const rebasing = (dir: string) => ['rebase-merge', 'rebase-apply']
  .some((p) => fs.existsSync(path.resolve(dir, git(dir, 'rev-parse', '--git-path', p))));
const stashes = (dir: string) => git(dir, 'stash', 'list').split('\n').filter(Boolean);
const attempted = (calls: string[][]) => calls.filter((a) => a.includes('rebase') && !a.includes('--abort'));

describe('un rebase en conflit est abandonné aussitôt : rien ne bouge', () => {
  it('après le conflit, aucun rebase n’est en cours', async () => {
    const dir = conflicting();
    const { calls, runner } = realRunner(dir);

    await runner.rebase('main');

    // le rebase a bien été tenté
    expect(attempted(calls).length).toBeGreaterThan(0);
    // plus aucun rebase en cours
    expect(rebasing(dir)).toBe(false);
  });

  it('après le conflit, l’échec est rendu', async () => {
    const dir = conflicting();
    const { calls, runner } = realRunner(dir);

    const result = await runner.rebase('main');

    // le rebase a bien été tenté
    expect(attempted(calls).length).toBeGreaterThan(0);
    // l'échec est rendu à l'appelant
    expect(result.ok).toBe(false);
  });

  it('après le conflit, la branche et son commit sont ceux d’avant', async () => {
    const dir = conflicting();
    const before = { branch: git(dir, 'rev-parse', '--abbrev-ref', 'HEAD'), head: git(dir, 'rev-parse', 'HEAD') };
    const { calls, runner } = realRunner(dir);

    await runner.rebase('main');

    // le rebase a bien été tenté
    expect(attempted(calls).length).toBeGreaterThan(0);
    // toujours sur la même branche, au même commit
    expect({ branch: git(dir, 'rev-parse', '--abbrev-ref', 'HEAD'), head: git(dir, 'rev-parse', 'HEAD') }).toEqual(before);
  });

  // Le cas limite : des modifications en cours au moment du clic (--autostash les met de côté).
  it('des modifications en cours : après le conflit, elles sont reprises et aucune entrée de stash ne reste', async () => {
    const dir = conflicting();
    fs.writeFileSync(path.join(dir, 'c.txt'), 'c, modifié\n');
    fs.writeFileSync(path.join(dir, 'd.txt'), 'non suivi\n');
    const before = git(dir, '--no-optional-locks', 'status', '--porcelain');
    const { calls, runner } = realRunner(dir);

    await runner.rebase('main');

    // le rebase a bien été tenté
    expect(attempted(calls).length).toBeGreaterThan(0);
    // la copie de travail est celle d'avant
    expect(git(dir, '--no-optional-locks', 'status', '--porcelain')).toEqual(before);
    // le contenu modifié est revenu
    expect(fs.readFileSync(path.join(dir, 'c.txt'), 'utf8')).toBe('c, modifié\n');
    // aucune entrée de stash laissée par --autostash
    expect(stashes(dir)).toEqual([]);
  });
});
