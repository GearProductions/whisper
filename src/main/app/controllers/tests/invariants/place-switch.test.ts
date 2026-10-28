// Invariants de Décharger (unload-pr) et de la nouvelle demande ici (new-here) :
// jamais de changement de branche dans un dossier qui a des modifications.
// Protégés : si un test échoue, corriger le code.
//   Note 0.12.0 docs/tickets/refactor/0.12.0-creer-relire-meme-dossier.md,
//   « Ce que ça ne doit pas faire » : « Changer de branche dans un dossier qui
//   a des modifications » (l'invariant de la 0.12.0, pr-place.test.ts, pour
//   pr-here et base ; ici pour les deux nouveaux changements de branche) :
//   unload-pr (revenir sur la base du dépôt) et new-here (git switch -c sur la
//   branche de la demande) relisent l'état du dossier au clic ; des
//   modifications → refusé, même si le relevé affiché le disait propre.
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
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-place-switch-')));
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
  out = path.join(root, 'vibecoder-out', 'a1');
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
// L'action `id` dans le dernier relevé de a1.
const shown = async (id: string) => (await import('app/controllers')).lastView('a1')?.actions.find((a) => a.id === id);
// Le clic sur une action directe.
const click = async (id: string) => (await import('app/controllers')).runVibeAction(id, { direct: true });

describe.skipIf(process.platform === 'win32')('Décharger (unload-pr) : jamais de changement de branche dans un dossier qui a des modifications', () => {
  beforeEach(() => {
    // a1 en Relire, la PR 7 chargée (sa fiche dans les sorties), le dossier sur sa branche.
    write(path.join(out, 'pr-7.json'), JSON.stringify({ number: 7, title: 'Essai', url: 'u', author: 'bob', base: 'main', head: 'feat/x', body: '', state: 'OPEN' }));
    configure({ flow: 'review', autonomy: 'guide', pr: 7 });
    git(repo, 'switch', '-q', 'feat/x');
  });

  it('propre : unload-pr revient sur la base du dépôt (le clic agit bien)', async () => {
    await openPanel();

    await click('unload-pr');
    await until(() => branch() === 'main');

    // sur la base du dépôt
    expect(branch()).toBe('main');
  }, 20000);

  it('un fichier modifié après le relevé : refusé, la branche et la modification restent', async () => {
    await openPanel();
    // le relevé propose unload-pr, actif : le dossier y était propre
    expect(await shown('unload-pr')).toMatchObject({ disabled: null });
    write(path.join(repo, 'a.txt'), 'modifié\n');

    await click('unload-pr');
    await wait(2000);

    // toujours sur la branche de la PR
    expect(branch()).toBe('feat/x');
    // la modification est toujours là
    expect(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8')).toBe('modifié\n');
  }, 20000);

  it('des modifications déjà au relevé : refusé, la branche et la modification restent', async () => {
    write(path.join(repo, 'a.txt'), 'modifié\n');
    await openPanel();
    // le relevé montre bien unload-pr (grisé)
    expect(await shown('unload-pr')).toBeDefined();

    await click('unload-pr');
    await wait(2000);

    // toujours sur la branche de la PR
    expect(branch()).toBe('feat/x');
    // la modification est toujours là
    expect(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8')).toBe('modifié\n');
  }, 20000);
});

describe.skipIf(process.platform === 'win32')('Nouvelle demande ici (new-here) : jamais de changement de branche dans un dossier qui a des modifications', () => {
  beforeEach(() => {
    // a1 en Créer, sur main.
    configure({ flow: 'create', autonomy: 'guide' });
  });
  // Une nouvelle demande retenue : le texte envoyé, la fiche du skill
  // nouvelle-demande écrite, puis le relevé qui la lit, jusqu'à ce qu'il propose new-here.
  async function requestPending() {
    await openPanel();
    const { refreshVibe, runVibeAction } = await import('app/controllers');
    runVibeAction('new-request', { text: 'ajouter un bouton' });
    await wait(300);
    write(path.join(out, 'new-request.json'), JSON.stringify({ branch: 'feat/0.13.0-bouton' }));
    await refreshVibe({ now: true });
    for (const end = Date.now() + 5000; !await shown('new-here') && Date.now() < end;) await wait(100);
  }

  it('propre : new-here passe sur la branche de la demande (le clic agit bien)', async () => {
    await requestPending();

    await click('new-here');
    await until(() => branch() === 'feat/0.13.0-bouton');

    // sur la branche de la demande
    expect(branch()).toBe('feat/0.13.0-bouton');
  }, 20000);

  it('un fichier modifié après le relevé : refusé, la branche et la modification restent', async () => {
    await requestPending();
    // le relevé propose new-here, actif : le dossier y était propre
    expect(await shown('new-here')).toMatchObject({ disabled: null });
    write(path.join(repo, 'a.txt'), 'modifié\n');

    await click('new-here');
    await wait(2000);

    // toujours sur main
    expect(branch()).toBe('main');
    // la modification est toujours là
    expect(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8')).toBe('modifié\n');
  }, 20000);

  it('des modifications déjà au relevé : refusé, la branche et la modification restent', async () => {
    write(path.join(repo, 'a.txt'), 'modifié\n');
    await requestPending();
    // le relevé montre bien new-here (grisé)
    expect(await shown('new-here')).toBeDefined();

    await click('new-here');
    await wait(2000);

    // toujours sur main
    expect(branch()).toBe('main');
    // la modification est toujours là
    expect(fs.readFileSync(path.join(repo, 'a.txt'), 'utf8')).toBe('modifié\n');
  }, 20000);
});
