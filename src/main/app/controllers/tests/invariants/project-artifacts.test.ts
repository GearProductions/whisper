// Invariants du dossier d'artefacts d'un projet (note 0.13.0,
// docs/tickets/fix/0.13.0-fix-and-improvements.md, sujet 8, « Ce que ça ne doit pas
// faire ») :
//   - effacer le dossier du projet en retirant un agent, un robot ou un worktree ;
//   - montrer ou servir un artefact d'un autre projet, ou un fichier hors de ce dossier
//     (I-37 : par son id, ni lien ni chemin venu de la page).
// Le dépôt, ses worktrees et leurs robots partagent le même dossier ; un dossier hors git
// est son propre projet. Les règles générales du panneau, du schéma et de l'ajout :
// artifacts.test.ts et artifact-moves.test.ts ; le déplacement des anciens artefacts :
// artifact-migration.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur disque,
// vrais liens symboliques, git réel sur un dépôt d'essai et son worktree, le vrai serveur
// du schéma) ; faux : Electron (fenêtres qui relèvent ce qu'on leur envoie ;
// protocol.handle qui garde le gestionnaire du schéma ; boîtes de dialogue), l'éditeur
// (relève ce qu'on lui fait ouvrir) et le SDK de Claude Code (aucun tour ne commence ici).
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
  return {
    Win, userData: '', windows: [] as InstanceType<typeof Win>[],
    schemes: new Map<string, (req: Request) => Response | Promise<Response>>(),
    // Le dossier que l'utilisateur choisit à Copier dans le projet.
    pick: { canceled: true, filePaths: [] as string[] },
    edited: [] as string[],
  };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  protocol: {
    registerSchemesAsPrivileged: () => {},
    handle: (scheme: string, fn: (req: Request) => Response | Promise<Response>) => { fake.schemes.set(scheme, fn); },
  },
  dialog: { showOpenDialog: async () => fake.pick, showMessageBox: async () => ({ response: 0 }) },
  shell: {}, clipboard: {}, nativeImage: {},
}));

vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: () => Object.assign((async function* run() {}()), { setPermissionMode: async () => {}, setModel: async () => {}, interrupt: async () => {} }),
  }),
}));

vi.mock('technicals/editor', () => ({
  findEditor: () => ({ name: 'éditeur', open: () => {}, openFile: (file: string) => { fake.edited.push(file); } }),
}));

vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${process.cwd()}/resources/${name}`,
}));

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const read = (file: string) => fs.readFileSync(file, 'utf8');
const settle = () => new Promise((r) => setTimeout(r, 300));
// Liens de fichier : sans équivalent simple sous Windows.
const posix = describe.skipIf(process.platform === 'win32');

let repo = '';      // le dossier de a1, un dépôt git
let worktree = '';  // le dossier de a2, un worktree de ce dépôt
let solo = '';      // le dossier de a3, hors git
let other = '';     // le dossier de a4, un autre dépôt
let lone = '';      // le dossier de a6, hors git aussi
let chosen = '';    // le dossier choisi à Copier dans le projet
let outside = '';   // un dossier hors de tout
let secret = '';    // un fichier hors de tout
let project = '';   // le dossier d'artefacts du dépôt et de son worktree
let foreign = '';   // celui de l'autre dépôt

const SECRET = 'SECRET_DEHORS';
const MINE = 'TEXTE_DU_PROJET';
const THEIRS = 'TEXTE_DE_L_AUTRE_PROJET';

// Ce que la page reçoit : le dernier relevé, et les textes de fichier poussés.
type Artifact = { id: string; name: string; url: string | null };
type View = { artifacts?: Artifact[]; artifactsDir?: string };
const panel = () => fake.windows.at(-1)!;
const survey = () => panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as View;
const names = () => (survey().artifacts ?? []).map((a) => a.name);
const texts = () => panel().sent.filter(([ch]) => ch === 'conv:vibeCode').map(([, c]) => c as { text: string | null } | null).flatMap((c) => (c && c.text !== null ? [c.text] : []));
// L'artefact que le dernier relevé donne sous ce nom ; sans lui, le cas ne peut pas commencer.
function artifact(name: string) {
  const a = (survey().artifacts ?? []).find((x) => x.name === name);
  if (!a) throw new Error(`le relevé ne donne aucun artefact ${name}`);
  return a;
}
// Tout ce qu'il y a sous un dossier, sans suivre aucun lien : chemin → contenu.
function snapshot(dir: string) {
  const found: Record<string, string> = {};
  for (const name of fs.readdirSync(dir, { recursive: true }).map(String)) {
    const p = path.join(dir, name);
    const st = fs.lstatSync(p);
    found[name] = st.isSymbolicLink() ? `lien:${fs.readlinkSync(p)}` : st.isDirectory() ? 'dossier' : read(p);
  }
  return found;
}

const AGENT = { model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder', vibe: { flow: 'create', autonomy: 'guide', pr: null } };

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  fake.windows = [];
  fake.schemes = new Map();
  fake.edited = [];
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-project-artifacts-')));
  repo = path.join(fake.userData, 'projet');
  worktree = path.join(fake.userData, 'projet-worktrees', 'enfant');
  solo = path.join(fake.userData, 'seul');
  other = path.join(fake.userData, 'autre');
  lone = path.join(fake.userData, 'isole');
  chosen = path.join(fake.userData, 'choisi');
  outside = path.join(fake.userData, 'dehors');
  secret = path.join(outside, 'secret.md');
  for (const d of [repo, solo, other, lone, chosen]) fs.mkdirSync(d, { recursive: true });
  fake.pick = { canceled: false, filePaths: [chosen] };
  write(secret, SECRET);
  for (const d of [repo, other]) {
    git(d, 'init', '-q', '-b', 'main');
    write(path.join(d, 'README.md'), 'projet');
    git(d, 'add', '.');
    git(d, 'commit', '-q', '-m', 'init');
    git(d, 'checkout', '-q', '-b', 'feat/0.13.0-essai');
  }
  git(repo, 'worktree', 'add', '-q', '-b', 'feat/0.13.0-enfant', worktree);
  write(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agents: [
      { ...AGENT, id: 'a1', dir: repo, name: 'parent' },
      { ...AGENT, id: 'a2', dir: worktree, name: 'enfant', parent: { id: 'a1' } },
      { ...AGENT, id: 'a3', dir: solo, name: 'seul' },
      { ...AGENT, id: 'a4', dir: other, name: 'autre' },
      { ...AGENT, id: 'a6', dir: lone, name: 'isolé' },
    ],
  }));
  const { projectArtifactsPath } = await import('app/controllers');
  project = projectArtifactsPath(repo);
  foreign = projectArtifactsPath(other);
  // Le même nom dans les deux projets, deux textes ; et un nom propre à l'autre.
  write(path.join(project, 'notes.md'), MINE);
  write(path.join(foreign, 'notes.md'), THEIRS);
  write(path.join(foreign, 'plan.md'), THEIRS);
});
afterEach(() => { vi.useRealTimers(); });

const agentOf = async (id: string) => {
  const { loadConfig } = await import('app/settings');
  const agent = loadConfig().agents.find((a) => a.id === id);
  if (!agent) throw new Error(`pas d'agent ${id} dans la config`);
  return agent;
};
const ids = async () => (await import('app/settings')).loadConfig().agents.map((a) => a.id);

// Le panneau ouvert sur cet agent, en VibeCoder, son premier relevé reçu.
async function open(id: string) {
  const { state } = await import('app/state');
  const { openConversation } = await import('app/windows');
  const { panelReady } = await import('app/controllers');
  state.icon = new fake.Win() as never;
  openConversation(id);
  fake.windows.at(-1)!.emit('ready-to-show');
  await panelReady();
  await settle();
}
async function follow(id: unknown) {
  const { followCode } = await import('app/controllers');
  followCode(id);
  await settle();
}
async function openInEditor(id: unknown) {
  const { openVibeItem } = await import('app/controllers');
  await openVibeItem(id);
  await settle();
}
async function copy(artifactId: unknown) {
  const { runVibeAction } = await import('app/controllers');
  runVibeAction('copy-artifact', { direct: true, artifact: artifactId });
  await settle();
}
// Une requête au schéma, branché comme au démarrage.
async function request(url: string) {
  const { serveFiles } = await import('technicals/file-scheme');
  const { resolveArtifact } = await import('app/controllers');
  serveFiles('vibe-artifact', resolveArtifact);
  return await fake.schemes.get('vibe-artifact')!(new Request(url));
}

describe('retirer ne touche pas au dossier du projet', () => {
  it('retirer l’agent du dépôt : le dossier ne change pas, son worktree le garde', async () => {
    const before = snapshot(project);
    const { removeAgent } = await import('app/controllers');

    await removeAgent('a1');

    // témoin : il est bien parti
    expect(await ids()).not.toContain('a1');
    // le dossier n'a pas changé
    expect(snapshot(project)).toEqual(before);
  });

  it('retirer le robot du worktree : le dossier ne change pas', async () => {
    const before = snapshot(project);
    const { removeAgent } = await import('app/controllers');

    await removeAgent('a2');

    // témoin : il est bien parti
    expect(await ids()).not.toContain('a2');
    // le dossier n'a pas changé
    expect(snapshot(project)).toEqual(before);
  });

  it('tous les agents du projet retirés, un agent rouvert sur le dépôt : il retrouve les artefacts', async () => {
    const { newAgent, removeAgent } = await import('app/controllers');
    const { loadConfig, updateAgent } = await import('app/settings');
    await removeAgent('a2');
    await removeAgent('a1');

    newAgent(repo);
    const id = loadConfig().agents.find((a) => a.dir === repo)!.id;
    updateAgent(id, { view: 'vibecoder', vibe: AGENT.vibe } as never);
    await open(id);

    // témoin : le premier agent est bien parti
    expect(id).not.toBe('a1');
    // il voit l'artefact du projet
    expect(names()).toContain('notes.md');
  });

  it('un dossier caché écrit là : il reste quand le robot qui l’a écrit est retiré', async () => {
    write(path.join(project, '.robot', 'interne.md'), 'CACHE');
    const { removeWorktreeChild } = await import('app/controllers');

    await removeWorktreeChild(await agentOf('a2'));

    // témoin : le robot est bien parti
    expect(await ids()).not.toContain('a2');
    // il est toujours là, avec son texte
    expect(read(path.join(project, '.robot', 'interne.md'))).toBe('CACHE');
  });

  it('un dossier caché écrit là : le panneau ne le liste pas', async () => {
    write(path.join(project, '.robot', 'interne.md'), 'CACHE');

    await open('a1');

    // témoin : le relevé liste bien les artefacts
    expect(names()).toContain('notes.md');
    // aucun de ses fichiers n'y est
    expect(names().join()).not.toContain('interne.md');
  });

  // Il n'a pas encore pu partir vers le dossier du projet : effacer les sorties ne l'emporte pas.
  it('Retirer le worktree : un ancien artefact pas encore parti reste, le reste des sorties part', async () => {
    const outOf = path.join(fake.userData, 'vibecoder-out', 'a2');
    write(path.join(outOf, 'artifacts', 'sous', 'x.md'), 'BLOQUE');
    write(path.join(outOf, 'commit.md'), 'SORTIE');
    const { removeWorktreeChild } = await import('app/controllers');

    await removeWorktreeChild(await agentOf('a2'));

    // il est toujours là
    expect(read(path.join(outOf, 'artifacts', 'sous', 'x.md'))).toBe('BLOQUE');
    // témoin : l'effacement a bien eu lieu
    expect(fs.existsSync(path.join(outOf, 'commit.md'))).toBe(false);
  });
});

posix('retirer : un lien n’est jamais suivi', () => {
  it('Retirer le worktree, ses anciens artifacts/ sont un lien : le dehors reste intact', async () => {
    const outOf = path.join(fake.userData, 'vibecoder-out', 'a2');
    fs.mkdirSync(outOf, { recursive: true });
    fs.symlinkSync(outside, path.join(outOf, 'artifacts'));
    const before = snapshot(outside);
    const { removeWorktreeChild } = await import('app/controllers');

    await removeWorktreeChild(await agentOf('a2'));

    // témoin : le robot est bien parti
    expect(await ids()).not.toContain('a2');
    // le dehors n'a pas changé
    expect(snapshot(outside)).toEqual(before);
  });
});

describe('le dépôt, ses worktrees et leurs robots partagent le même dossier', () => {
  it('le robot du worktree voit l’artefact du dépôt', async () => {
    await open('a2');

    await follow(artifact('notes.md').id);

    // la page reçoit le texte de l'artefact du projet
    expect(texts()).toContain(MINE);
  });

  it('un artefact ajouté par le robot du worktree : l’agent du dépôt le voit, le worktree n’a rien reçu', async () => {
    const dropped = path.join(fake.userData, 'depose.md');
    write(dropped, 'DEPOSE');
    const { addArtifacts } = await import('app/controllers');

    await addArtifacts(await agentOf('a2'), [dropped]);
    await open('a1');

    // l'agent du dépôt le voit
    expect(names()).toContain('depose.md');
    // git ne voit rien de changé dans le worktree
    expect(git(worktree, 'status', '--porcelain').toString()).toBe('');
  });

  it('Claude Code reçoit le dossier du projet, à côté de ses sorties, pas celui d’un autre projet', async () => {
    const { launchOptions, projectArtifactsPath } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    const cfg = loadConfig();

    const { dirs } = launchOptions(await agentOf('a2'), cfg);

    // le dossier du projet y est
    expect(dirs).toContain(projectArtifactsPath(worktree));
    // celui d'un autre projet n'y est pas
    expect(dirs).not.toContain(foreign);
  });

  // Le @ écrit ce chemin : il doit être celui du projet de l'agent affiché.
  it('le relevé donne à la page le dossier du projet de l’agent affiché', async () => {
    await open('a2');

    // le dossier du projet
    expect(survey().artifactsDir).toBe(project);
    // pas celui d'un autre projet
    expect(survey().artifactsDir).not.toBe(foreign);
  });

  it('le dossier du projet n’est ni dans le dépôt ni dans ses sorties', () => {
    const fromRepo = path.relative(repo, project);
    const fromOutputs = path.relative(path.join(fake.userData, 'vibecoder-out'), project);

    // hors du dépôt
    expect(fromRepo.startsWith('..')).toBe(true);
    // hors des sorties
    expect(fromOutputs.startsWith('..')).toBe(true);
  });
});

describe('jamais un artefact d’un autre projet (I-37)', () => {
  it('le relevé ne liste pas un artefact d’un autre dépôt', async () => {
    await open('a1');

    // témoin : l'artefact du projet est listé
    expect(names()).toContain('notes.md');
    // celui de l'autre dépôt n'y est pas
    expect(names()).not.toContain('plan.md');
  });

  it('deux projets, le même nom : la page ne reçoit que le texte de son projet', async () => {
    await open('a1');

    await follow(artifact('notes.md').id);

    // son texte
    expect(texts()).toContain(MINE);
    // jamais celui de l'autre projet
    expect(texts()).not.toContain(THEIRS);
  });

  it('deux projets, le même nom : le schéma ne sert que le fichier de son projet', async () => {
    await open('a1');

    const res = await request(artifact('notes.md').url ?? 'vibe-artifact://a1/a0');

    // jamais celui de l'autre projet
    expect(await res.text()).not.toContain(THEIRS);
  });

  it('l’éditeur n’ouvre que le fichier de son projet', async () => {
    await open('a1');

    await openInEditor(artifact('notes.md').id);

    // ce fichier-là, et lui seul
    expect(fake.edited.map((f) => fs.realpathSync.native(f))).toEqual([path.join(project, 'notes.md')]);
  });

  it('l’autre dépôt affiché : il ne voit pas les artefacts du premier', async () => {
    write(path.join(project, 'propre.md'), MINE);

    await open('a4');

    // témoin : son propre artefact est listé
    expect(names()).toContain('plan.md');
    // celui du premier dépôt n'y est pas
    expect(names()).not.toContain('propre.md');
  });

  it('un dossier hors git : il ne voit pas les artefacts du dépôt', async () => {
    const { projectArtifactsPath } = await import('app/controllers');
    write(path.join(projectArtifactsPath(solo), 'seul.md'), 'SEUL');

    await open('a3');

    // témoin : son propre artefact est listé
    expect(names()).toContain('seul.md');
    // celui du dépôt n'y est pas
    expect(names()).not.toContain('notes.md');
  });

  it('deux dossiers hors git : aucun ne voit les artefacts de l’autre', async () => {
    const { projectArtifactsPath } = await import('app/controllers');
    write(path.join(projectArtifactsPath(solo), 'seul.md'), 'SEUL');
    write(path.join(projectArtifactsPath(lone), 'isole.md'), 'ISOLE');

    await open('a3');

    // témoin : son propre artefact est listé
    expect(names()).toContain('seul.md');
    // celui de l'autre n'y est pas
    expect(names()).not.toContain('isole.md');
  });

  // Les dossiers de projet sont voisins : un `../` mène droit chez l'autre.
  it('un chemin qui remonte vers le dossier de l’autre projet : rien n’est lu', async () => {
    await open('a1');

    await follow(`../${path.basename(foreign)}/plan.md`);

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  it('un chemin qui remonte vers le dossier de l’autre projet : rien n’est servi', async () => {
    await open('a1');

    const res = await request(`vibe-artifact://a1/${encodeURIComponent(`../${path.basename(foreign)}/plan.md`)}`);

    // la réponse est un refus
    expect(res.ok).toBe(false);
    // le texte de l'autre projet n'y est pas
    expect(await res.text()).not.toContain(THEIRS);
  });

  it('le chemin absolu d’un artefact de l’autre projet : rien n’est lu', async () => {
    await open('a1');

    await follow(path.join(foreign, 'plan.md'));

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  // Le chemin que le relevé donne pour le texte du @ : aucun canal ne le reçoit en retour.
  it('le chemin que donne le relevé, renvoyé par la page : rien n’est lu', async () => {
    await open('a1');

    await follow(path.join(survey().artifactsDir ?? project, 'notes.md'));

    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  it('un ancien artefact pas encore parti n’est pas dans le dossier du projet : il n’est pas montré', async () => {
    write(path.join(fake.userData, 'vibecoder-out', 'a1', 'artifacts', 'ancien.md'), 'ANCIEN');

    await open('a1');

    // témoin : l'artefact du projet est listé
    expect(names()).toContain('notes.md');
    // l'ancien n'y est pas
    expect(names()).not.toContain('ancien.md');
  });
});

posix('le dossier du projet remplacé par un lien : rien du dehors', () => {
  // Le dossier du projet devient un lien vers le dehors.
  const linkProject = () => {
    fs.rmSync(project, { recursive: true });
    fs.symlinkSync(outside, project);
  };

  it('le relevé ne liste pas ce qu’il y a derrière', async () => {
    linkProject();

    await open('a1');

    // le fichier du dehors n'est pas listé
    expect(names()).not.toContain('secret.md');
  });

  it('remplacé après le relevé : le texte du dehors n’est pas poussé', async () => {
    write(path.join(outside, 'notes.md'), SECRET);
    await open('a1');
    const { id } = artifact('notes.md');
    linkProject();

    await follow(id);

    // le texte du dehors n'est jamais poussé
    expect(texts()).not.toContain(SECRET);
  });

  it('remplacé après le relevé : le schéma ne sert pas le dehors', async () => {
    write(path.join(outside, 'capture.png'), SECRET);
    write(path.join(project, 'capture.png'), MINE);
    await open('a1');
    const url = artifact('capture.png').url!;
    linkProject();

    const res = await request(url);

    // le texte du dehors n'y est pas
    expect(await res.text()).not.toContain(SECRET);
  });

  it('remplacé après le relevé : l’éditeur n’ouvre rien', async () => {
    write(path.join(outside, 'notes.md'), SECRET);
    await open('a1');
    const { id } = artifact('notes.md');
    linkProject();

    await openInEditor(id);

    // l'éditeur n'ouvre rien
    expect(fake.edited).toEqual([]);
  });

  it('remplacé après le relevé : rien du dehors n’est copié', async () => {
    write(path.join(outside, 'notes.md'), SECRET);
    await open('a1');
    const { id } = artifact('notes.md');
    linkProject();

    await copy(id);

    // le texte du dehors n'arrive pas dans le dossier choisi
    expect(Object.values(snapshot(chosen))).not.toContain(SECRET);
  });
});
