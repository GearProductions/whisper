// Invariant de « Mettre de côté » (stash). Protégé : si un test échoue,
// corriger le code.
//   Note 0.12.0 docs/tickets/refactor/0.12.0-creer-relire-meme-dossier.md,
//   « Ce que ça ne doit pas faire » : « Mettre des modifications de côté sans
//   que l'utilisateur l'ait choisi au clic : jamais à la suite d'un chargement
//   ou d'un changement de branche » (SPEC F-114, I-39). Le dossier modifié
//   (un fichier suivi et un non suivi), rien n'est mis de côté au relevé, ni
//   après un chargement (load-pr), un Décharger (unload-pr, « Rester sur la
//   branche »), une nouvelle demande (new-request, new-here), un changement
//   de branche (pr-here) ou un nouveau worktree (pr-worktree, new-worktree) ; seul le clic sur stash met de côté, tout (git stash
//   push -u : les non suivis compris), et rien d'autre ne suit (le dossier
//   reste sur sa branche). La forme exacte de la commande : direct.test.ts.
//   Note 0.12.0 docs/tickets/feat/0.12.0-gestion-des-branches.md, « Ce que ça
//   ne doit pas faire » : « Mettre des modifications de côté sans que
//   l'utilisateur l'ait choisi au clic (Pull et Rebase : --autostash,
//   seulement à leur clic, repris après) » : aller sur une branche
//   (switch-branch) ou créer une branche dans un worktree (new-worktree avec
//   son nom, sans demande) ne met rien de côté ; Pull et Rebase, au clic, sur le
//   dossier modifié, font leur travail et rendent les modifications (suivies
//   et non suivies), sans laisser d'entrée de stash. Le rebase en conflit :
//   technicals/direct, rebase.test.ts. Et « Pousser sans un clic sur
//   Pousser » : un Rebase réussi ne pousse rien (la branche distante reste
//   où elle était) ; la forme de git push : direct.test.ts.
// Sur le vrai principal (contrôleurs, réglages et fichiers sur disque, git réel
// sur un dépôt d'essai et son origin, un dépôt nu local), sur le décor commun
// (app/tests/harness : le faux d'Electron, le faux SDK dont le tour finit
// aussitôt, le profil, le socket, l'attente) ; local : le dépôt d'essai et son
// origin, et gh (un faux préfixe : git passe au vrai git, gh répond la PR 7
// ouverte). Restent ici le relevé, les principaux chemins (load-pr, pr-here,
// switch-branch), Pull, Rebase et le clic sur stash ; les autres chemins :
// variants/stash.test.ts.
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

describe.skipIf(process.platform === 'win32')('jamais de mise de côté sans un clic sur stash', () => {
  it('au relevé : le dossier modifié, relevé deux fois, rien n’est mis de côté', async () => {
    makeDirty();

    await openPanel('a1');
    await surveyAgain();

    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('à la suite d’un chargement : load-pr sur le dossier modifié charge la PR, rien n’est mis de côté', async () => {
    fs.rmSync(path.join(out, 'pr-7.json'));
    configure({ flow: 'review', autonomy: 'guide' });
    makeDirty();
    await openPanel('a1');

    await click('load-pr', { pr: 7 });
    await until(() => fs.existsSync(path.join(out, 'pr-7.json')));
    await surveyAgain();

    // la PR est bien chargée (sa fiche est écrite)
    expect(fs.existsSync(path.join(out, 'pr-7.json'))).toBe(true);
    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('à la suite d’un changement de branche : pr-here sur le dossier modifié, rien n’est mis de côté', async () => {
    makeDirty();
    await openPanel('a1');

    await click('pr-here');
    await surveyAgain();

    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);
});

describe.skipIf(process.platform === 'win32')('Pull, Rebase, aller sur une branche : rien ne reste de côté', () => {
  // Le dépôt sur feat/x, qui suit origin/feat/x.
  const onFeature = () => git(repo, 'switch', '-q', 'feat/x');
  // Le dépôt nu d'origin.
  const origin = () => `${repo}-origin.git`;
  const head = (ref = 'HEAD') => git(repo, 'rev-parse', ref);
  const contains = (ancestor: string) => {
    try { git(repo, 'merge-base', '--is-ancestor', ancestor, 'HEAD'); return true; } catch { return false; }
  };

  it('aller sur une branche : switch-branch sur le dossier modifié, rien n’est mis de côté', async () => {
    git(repo, 'branch', '-q', 'feat/x', 'origin/feat/x');
    makeDirty();
    await openPanel('a1');

    await click('switch-branch', { branch: 'feat/x' });
    await surveyAgain();

    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('Pull : la branche en retard, le dossier modifié : la branche avance, les modifications reviennent, aucune entrée de stash', async () => {
    onFeature();
    // origin/feat/x a un commit de plus ; la branche locale, en retard d'un commit
    write(path.join(repo, 'd.txt'), 'suite\n');
    git(repo, 'add', 'd.txt');
    git(repo, 'commit', '-q', '-m', 'la suite');
    git(repo, 'push', '-q', 'origin', 'feat/x');
    git(repo, 'reset', '-q', '--hard', 'HEAD~1');
    makeDirty();
    await openPanel('a1');

    await click('pull');
    await until(() => head() === head('origin/feat/x'));
    await surveyAgain();

    // la branche a rejoint origin/feat/x (le clic a agi)
    expect(head()).toBe(head('origin/feat/x'));
    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi a retrouvé sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('Rebase : la branche principale a avancé, le dossier modifié : la branche est rebasée, les modifications reviennent, aucune entrée de stash', async () => {
    // origin/main a un commit de plus que la base de feat/x
    write(path.join(repo, 'e.txt'), 'la base avance\n');
    git(repo, 'add', 'e.txt');
    git(repo, 'commit', '-q', '-m', 'la base avance');
    git(repo, 'push', '-q', 'origin', 'main');
    onFeature();
    const pushed = git(origin(), 'rev-parse', 'feat/x');
    makeDirty();
    await openPanel('a1');

    await click('rebase');
    await until(() => contains(head('origin/main')));
    await surveyAgain();

    // la branche part maintenant de origin/main (le clic a agi)
    expect(contains(head('origin/main'))).toBe(true);
    // rien n'a été poussé sans un clic sur Pousser : la branche distante n'a pas bougé
    expect(git(origin(), 'rev-parse', 'feat/x')).toBe(pushed);
    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi a retrouvé sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);
});

describe.skipIf(process.platform === 'win32')('le clic sur stash : tout de côté, et rien d’autre ne suit', () => {
  it('la PR chargée, le dossier modifié : stash met tout de côté, non suivis compris, et le dossier reste sur sa branche', async () => {
    makeDirty();
    await openPanel('a1');
    // le relevé propose stash : le dossier a des modifications
    expect(await shown('stash')).toBeDefined();

    await click('stash');
    await until(() => stashes().length > 0);
    await surveyAgain();

    // une seule entrée de stash
    expect(stashes()).toHaveLength(1);
    // le dossier est propre, fichier non suivi compris (git stash push -u)
    expect(git(repo, 'status', '--porcelain')).toBe('');
    // aucun changement de branche ne suit : toujours sur main
    expect(branch()).toBe('main');
  }, 20000);
});
