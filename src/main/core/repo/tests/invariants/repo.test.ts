// Invariant d'« Ouvrir sur GitHub ». Protégé : si un test échoue, corriger le code.
//   I-32 : n'ouvre que https://github.com/<propriétaire>/<dépôt>, reconstruit
//          depuis l'origine du dossier de l'agent ; jamais un autre hôte, un
//          autre schéma, un chemin en plus, des identifiants, un autre remote.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { githubPage, githubUrl } from 'core/repo';

const PAGE = /^https:\/\/github\.com\/[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/;

describe('adresse reconstruite (I-32)', () => {
  it.each([
    'https://github.com/o/d.git',
    'https://github.com/o/d',
    'https://utilisateur:jeton@github.com/o/d.git',
    'https://jeton@github.com/o/d',
    'git@github.com:o/d.git',
    'ssh://git@github.com/o/d.git',
    'git://github.com/o/d.git',
  ])('%s → https://github.com/o/d', (remote) => {
    expect(githubUrl(remote)).toBe('https://github.com/o/d');
  });

  it.each([
    'https://github.com.exemple.fr/o/d',
    'https://exemple.fr/github.com/o/d',
    'https://exemple.fr/o/d?github.com',
    'https://github.com@exemple.fr/o/d',
    'git@exemple.fr:github.com/o/d',
    'file:///home/u/github.com/o/d',
    'javascript:alert(1)//github.com/o/d',
    'ext::sh -c "github.com/o/d"',
    '/home/u/depots/d',
    '../d',
    'https://github.com/o',
    'https://github.com/o/d/issues',
    'https://github.com/o/d?x=1',
    'https://github.com/o/d#x',
    'https://github.com/o/../d',
    'https://github.com/o/..',
    'https://github.com/o/d\nhttps://exemple.fr',
    'https://github.com/o/d evil',
    '',
  ])('%j → rien', (remote) => {
    expect(githubUrl(remote)).toBeNull();
  });

  it.each([
    'https://u:ghp_secret123@github.com/o/d.git',
    'https://ghp_secret123@github.com/o/d',
    'ssh://ghp_secret123@github.com/o/d.git',
  ])('%s : jamais d\'identifiants dans l\'adresse', (remote) => {
    const url = githubUrl(remote);
    expect(url).toMatch(PAGE);
    expect(url).not.toContain('secret');
  });
});

// Un dossier simulé : chemin → contenu.
const disk = (files: Record<string, string>) => (file: string) => files[path.resolve(file)] ?? null;
const dir = path.resolve('/depots/projet');
const at = (...p: string[]) => path.resolve(dir, ...p);
const config = (remotes: string) => `[core]\n\trepositoryformatversion = 0\n${remotes}`;

describe('origine du dossier de l\'agent (I-32)', () => {
  it('origin, et pas un autre remote', () => {
    const read = disk({ [at('.git', 'config')]: config(
      '[remote "upstream"]\n\turl = https://github.com/autre/amont.git\n'
      + '[remote "origin"]\n\turl = https://exemple.fr/o/d.git\n',
    ) });
    expect(githubPage(dir, read)).toBeNull();
  });

  it('origin sur GitHub : sa page', () => {
    const read = disk({ [at('.git', 'config')]: config(
      '[remote "upstream"]\n\turl = https://github.com/autre/amont.git\n'
      + '[remote "origin"]\n\turl = git@github.com:o/d.git\n',
    ) });
    expect(githubPage(dir, read)).toBe('https://github.com/o/d');
  });

  it('pas de .git dans le dossier : rien, même si un parent en a un', () => {
    const read = disk({ [path.resolve(dir, '..', '.git', 'config')]: config(
      '[remote "origin"]\n\turl = https://github.com/o/d.git\n',
    ) });
    expect(githubPage(dir, read)).toBeNull();
  });
});
