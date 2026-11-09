// Le dépôt git d'essai (git réel) : sa branche et sa note commitée, son dépôt distant local.
// Ne connaît pas : le principal, Electron, ce que vérifient les tests.
// Utilisé par : le barrel (harness) ; les tests, directement (git, write).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { write } from './profile';

// git dans `cwd`, avec une identité ; la sortie telle quelle (non rognée).
export const git = (cwd: string, ...args: string[]): string =>
  execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' }).toString();

// Un dépôt sur main (un commit vide), puis sur `branch` avec sa note commitée à docs/tickets/<branch>.md.
export function repo(dir: string, { branch = 'feat/0.9.0-essai', note = '# 0.9.0 — essai\n\n## Ce que ça fait\n\n- un essai\n' }: { branch?: string; note?: string } = {}): void {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
  git(dir, 'checkout', '-q', '-b', branch);
  write(path.join(dir, 'docs/tickets', `${branch}.md`), note);
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'note');
}

// Un dépôt nu à côté (<dir>-origin.git), en origin : les branches existantes y sont poussées (suivies) et
// origin/HEAD pointe sur main. Rend le chemin du dépôt nu.
export function remote(dir: string): string {
  const bare = `${dir}-origin.git`;
  fs.mkdirSync(bare, { recursive: true });
  git(bare, 'init', '-q', '--bare', '-b', 'main');
  git(dir, 'remote', 'add', 'origin', bare);
  git(dir, 'push', '-q', '-u', 'origin', '--all');
  git(dir, 'remote', 'set-head', 'origin', 'main');
  return bare;
}
