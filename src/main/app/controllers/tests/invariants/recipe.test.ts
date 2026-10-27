// Invariants du fichier du projet et de sa recette, côté principal. Protégés :
// si un test échoue, corriger le code.
//   Note 0.12.0 docs/tickets/feat/0.12.0-worktrees.md, « Ce que ça ne doit pas
//   faire » :
//   - « Lire le fichier du projet ailleurs que dans .vibecoder/ du dossier du
//     parent : jamais celui d'un worktree (une PR pourrait y apporter ses
//     propres commandes) » : un enfant prend le fichier de son parent présent ;
//     parti, il n'en a aucun — ni commandes, ni recette ;
//   - « Mettre un nom de branche dans le texte d'une commande : il passe par
//     les variables VIBECODER_BRANCH et VIBECODER_BASE » : la commande du
//     fichier reçoit la branche par son environnement ; une branche qui n'est
//     pas un ref sûr ne lance rien ;
//   - « Retirer un worktree qui a des modifications » : `git status
//     --porcelain` dans le worktree d'abord ; une ligne, ou pas de réponse →
//     refusé, quelle que soit la commande du fichier.
// Sur le vrai principal (contrôleurs des processus et de la recette, réglages
// et fichiers sur disque, git réel sur un dépôt d'essai et ses worktrees, de
// vrais processus) ; faux : Electron (le dossier userData, la boîte de
// dialogue). Les commandes écrivent ce qu'elles font dans des fichiers : c'est
// le système lui-même qu'on observe.
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ userData: '' }));

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class {},
  screen: {}, shell: {}, clipboard: {}, nativeImage: {},
  dialog: { showMessageBox: async () => ({ response: 0 }) },
}));

const { loadConfig } = await import('app/settings');
const { processView, stopProcesses } = await import('app/controllers/processes');
const { createWorktree, prepare, removeWorktree } = await import('app/controllers/recipe');

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const lines = (file: string) => (fs.existsSync(file) ? fs.readFileSync(file, 'utf8').trim().split('\n') : []);
let root = '';
let repo = '';
let worktree = '';
let sibling = '';
let seenFile = '';
let pirate = '';

const agent = (id: string, dir: string, parent?: string) =>
  ({ id, dir, name: id, model: 'opus', effort: 'high', mode: 'default', sessionId: null, ...(parent ? { parent: { id: parent } } : {}) });
const saveAgents = (list: object[]) => write(path.join(root, 'config.json'), JSON.stringify({ agentsEnabled: true, agents: list }));
const agentOf = (id: string) => loadConfig().agents.find((a) => a.id === id)!;
const names = (id: string) => processView(agentOf(id), loadConfig()).processes.map((p) => p.name);
// Le fichier du projet d'un dossier : <dossier>/.vibecoder/project.json.
const projectAt = (dir: string, project: object) => write(path.join(dir, '.vibecoder', 'project.json'), JSON.stringify(project));

beforeEach(() => {
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-recette-')));
  root = fake.userData;
  seenFile = path.join(root, 'seen.txt');
  pirate = path.join(root, 'PIRATE');
  repo = path.join(root, 'projet');
  fs.mkdirSync(repo);
  git(repo, 'init', '-q', '-b', 'main');
  write(path.join(repo, 'a.txt'), 'a\n');
  git(repo, 'add', 'a.txt');
  git(repo, 'commit', '-q', '-m', 'init');
  worktree = path.join(root, 'projet-worktrees', 'feat-a');
  git(repo, 'worktree', 'add', '-q', '-b', 'feat/a', worktree);
  sibling = path.join(root, 'projet-worktrees', 'feat-b');
  git(repo, 'worktree', 'add', '-q', '-b', 'feat/b', sibling);
  // Une famille : a1 sur la copie principale, a2 et a3 ses enfants sur deux worktrees.
  saveAgents([agent('a1', repo), agent('a2', worktree, 'a1'), agent('a3', sibling, 'a1')]);
});
afterEach(async () => { await stopProcesses(); });

describe.skipIf(process.platform === 'win32')('le fichier du projet : celui de .vibecoder/ du parent présent, jamais celui d’un worktree', () => {
  beforeEach(() => {
    // Le fichier du parent : ses commandes et son setup (qui note le dossier où il tourne).
    projectAt(repo, { commands: [{ name: 'serveur', run: 'true' }], setup: [`echo "$PWD" >> '${seenFile}'`] });
    // Celui qu'une PR apporterait dans chaque worktree.
    const fromPr = { commands: [{ name: 'pirate', run: `touch '${pirate}'` }], setup: [`touch '${pirate}'`] };
    projectAt(worktree, fromPr);
    projectAt(sibling, fromPr);
  });

  it('un enfant : les commandes du fichier de son parent, jamais celles de son worktree', () => {
    const shown = names('a2');

    // celles du parent
    expect(shown).toContain('serveur');
    // jamais celles du worktree
    expect(shown).not.toContain('pirate');
  });

  it('le parent parti : l’enfant n’a plus de commandes, ni celles de son worktree, ni celles d’un frère', () => {
    // le parent présent, l'enfant a bien les commandes de la famille
    expect(names('a2')).toContain('serveur');
    saveAgents([agent('a2', worktree, 'a1'), agent('a3', sibling, 'a1')]);

    const shown = names('a2');

    // aucune commande
    expect(shown).toEqual([]);
  });

  it('préparer un enfant : le setup de son parent, dans le dossier de l’enfant, jamais celui du worktree', async () => {
    await prepare(agentOf('a2'));

    // le setup du parent a tourné une fois, dans le worktree de l'enfant
    expect(lines(seenFile)).toEqual([worktree]);
    // celui du worktree n'a pas tourné
    expect(fs.existsSync(pirate)).toBe(false);
  });

  it('préparer un enfant dont le parent est parti : rien ne tourne, ni le setup de son worktree', async () => {
    saveAgents([agent('a2', worktree, 'a1'), agent('a3', sibling, 'a1')]);

    await prepare(agentOf('a2'));

    // aucun setup du parent
    expect(lines(seenFile)).toEqual([]);
    // ni celui du worktree
    expect(fs.existsSync(pirate)).toBe(false);
  });
});

describe.skipIf(process.platform === 'win32')('créer un worktree : la branche par l’environnement, jamais dans le texte de la commande', () => {
  it('la commande du fichier, sans branche dans son texte, crée le worktree de la branche reçue par VIBECODER_BRANCH et VIBECODER_BASE', async () => {
    projectAt(repo, { commands: [], worktree: { create: 'git worktree add -q -b "$VIBECODER_BRANCH" "../projet-worktrees/$VIBECODER_BRANCH" "$VIBECODER_BASE"' } });
    const dir = path.join(root, 'projet-worktrees', 'feat', 'c');

    await createWorktree(agentOf('a1'), { branch: 'feat/c', base: 'main', start: 'main' });

    // le worktree est là, sur la branche passée par l'environnement
    expect(git(dir, 'rev-parse', '--abbrev-ref', 'HEAD').toString().trim()).toBe('feat/c');
  });

  it('une branche qui n’est pas un ref sûr : refusé, la commande du fichier ne tourne pas', async () => {
    projectAt(repo, { commands: [], worktree: { create: `touch '${pirate}'` } });

    const result = await createWorktree(agentOf('a1'), { branch: 'feat/c;touch PIRATE', base: 'main', start: 'main' });

    // refusé
    expect(result.ok).toBe(false);
    // la commande n'a pas tourné
    expect(fs.existsSync(pirate)).toBe(false);
  });
});

describe.skipIf(process.platform === 'win32')('retirer un worktree : jamais avec des modifications, ni sans réponse de git status', () => {
  beforeEach(() => {
    // La commande de retrait du parent efface le dossier sans rien demander : seul le contrôle la retient.
    projectAt(repo, { commands: [], worktree: { remove: `rm -rf '${worktree}'` } });
  });

  it('propre : retiré (la commande du fichier agit bien)', async () => {
    await removeWorktree(agentOf('a2'));

    // le dossier n'est plus là
    expect(fs.existsSync(worktree)).toBe(false);
  });

  it('un fichier modifié : refusé, le worktree et la modification restent', async () => {
    write(path.join(worktree, 'a.txt'), 'modifié\n');

    const result = await removeWorktree(agentOf('a2'));

    // refusé
    expect(result.ok).toBe(false);
    // la modification est toujours là
    expect(fs.readFileSync(path.join(worktree, 'a.txt'), 'utf8')).toBe('modifié\n');
  });

  it('un fichier nouveau, non suivi : refusé, il reste', async () => {
    write(path.join(worktree, 'nouveau.txt'), 'n\n');

    const result = await removeWorktree(agentOf('a2'));

    // refusé
    expect(result.ok).toBe(false);
    // le fichier est toujours là
    expect(fs.existsSync(path.join(worktree, 'nouveau.txt'))).toBe(true);
  });

  it('une modification indexée : refusé, elle reste', async () => {
    write(path.join(worktree, 'a.txt'), 'indexé\n');
    git(worktree, 'add', 'a.txt');

    const result = await removeWorktree(agentOf('a2'));

    // refusé
    expect(result.ok).toBe(false);
    // la modification est toujours là
    expect(fs.readFileSync(path.join(worktree, 'a.txt'), 'utf8')).toBe('indexé\n');
  });

  it('git status sans réponse : refusé, le worktree reste', async () => {
    // le lien du worktree vers le dépôt est cassé : git status y échoue
    write(path.join(worktree, '.git'), 'gitdir: /nulle-part\n');
    expect(spawnSync('git', ['status', '--porcelain'], { cwd: worktree }).status).not.toBe(0);

    const result = await removeWorktree(agentOf('a2'));

    // refusé
    expect(result.ok).toBe(false);
    // le dossier est toujours là
    expect(fs.existsSync(path.join(worktree, 'a.txt'))).toBe(true);
  });
});
