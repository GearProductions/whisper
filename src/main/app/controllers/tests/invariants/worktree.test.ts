// Invariant des robots enfants (I-41 réécrit par la note 0.10.0
// docs/tickets/feat/0.10.0-familles-d-agents.md, « Ce que ça ne doit pas
// faire » : « Créer un agent enfant sur un dossier qui n'est pas la racine
// d'un worktree du même dépôt, ou sans la question de confiance acceptée » ;
// I-23). Un enfant ne naît que sur la racine d'un worktree du même dépôt,
// autre que la copie de son parent, sans agent, après la question de confiance
// acceptée. Il naît de trois façons : le robot d'une PR (F-110, de la fiche
// pr-<n>-worktree.json des sorties de l'agent du dépôt, après une demande de
// l'écran ; depuis la 0.12.0, c'est l'appli qui crée ce worktree, plus un
// skill : pr-place.test.ts ; la question posée à chaque fois), *Ouvrir un agent
// ici* (openHere, depuis le clic droit du parent ; la question pour un dossier
// jamais choisi) et le rattachement par git (syncFamilies, au lancement).
// Aucune page ne donne le dossier.
// Protégé : si ce test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, réglages et fichiers sur disque, git
// réel sur des dépôts d'essai) ; faux : Electron (fenêtres, et la boîte de
// dialogue, qui relève ses questions, laisse un cas agir pendant qu'elle est
// ouverte, et répond ce que le cas règle) et le SDK de Claude Code (le tour
// finit aussitôt, sans rien écrire).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { slow } from '../slow';

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
  return { Win, cwd: process.cwd(), userData: '', windows: [] as InstanceType<typeof Win>[], answer: 0, asked: [] as { title: string; detail: string }[], whileAsked: () => {} };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  shell: {}, clipboard: {}, nativeImage: {},
  dialog: { showMessageBox: async (o: { title: string; detail: string }) => { fake.asked.push(o); fake.whileAsked(); return { response: fake.answer }; } },
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

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const settle = () => new Promise((r) => setTimeout(r, slow(150)));
let root = '';
let repo = '';
let worktree = '';
let out = '';

function newRepo(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q');
  git(dir, 'commit', '-q', '--allow-empty', '-m', 'init');
}

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
  fake.windows = [];
  fake.asked = [];
  fake.answer = 1;
  fake.whileAsked = () => {};
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-worktree-')));
  root = fake.userData;
  repo = path.join(root, 'projet');
  newRepo(repo);
  worktree = path.join(root, 'projet-worktrees', 'pr-7');
  git(repo, 'worktree', 'add', '-q', '-b', 'pr-7', worktree);
  out = path.join(root, 'vibecoder-out', 'a1');
  write(path.join(out, 'pr-7.json'), JSON.stringify({ number: 7, title: 'Essai', base: 'main', head: 'feat/x', state: 'OPEN' }));
  write(path.join(root, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agents: [{ id: 'a1', dir: repo, name: 'projet', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'review', autonomy: 'guide', pr: 7 } }],
  }));
});
afterEach(() => { vi.useRealTimers(); process.chdir(fake.cwd); });


const card = (dir: string, where = out) => write(path.join(where, 'pr-7-worktree.json'), JSON.stringify({ dir, branch: 'pr-7' }));
const agents = async () => (await import('app/settings')).loadConfig().agents;

// Un agent de plus dans les réglages, comme l'enregistre « + » (dossier déjà choisi).
function addAgent(id: string, dir: string) {
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8'));
  cfg.agents.push({ id, dir, name: id, model: 'opus', effort: 'high', mode: 'default', sessionId: null });
  write(path.join(root, 'config.json'), JSON.stringify(cfg));
}

// Un autre dépôt, avec un worktree à lui ; renvoie la racine de ce worktree.
function otherWorktree() {
  const other = path.join(root, 'autre');
  newRepo(other);
  const dir = path.join(root, 'autre-worktrees', 'x');
  git(other, 'worktree', 'add', '-q', '-b', 'x', dir);
  return dir;
}

// L'écran a demandé le worktree de la PR 7 à a1 ; la fiche est là (ou non) : un passage.
async function sync() {
  const { syncWorktrees, wantWorktree } = await import('app/controllers');
  wantWorktree('a1', 7);
  await syncWorktrees();
}

// Clic droit de a1 → Worktrees → Ouvrir un agent ici, sur `dir`.
async function openHere(dir: string) {
  const { openHere: open } = await import('app/controllers');
  const parent = (await agents()).find((a) => a.id === 'a1')!;
  await open(parent, dir);
}

// Le rattachement par git (au lancement), puis l'agent a2 tel qu'enregistré.
async function familiesSynced() {
  const { syncFamilies } = await import('app/controllers');
  await syncFamilies();
  return (await agents()).find((a) => a.id === 'a2')!;
}

describe('le robot d’une PR dans un worktree', () => {
  it('jamais sans la question de confiance : Annuler → aucun robot', async () => {
    fake.answer = 0;
    card(worktree);

    await sync();

    // la question a été posée une fois…
    expect(fake.asked).toHaveLength(1);
    // … sur ce worktree…
    expect(fake.asked[0].detail).toContain(worktree);
    // … en disant que les réglages de la PR se chargeront
    expect(fake.asked[0].detail).toMatch(/PR #7.*\.claude|\.claude.*PR #7/s);
    // refusée : aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('la question est posée même pour un dossier déjà favori', async () => {
    fake.answer = 0;
    write(path.join(root, 'config.json'), JSON.stringify({
      ...JSON.parse(fs.readFileSync(path.join(root, 'config.json'), 'utf8')), agentFolders: [{ dir: worktree, color: '#22c55e' }],
    }));
    card(worktree);

    await sync();

    // favori ou non, la question a été posée
    expect(fake.asked).toHaveLength(1);
    // refusée : aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('confiance accordée : le robot « PR #7 » sur ce worktree, enfant de l’agent du dépôt', async () => {
    card(worktree);

    await sync();

    // la question a précédé le robot
    expect(fake.asked).toHaveLength(1);
    const list = await agents();
    // un seul agent de plus
    expect(list).toHaveLength(2);
    // sur ce worktree, avec les réglages de son parent, enfant de a1 pour la PR 7 (parent durable, plus temp)
    expect(list[1]).toMatchObject({
      dir: worktree, name: 'PR #7', model: 'opus', effort: 'high', mode: 'default', view: 'vibecoder',
      vibe: { flow: 'review', autonomy: 'guide', pr: 7 }, parent: { id: 'a1', pr: 7 },
    });
  });

  it('un dossier qui n’existe pas : ni question, ni robot', async () => {
    card(path.join(root, 'nulle-part'));

    await sync();

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('un autre dépôt : ni question, ni robot', async () => {
    const other = path.join(root, 'autre');
    newRepo(other);
    card(other);

    await sync();

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('le dossier de l’agent du dépôt : ni question, ni robot', async () => {
    card(repo);

    await sync();

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('un sous-dossier du dépôt : ni question, ni robot', async () => {
    fs.mkdirSync(path.join(repo, 'src'));
    card(path.join(repo, 'src'));

    await sync();

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('un sous-dossier du worktree : ni question, ni robot', async () => {
    fs.mkdirSync(path.join(worktree, 'src'));
    card(path.join(worktree, 'src'));

    await sync();

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('un fichier du worktree : ni question, ni robot', async () => {
    write(path.join(worktree, 'a.txt'), 'a');
    card(path.join(worktree, 'a.txt'));

    await sync();

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('un dossier hors de tout dépôt : ni question, ni robot', async () => {
    fs.mkdirSync(path.join(root, 'vide'));
    card(path.join(root, 'vide'));

    await sync();

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('un chemin relatif, même s’il désigne le worktree depuis le dossier courant : ni question, ni robot', async () => {
    card('projet-worktrees/pr-7');
    process.chdir(root);
    // depuis le dossier courant, ce chemin relatif désigne bien le worktree
    expect(fs.realpathSync('projet-worktrees/pr-7')).toBe(worktree);

    await sync();

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('la fiche d’un autre dossier de sorties ne compte pas : ni question, ni robot', async () => {
    card(worktree, path.join(root, 'vibecoder-out', 'a2'));

    await sync();

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('une fiche en lien symbolique ne compte pas : ni question, ni robot', async () => {
    write(path.join(root, 'ailleurs.json'), JSON.stringify({ dir: worktree, branch: 'pr-7' }));
    fs.symlinkSync(path.join(root, 'ailleurs.json'), path.join(out, 'pr-7-worktree.json'));

    await sync();

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('sans demande de l’écran, la fiche seule ne fait rien', async () => {
    card(worktree);
    const { syncWorktrees } = await import('app/controllers');

    await syncWorktrees();

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('une page ne donne jamais le dossier : un chemin dans un réglage ou dans les arguments d’une action est ignoré', async () => {
    const { state } = await import('app/state');
    const { openConversation } = await import('app/windows');
    const { panelReady, runVibeAction, setVibe, syncWorktrees } = await import('app/controllers');
    state.icon = new fake.Win() as never;
    openConversation('a1');
    const panel = fake.windows.at(-1)!;
    panel.emit('ready-to-show');
    await panelReady();
    await settle();

    setVibe({ worktree: worktree });
    setVibe({ worktree: true, dir: worktree });
    runVibeAction('open-worktree', { dir: worktree, pr: 7 });
    await settle();
    await syncWorktrees();

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });
});

describe('Ouvrir un agent ici : l’enfant d’un worktree', () => {
  it('jamais sans la question de confiance : Annuler → aucun enfant', async () => {
    fake.answer = 0;

    await openHere(worktree);

    // la question a été posée une fois…
    expect(fake.asked).toHaveLength(1);
    // … sur ce worktree
    expect(fake.asked[0].detail).toContain(worktree);
    // refusée : aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('confiance accordée : un enfant de l’agent du dépôt, sur ce worktree', async () => {
    await openHere(worktree);

    // la question a précédé l'enfant
    expect(fake.asked).toHaveLength(1);
    const list = await agents();
    // un seul agent de plus
    expect(list).toHaveLength(2);
    // sur la racine du worktree, enfant de a1 (durable)
    expect(list[1]).toMatchObject({ dir: worktree, parent: { id: 'a1' } });
  });

  it('un dossier qui n’existe pas : ni question, ni enfant', async () => {
    await openHere(path.join(root, 'nulle-part'));

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('un autre dépôt : ni question, ni enfant', async () => {
    const other = path.join(root, 'autre');
    newRepo(other);

    await openHere(other);

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('un worktree d’un autre dépôt : ni question, ni enfant', async () => {
    const dir = otherWorktree();

    await openHere(dir);

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('la copie du parent : ni question, ni enfant', async () => {
    await openHere(repo);

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('un sous-dossier du dépôt : ni question, ni enfant', async () => {
    fs.mkdirSync(path.join(repo, 'src'));

    await openHere(path.join(repo, 'src'));

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('un sous-dossier du worktree : ni question, ni enfant', async () => {
    fs.mkdirSync(path.join(worktree, 'src'));

    await openHere(path.join(worktree, 'src'));

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('un fichier du worktree : ni question, ni enfant', async () => {
    write(path.join(worktree, 'a.txt'), 'a');

    await openHere(path.join(worktree, 'a.txt'));

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('un dossier hors de tout dépôt : ni question, ni enfant', async () => {
    fs.mkdirSync(path.join(root, 'vide'));

    await openHere(path.join(root, 'vide'));

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('un chemin relatif, même s’il désigne le worktree depuis le dossier courant : ni question, ni enfant', async () => {
    process.chdir(root);
    // depuis le dossier courant, ce chemin relatif désigne bien le worktree
    expect(fs.realpathSync('projet-worktrees/pr-7')).toBe(worktree);

    await openHere('projet-worktrees/pr-7');

    // aucune question
    expect(fake.asked).toEqual([]);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('un worktree qui a déjà un agent : ni question, ni second agent', async () => {
    addAgent('a2', worktree);

    await openHere(worktree);

    // aucune question
    expect(fake.asked).toEqual([]);
    // toujours un seul agent sur ce worktree
    expect((await agents()).filter((a) => a.dir === worktree)).toHaveLength(1);
  });

  it('le worktree retiré pendant la question : aucun enfant, même accordée', async () => {
    // pendant que la question est ouverte, le worktree disparaît
    fake.whileAsked = () => { git(repo, 'worktree', 'remove', '--force', worktree); };

    await openHere(worktree);

    // la question a bien été posée (le worktree a disparu pendant qu'elle était ouverte)
    expect(fake.asked).toHaveLength(1);
    // aucun agent de plus
    expect(await agents()).toHaveLength(1);
  });

  it('un agent ouvert sur le worktree pendant la question : pas de second agent, même accordée', async () => {
    // pendant que la question est ouverte, un agent est enregistré sur ce worktree
    fake.whileAsked = () => { addAgent('a2', worktree); };

    await openHere(worktree);

    // la question a bien été posée (l'agent est arrivé pendant qu'elle était ouverte)
    expect(fake.asked).toHaveLength(1);
    // toujours un seul agent sur ce worktree
    expect((await agents()).filter((a) => a.dir === worktree)).toHaveLength(1);
  });
});

describe('le rattachement par git : un agent existant ne devient enfant que sur la racine d’un worktree du dépôt', () => {
  it('un agent à la racine d’un worktree du dépôt : enfant de l’agent du dépôt', async () => {
    addAgent('a2', worktree);

    const a2 = await familiesSynced();

    // rattaché à a1
    expect(a2.parent).toMatchObject({ id: 'a1' });
  });

  it('un agent sur un sous-dossier d’un worktree du dépôt : jamais enfant', async () => {
    fs.mkdirSync(path.join(worktree, 'src'));
    addAgent('a2', path.join(worktree, 'src'));

    const a2 = await familiesSynced();

    // aucun parent
    expect(a2.parent ?? null).toBeNull();
  });

  it('un agent sur un worktree d’un autre dépôt : jamais enfant de l’agent du dépôt', async () => {
    addAgent('a2', otherWorktree());

    const a2 = await familiesSynced();

    // aucun parent
    expect(a2.parent ?? null).toBeNull();
  });

  it('un agent sur un sous-dossier de la copie principale : jamais enfant', async () => {
    fs.mkdirSync(path.join(repo, 'src'));
    addAgent('a2', path.join(repo, 'src'));

    const a2 = await familiesSynced();

    // aucun parent
    expect(a2.parent ?? null).toBeNull();
  });
});
