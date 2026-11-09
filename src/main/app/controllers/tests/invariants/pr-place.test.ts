// Invariants de Relire, Ici ou Dans un worktree. Protégés : si un test échoue,
// corriger le code.
//   Note 0.12.0 docs/tickets/feat/0.12.0-worktrees.md, « Ce que ça ne doit pas
//   faire » :
//   - « Changer de branche dans un dossier qui a des modifications » : *Ici*
//     (pr-here) relit l'état du dossier au clic ; des modifications → refusé,
//     même si le relevé affiché le disait propre ; de même *PR mergée →
//     revenir sur la base* (base, git switch aussi) ;
//   - « Créer un robot de PR sans la question de confiance, toujours posée (ses
//     réglages .claude sont ceux de la PR) » (réécriture d'I-41 : le worktree
//     de la PR est créé par l'appli, plus par le skill worktree-pr ; les cas
//     de la fiche et d'*Ouvrir un agent ici* restent dans worktree.test.ts).
// Sur le vrai principal (contrôleurs, réglages et fichiers sur disque, git réel
// sur un dépôt d'essai et son origin, un dépôt nu local), sur le décor commun
// (app/tests/harness : le faux d'Electron, dont la boîte de dialogue relève ses
// questions, laisse un cas agir pendant qu'elle est ouverte et répond ce que le
// cas règle ; le faux SDK dont le tour finit aussitôt, le profil, le socket,
// l'attente) ; local : le dépôt d'essai et son origin, et, pour *base*, gh (un
// faux préfixe : git passe au vrai git, gh répond une PR fusionnée).
// Chaque chemin garde ici son témoin « propre » et un refus ; les refus de Ici
// après une modification indexée et avec des modifications déjà au relevé :
// variants/pr-place.test.ts.
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

// La boîte de dialogue : ses questions relevées, la réponse du cas (Confirmer par défaut), ce qui se passe pendant qu'elle est ouverte.
const fake = {
  answer: 1, whileAsked: () => {},
  get asked() { return electron.dialog.asked as { title: string; detail: string }[]; },
};
// git rend ici sa sortie rognée.
const git = (cwd: string, ...args: string[]) => rawGit(cwd, ...args).trim();
const until = async (ok: () => boolean, ms = 10000) => {
  for (const end = Date.now() + ms; !ok() && Date.now() < end;) await settle(50);
  return ok();
};
let root = '';
let repo = '';
let prDir = '';

const branch = () => git(repo, 'rev-parse', '--abbrev-ref', 'HEAD');
const savedAgents = () => JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8')).agents as { dir: string }[];
const agents = async () => (await import('app/settings')).loadConfig().agents;

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  root = profile('whisper-pr-place-');
  fake.answer = 1;
  fake.whileAsked = () => {};
  electron.dialog.answer = () => { fake.whileAsked(); return fake.answer; };
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
  // La PR 7 chargée (load-pr) : sa fiche dans les sorties, sa référence.
  git(repo, 'update-ref', 'refs/vibecoder/pr/7', 'origin/feat/x');
  write(path.join(root, 'vibecoder-out', 'a1', 'pr-7.json'), JSON.stringify({ number: 7, title: 'Essai', url: 'u', author: 'bob', base: 'main', head: 'feat/x', body: '', state: 'OPEN' }));
  prDir = path.join(root, 'projet-worktrees', 'pr-7');
  writeConfig(root, [
    { id: 'a1', dir: repo, name: 'projet', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'review', autonomy: 'guide', pr: 7 } },
  ]);
});
afterEach(closeAll);

// L'action `id` dans le dernier relevé de a1.
const shown = async (id: string) => (await import('app/controllers')).lastView('a1')?.actions.find((a) => a.id === id);
// Le clic sur une action directe de l'étape PR.
const click = (id: string) => press(id, { direct: true });

describe.skipIf(process.platform === 'win32')('Ici : jamais de changement de branche dans un dossier qui a des modifications', () => {
  it('propre : Ici passe sur la branche de la PR (le clic agit bien)', async () => {
    await openPanel('a1');

    await click('pr-here');
    await until(() => branch() === 'feat/x');

    // sur la branche de la PR
    expect(branch()).toBe('feat/x');
  }, 20000);

  it('un fichier modifié après le relevé : refusé, la branche et la modification restent', async () => {
    await openPanel('a1');
    // le relevé propose Ici, actif : le dossier y était propre
    expect(await shown('pr-here')).toMatchObject({ disabled: null });
    write(path.join(repo, 'a.txt'), 'modifié\n');

    await click('pr-here');
    await settle(2000);

    // toujours sur main
    expect(branch()).toBe('main');
    // la modification est toujours là
    expect(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8')).toBe('modifié\n');
  }, 20000);
});

describe.skipIf(process.platform === 'win32')('PR mergée → revenir sur la base : jamais de changement de branche dans un dossier qui a des modifications', () => {
  beforeEach(() => {
    // a1 en Créer, sur feat/x, dont la PR est fusionnée ; le préfixe : git passe
    // au vrai git, gh répond la PR (pr list : aucune).
    git(repo, 'switch', '-q', 'feat/x');
    const prefix = path.join(root, 'faux-prefixe.cjs');
    write(prefix, `if (process.argv[2] !== 'gh') {
  const r = require('child_process').spawnSync(process.argv[2], process.argv.slice(3), { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
process.stdout.write(process.argv.includes('list') ? '[]' : ${JSON.stringify(JSON.stringify({ number: 7, title: 'Essai', url: 'u', state: 'MERGED', baseRefName: 'main', headRefName: 'feat/x' }))});\n`);
    writeConfig(root, [
      { id: 'a1', dir: repo, name: 'projet', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
        vibe: { flow: 'create', autonomy: 'guide' } as never },
    ], { vibeCommandPrefix: `"${process.execPath}" "${prefix}"` });
  });
  // Le panneau ouvert, jusqu'à ce que le relevé propose base (la PR lue par gh, en fond).
  async function openOnMerged() {
    await openPanel('a1');
    for (const end = Date.now() + 10000; !await shown('base') && Date.now() < end;) await settle(100);
  }

  it('propre : base passe sur la base (le clic agit bien)', async () => {
    await openOnMerged();

    await click('base');
    await until(() => branch() === 'main');

    // sur la base
    expect(branch()).toBe('main');
  }, 20000);

  it('un fichier modifié après le relevé : refusé, la branche et la modification restent', async () => {
    await openOnMerged();
    // le relevé propose base, actif : le dossier y était propre
    expect(await shown('base')).toMatchObject({ disabled: null });
    write(path.join(repo, 'a.txt'), 'modifié\n');

    await click('base');
    await settle(2000);

    // toujours sur la branche de la PR
    expect(branch()).toBe('feat/x');
    // la modification est toujours là
    expect(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8')).toBe('modifié\n');
  }, 20000);
});

describe.skipIf(process.platform === 'win32')('Dans un worktree : jamais de robot de PR sans la question de confiance', () => {
  it('Annuler : la question posée sur le worktree créé, en disant que les réglages de la PR se chargeront ; aucun robot', async () => {
    fake.answer = 0;
    await openPanel('a1');

    await click('pr-worktree');
    await until(() => fake.asked.length > 0);
    await settle(300);

    // la question a été posée une fois…
    expect(fake.asked).toHaveLength(1);
    // … sur le worktree de la PR…
    expect(fake.asked[0].detail).toContain(prDir);
    // … en disant que les réglages de la PR se chargeront
    expect(fake.asked[0].detail).toMatch(/PR #7.*\.claude|\.claude.*PR #7/s);
    // refusée : aucun agent de plus
    expect(await agents()).toHaveLength(1);
  }, 30000);

  it('confiance accordée : le robot « PR #7 » naît après la question, sur le worktree, enfant de l’agent du dépôt', async () => {
    let atQuestion = -1;
    fake.whileAsked = () => { atQuestion = savedAgents().length; };
    await openPanel('a1');

    await click('pr-worktree');
    await until(() => savedAgents().length > 1);

    // la question a été posée une fois
    expect(fake.asked).toHaveLength(1);
    // pendant la question, aucun robot encore
    expect(atQuestion).toBe(1);
    // le robot, ensuite : sur le worktree, enfant de a1 pour la PR 7
    expect((await agents())[1]).toMatchObject({ dir: prDir, parent: { id: 'a1', pr: 7 } });
  }, 30000);

  it('le worktree prêt (prWorktreeReady), Annuler : la question posée, aucun robot', async () => {
    fake.answer = 0;
    git(repo, 'worktree', 'add', '-q', '-b', 'pr-7', prDir, 'refs/vibecoder/pr/7');
    const { prWorktreeReady } = await import('app/controllers');
    const parent = (await agents()).find((a) => a.id === 'a1')!;

    await prWorktreeReady(parent, 7, prDir, 'pr-7');
    await until(() => fake.asked.length > 0, 3000);

    // la question a été posée une fois, sur ce worktree
    expect(fake.asked.map((q) => q.detail.includes(prDir))).toEqual([true]);
    // refusée : aucun agent de plus
    expect(await agents()).toHaveLength(1);
  }, 20000);
});
