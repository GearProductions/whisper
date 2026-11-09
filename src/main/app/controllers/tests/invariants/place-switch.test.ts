// Invariants de Décharger (unload-pr) et de la nouvelle demande ici (new-here) :
// jamais de changement de branche dans un dossier qui a des modifications.
// Protégés : si un test échoue, corriger le code.
//   Note 0.12.0 docs/tickets/refactor/0.12.0-creer-relire-meme-dossier.md,
//   « Ce que ça ne doit pas faire » : « Changer de branche dans un dossier qui
//   a des modifications » (l'invariant de la 0.12.0, pr-place.test.ts, pour
//   pr-here et base ; ici pour les deux nouveaux changements de branche) :
//   unload-pr (revenir sur la base du dépôt) et new-here (git switch -c sur la
//   branche de la demande) relisent l'état du dossier au clic ; des
//   modifications → refusé, même si le relevé affiché le disait propre.
//   Note 0.12.0 docs/tickets/feat/0.12.0-gestion-des-branches.md, même ligne :
//   aller sur une branche locale depuis la vue des branches (switch-branch)
//   est un changement de branche de plus, relu de même au clic.
//   Même note : « Changer la branche d'un worktree (enfant ou robot) : aller
//   sur une branche, charger une PR, revenir sur la base, créer une branche
//   ici. Le principal le refuse, quel que soit l'écran. »
// Sur le vrai principal (contrôleurs, réglages et fichiers sur disque, git réel
// sur un dépôt d'essai et son origin, un dépôt nu local), sur le décor commun
// (app/tests/harness : le faux d'Electron, le faux SDK dont le tour finit
// aussitôt, le profil, le socket, l'attente) ; local : le dépôt d'essai et son
// origin, et gh (un faux préfixe : git passe au vrai git, gh répond la PR 7
// ouverte). Le clic reste local : les cas du worktree lisent sa réponse.
// Chaque chemin qui change de branche garde ici son témoin « propre » et un refus ; le refus des
// modifications déjà au relevé de new-here et de switch-branch : variants/place-switch.test.ts.
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
// Les réglages : a1 sur le dépôt, en `vibe`, derrière le faux préfixe.
const configure = (vibe: object) => writeConfig(root, [
  { id: 'a1', dir: repo, name: 'projet', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder', vibe: vibe as never },
], { vibeCommandPrefix: `"${process.execPath}" "${path.join(root, 'faux-prefixe.cjs')}"` });

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  root = profile('whisper-place-switch-');
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
  out = path.join(root, 'vibecoder-out', 'a1');
});
afterEach(closeAll);

// L'action `id` dans le dernier relevé de a1.
const shown = async (id: string) => (await import('app/controllers')).lastView('a1')?.actions.find((a) => a.id === id);
// Le clic sur une action directe.
const click = async (id: string, args: object = {}) => (await import('app/controllers')).runVibeAction(id, { ...args, direct: true });

describe.skipIf(process.platform === 'win32')('Décharger (unload-pr) : jamais de changement de branche dans un dossier qui a des modifications', () => {
  beforeEach(() => {
    // a1 en Relire, la PR 7 chargée (sa fiche dans les sorties), le dossier sur sa branche.
    write(path.join(out, 'pr-7.json'), JSON.stringify({ number: 7, title: 'Essai', url: 'u', author: 'bob', base: 'main', head: 'feat/x', body: '', state: 'OPEN' }));
    configure({ flow: 'review', autonomy: 'guide', pr: 7 });
    git(repo, 'switch', '-q', 'feat/x');
  });

  it('propre : unload-pr revient sur la base du dépôt (le clic agit bien)', async () => {
    await openPanel('a1');

    await click('unload-pr');
    await until(() => branch() === 'main');

    // sur la base du dépôt
    expect(branch()).toBe('main');
  }, 20000);

  it('un fichier modifié après le relevé : refusé, la branche et la modification restent', async () => {
    await openPanel('a1');
    // le relevé propose unload-pr, actif : le dossier y était propre
    expect(await shown('unload-pr')).toMatchObject({ disabled: null });
    write(path.join(repo, 'a.txt'), 'modifié\n');

    await click('unload-pr');
    await settle(2000);

    // toujours sur la branche de la PR
    expect(branch()).toBe('feat/x');
    // la modification est toujours là
    expect(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8')).toBe('modifié\n');
  }, 20000);

  it('des modifications déjà au relevé : refusé, la branche et la modification restent', async () => {
    write(path.join(repo, 'a.txt'), 'modifié\n');
    await openPanel('a1');
    // le relevé montre bien unload-pr (grisé)
    expect(await shown('unload-pr')).toBeDefined();

    await click('unload-pr');
    await settle(2000);

    // toujours sur la branche de la PR
    expect(branch()).toBe('feat/x');
    // la modification est toujours là
    expect(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8')).toBe('modifié\n');
  }, 20000);
});

describe.skipIf(process.platform === 'win32')('Nouvelle demande ici (new-here) : jamais de changement de branche dans un dossier qui a des modifications', () => {
  beforeEach(() => {
    // a1 en Créer, sur main.
    configure({ flow: 'create', autonomy: 'guide' });
  });
  // Une nouvelle demande retenue : le texte envoyé, la fiche du skill
  // nouvelle-demande écrite, puis le relevé qui la lit, jusqu'à ce qu'il propose new-here.
  async function requestPending() {
    await openPanel('a1');
    const { refreshVibe } = await import('app/controllers');
    await press('new-request', { text: 'ajouter un bouton' });
    await settle(300);
    write(path.join(out, 'new-request.json'), JSON.stringify({ branch: 'feat/0.13.0-bouton' }));
    await refreshVibe({ now: true });
    for (const end = Date.now() + 5000; !await shown('new-here') && Date.now() < end;) await settle(100);
  }

  it('propre : new-here passe sur la branche de la demande (le clic agit bien)', async () => {
    await requestPending();

    await click('new-here');
    await until(() => branch() === 'feat/0.13.0-bouton');

    // sur la branche de la demande
    expect(branch()).toBe('feat/0.13.0-bouton');
  }, 20000);

  it('un fichier modifié après le relevé : refusé, la branche et la modification restent', async () => {
    await requestPending();
    // le relevé propose new-here, actif : le dossier y était propre
    expect(await shown('new-here')).toMatchObject({ disabled: null });
    write(path.join(repo, 'a.txt'), 'modifié\n');

    await click('new-here');
    await settle(2000);

    // toujours sur main
    expect(branch()).toBe('main');
    // la modification est toujours là
    expect(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8')).toBe('modifié\n');
  }, 20000);
});

describe.skipIf(process.platform === 'win32')('Aller sur une branche (switch-branch) : jamais de changement de branche dans un dossier qui a des modifications', () => {
  beforeEach(() => {
    // a1 en Créer, sur main ; feat/x, une branche locale.
    configure({ flow: 'create', autonomy: 'guide' });
    git(repo, 'branch', '-q', 'feat/x', 'origin/feat/x');
  });

  it('propre : switch-branch passe sur la branche choisie (le clic agit bien)', async () => {
    await openPanel('a1');

    await click('switch-branch', { branch: 'feat/x' });
    await until(() => branch() === 'feat/x');

    // sur la branche choisie
    expect(branch()).toBe('feat/x');
  }, 20000);

  it('un fichier modifié après le relevé : refusé, la branche et la modification restent', async () => {
    await openPanel('a1');
    // le relevé propose switch-branch, actif : le dossier y était propre
    expect(await shown('switch-branch')).toMatchObject({ disabled: null });
    write(path.join(repo, 'a.txt'), 'modifié\n');

    await click('switch-branch', { branch: 'feat/x' });
    await settle(2000);

    // toujours sur main
    expect(branch()).toBe('main');
    // la modification est toujours là
    expect(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8')).toBe('modifié\n');
  }, 20000);
});

describe.skipIf(process.platform === 'win32')('Un worktree (enfant ou robot) ne change jamais de branche', () => {
  // Note 0.12.0 docs/tickets/feat/0.12.0-gestion-des-branches.md, « Ce que ça ne doit pas faire » :
  // « Changer la branche d'un worktree (enfant ou robot) : aller sur une branche, charger une PR, revenir
  // sur la base, créer une branche ici. Le principal le refuse, quel que soit l'écran. »
  // a0 : le dépôt ; a1 : son enfant, dans un vrai worktree (git worktree add).
  let wt = '';
  const asChild = (vibe: object, pr?: number) => writeConfig(root, [
    { id: 'a0', dir: repo, name: 'projet', model: 'opus', effort: 'high', mode: 'default', sessionId: null },
    { id: 'a1', dir: wt, name: pr ? `PR #${pr}` : 'enfant', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder', vibe: vibe as never,
      parent: pr ? { id: 'a0', pr } : { id: 'a0' } },
  ], { vibeCommandPrefix: `"${process.execPath}" "${path.join(root, 'faux-prefixe.cjs')}"` });
  const wtBranch = () => git(wt, 'rev-parse', '--abbrev-ref', 'HEAD');
  const heads = () => git(repo, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/');
  // Le relevé connaît les branches locales (lues en fond) : un refus vient du worktree, pas d'une branche inconnue.
  const branchesRead = async () => {
    const { lastView } = await import('app/controllers');
    await until(() => (lastView('a1')?.branches?.length ?? 0) > 1);
    expect(lastView('a1')?.branches?.length).toBeGreaterThan(1);
  };
  // Un clic, puis plus aucune action directe en cours : le refus du suivant n'est pas « une autre en cours ».
  const clickDone = async (id: string, args: object = {}) => {
    const r = await click(id, args);
    const { lastView } = await import('app/controllers');
    await settle(300);
    await until(() => !lastView('a1')?.actions.some((a) => a.direct?.running));
    return r;
  };
  beforeEach(() => {
    wt = path.join(root, 'worktree');
    git(repo, 'branch', '-q', 'feat/x', 'origin/feat/x');
  });

  it('l’enfant d’une demande : aller sur une branche, créer une branche ici ou dans un worktree, charger une PR, revenir sur la base → refusés, rien ne bouge', async () => {
    git(repo, 'worktree', 'add', '-q', '-b', 'feat/enfant', wt, 'main');
    asChild({ flow: 'create', autonomy: 'guide' });
    await openPanel('a1');
    await branchesRead();
    const before = heads();

    const answers = [
      await clickDone('switch-branch', { branch: 'feat/x' }),
      await clickDone('new-here', { branch: 'feat/nouvelle' }),
      await clickDone('new-worktree', { branch: 'feat/autre' }),
      await clickDone('load-pr', { pr: 7 }),
      await clickDone('unload-pr'),
    ];
    await settle(2000);

    // chaque clic refusé
    expect(answers.map((a) => a.ok)).toEqual([false, false, false, false, false]);
    // toujours sur sa branche, aucune branche créée
    expect(wtBranch()).toBe('feat/enfant');
    expect(heads()).toBe(before);
  }, 20000);

  it('le robot d’une PR : aller sur une branche, charger une autre PR, la PR ici, revenir sur la base → refusés, rien ne bouge', async () => {
    git(repo, 'worktree', 'add', '-q', '-b', 'pr-7', wt, 'origin/feat/x');
    // le worktree de la PR, chez le parent (sans lui, le robot est retiré) ; la fiche de la PR, chez le robot
    write(path.join(root, 'vibecoder-out', 'a0', 'pr-7-worktree.json'), JSON.stringify({ dir: wt, branch: 'pr-7' }));
    write(path.join(root, 'vibecoder-out', 'a1', 'pr-7.json'), JSON.stringify({ number: 7, title: 'Essai', url: 'u', author: 'bob', base: 'main', head: 'feat/x', body: '', state: 'OPEN' }));
    asChild({ flow: 'review', autonomy: 'guide', pr: 7 }, 7);
    await openPanel('a1');
    await branchesRead();
    const before = heads();

    const answers = [
      await clickDone('switch-branch', { branch: 'feat/x' }),
      await clickDone('load-pr', { pr: 8 }),
      await clickDone('pr-here'),
      await clickDone('unload-pr'),
    ];
    await settle(2000);

    // chaque clic refusé
    expect(answers.map((a) => a.ok)).toEqual([false, false, false, false]);
    // toujours sur la branche du robot, aucune branche créée
    expect(wtBranch()).toBe('pr-7');
    expect(heads()).toBe(before);
  }, 20000);
});
