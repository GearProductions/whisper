import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { githubPage, githubUrl } from 'core/repo';

describe('origines reconnues', () => {
  it.each([
    ['http://github.com/o/d', 'https://github.com/o/d'],
    ['https://GitHub.com/o/d.git', 'https://github.com/o/d'],
    ['https://github.com/o/d/', 'https://github.com/o/d'],
    ['https://github.com:443/o/d.git/', 'https://github.com/o/d'],
    ['git@github.com:o/d.js.git', 'https://github.com/o/d.js'],
    ['github.com:o/d', 'https://github.com/o/d'],
    ['https://github.com/o/.github', 'https://github.com/o/.github'],
    ['https://github.com/o/.', null],
  ])('%s → %s', (remote, url) => {
    expect(githubUrl(remote)).toBe(url);
  });
});

// Un disque simulé : chemin → contenu (chemins résolus, comme ceux lus).
const disk = (files: Record<string, string>) => {
  const resolved = Object.fromEntries(Object.entries(files).map(([f, text]) => [path.resolve(f), text]));
  return (file: string) => resolved[path.resolve(file)] ?? null;
};
const origin = (body: string) => `[core]\n\tbare = false\n[remote "origin"]\n${body}[branch "master"]\n\turl = https://github.com/b/b\n`;
const page = (files: Record<string, string>, dir = '/x') => githubPage(path.resolve(dir), disk(files));

describe('config du dépôt', () => {
  it.each([
    ['url entre guillemets', '\turl = "https://github.com/o/d.git"\n', 'https://github.com/o/d'],
    ['clé en majuscules', '\tURL = git@github.com:o/d.git\n', 'https://github.com/o/d'],
    ['commentaires', '# url = https://github.com/c/c\n\t; url = https://github.com/c/c\n\turl = https://github.com/o/d\n', 'https://github.com/o/d'],
    ['origin sans url', '\tfetch = +refs/heads/*:refs/remotes/origin/*\n', null],
  ])('%s', (_, body, url) => {
    expect(page({ '/x/.git/config': origin(body) })).toBe(url);
  });

  it('pas de .git : rien', () => {
    expect(page({})).toBeNull();
  });

  it('worktree : gitdir puis commondir', () => {
    expect(page({
      '/w/.git': 'gitdir: /x/.git/worktrees/w\n',
      '/x/.git/worktrees/w/commondir': '../..\n',
      '/x/.git/config': origin('\turl = https://github.com/o/d.git\n'),
    }, '/w')).toBe('https://github.com/o/d');
  });

  it('sous-module : gitdir relatif, sans commondir', () => {
    expect(page({
      '/x/m/.git': 'gitdir: ../.git/modules/m\n',
      '/x/.git/modules/m/config': origin('\turl = git@github.com:o/m.git\n'),
      '/x/.git/config': origin('\turl = https://github.com/o/d.git\n'),
    }, '/x/m')).toBe('https://github.com/o/m');
  });
});
