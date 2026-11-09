// Variants de Décharger, de la nouvelle demande ici et d'Aller sur une branche : le refus des
// modifications déjà au relevé (new-here, switch-branch), déplacé de
// invariants/place-switch.test.ts, qui garde pour chaque chemin son témoin « propre » et un refus.
// Sur le vrai principal et le décor commun, comme place-switch.test.ts (le dépôt d'essai et gh restent locaux).
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

  it('des modifications déjà au relevé : refusé, la branche et la modification restent', async () => {
    write(path.join(repo, 'a.txt'), 'modifié\n');
    await requestPending();
    // le relevé montre bien new-here (grisé)
    expect(await shown('new-here')).toBeDefined();

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

  it('des modifications déjà au relevé : refusé, la branche et la modification restent', async () => {
    write(path.join(repo, 'a.txt'), 'modifié\n');
    await openPanel('a1');
    // le relevé montre bien switch-branch (grisé)
    expect(await shown('switch-branch')).toBeDefined();

    await click('switch-branch', { branch: 'feat/x' });
    await settle(2000);

    // toujours sur main
    expect(branch()).toBe('main');
    // la modification est toujours là
    expect(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8')).toBe('modifié\n');
  }, 20000);
});
