// Variants de la recette et du fichier du projet dans .vibecoder/ (note 0.12.0,
// « La recette, sans IA », « Le fichier du projet, dans .vibecoder/ »).
import { describe, expect, it } from 'vitest';
import { createSteps, parseProject, projectPath, recipeEnv, removeSteps, withExclude, worktreeDir, type Project } from 'core/runner';

const project = (extra: object) => parseProject(JSON.stringify({ commands: [], ...extra })) as Project;

describe('la recette', () => {
  it('le dossier du worktree : à côté du dépôt par défaut, sinon worktree.dir, résolu depuis le dépôt', () => {
    expect(worktreeDir(project({}), '/r/projet', 'pr-7')).toBe('/r/projet-worktrees/pr-7');
    expect(worktreeDir(project({ worktree: { dir: '../wt/{branch}/x' } }), '/r/projet', 'feat/a')).toBe('/r/wt/feat/a/x');
    expect(worktreeDir(project({ worktree: { dir: '/abs/{branch}' } }), '/r/projet', 'b')).toBe('/abs/b');
  });

  it('sans base : la branche seule', () => {
    expect(recipeEnv('pr-7')).toEqual({ VIBECODER_BRANCH: 'pr-7' });
    expect(recipeEnv('pr-7', '')).toBeNull();
  });

  it('avec worktree.create : le script seul, le setup pas relancé (il prépare son worktree)', () => {
    const p = project({ prefix: '', worktree: { create: 'mk' }, setup: ['yarn install'] });
    expect(createSteps(p, { home: '/r/p', branch: 'b', start: 'origin/b' }, '', '')).toEqual([{ argv: ['bash', '-ic', 'mk'], cwd: '/r/p' }]);
  });

  it('sans setup ni préfixe : la seule création, au dépôt ; le shell du fichier', () => {
    const p = project({ prefix: '', shell: ['zsh', '-c'], worktree: { create: 'mk' } });
    expect(createSteps(p, { home: '/r/p', branch: 'b', start: 'origin/b' }, '', '')).toEqual([{ argv: ['zsh', '-c', 'mk'], cwd: '/r/p' }]);
    expect(removeSteps(p, { home: '/r/p', dir: '/r/p-worktrees/b' }, '', '')).toEqual([{ argv: ['git', '-C', '/r/p', 'worktree', 'remove', '/r/p-worktrees/b'], cwd: '/r/p' }]);
  });
});

describe('le fichier du projet, dans .vibecoder/', () => {
  it('son chemin', () => {
    expect(projectPath('/r/projet')).toBe('/r/projet/.vibecoder/project.json');
  });

  it('.git/info/exclude : la ligne ajoutée à la fin, une fois', () => {
    expect(withExclude(null)).toBe('.vibecoder/\n');
    expect(withExclude('# exclude\n*.log')).toBe('# exclude\n*.log\n.vibecoder/\n');
    expect(withExclude('*.log\n')).toBe('*.log\n.vibecoder/\n');
    for (const line of ['.vibecoder', '.vibecoder/', '/.vibecoder/', '  .vibecoder/  ']) expect(withExclude(`a\n${line}\nb\n`)).toBeNull();
    expect(withExclude('.vibecoder-old/\n')).toBe('.vibecoder-old/\n.vibecoder/\n');
  });
});
