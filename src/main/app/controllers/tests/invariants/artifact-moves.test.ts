// Invariants du sort des artefacts (note 0.13.0,
// docs/tickets/feat/0.13.0-ameliorer-artefacts.md, « Ce que ça ne doit pas
// faire ») ; les artefacts sont dans le dossier du projet, le transfert au parent et le
// retour à l'agent rouvert ont disparu (note
// docs/tickets/fix/0.13.0-fix-and-improvements.md, sujet 8 : seule retouche acceptée, ces
// cas retirés, le reste sur le dossier du projet, ces règles gardées) :
//   - perdre un artefact : retirer un agent, un robot ou un worktree ne touche pas au
//     dossier du projet ;
//   - écraser un artefact existant au dépôt ;
//   - modifier, déplacer ou supprimer ce qui est déposé ou choisi ;
//   - écrire ailleurs que dans le dossier du projet de l'agent affiché à l'ajout (un
//     nom en `..` compris) ;
//   - suivre un lien : ni un lien déposé ou choisi, seul ou dans un dossier, ni un
//     dossier du projet qui serait un lien ;
//   - lire un fichier désigné par un chemin venu de la page (I-37) : conv:vibeRun
//     ne prend jamais de chemin, et ce que reçoit conv:vibeDrop est revérifié.
// Le parcours lui-même (numéros, rapport, liens passés) :
// technicals/file-tree/tests/invariants/file-tree.test.ts ; le pont :
// tests/invariants/vibe-drop.test.ts ; le déplacement des anciens artefacts :
// artifact-migration.test.ts ; le partage entre les robots d'un projet :
// project-artifacts.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, réglages et fichiers sur disque, vrais liens
// symboliques, git réel sur un dépôt d'essai et son worktree) ; faux :
// Electron (fenêtres qui relèvent ce qu'on leur envoie, boîte de dialogue qui
// répond ce que le cas règle) et le SDK de Claude Code (aucun tour ne commence ici).
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
  return {
    // cwd : le dossier du projet, retenu avant qu'un cas change de dossier courant.
    Win, cwd: process.cwd(), userData: '', windows: [] as InstanceType<typeof Win>[],
    // Les boîtes de dialogue ouvertes, et ce que l'utilisateur y choisit.
    picks: [] as unknown[],
    pick: { canceled: true, filePaths: [] as string[] },
  };
});

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class extends fake.Win { constructor() { super(); fake.windows.push(this); } },
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  protocol: { registerSchemesAsPrivileged: () => {}, handle: () => {} },
  dialog: {
    showOpenDialog: async (...a: unknown[]) => { fake.picks.push(a.at(-1)); return fake.pick; },
    showMessageBox: async () => ({ response: 0 }),
  },
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

vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${fake.cwd}/resources/${name}`,
}));

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const read = (file: string) => fs.readFileSync(file, 'utf8');
const settle = () => new Promise((r) => setTimeout(r, slow(300)));
// Liens de fichier et droits : sans équivalent simple sous Windows.
const posix = describe.skipIf(process.platform === 'win32');

let repo = '';      // le dossier du parent (a1), un dépôt git
let worktree = '';  // le dossier de l'enfant (a2), un worktree de ce dépôt
let solo = '';      // le dossier de l'agent sans parent (a3)
let other = '';     // le dossier d'un autre agent (a4)
let drops = '';     // ce que l'utilisateur dépose ou choisit, hors de tout
let outside = '';   // un dossier hors de tout, à ne pas toucher
let secret = '';    // un fichier hors de tout

const SECRET = 'SECRET_DEHORS';
// Le dossier d'artefacts du projet de chaque agent.
let projects: Record<string, string> = {};
const arts = (id: string) => projects[id];
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
// Les contenus des fichiers sous un dossier, où qu'ils soient.
const contents = (dir: string) => (fs.existsSync(dir) ? Object.values(snapshot(dir)) : []);
// Tout le profil, sauf le dossier du projet de cet agent.
function outsideArts(id: string) {
  const under = path.relative(fake.userData, arts(id));
  return Object.entries(snapshot(fake.userData)).filter(([name]) => name !== under && !name.startsWith(under + path.sep));
}
// Le dossier du projet de cet agent remplacé par un lien.
function linkArts(id: string, target: string) {
  fs.rmSync(arts(id), { recursive: true, force: true });
  fs.mkdirSync(path.dirname(arts(id)), { recursive: true });
  fs.symlinkSync(target, arts(id));
}

const AGENT = { model: 'opus', effort: 'high', mode: 'default', sessionId: null };

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  fake.windows = [];
  fake.picks = [];
  fake.pick = { canceled: true, filePaths: [] };
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-artifact-moves-')));
  repo = path.join(fake.userData, 'projet');
  worktree = path.join(fake.userData, 'projet-worktrees', 'enfant');
  solo = path.join(fake.userData, 'seul');
  other = path.join(fake.userData, 'autre');
  drops = path.join(fake.userData, 'depose');
  outside = path.join(fake.userData, 'dehors');
  secret = path.join(outside, 'secret.md');
  fs.mkdirSync(repo, { recursive: true });
  fs.mkdirSync(solo, { recursive: true });
  fs.mkdirSync(other, { recursive: true });
  fs.mkdirSync(drops, { recursive: true });
  write(secret, SECRET);
  git(repo, 'init', '-q', '-b', 'main');
  write(path.join(repo, 'README.md'), 'projet');
  git(repo, 'add', '.');
  git(repo, 'commit', '-q', '-m', 'init');
  git(repo, 'checkout', '-q', '-b', 'feat/0.13.0-essai');
  git(repo, 'worktree', 'add', '-q', '-b', 'feat/0.13.0-enfant', worktree);
  write(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agents: [
      { ...AGENT, id: 'a1', dir: repo, name: 'parent', view: 'vibecoder', vibe: { flow: 'create', autonomy: 'guide', pr: null } },
      { ...AGENT, id: 'a2', dir: worktree, name: 'enfant', parent: { id: 'a1' } },
      { ...AGENT, id: 'a3', dir: solo, name: 'seul' },
      { ...AGENT, id: 'a4', dir: other, name: 'autre' },
    ],
  }));
  const { projectArtifactsPath } = await import('app/controllers');
  projects = { a1: projectArtifactsPath(repo), a2: projectArtifactsPath(worktree), a3: projectArtifactsPath(solo), a4: projectArtifactsPath(other) };
});
afterEach(() => { vi.useRealTimers(); process.chdir(fake.cwd); });

const agentOf = async (id: string) => {
  const { loadConfig } = await import('app/settings');
  const agent = loadConfig().agents.find((a) => a.id === id);
  if (!agent) throw new Error(`pas d'agent ${id} dans la config`);
  return agent;
};
const ids = async () => (await import('app/settings')).loadConfig().agents.map((a) => a.id);
// Un agent de plus dans les réglages.
function addAgent(agent: object) {
  const file = path.join(fake.userData, 'config.json');
  const cfg = JSON.parse(read(file));
  cfg.agents.push({ ...AGENT, name: 'robot', ...agent });
  write(file, JSON.stringify(cfg));
}

// Le panneau ouvert sur a1, en VibeCoder, son premier relevé reçu.
async function open() {
  const { state } = await import('app/state');
  const { openConversation } = await import('app/windows');
  const { panelReady } = await import('app/controllers');
  state.icon = new fake.Win() as never;
  openConversation('a1');
  fake.windows.at(-1)!.emit('ready-to-show');
  await panelReady();
  await settle();
}
// Les ids des actions du dernier relevé.
const shownActions = () => {
  const views = fake.windows.at(-1)!.sent.filter(([ch]) => ch === 'conv:vibe');
  return ((views.at(-1)?.[1] as { actions?: { id: string }[] } | undefined)?.actions ?? []).map((a) => a.id);
};

describe('sans parent : rien ne part', () => {
  it('retiré sans parent : les artefacts de son projet restent à leur place', async () => {
    write(path.join(arts('a3'), 'rapport.md'), 'SEUL');
    const before = snapshot(arts('a3'));
    const { removeAgent } = await import('app/controllers');

    await removeAgent('a3');

    // témoin : il est bien parti
    expect(await ids()).not.toContain('a3');
    // rien n'a bougé
    expect(snapshot(arts('a3'))).toEqual(before);
  });
});

describe('removeChild (le relevé, Retirer le worktree) : les artefacts ne partent pas avec les sorties', () => {
  // Le relevé retire seul le robot dont le parent est parti (F-110), par removeChild, sans parent.
  it('le robot d’une PR retiré par le relevé, son parent parti : ses artefacts restent', async () => {
    addAgent({ id: 'a5', dir: other, temp: { parent: 'parti', pr: 7 } });
    write(path.join(arts('a4'), 'rapport.md'), 'ROBOT');
    const { syncWorktrees } = await import('app/controllers');

    await syncWorktrees();

    // témoin : le robot est bien parti
    expect(await ids()).not.toContain('a5');
    // son artefact est toujours là
    expect(read(path.join(arts('a4'), 'rapport.md'))).toBe('ROBOT');
  });

  // La fiche de la PR a disparu, le parent est là : le relevé le retire, l'artefact ne bouge pas.
  it('le robot d’une PR retiré par le relevé, son parent là : ses artefacts restent', async () => {
    addAgent({ id: 'a5', dir: worktree, temp: { parent: 'a1', pr: 7 } });
    write(path.join(arts('a1'), 'rapport.md'), 'ROBOT');
    const { syncWorktrees } = await import('app/controllers');

    await syncWorktrees();

    // témoin : le robot est bien parti
    expect(await ids()).not.toContain('a5');
    // son artefact est toujours là
    expect(read(path.join(arts('a1'), 'rapport.md'))).toBe('ROBOT');
  });

  it('Retirer le worktree : les artefacts restent dans le dossier du projet, le worktree est parti', async () => {
    write(path.join(arts('a1'), 'rapport.md'), 'ENFANT');
    const { removeWorktreeChild } = await import('app/controllers');

    await removeWorktreeChild(await agentOf('a2'));

    // témoin : l'enfant est bien parti
    expect(await ids()).not.toContain('a2');
    // son artefact est toujours là
    expect(read(path.join(arts('a1'), 'rapport.md'))).toBe('ENFANT');
  });
});

describe('à l’ajout : copié dans le dossier du projet, l’original intact', () => {
  it('témoin : un fichier déposé arrive dans le dossier du projet', async () => {
    write(path.join(drops, 'rapport.md'), 'DEPOSE');
    const { addArtifacts } = await import('app/controllers');

    const r = await addArtifacts(await agentOf('a1'), [path.join(drops, 'rapport.md')]);

    // accepté
    expect(r.ok).toBe(true);
    // il y est, avec son texte
    expect(read(path.join(arts('a1'), 'rapport.md'))).toBe('DEPOSE');
  });

  it('un artefact du même nom : il garde son texte, le déposé arrive', async () => {
    write(path.join(arts('a1'), 'rapport.md'), 'ANCIEN');
    write(path.join(drops, 'rapport.md'), 'DEPOSE');
    const { addArtifacts } = await import('app/controllers');

    await addArtifacts(await agentOf('a1'), [path.join(drops, 'rapport.md')]);

    // l'existant n'a pas changé
    expect(read(path.join(arts('a1'), 'rapport.md'))).toBe('ANCIEN');
    // le déposé est arrivé
    expect(contents(arts('a1'))).toContain('DEPOSE');
  });

  it('un fichier : l’original reste à sa place, même texte, même date', async () => {
    const file = path.join(drops, 'rapport.md');
    write(file, 'ORIGINAL');
    const before = fs.statSync(file).mtimeMs;
    const { addArtifacts } = await import('app/controllers');

    await addArtifacts(await agentOf('a1'), [file]);

    // témoin : la copie est arrivée
    expect(contents(arts('a1'))).toContain('ORIGINAL');
    // même texte
    expect(read(file)).toBe('ORIGINAL');
    // même date de modification
    expect(fs.statSync(file).mtimeMs).toBe(before);
  });

  it('un dossier : tout y reste, à la même place, avec le même texte', async () => {
    write(path.join(drops, 'lot', 'a.md'), 'A');
    write(path.join(drops, 'lot', 'sous', 'b.md'), 'B');
    const before = snapshot(drops);
    const { addArtifacts } = await import('app/controllers');

    await addArtifacts(await agentOf('a1'), [path.join(drops, 'lot')]);

    // témoin : la copie est arrivée
    expect(contents(arts('a1'))).toContain('B');
    // l'original n'a pas changé
    expect(snapshot(drops)).toEqual(before);
  });

  it('rien n’est écrit ailleurs que dans le dossier du projet de cet agent', async () => {
    write(path.join(drops, 'lot', 'a.md'), 'A');
    fs.mkdirSync(path.dirname(arts('a1')), { recursive: true });
    const before = outsideArts('a1');
    const { addArtifacts } = await import('app/controllers');

    await addArtifacts(await agentOf('a1'), [path.join(drops, 'lot')]);

    // témoin : la copie est arrivée
    expect(contents(arts('a1'))).toContain('A');
    // rien d'autre n'a changé
    expect(outsideArts('a1')).toEqual(before);
  });

  // Son nom de base est `..` : le mettre dans le dossier du projet, c'est écrire au-dessus.
  it('un chemin dont le nom est `..` : rien n’est écrit', async () => {
    write(path.join(drops, 'x.md'), 'DEPOSE');
    fs.mkdirSync(path.join(drops, 'sous'));
    const before = snapshot(fake.userData);
    const { addArtifacts } = await import('app/controllers');

    const r = await addArtifacts(await agentOf('a1'), [`${drops}${path.sep}sous${path.sep}..`]);

    // refusé
    expect(r.ok).toBe(false);
    // rien n'a changé, dans le dossier du projet ni ailleurs
    expect(snapshot(fake.userData)).toEqual(before);
  });

  // path.resolve l'effacerait, et le chemin aurait l'air sain.
  it('un chemin avec un `..` au milieu : le fichier n’est pas lu', async () => {
    fs.mkdirSync(path.join(drops, 'sous'));
    const { addArtifacts } = await import('app/controllers');

    const r = await addArtifacts(await agentOf('a1'), [`${drops}${path.sep}sous${path.sep}..${path.sep}..${path.sep}dehors${path.sep}secret.md`]);

    // refusé
    expect(r.ok).toBe(false);
    // le fichier n'est pas dans le dossier du projet
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  // Ce chemin relatif, sans `..`, mène bien au fichier depuis le dossier courant du principal.
  it('un chemin relatif : le fichier n’est pas lu', async () => {
    const { addArtifacts } = await import('app/controllers');
    const agent = await agentOf('a1');
    process.chdir(outside);

    const r = await addArtifacts(agent, [path.basename(secret)]);

    // refusé
    expect(r.ok).toBe(false);
    // le fichier n'est pas dans le dossier du projet
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  it('autre chose qu’une liste : rien n’est lu', async () => {
    const { addArtifacts } = await import('app/controllers');

    const r = await addArtifacts(await agentOf('a1'), secret);

    // refusé
    expect(r.ok).toBe(false);
    // le fichier n'est pas dans le dossier du projet
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  // Un File construit par la page : le pont envoie un chemin vide.
  it('un chemin vide : rien n’est lu', async () => {
    const { addArtifacts } = await import('app/controllers');

    const r = await addArtifacts(await agentOf('a1'), ['']);

    // refusé
    expect(r.ok).toBe(false);
    // rien dans le dossier du projet
    expect(contents(arts('a1'))).toEqual([]);
  });
});

posix('à l’ajout : un lien n’est jamais suivi', () => {
  it('un lien vers un fichier, seul : sa cible n’est pas copiée', async () => {
    fs.symlinkSync(secret, path.join(drops, 'lien.md'));
    const { addArtifacts } = await import('app/controllers');

    const r = await addArtifacts(await agentOf('a1'), [path.join(drops, 'lien.md')]);

    // refusé
    expect(r.ok).toBe(false);
    // la cible n'est pas dans le dossier du projet
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  it('un lien vers un dossier, seul : son contenu n’est pas copié', async () => {
    fs.symlinkSync(outside, path.join(drops, 'lien'));
    const { addArtifacts } = await import('app/controllers');

    const r = await addArtifacts(await agentOf('a1'), [path.join(drops, 'lien')]);

    // refusé
    expect(r.ok).toBe(false);
    // le contenu de la cible n'est pas dans le dossier du projet
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  // lstat sur `lien/` suit le lien : ce / de fin ne doit pas le faire entrer.
  it('un lien vers un dossier, avec un / de fin : son contenu n’est pas copié', async () => {
    fs.symlinkSync(outside, path.join(drops, 'lien'));
    const { addArtifacts } = await import('app/controllers');

    const r = await addArtifacts(await agentOf('a1'), [`${path.join(drops, 'lien')}${path.sep}`]);

    // refusé
    expect(r.ok).toBe(false);
    // le contenu de la cible n'est pas dans le dossier du projet
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  it('un lien vers un fichier, dans un dossier : passé, les autres fichiers arrivent', async () => {
    write(path.join(drops, 'lot', 'a.md'), 'A');
    fs.symlinkSync(secret, path.join(drops, 'lot', 'lien.md'));
    const { addArtifacts } = await import('app/controllers');

    await addArtifacts(await agentOf('a1'), [path.join(drops, 'lot')]);

    // témoin : le fichier ordinaire est arrivé
    expect(contents(arts('a1'))).toContain('A');
    // la cible n'est pas dans le dossier du projet
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  it('un lien vers un dossier, dans un dossier : on n’y entre pas', async () => {
    write(path.join(drops, 'lot', 'a.md'), 'A');
    fs.symlinkSync(outside, path.join(drops, 'lot', 'lien'));
    const { addArtifacts } = await import('app/controllers');

    await addArtifacts(await agentOf('a1'), [path.join(drops, 'lot')]);

    // témoin : le fichier ordinaire est arrivé
    expect(contents(arts('a1'))).toContain('A');
    // le contenu de la cible n'est pas dans le dossier du projet
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  it('le dossier du projet est un lien : rien n’arrive dans sa cible', async () => {
    write(path.join(drops, 'a.md'), 'A');
    linkArts('a1', outside);
    const before = snapshot(outside);
    const { addArtifacts } = await import('app/controllers');

    const r = await addArtifacts(await agentOf('a1'), [path.join(drops, 'a.md')]);

    // refusé
    expect(r.ok).toBe(false);
    // le dehors n'a pas changé
    expect(snapshot(outside)).toEqual(before);
  });
});

describe('Ajouter : la boîte de dialogue du principal', () => {
  it('témoin : un fichier choisi arrive dans le dossier du projet, l’original reste', async () => {
    const file = path.join(drops, 'rapport.md');
    write(file, 'CHOISI');
    fake.pick = { canceled: false, filePaths: [file] };
    const { pickArtifacts } = await import('app/controllers');

    await pickArtifacts(await agentOf('a1'));

    // il y est
    expect(read(path.join(arts('a1'), 'rapport.md'))).toBe('CHOISI');
    // l'original n'a pas changé
    expect(read(file)).toBe('CHOISI');
  });

  it('annulée : rien n’est copié', async () => {
    const { pickArtifacts } = await import('app/controllers');

    await pickArtifacts(await agentOf('a1'));

    // rien dans le dossier du projet
    expect(contents(arts('a1'))).toEqual([]);
  });
});

posix('Ajouter : un lien choisi n’est jamais suivi', () => {
  it('un lien choisi : sa cible n’est pas copiée', async () => {
    fs.symlinkSync(secret, path.join(drops, 'lien.md'));
    fake.pick = { canceled: false, filePaths: [path.join(drops, 'lien.md')] };
    const { pickArtifacts } = await import('app/controllers');

    const r = await pickArtifacts(await agentOf('a1'));

    // refusé
    expect(r.ok).toBe(false);
    // la cible n'est pas dans le dossier du projet
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });
});

describe('une page ne désigne aucun fichier (I-37)', () => {
  // conv:vibeRun ne prend jamais de chemin : Ajouter n'a que sa boîte de dialogue.
  it('le clic sur Ajouter, avec un chemin glissé dans les arguments : seule la boîte de dialogue décide', async () => {
    await open();
    const { runVibeAction } = await import('app/controllers');

    runVibeAction('add-artifact', { direct: true, dropped: [secret], paths: [secret], path: secret, file: secret });
    await settle();

    // la boîte de dialogue s'est ouverte
    expect(fake.picks.length).toBeGreaterThan(0);
    // le chemin glissé n'a pas été copié
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  // Sans { direct: true } : l'action telle que l'agent la ferait, pas le clic de l'appli.
  it('sans le clic de l’appli (pas direct), avec un chemin glissé : rien n’est copié', async () => {
    await open();
    const { runVibeAction } = await import('app/controllers');

    runVibeAction('add-artifact', { dropped: [secret] });
    await settle();

    // témoin : le relevé montre bien cette action
    expect(shownActions()).toContain('add-artifact');
    // aucune boîte de dialogue
    expect(fake.picks).toEqual([]);
    // rien dans le dossier du projet
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  it('témoin : un dépôt (conv:vibeDrop) arrive dans le dossier du projet de l’agent affiché, et de lui seul', async () => {
    const file = path.join(drops, 'rapport.md');
    write(file, 'DEPOSE');
    write(path.join(arts('a4'), 'plan.md'), 'AUTRE');
    const before = snapshot(arts('a4'));
    await open();
    const { dropOnArtifacts } = await import('app/controllers');

    dropOnArtifacts([file]);

    // il est dans le dossier du projet de l'agent affiché
    await vi.waitFor(() => expect(contents(arts('a1'))).toContain('DEPOSE'), { timeout: slow(2000) });
    // un autre agent n'a rien reçu
    expect(snapshot(arts('a4'))).toEqual(before);
  });

  it('un dépôt, aucun agent affiché : rien n’est lu', async () => {
    const { dropOnArtifacts } = await import('app/controllers');

    const r = dropOnArtifacts([secret]);
    await settle();

    // refusé
    expect(r.ok).toBe(false);
    // le fichier n'est dans aucun dossier de projet
    expect(contents(path.join(fake.userData, 'vibecoder-artifacts'))).not.toContain(SECRET);
  });

  it('un dépôt d’un chemin relatif : rien n’est lu', async () => {
    await open();
    const { dropOnArtifacts } = await import('app/controllers');
    // Ce chemin relatif, sans `..`, mène bien au fichier depuis le dossier courant du principal.
    process.chdir(outside);

    dropOnArtifacts([path.basename(secret)]);
    await settle();

    // témoin : le relevé montre bien l'action du dépôt
    expect(shownActions()).toContain('add-artifact');
    // le fichier n'est pas dans le dossier du projet
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  it('un dépôt d’un chemin avec un `..` : rien n’est lu', async () => {
    fs.mkdirSync(path.join(drops, 'sous'));
    await open();
    const { dropOnArtifacts } = await import('app/controllers');

    dropOnArtifacts([`${drops}${path.sep}sous${path.sep}..${path.sep}..${path.sep}dehors${path.sep}secret.md`]);
    await settle();

    // témoin : le relevé montre bien l'action du dépôt
    expect(shownActions()).toContain('add-artifact');
    // le fichier n'est pas dans le dossier du projet
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });
});
