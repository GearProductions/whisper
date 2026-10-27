// Invariant de « Mettre de côté » (stash). Protégé : si un test échoue,
// corriger le code.
//   Note 0.12.0 docs/tickets/refactor/0.12.0-creer-relire-meme-dossier.md,
//   « Ce que ça ne doit pas faire » : « Mettre des modifications de côté sans
//   que l'utilisateur l'ait choisi au clic : jamais à la suite d'un chargement
//   ou d'un changement de branche » (SPEC F-114, I-39). Le dossier modifié
//   (un fichier suivi et un non suivi), rien n'est mis de côté au relevé, ni
//   après un chargement (load-pr), un Décharger (unload-pr, « Rester sur la
//   branche »), une nouvelle demande (new-request, new-here), un changement
//   de branche (pr-here) ou un nouveau worktree (pr-worktree, new-worktree) ; seul le clic sur stash met de côté, tout (git stash
//   push -u : les non suivis compris), et rien d'autre ne suit (le dossier
//   reste sur sa branche). La forme exacte de la commande : direct.test.ts.
// Sur le vrai principal (contrôleurs, réglages et fichiers sur disque, git réel
// sur un dépôt d'essai et son origin, un dépôt nu local) ; faux : Electron
// (fenêtres, boîte de dialogue), le SDK de Claude Code (le tour finit aussitôt,
// sans rien écrire) et gh (un faux préfixe : git passe au vrai git, gh répond
// la PR 7 ouverte).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => {
  type Handler = (...a: unknown[]) => void;
  class Win {
    sent: [string, unknown][] = [];
    handlers = new Map<string, Handler[]>();
    visible = false;
    webContents = {
      send: (ch: string, payload?: unknown) => { this.sent.push([ch, payload]); },
      on: () => {}, setWindowOpenHandler: () => {},
    };
    on(ev: string, fn: Handler) { this.handlers.set(ev, [...(this.handlers.get(ev) || []), fn]); return this; }
    once(ev: string, fn: Handler) { return this.on(ev, fn); }
    emit(ev: string) { for (const fn of this.handlers.get(ev) || []) fn(); }
    loadFile() {} setAlwaysOnTop() {} setVisibleOnAllWorkspaces() {} setResizable() {} setBounds() {}
    getBounds() { return { x: 500, y: 500, width: 64, height: 64 }; }
    isVisible() { return this.visible; } isDestroyed() { return false; } isMinimized() { return false; }
    show() { this.visible = true; } showInactive() { this.visible = true; } hide() { this.visible = false; }
    focus() { this.emit('focus'); } restore() {} minimize() { this.visible = false; }
  }
  // cwd : le dossier du projet, retenu avant qu'un cas change de dossier courant.
  return { Win, cwd: process.cwd(), userData: '', windows: [] as InstanceType<typeof Win>[] };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: {}, clipboard: {}, nativeImage: {},
  // Annuler, toujours : aucun robot ne naît ici.
  dialog: { showMessageBox: async () => ({ response: 0 }) },
}));

vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: ({ prompt }: { prompt: AsyncIterable<unknown> }) => Object.assign((async function* run() {
      for await (const _ of prompt) yield { type: 'result', subtype: 'success', is_error: false, result: 'ok' };
    }()), { setPermissionMode: async () => {}, setModel: async () => {}, interrupt: async () => {} }),
  }),
}));

vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${fake.cwd}/resources/${name}`,
}));

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' }).toString().trim();
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const until = async (ok: () => boolean, ms = 10000) => {
  for (const end = Date.now() + ms; !ok() && Date.now() < end;) await wait(50);
  return ok();
};
let root = '';
let repo = '';
let out = '';

const branch = () => git(repo, 'rev-parse', '--abbrev-ref', 'HEAD');
const stashes = () => git(repo, 'stash', 'list').split('\n').filter(Boolean);
const worktrees = () => git(repo, 'worktree', 'list', '--porcelain').split('\n').filter((l) => l.startsWith('worktree ')).length;
const agents = async () => (await import('app/settings')).loadConfig().agents;
// Le dossier modifié : un fichier suivi changé, un fichier non suivi ajouté.
const makeDirty = () => { write(path.join(repo, 'a.txt'), 'modifié\n'); write(path.join(repo, 'c.txt'), 'non suivi\n'); };
const tracked = () => fs.readFileSync(path.join(repo, 'a.txt'), 'utf8');
const untracked = () => fs.existsSync(path.join(repo, 'c.txt'));
// Les réglages : a1 sur le dépôt, en `vibe`, derrière le faux préfixe.
const configure = (vibe: object) => write(path.join(root, 'config.json'), JSON.stringify({
  agentsEnabled: true,
  vibeCommandPrefix: `"${process.execPath}" "${path.join(root, 'faux-prefixe.cjs')}"`,
  agents: [{ id: 'a1', dir: repo, name: 'projet', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder', vibe }],
}));

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  fake.windows = [];
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-stash-')));
  root = fake.userData;
  // origin : un dépôt nu, avec main et la branche de la PR (feat/x).
  const origin = path.join(root, 'origin.git');
  fs.mkdirSync(origin);
  git(origin, 'init', '-q', '--bare', '-b', 'main');
  repo = path.join(root, 'projet');
  git(root, 'clone', '-q', origin, repo);
  git(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  write(path.join(repo, 'a.txt'), 'a\n');
  git(repo, 'add', 'a.txt');
  git(repo, 'commit', '-q', '-m', 'init');
  git(repo, 'push', '-q', 'origin', 'main');
  git(repo, 'switch', '-q', '-c', 'feat/x');
  write(path.join(repo, 'b.txt'), 'b\n');
  git(repo, 'add', 'b.txt');
  git(repo, 'commit', '-q', '-m', 'la PR');
  git(repo, 'push', '-q', 'origin', 'feat/x');
  git(repo, 'switch', '-q', 'main');
  git(repo, 'branch', '-q', '-D', 'feat/x');
  // Le faux préfixe : git passe au vrai git ; gh répond la PR 7 ouverte (pr list : aucune).
  write(path.join(root, 'faux-prefixe.cjs'), `if (process.argv[2] !== 'gh') {
  const r = require('child_process').spawnSync(process.argv[2], process.argv.slice(3), { stdio: 'inherit' });
  process.exit(r.status ?? 1);
}
process.stdout.write(process.argv.includes('list') ? '[]' : ${JSON.stringify(JSON.stringify({ number: 7, title: 'Essai', url: 'u', author: { login: 'bob' }, baseRefName: 'main', headRefName: 'feat/x', body: '', state: 'OPEN' }))});\n`);
  // La PR 7 chargée (load-pr) : sa fiche dans les sorties.
  out = path.join(root, 'vibecoder-out', 'a1');
  write(path.join(out, 'pr-7.json'), JSON.stringify({ number: 7, title: 'Essai', url: 'u', author: 'bob', base: 'main', head: 'feat/x', body: '', state: 'OPEN' }));
  configure({ flow: 'review', autonomy: 'guide', pr: 7 });
});
afterEach(() => { vi.useRealTimers(); process.chdir(fake.cwd); });

// Le panneau de a1 ouvert, son premier relevé envoyé.
async function openPanel() {
  const { state } = await import('app/state');
  const { openConversation } = await import('app/windows');
  const { panelReady } = await import('app/controllers');
  state.icon = new fake.Win() as never;
  openConversation('a1');
  fake.windows.at(-1)!.emit('ready-to-show');
  await panelReady();
  await wait(150);
}
// Un relevé de plus, puis le temps qu'une suite éventuelle agisse.
async function surveyAgain() {
  const { refreshVibe } = await import('app/controllers');
  await refreshVibe({ now: true });
  await wait(1500);
}
// L'action `id` dans le dernier relevé de a1.
const shown = async (id: string) => (await import('app/controllers')).lastView('a1')?.actions.find((a) => a.id === id);
// Le clic sur une action directe.
const click = async (id: string, args: object = {}) => (await import('app/controllers')).runVibeAction(id, { ...args, direct: true });
// Une nouvelle demande retenue (Créer) : le texte envoyé, la fiche du skill
// nouvelle-demande écrite, puis le relevé qui la lit.
async function requestPending() {
  configure({ flow: 'create', autonomy: 'guide' });
  await openPanel();
  const { refreshVibe, runVibeAction } = await import('app/controllers');
  runVibeAction('new-request', { text: 'ajouter un bouton' });
  await wait(300);
  write(path.join(out, 'new-request.json'), JSON.stringify({ branch: 'feat/0.13.0-bouton' }));
  await refreshVibe({ now: true });
  for (const end = Date.now() + 5000; !await shown('new-here') && Date.now() < end;) await wait(100);
}

describe.skipIf(process.platform === 'win32')('jamais de mise de côté sans un clic sur stash', () => {
  it('au relevé : le dossier modifié, relevé deux fois, rien n’est mis de côté', async () => {
    makeDirty();

    await openPanel();
    await surveyAgain();

    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('à la suite d’un chargement : load-pr sur le dossier modifié charge la PR, rien n’est mis de côté', async () => {
    fs.rmSync(path.join(out, 'pr-7.json'));
    configure({ flow: 'review', autonomy: 'guide' });
    makeDirty();
    await openPanel();

    await click('load-pr', { pr: 7 });
    await until(() => fs.existsSync(path.join(out, 'pr-7.json')));
    await surveyAgain();

    // la PR est bien chargée (sa fiche est écrite)
    expect(fs.existsSync(path.join(out, 'pr-7.json'))).toBe(true);
    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('à la suite d’un changement de branche : pr-here sur le dossier modifié, rien n’est mis de côté', async () => {
    makeDirty();
    await openPanel();

    await click('pr-here');
    await surveyAgain();

    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('Dans un nouveau worktree : pr-worktree sur le dossier modifié crée le worktree, rien n’est mis de côté', async () => {
    makeDirty();
    await openPanel();

    await click('pr-worktree');
    await until(() => worktrees() > 1);
    await surveyAgain();

    // le worktree de la PR est bien créé (le clic a agi)
    expect(worktrees()).toBeGreaterThan(1);
    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('Décharger : unload-pr sur le dossier modifié, rien n’est mis de côté', async () => {
    git(repo, 'switch', '-q', 'feat/x');
    makeDirty();
    await openPanel();

    await click('unload-pr');
    await surveyAgain();

    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('Décharger : « Rester sur la branche » ne suit plus la PR, rien n’est mis de côté', async () => {
    git(repo, 'switch', '-q', 'feat/x');
    makeDirty();
    await openPanel();
    const { setVibe } = await import('app/controllers');

    setVibe({ pr: null });
    await surveyAgain();

    // la PR n'est plus suivie (le Décharger a eu lieu)
    expect((await agents())[0].vibe?.pr ?? null).toBeNull();
    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('à la suite d’une nouvelle demande : la demande retenue et relevée sur le dossier modifié, rien n’est mis de côté', async () => {
    makeDirty();

    await requestPending();
    await surveyAgain();

    // la demande attend son choix (le relevé la montre)
    expect((await import('app/controllers')).lastView('a1')?.request).toMatchObject({ branch: 'feat/0.13.0-bouton' });
    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('nouvelle demande : new-here sur le dossier modifié, rien n’est mis de côté', async () => {
    makeDirty();
    await requestPending();

    await click('new-here');
    await surveyAgain();

    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 20000);

  it('nouvelle demande : new-worktree sur le dossier modifié crée le worktree, rien n’est mis de côté', async () => {
    makeDirty();
    await requestPending();

    await click('new-worktree');
    await until(() => worktrees() > 1);
    await surveyAgain();

    // le worktree de la demande est bien créé (le clic a agi)
    expect(worktrees()).toBeGreaterThan(1);
    // aucune entrée de stash
    expect(stashes()).toEqual([]);
    // le fichier suivi garde sa modification
    expect(tracked()).toBe('modifié\n');
    // le fichier non suivi est toujours là
    expect(untracked()).toBe(true);
  }, 30000);
});

describe.skipIf(process.platform === 'win32')('le clic sur stash : tout de côté, et rien d’autre ne suit', () => {
  it('la PR chargée, le dossier modifié : stash met tout de côté, non suivis compris, et le dossier reste sur sa branche', async () => {
    makeDirty();
    await openPanel();
    // le relevé propose stash : le dossier a des modifications
    expect(await shown('stash')).toBeDefined();

    await click('stash');
    await until(() => stashes().length > 0);
    await surveyAgain();

    // une seule entrée de stash
    expect(stashes()).toHaveLength(1);
    // le dossier est propre, fichier non suivi compris (git stash push -u)
    expect(git(repo, 'status', '--porcelain')).toBe('');
    // aucun changement de branche ne suit : toujours sur main
    expect(branch()).toBe('main');
  }, 20000);

  it('Décharger, sur la branche de la PR, le dossier modifié : stash met tout de côté et le dossier reste sur la branche de la PR', async () => {
    git(repo, 'switch', '-q', 'feat/x');
    makeDirty();
    await openPanel();
    // le relevé propose stash : le dossier a des modifications
    expect(await shown('stash')).toBeDefined();

    await click('stash');
    await until(() => stashes().length > 0);
    await surveyAgain();

    // une seule entrée de stash
    expect(stashes()).toHaveLength(1);
    // aucun changement de branche ne suit : toujours sur la branche de la PR
    expect(branch()).toBe('feat/x');
  }, 20000);

  it('une nouvelle demande en attente, le dossier modifié : stash met tout de côté et le dossier reste sur main', async () => {
    makeDirty();
    await requestPending();
    // le relevé propose stash : le dossier a des modifications
    expect(await shown('stash')).toBeDefined();

    await click('stash');
    await until(() => stashes().length > 0);
    await surveyAgain();

    // une seule entrée de stash
    expect(stashes()).toHaveLength(1);
    // aucun changement de branche ne suit : pas de passage sur la branche de la demande
    expect(branch()).toBe('main');
  }, 20000);
});
