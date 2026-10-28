// Les actions directes sur de vrais dépôts (git init, un « origin » nu, des
// clones) ; gh simulé par un faux préfixe (node et un script) qui relève ses
// arguments et répond ce qu'on lui a préparé.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { directRunner } from 'technicals/direct';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecoder-direct-git-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));
// Une identité, et ni la configuration de l'utilisateur (signature, hooks…) ni celle du système : pour
// le git du test comme pour celui du code testé (il hérite de l'environnement).
Object.assign(process.env, { GIT_AUTHOR_NAME: 'Essai', GIT_AUTHOR_EMAIL: 'essai@exemple.fr', GIT_COMMITTER_NAME: 'Essai',
  GIT_COMMITTER_EMAIL: 'essai@exemple.fr', GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' });
const ENV = process.env;
// git pour préparer et observer (le test, pas le code testé).
const git = (dir: string, ...args: string[]) => execFileSync('git', ['-C', dir, ...args], { encoding: 'utf8', env: ENV }).trim();

// Le faux préfixe : git passe au vrai git ; gh est simulé — ses arguments relevés dans calls.jsonl, il
// répond answer.json (sortie 0), ou rien et 1 s'il manque.
const FAKE = path.join(tmp, 'faux-prefixe.cjs');
const CALLS = path.join(tmp, 'calls.jsonl');
const ANSWER = path.join(tmp, 'answer.json');
fs.writeFileSync(FAKE, `const fs = require('fs');
if (process.argv[2] !== 'gh') {
  const r = require('child_process').spawnSync(process.argv[2], process.argv.slice(3), { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
fs.appendFileSync(${JSON.stringify(CALLS)}, JSON.stringify(process.argv.slice(2)) + '\\n');
if (!fs.existsSync(${JSON.stringify(ANSWER)})) { process.stderr.write('no pull requests found'); process.exit(1); }
process.stdout.write(fs.readFileSync(${JSON.stringify(ANSWER)}, 'utf8'));\n`);
const PREFIX = [process.execPath, FAKE];
const answer = (v: unknown) => fs.writeFileSync(ANSWER, JSON.stringify(v));
const ghCalls = () => { const l = fs.existsSync(CALLS) ? fs.readFileSync(CALLS, 'utf8').trim().split('\n').filter(Boolean) : []; fs.rmSync(CALLS, { force: true }); return l.map((x) => JSON.parse(x)); };

// Un origin nu (main, un commit), un clone sur feat/x (un commit, poussé), et ses sorties.
let k = 0;
function setup() {
  const root = path.join(tmp, `cas-${k++}`);
  const origin = path.join(root, 'origin.git');
  const work = path.join(root, 'work');
  const out = path.join(root, 'out');
  fs.mkdirSync(root);
  execFileSync('git', ['init', '-q', '--bare', '-b', 'main', origin], { env: ENV });
  execFileSync('git', ['clone', '-q', origin, work], { env: ENV, stdio: 'ignore' });   // « dépôt vide » : attendu
  git(work, 'switch', '-q', '-c', 'main');
  fs.writeFileSync(path.join(work, 'a.txt'), 'un\n');
  git(work, 'add', 'a.txt');
  git(work, 'commit', '-q', '-m', 'premier');
  git(work, 'push', '-q', '-u', 'origin', 'main');
  git(work, 'switch', '-q', '-c', 'feat/x');
  fs.writeFileSync(path.join(work, 'b.txt'), 'deux\n');
  git(work, 'add', 'b.txt');
  git(work, 'commit', '-q', '-m', 'second');
  git(work, 'push', '-q', '-u', 'origin', 'feat/x');
  fs.rmSync(ANSWER, { force: true });
  ghCalls();
  return { root, origin, work, out, runner: directRunner({ dir: work, out, prefix: PREFIX }) };
}

describe('commit', () => {
  it('commite l’index avec le message de commit.md, puis le supprime ; ce qui n’est pas indexé reste', async () => {
    const { work, out, runner } = setup();
    fs.writeFileSync(path.join(work, 'c.txt'), 'trois\n');
    git(work, 'add', 'c.txt');
    fs.writeFileSync(path.join(work, 'a.txt'), 'un, modifié\n');   // pas indexé
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'commit.md'), 'core/x : le module\n\nSon contrat.\n');
    const r = await runner.commit();
    expect(r.ok).toBe(true);
    expect(r.line).toMatch(/core\/x : le module/);
    expect(git(work, 'log', '-1', '--format=%B')).toBe('core/x : le module\n\nSon contrat.');
    expect(git(work, 'show', '--name-only', '--format=', 'HEAD')).toBe('c.txt');
    expect(git(work, 'status', '--porcelain')).toBe('M a.txt');
    expect(fs.existsSync(path.join(out, 'commit.md'))).toBe(false);
    expect(fs.readFileSync(path.join(out, 'direct.log'), 'utf8')).toMatch(/\t\S+ \S+ git -C .* commit -F .*commit\.md\t0\t/);
  });

  it('rien d’indexé : échec rendu, commit.md gardé, aucun commit', async () => {
    const { work, out, runner } = setup();
    const head = git(work, 'rev-parse', 'HEAD');
    fs.mkdirSync(out, { recursive: true });
    fs.writeFileSync(path.join(out, 'commit.md'), 'x\n');
    const r = await runner.commit();
    expect(r.ok).toBe(false);
    expect(r.detail).toMatch(/\$ git commit -F/);
    expect(fs.existsSync(path.join(out, 'commit.md'))).toBe(true);
    expect(git(work, 'rev-parse', 'HEAD')).toBe(head);
  });

  it('pas de commit.md : refusé sans lancer git', async () => {
    const { out, runner } = setup();
    expect((await runner.commit()).ok).toBe(false);
    expect(fs.existsSync(path.join(out, 'direct.log'))).toBe(false);
  });
});

describe('base', () => {
  it('PR fusionnée : sur la base, à jour (la fusion tirée), la branche locale supprimée', async () => {
    const { root, origin, work, runner } = setup();
    // La fusion de la PR, faite ailleurs et poussée.
    const other = path.join(root, 'other');
    execFileSync('git', ['clone', '-q', origin, other], { env: ENV });
    git(other, 'merge', '-q', '--no-ff', '-m', 'Merge pull request #7', 'origin/feat/x');
    git(other, 'push', '-q', 'origin', 'main');
    answer({ state: 'MERGED' });
    const r = await runner.toBase('feat/x', 'main');
    expect(r).toMatchObject({ ok: true });
    expect(git(work, 'branch', '--show-current')).toBe('main');
    expect(git(work, 'log', '-1', '--format=%s')).toBe('Merge pull request #7');
    expect(git(work, 'branch', '--list', 'feat/x')).toBe('');
    expect(ghCalls()).toEqual([['gh', 'pr', 'view', '--json', 'state', '--', 'feat/x']]);
  });

  it('PR ouverte : refusé, rien ne bouge (branche, références)', async () => {
    const { work, runner } = setup();
    const refs = git(work, 'for-each-ref');
    answer({ state: 'OPEN' });
    const r = await runner.toBase('feat/x', 'main');
    expect(r.ok).toBe(false);
    expect(r.line).toMatch(/OPEN, not merged/);
    expect(git(work, 'branch', '--show-current')).toBe('feat/x');
    expect(git(work, 'for-each-ref')).toBe(refs);
  });

  it('pas de PR (gh échoue) : refusé avec sa raison, rien ne bouge', async () => {
    const { work, runner } = setup();
    const r = await runner.toBase('feat/x', 'main');
    expect(r).toMatchObject({ ok: false, line: 'no pull requests found' });
    expect(git(work, 'branch', '--show-current')).toBe('feat/x');
  });
});

describe('charger une PR', () => {
  it('pr-<n>.json écrit d’après gh, origin/<tête> rapatriée, la copie de travail intacte', async () => {
    const { work, out, runner } = setup();
    const tip = git(work, 'rev-parse', 'feat/x');
    git(work, 'switch', '-q', 'main');
    git(work, 'update-ref', '-d', 'refs/remotes/origin/feat/x');
    answer({ number: 7, title: 'Le titre', url: 'https://github.com/o/d/pull/7', author: { login: 'bob' }, baseRefName: 'main',
      headRefName: 'feat/x', body: 'Corps', state: 'OPEN' });
    const r = await runner.loadPr(7);
    expect(r).toMatchObject({ ok: true, line: '#7 Le titre (feat/x → main)' });
    expect(JSON.parse(fs.readFileSync(path.join(out, 'pr-7.json'), 'utf8'))).toEqual({
      number: 7, title: 'Le titre', url: 'https://github.com/o/d/pull/7', author: 'bob', base: 'main', head: 'feat/x', body: 'Corps', state: 'OPEN' });
    expect(git(work, 'rev-parse', 'origin/feat/x')).toBe(tip);
    expect(git(work, 'for-each-ref', 'refs/vibecoder')).toBe('');
    expect(git(work, 'branch', '--show-current')).toBe('main');
    expect(git(work, 'status', '--porcelain')).toBe('');
  });

  it('une tête absente d’origin (une PR d’un fork) : la fiche écrite, l’échec rendu', async () => {
    const { runner } = setup();
    answer({ number: 7, title: 't', url: 'u', author: { login: 'bob' }, baseRefName: 'main', headRefName: 'fork/ailleurs', body: '', state: 'OPEN' });
    expect((await runner.loadPr(7)).ok).toBe(false);
  });

  it('sameRepo : une PR d’un fork (isCrossRepository) refusée, clairement ; sinon ok', async () => {
    const { runner } = setup();
    answer({ isCrossRepository: true });
    expect(await runner.sameRepo(7)).toMatchObject({ ok: false, line: expect.stringMatching(/fork/) });
    expect(ghCalls()).toEqual([['gh', 'pr', 'view', '--json', 'isCrossRepository', '--', '7']]);
    answer({ isCrossRepository: false });
    expect((await runner.sameRepo(7)).ok).toBe(true);
  });
});

describe('publier la revue', () => {
  it('gh pr review reçoit le fichier du brouillon ; pr-<n>-review.json : l’état et le lien', async () => {
    const { out, runner } = setup();
    answer({});
    const r = await runner.publish(7, 'approve', '- [note] ok', 'https://github.com/o/d/pull/7');
    expect(r.ok).toBe(true);
    expect(ghCalls()).toEqual([['gh', 'pr', 'review', '7', '--approve', '--body-file', path.join(out, 'pr-7-review-body.md')]]);
    expect(fs.readFileSync(path.join(out, 'pr-7-review-body.md'), 'utf8')).toBe('- [note] ok');
    expect(JSON.parse(fs.readFileSync(path.join(out, 'pr-7-review.json'), 'utf8'))).toEqual({ state: 'APPROVED', url: 'https://github.com/o/d/pull/7' });
  });

  it('gh échoue (sa propre PR) : rien d’écrit dans pr-<n>-review.json, l’erreur rendue', async () => {
    const { out, runner } = setup();
    const r = await runner.publish(7, 'approve', 'x', 'u');
    expect(r).toMatchObject({ ok: false, line: 'no pull requests found' });
    expect(fs.existsSync(path.join(out, 'pr-7-review.json'))).toBe(false);
  });
});

describe('Ici : rapatrier une branche, aller dessus', () => {
  it('fetchBranch : origin/<branche> à jour, la copie de travail intacte ; switchTo : la branche suivie créée d’après origin', async () => {
    const { root, origin, work, runner } = setup();
    // feat/y, poussée d'ailleurs : inconnue du clone.
    const other = path.join(root, 'other');
    execFileSync('git', ['clone', '-q', origin, other], { env: ENV });
    git(other, 'switch', '-q', '-c', 'feat/y');
    fs.writeFileSync(path.join(other, 'y.txt'), 'y\n');
    git(other, 'add', 'y.txt');
    git(other, 'commit', '-q', '-m', 'sur y');
    git(other, 'push', '-q', 'origin', 'feat/y');
    const tip = git(other, 'rev-parse', 'HEAD');
    const f = await runner.fetchBranch('feat/y');
    expect(f).toMatchObject({ ok: true, line: 'origin/feat/y fetched.' });
    expect(git(work, 'rev-parse', 'origin/feat/y')).toBe(tip);
    expect(git(work, 'branch', '--show-current')).toBe('feat/x');
    const s = await runner.switchTo('feat/y');
    expect(s).toMatchObject({ ok: true, line: 'On feat/y.' });
    expect(s.detail).toMatch(/\$ git switch feat\/y/);
    expect(git(work, 'branch', '--show-current')).toBe('feat/y');
    expect(git(work, 'rev-parse', 'HEAD')).toBe(tip);
  });

  it('switchTo(branche, départ) : la branche créée depuis le départ', async () => {
    const { work, runner } = setup();
    const s = await runner.switchTo('feat/neuve', 'origin/main');
    expect(s).toMatchObject({ ok: true, line: 'On feat/neuve.' });
    expect(git(work, 'branch', '--show-current')).toBe('feat/neuve');
    expect(git(work, 'rev-parse', 'HEAD')).toBe(git(work, 'rev-parse', 'origin/main'));
    expect((await runner.switchTo('feat/neuve', 'origin/main')).ok).toBe(false);   // existe déjà : l'échec rendu
  });

  it('pullBranch : une branche locale sans suivi mise à jour d’après origin ; non fast-forward : l’échec rendu', async () => {
    const { root, origin, work, runner } = setup();
    const other = path.join(root, 'autre');
    execFileSync('git', ['clone', '-q', '-b', 'feat/x', origin, other], { env: ENV });
    fs.writeFileSync(path.join(other, 'c.txt'), 'trois\n');
    git(other, 'add', 'c.txt');
    git(other, 'commit', '-q', '-m', 'troisième');
    git(other, 'push', '-q', 'origin', 'feat/x');
    git(work, 'branch', '--unset-upstream');
    expect((await runner.pullBranch('feat/x')).ok).toBe(true);
    expect(git(work, 'rev-parse', 'HEAD')).toBe(git(other, 'rev-parse', 'HEAD'));
    git(work, 'reset', '-q', '--hard', 'HEAD~1');
    fs.writeFileSync(path.join(work, 'd.txt'), 'à part\n');
    git(work, 'add', 'd.txt');
    git(work, 'commit', '-q', '-m', 'divergent');
    expect((await runner.pullBranch('feat/x')).ok).toBe(false);
  });

  it('une branche absente d’origin : échec rendu, rien ne bouge', async () => {
    const { work, runner } = setup();
    expect((await runner.fetchBranch('nulle-part')).ok).toBe(false);
    expect((await runner.switchTo('nulle-part')).ok).toBe(false);
    expect(git(work, 'branch', '--show-current')).toBe('feat/x');
  });

  it('un ref pas sûr (« -f », « a..b », pas un texte) : refusé sans lancer git', async () => {
    const { out, runner } = setup();
    for (const b of ['-f', '--force', 'a..b', 'a b', '', 7]) {
      expect((await runner.fetchBranch(b)).ok).toBe(false);
      expect((await runner.switchTo(b)).ok).toBe(false);
      expect((await runner.switchTo('feat/z', b)).ok).toBe(false);
      expect((await runner.pullBranch(b)).ok).toBe(false);
    }
    expect(fs.existsSync(path.join(out, 'direct.log'))).toBe(false);
  });
});

describe('Mettre de côté', () => {
  it('stash : modifications et fichiers non suivis mis de côté, le dossier propre, la branche inchangée ; récupérables', async () => {
    const { work, runner } = setup();
    fs.writeFileSync(path.join(work, 'a.txt'), 'un, modifié\n');
    fs.writeFileSync(path.join(work, 'neuf.txt'), 'neuf\n');
    const r = await runner.stash();
    expect(r.ok).toBe(true);
    expect(r.detail).toMatch(/\$ git stash push -u/);
    expect(git(work, 'status', '--porcelain')).toBe('');
    expect(git(work, 'branch', '--show-current')).toBe('feat/x');
    expect(git(work, 'stash', 'list')).toMatch(/stash@\{0\}/);
    git(work, 'stash', 'pop', '-q');
    expect(fs.readFileSync(path.join(work, 'neuf.txt'), 'utf8')).toBe('neuf\n');
  });
});

describe('Retirer le worktree d’une PR : sa branche pr-<n>', () => {
  it('dropPrBranch : pr-<n> supprimée, même non fusionnée ; une autre branche jamais', async () => {
    const { work, runner } = setup();
    git(work, 'branch', 'pr-7');
    const r = await runner.dropPrBranch(7);
    expect(r).toMatchObject({ ok: true, line: 'pr-7 deleted.' });
    expect(git(work, 'branch', '--list', 'pr-7')).toBe('');
    expect((await runner.dropPrBranch(7)).ok).toBe(false);   // déjà partie : l'échec rendu
    for (const n of [0, -1, 1.5, '7', 'feat/x']) expect((await runner.dropPrBranch(n)).ok).toBe(false);
    expect(git(work, 'branch', '--list', 'feat/x')).not.toBe('');
  });
});

describe('Pull, Rebase, Pousser, Actualiser', () => {
  it('fetchAll puis pull : la branche suivie avancée, les modifications en cours reprises', async () => {
    const { root, origin, work, runner } = setup();
    const other = path.join(root, 'autre');
    execFileSync('git', ['clone', '-q', '-b', 'feat/x', origin, other], { env: ENV });
    fs.writeFileSync(path.join(other, 'c.txt'), 'trois\n');
    git(other, 'add', 'c.txt');
    git(other, 'commit', '-q', '-m', 'troisième');
    git(other, 'push', '-q', 'origin', 'feat/x');
    fs.writeFileSync(path.join(work, 'a.txt'), 'un, en cours\n');
    expect((await runner.fetchAll()).ok).toBe(true);
    expect(git(work, 'rev-parse', 'origin/feat/x')).toBe(git(other, 'rev-parse', 'HEAD'));
    expect((await runner.pull()).ok).toBe(true);
    expect(git(work, 'rev-parse', 'HEAD')).toBe(git(other, 'rev-parse', 'HEAD'));
    expect(git(work, 'status', '--porcelain')).toBe('M a.txt');
    expect(git(work, 'stash', 'list')).toBe('');
  });

  it('rebase sur origin/main avancée, puis push --force-with-lease : origin/feat/x réécrite ; un bail périmé : refusé', async () => {
    const { root, origin, work, runner } = setup();
    const other = path.join(root, 'autre');
    execFileSync('git', ['clone', '-q', origin, other], { env: ENV });
    fs.writeFileSync(path.join(other, 'm.txt'), 'base\n');
    git(other, 'add', 'm.txt');
    git(other, 'commit', '-q', '-m', 'la base avance');
    git(other, 'push', '-q', 'origin', 'main');
    await runner.fetchAll();
    const r = await runner.rebase('origin/main');
    expect(r).toMatchObject({ ok: true, line: 'Rebased on origin/main.' });
    expect(git(work, 'merge-base', 'HEAD', 'origin/main')).toBe(git(work, 'rev-parse', 'origin/main'));
    expect((await runner.push()).ok).toBe(true);
    expect(git(origin, 'rev-parse', 'feat/x')).toBe(git(work, 'rev-parse', 'HEAD'));
    // quelqu'un pousse sur feat/x sans qu'on l'ait rapatrié : le bail ne tient plus
    git(other, 'fetch', '-q', 'origin');
    git(other, 'switch', '-q', 'feat/x');
    git(other, 'commit', '-q', '--allow-empty', '-m', 'ailleurs');
    git(other, 'push', '-q', 'origin', 'feat/x');
    git(work, 'commit', '-q', '--amend', '--allow-empty', '-m', 'réécrit');
    expect((await runner.push()).ok).toBe(false);
    expect(git(origin, 'log', '-1', '--format=%s', 'feat/x')).toBe('ailleurs');
  });

  it('rebase : un ref pas sûr refusé sans lancer git', async () => {
    const { out, runner } = setup();
    for (const b of ['-i', '--exec=x', 'a..b', 'a b', '', 7, undefined]) expect((await runner.rebase(b)).ok).toBe(false);
    expect(fs.existsSync(path.join(out, 'direct.log'))).toBe(false);
  });
});

describe('Me demander en relecture', () => {
  const runner = (exit: number, stderr = '') => directRunner({ dir: tmp, out: tmp, prefix: [], launch: async () => ({ exit, stdout: '', stderr }) });

  it('réussi : la ligne dit qui est demandé, sur quelle PR', async () => {
    expect(await runner(0).requestReview(7, 'kb')).toMatchObject({ ok: true, line: 'Review requested from kb on #7.' });
  });

  it('gh en échec (l’auteur de la PR, pas de droit) : sa première ligne', async () => {
    expect(await runner(1, 'Review cannot be requested from pull request author.\n').requestReview(7, 'kb'))
      .toMatchObject({ ok: false, line: 'Review cannot be requested from pull request author.' });
  });
});
