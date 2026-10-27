// Variants de la recette (note 0.12.0, « La recette, sans IA ») : sur le vrai
// contrôleur, git réel sur un dépôt d'essai, de vrais processus ; faux :
// Electron (le dossier userData).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { withDefaults } from 'core/config';

const fake = vi.hoisted(() => ({ userData: '' }));
vi.mock('electron', () => ({ app: { getPath: () => fake.userData }, dialog: {} }));

const { createWorktree, prepare, recipeView, removeWorktree } = await import('app/controllers/recipe');

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' }).toString();
const agent = (id: string, dir: string, parent?: string) =>
  ({ id, dir, name: id, model: '', effort: '', mode: 'default', sessionId: null, ...(parent ? { parent: { id: parent } } : {}) });
let root = '';
let repo = '';
let n = 0;
let home: ReturnType<typeof agent>;
const project = (p: object) => {
  fs.mkdirSync(path.join(repo, '.vibecoder'), { recursive: true });
  fs.writeFileSync(path.join(repo, '.vibecoder', 'project.json'), JSON.stringify(p));
};

beforeEach(() => {
  root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-recette-v-')));
  fake.userData = root;
  repo = path.join(root, 'projet');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  git(repo, 'commit', '-q', '--allow-empty', '-m', 'init');
  home = agent(`h${n++}`, repo);
});

describe.skipIf(process.platform === 'win32')('la recette', () => {
  it('sans worktree.create : git worktree add, puis le setup dans le worktree ; le dossier rendu', async () => {
    project({ commands: [], setup: ['pwd > setup.txt'] });
    const cfg = withDefaults({ agents: [home] });

    const r = await createWorktree(home, { branch: 'feat/x', base: 'main', start: 'main' }, cfg);

    const dir = path.join(root, 'projet-worktrees', 'feat', 'x');
    expect(r).toEqual({ ok: true, line: 'worktree créé', dir });
    expect(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD').trim()).toBe('feat/x');
    expect(fs.readFileSync(path.join(dir, 'setup.txt'), 'utf8').trim()).toBe(dir);
    expect(recipeView(home, cfg)).toMatchObject({ op: 'create', running: false, last: { ok: true } });
  });

  it('le dossier déjà là : refusé, rien ne tourne', async () => {
    project({ commands: [], worktree: { create: 'touch ran.txt' } });
    fs.mkdirSync(path.join(root, 'projet-worktrees', 'x'), { recursive: true });

    const r = await createWorktree(home, { branch: 'x', base: 'main', start: 'main' }, withDefaults({ agents: [home] }));

    expect(r.ok).toBe(false);
    expect(fs.existsSync(path.join(repo, 'ran.txt'))).toBe(false);
  });

  it('une commande qui réussit sans créer de worktree : refusé, le setup ne tourne pas', async () => {
    project({ commands: [], worktree: { create: 'mkdir -p ../projet-worktrees/y' }, setup: ['touch setup.txt'] });

    const r = await createWorktree(home, { branch: 'y', base: 'main', start: 'main' }, withDefaults({ agents: [home] }));

    expect(r.ok).toBe(false);
    expect(fs.existsSync(path.join(root, 'projet-worktrees', 'y', 'setup.txt'))).toBe(false);
  });

  it('une étape en échec : arrêt, sa dernière ligne rendue et retenue, son journal dans <sorties>/recipe.log', async () => {
    project({ commands: [], setup: ['echo premier; echo "ça casse"; false', 'touch second.txt'] });
    const cfg = withDefaults({ agents: [home] });

    const r = await prepare(home, cfg);

    expect(r).toEqual({ ok: false, line: 'ça casse' });
    expect(fs.existsSync(path.join(repo, 'second.txt'))).toBe(false);
    expect(recipeView(home, cfg)).toMatchObject({ op: 'setup', running: false, last: { ok: false, line: 'ça casse' } });
    expect(fs.readFileSync(path.join(root, 'vibecoder-out', home.id, 'recipe.log'), 'utf8')).toContain('premier');
  });

  it('une à la fois par famille : la seconde, refusée pendant la première, en cours au relevé', async () => {
    const child = agent(`${home.id}-c`, path.join(root, 'ailleurs'), home.id);
    fs.mkdirSync(child.dir);
    project({ commands: [], setup: ['sleep 1'] });
    const cfg = withDefaults({ agents: [home, child] });

    const first = prepare(home, cfg);
    expect(recipeView(child, cfg)).toMatchObject({ op: 'setup', running: true });
    expect((await prepare(child, cfg)).ok).toBe(false);

    expect((await first).ok).toBe(true);
    expect((await prepare(child, cfg)).ok).toBe(true);
  });

  it('sans worktree.remove : git worktree remove ; un agent sans parent : refusé', async () => {
    const dir = path.join(root, 'projet-worktrees', 'z');
    git(repo, 'worktree', 'add', '-q', '-b', 'z', dir);
    const child = agent(`${home.id}-z`, dir, home.id);
    const cfg = withDefaults({ agents: [home, child] });

    expect((await removeWorktree(home, cfg)).ok).toBe(false);
    expect(await removeWorktree(child, cfg)).toEqual({ ok: true, line: 'worktree retiré' });
    expect(fs.existsSync(dir)).toBe(false);
  });
});
