// Invariant de la clé d'un projet (note 0.13.0,
// docs/tickets/fix/0.13.0-fix-and-improvements.md, sujet 8, « Ce que ça ne doit pas
// faire » : montrer ou servir un artefact d'un autre projet ; « Forme » : la clé est lue
// sur le disque, sans lancer git, et vaut le dossier git commun résolu que donne repoOf ;
// un dossier hors git est son propre projet). La clé décide quel dossier d'artefacts un
// robot voit : une clé fausse enverrait un robot dans un autre dossier sans rien dire.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai disque et le vrai git : un dépôt, son worktree, un sous-module, un lien
// réel ; repoOf (qui lance git) sert de référence.
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { repoOf } from 'core/family';
import { folderKey, projectFolder, projectKey } from 'core/vibecoder';
import { gitRun } from 'technicals/git';

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', '-c', 'protocol.file.allow=always', ...args], { cwd, stdio: 'pipe' });
// Le disque réel, tel que l'appli le passe : null s'il n'y a rien à lire.
const read = (file: string) => { try { return fs.readFileSync(file, 'utf8'); } catch { return null; } };
const realpath = fs.realpathSync.native;
const key = (dir: string) => projectKey(dir, read, realpath);
// Ce que dit git lui-même du dossier git commun.
const commonOf = async (dir: string) => (await repoOf(gitRun(dir), realpath))!.common;
const newRepo = (dir: string) => {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
};

let tmp = '';
let repo = '';
let worktree = '';

beforeEach(() => {
  tmp = realpath(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-project-key-')));
  repo = path.join(tmp, 'projet');
  worktree = path.join(tmp, 'projet-worktrees', 'enfant');
  newRepo(repo);
  git(repo, 'worktree', 'add', '-q', '-b', 'enfant', worktree);
});
afterEach(() => { vi.unstubAllEnvs(); });

describe('la clé d’un dépôt est le dossier git commun que voit git', () => {
  it('sur le dépôt : la clé est celle de repoOf', async () => {
    const expected = await commonOf(repo);

    const actual = key(repo);

    // la même que celle que git donne
    expect(actual).toBe(expected);
  });

  it('sur son worktree : la clé est celle de repoOf, la même que celle du dépôt', async () => {
    const expected = await commonOf(worktree);

    const actual = key(worktree);

    // la même que celle que git donne
    expect(actual).toBe(expected);
    // la même que celle du dépôt : le worktree et le dépôt sont un seul projet
    expect(actual).toBe(key(repo));
  });

  it('dans un sous-dossier du dépôt : on remonte comme git', async () => {
    const sub = path.join(repo, 'src', 'profond');
    fs.mkdirSync(sub, { recursive: true });

    const actual = key(sub);

    // la même que celle que git donne
    expect(actual).toBe(await commonOf(sub));
  });

  it('dans un sous-dossier du worktree : on remonte comme git', async () => {
    const sub = path.join(worktree, 'src', 'profond');
    fs.mkdirSync(sub, { recursive: true });

    const actual = key(sub);

    // la même que celle que git donne
    expect(actual).toBe(await commonOf(sub));
    // la même que celle du dépôt
    expect(actual).toBe(key(repo));
  });

  // /home est un lien vers /var/home ici : le même dépôt, sous deux chemins.
  it('le dépôt atteint par un lien : la même clé', () => {
    const linked = path.join(tmp, 'lien-projet');
    fs.symlinkSync(repo, linked);

    const actual = key(linked);

    // la même qu'en passant par le vrai chemin
    expect(actual).toBe(key(repo));
  });

  it('son worktree atteint par un lien : la même clé', () => {
    const linked = path.join(tmp, 'lien-enfant');
    fs.symlinkSync(worktree, linked);

    const actual = key(linked);

    // la même qu'en passant par le vrai chemin
    expect(actual).toBe(key(repo));
  });

  // Le lien mène au milieu du dépôt : remonter depuis le chemin du lien ne trouverait aucun .git.
  it('un sous-dossier du dépôt atteint par un lien : la même clé', () => {
    const sub = path.join(repo, 'src');
    const linked = path.join(tmp, 'lien-src');
    fs.mkdirSync(sub);
    fs.symlinkSync(sub, linked);

    const actual = key(linked);

    // la même qu'en passant par le vrai chemin
    expect(actual).toBe(key(repo));
  });

  // Un .git fichier, sans commondir : le sous-module est son propre dépôt.
  it('un sous-module : sa propre clé, celle de repoOf, pas celle du dépôt qui le contient', async () => {
    const lib = path.join(tmp, 'lib');
    newRepo(lib);
    git(repo, 'submodule', 'add', '-q', lib, 'module');
    const sub = path.join(repo, 'module');

    const actual = key(sub);

    // la même que celle que git donne
    expect(actual).toBe(await commonOf(sub));
    // pas celle du dépôt qui le contient
    expect(actual).not.toBe(key(repo));
  });

  it('deux dépôts : deux clés', () => {
    const other = path.join(tmp, 'autre');
    newRepo(other);

    const actual = key(other);

    // aucun artefact partagé entre deux dépôts
    expect(actual).not.toBe(key(repo));
  });
});

describe('sans lancer git', () => {
  // Un git qui dépasse son délai rendrait null, et un robot partirait dans un autre dossier sans rien dire.
  it('git introuvable : la clé d’un worktree reste celle de son dépôt', async () => {
    const expected = await commonOf(worktree);
    vi.stubEnv('PATH', '');

    const actual = key(worktree);

    // la même que celle que git donnait
    expect(actual).toBe(expected);
  });
});

describe('un dossier hors git est son propre projet', () => {
  it('sa clé est celle de son dossier', () => {
    const solo = path.join(tmp, 'seul');
    fs.mkdirSync(solo);

    const actual = key(solo);

    // la clé de son dossier
    expect(actual).toBe(folderKey(solo, realpath));
  });

  it('deux dossiers hors git : deux clés', () => {
    const a = path.join(tmp, 'seul-a');
    const b = path.join(tmp, 'seul-b');
    fs.mkdirSync(a);
    fs.mkdirSync(b);

    const actual = key(a);

    // aucun artefact partagé entre deux dossiers hors git
    expect(actual).not.toBe(key(b));
  });

  it('un dossier hors git atteint par un lien : la même clé', () => {
    const solo = path.join(tmp, 'seul');
    const linked = path.join(tmp, 'lien-seul');
    fs.mkdirSync(solo);
    fs.symlinkSync(solo, linked);

    const actual = key(linked);

    // la même qu'en passant par le vrai chemin
    expect(actual).toBe(key(solo));
  });

  it('un dossier parti : pas de levée, sa clé est celle de son chemin', () => {
    const gone = path.join(tmp, 'parti');

    const actual = key(gone);

    // le dossier de ce chemin, pour le déplacement d'une entrée dont le dossier a disparu
    expect(actual).toBe(folderKey(gone, realpath));
  });
});

describe('le dossier d’une clé', () => {
  // Un nom de dossier : ni séparateur, ni `..`, aucun moyen d'écrire ailleurs que sous la racine.
  it('une clé qui contient `..` et des séparateurs ne se retrouve pas dans le nom', () => {
    const actual = projectFolder('/un/../chemin/.git');

    // seulement des chiffres hexadécimaux
    expect(actual).toMatch(/^[0-9a-f]+$/);
  });

  it('la même clé donne le même dossier', () => {
    const actual = projectFolder(key(repo));

    // stable d'un démarrage à l'autre
    expect(actual).toBe(projectFolder(key(worktree)));
  });

  it('deux clés : deux dossiers', () => {
    const actual = projectFolder('/un/.git');

    // aucun artefact partagé entre deux projets
    expect(actual).not.toBe(projectFolder('/autre/.git'));
  });
});
