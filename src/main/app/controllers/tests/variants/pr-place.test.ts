// Variants de Ici (pr-here) : le refus après une modification indexée et avec des modifications
// déjà au relevé, déplacé de invariants/pr-place.test.ts, qui garde le témoin « propre » et un refus.
// Sur le vrai principal et le décor commun, comme pr-place.test.ts (le dépôt d'essai reste local).
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

const branch = () => git(repo, 'rev-parse', '--abbrev-ref', 'HEAD');

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  root = profile('whisper-pr-place-');
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
  it('une modification indexée après le relevé : refusé, la branche et la modification restent', async () => {
    await openPanel('a1');
    // le relevé propose Ici, actif : le dossier y était propre
    expect(await shown('pr-here')).toMatchObject({ disabled: null });
    write(path.join(repo, 'a.txt'), 'indexé\n');
    git(repo, 'add', 'a.txt');

    await click('pr-here');
    await settle(2000);

    // toujours sur main
    expect(branch()).toBe('main');
    // la modification est toujours indexée
    expect(git(repo, 'diff', '--cached', '--name-only')).toBe('a.txt');
  }, 20000);

  it('des modifications déjà au relevé : refusé, la branche et la modification restent', async () => {
    write(path.join(repo, 'a.txt'), 'modifié\n');
    await openPanel('a1');
    // le relevé montre bien Ici (grisé)
    expect(await shown('pr-here')).toBeDefined();

    await click('pr-here');
    await settle(2000);

    // toujours sur main
    expect(branch()).toBe('main');
    // la modification est toujours là
    expect(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8')).toBe('modifié\n');
  }, 20000);
});
