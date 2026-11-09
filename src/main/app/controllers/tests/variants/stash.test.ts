// Variants de « Mettre de côté » (stash) : rien n'est mis de côté sans le clic sur stash, pour les
// chemins autres que les principaux (nouveau worktree, Décharger, nouvelle demande, nouveau
// worktree avec un nom de branche), et le clic sur stash après Décharger et avec une nouvelle
// demande en attente ; déplacés de invariants/stash.test.ts, qui garde le relevé, les principaux
// chemins, Pull, Rebase et le clic sur stash.
// Sur le vrai principal et le décor commun, comme stash.test.ts (le dépôt d'essai et gh restent locaux).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  click as press, closeAll, fakeClaude, fakeElectron, git as rawGit, openPanel, profile, remote, repoResources, settle, write,
  writeConfig,
} from 'app/tests/harness';

const electron = fakeElectron();
const claude = fakeClaude({ finish: true });
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

// git rend ici sa sortie rognée.
const git = (cwd: string, ...args: string[]) => rawGit(cwd, ...args).trim();
const until = async (ok: () => boolean, ms = 10000) => {
  for (const end = Date.now() + ms; !ok() && Date.now() < end;) await settle(50);
  return ok();
};
let root = '';
let repo = '';
let out = '';

const branch = () => git(repo, 'rev-parse', '--abbrev-ref', 'HEAD');
const stashes = () => git(repo, 'stash', 'list').split('\n').filter(Boolean);
const worktrees = () => git(repo, 'worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree ')).length;
const agents = async () => (await import('app/settings')).loadConfig().agents;
// Le dossier modifié : un fichier suivi changé, un fichier non suivi ajouté.
const makeDirty = () => { write(path.join(repo, 'a.txt'), 'modifié\n'); write(path.join(repo, 'c.txt'), 'non suivi\n'); };
const tracked = () => fs.readFileSync(path.join(repo, 'a.txt'), 'utf8');
const untracked = () => fs.existsSync(path.join(repo, 'c.txt'));
// Les réglages : a1 sur le dépôt, en `vibe`, derrière le faux préfixe.
const configure = (vibe: object) => writeConfig(root, [
  { id: 'a1', dir: repo, name: 'projet', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder', vibe: vibe as never },
], { vibeCommandPrefix: `"${process.execPath}" "${path.join(root, 'faux-prefixe.cjs')}"` });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  root = profile('whisper-stash-');
  // Le dépôt sur main, la branche de la PR (feat/x) poussée dans origin (un dépôt nu), puis supprimée ici.
  repo = path.join(root, 'projet');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  write(path.join(repo, 'a.txt'), 'a\n');
  git(repo, 'add', 'a.txt');
  git(repo, 'commit', '-q', '-m', 'init');
  git(repo, 'switch', '-q', '-c', 'feat/x');
  write(path.join(repo, 'b.txt'), 'b\n');
  git(repo, 'add', 'b.txt');
  git(repo, 'commit', '-q', '-m', 'la PR');
  remote(repo);
  git(repo, 'switch', '-q', 'main');
  git(repo, 'branch', '-q', '-D', 'feat/x');
  // Le faux préfixe : git passe au vrai git ; gh répond la PR 7 ouverte (pr list : aucune).
  write(path.join(root, 'faux-prefixe.cjs'), `if (process.argv[2] !== 'gh') {
  const r = require('child_process').spawnSync(process.argv[2], process.argv.slice(3), { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
process.stdout.write(process.argv.includes('list') ? '[]' : ${JSON.stringify(JSON.stringify({ number: 7, title: 'Essai', url: 'u', author: { login: 'bob' }, baseRefName: 'main', headRefName: 'feat/x', body: '', state: 'OPEN' }))});\n`);
  // La PR 7 chargée (load-pr) : sa fiche dans les sorties.
  out = path.join(root, 'vibecoder-out', 'a1');
  write(path.join(out, 'pr-7.json'), JSON.stringify({ number: 7, title: 'Essai', url: 'u', author: 'bob', base: 'main', head: 'feat/x', body: '', state: 'OPEN' }));
  configure({ flow: 'review', autonomy: 'guide', pr: 7 });
});
afterEach(closeAll);

// Un relevé de plus, puis le temps qu'une suite éventuelle agisse.
async function surveyAgain() {
  const { refreshVibe } = await import('app/controllers');
  await refreshVibe({ now: true });
  await settle(1500);
}
// L'action `id` dans le dernier relevé de a1.
const shown = async (id: string) => (await import('app/controllers')).lastView('a1')?.actions.find((a) => a.id === id);
// Le clic sur une action directe.
const click = (id: string, args: object = {}) => press(id, { ...args, direct: true });

// Une nouvelle demande retenue (Créer) : le texte envoyé, la fiche du skill
// nouvelle-demande écrite, puis le relevé qui la lit.
async function requestPending() {
  configure({ flow: 'create', autonomy: 'guide' });
  await openPanel('a1');
  const { refreshVibe } = await import('app/controllers');
  await press('new-request', { text: 'ajouter un bouton' });
  await settle(300);
  write(path.join(out, 'new-request.json'), JSON.stringify({ branch: 'feat/0.13.0-bouton' }));
  await refreshVibe({ now: true });
  for (const end = Date.now() + 5000; !await shown('new-here') && Date.now() < end;) await settle(100);
}

describe.skipIf(process.platform === 'win32')('jamais de mise de côté sans un clic sur stash', () => {
  it('Dans un nouveau worktree : pr-worktree sur le dossier modifié crée le worktree, rien n’est mis de côté', async () => {
    makeDirty();
    await openPanel('a1');

    await click('pr-worktree');
    await until(() => worktrees() > 1);
    await surveyAgain();

    // le worktree de la PR est bien créé (le clic a agi)
    expect(worktrees()).toBeGreaterThan(1);
    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('Décharger : unload-pr sur le dossier modifié, rien n’est mis de côté', async () => {
    git(repo, 'switch', '-q', 'feat/x');
    makeDirty();
    await openPanel('a1');

    await click('unload-pr');
    await surveyAgain();

    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('Décharger : « Rester sur la branche » ne suit plus la PR, rien n’est mis de côté', async () => {
    git(repo, 'switch', '-q', 'feat/x');
    makeDirty();
    await openPanel('a1');
    const { setVibe } = await import('app/controllers');

    setVibe({ pr: null });
    await surveyAgain();

    // la PR n'est plus suivie (le Décharger a eu lieu)
    expect((await agents())[0].vibe?.pr ?? null).toBeNull();
    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('à la suite d’une nouvelle demande : la demande retenue et relevée sur le dossier modifié, rien n’est mis de côté', async () => {
    makeDirty();

    await requestPending();
    await surveyAgain();

    // la demande attend son choix (le relevé la montre)
    expect((await import('app/controllers')).lastView('a1')?.request).toMatchObject({ branch: 'feat/0.13.0-bouton' });
    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('nouvelle demande : new-here sur le dossier modifié, rien n’est mis de côté', async () => {
    makeDirty();
    await requestPending();

    await click('new-here');
    await surveyAgain();

    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('nouvelle demande : new-worktree sur le dossier modifié crée le worktree, rien n’est mis de côté', async () => {
    makeDirty();
    await requestPending();

    await click('new-worktree');
    await until(() => worktrees() > 1);
    await surveyAgain();

    // le worktree de la demande est bien créé (le clic a agi)
    expect(worktrees()).toBeGreaterThan(1);
    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 30000);
});

describe.skipIf(process.platform === 'win32')('Pull, Rebase, aller sur une branche : rien ne reste de côté', () => {
  it('Créer une branche dans un worktree : new-worktree { branch } sur le dossier modifié crée le worktree, rien n’est mis de côté', async () => {
    configure({ flow: 'create', autonomy: 'guide' });
    makeDirty();
    await openPanel('a1');

    await click('new-worktree', { branch: 'feat/y' });
    await until(() => worktrees() > 1);
    await surveyAgain();

    // le worktree de la branche est bien créé (le clic a agi)
    expect(worktrees()).toBeGreaterThan(1);
    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 30000);
});

describe.skipIf(process.platform === 'win32')('le clic sur stash : tout de côté, et rien d’autre ne suit', () => {
  it('Décharger, sur la branche de la PR, le dossier modifié : stash met tout de côté et le dossier reste sur la branche de la PR', async () => {
    git(repo, 'switch', '-q', 'feat/x');
    makeDirty();
    await openPanel('a1');
    // le relevé propose stash : le dossier a des modifications
    expect(await shown('stash')).toBeDefined();

    await click('stash');
    await until(() => stashes().length > 0);
    await surveyAgain();

    // une seule entrée de stash
    expect(stashes()).toHaveLength(1);
    // aucun changement de branche ne suit : toujours sur la branche de la PR
    expect(branch()).toBe('feat/x');
  }, 20000);

  it('une nouvelle demande en attente, le dossier modifié : stash met tout de côté et le dossier reste sur main', async () => {
    makeDirty();
    await requestPending();
    // le relevé propose stash : le dossier a des modifications
    expect(await shown('stash')).toBeDefined();

    await click('stash');
    await until(() => stashes().length > 0);
    await surveyAgain();

    // une seule entrée de stash
    expect(stashes()).toHaveLength(1);
    // aucun changement de branche ne suit : pas de passage sur la branche de la demande
    expect(branch()).toBe('main');
  }, 20000);
});
