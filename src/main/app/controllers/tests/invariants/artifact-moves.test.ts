// Invariants du sort des artefacts (note 0.13.0,
// docs/tickets/feat/0.13.0-ameliorer-artefacts.md, « Ce que ça ne doit pas
// faire ») :
//   - perdre un artefact au transfert ou au retour : un transfert qui échoue
//     laisse le fichier sur le disque ; les artefacts d'un agent sans parent ne
//     partent pas avec removeChild ;
//   - écraser un artefact existant, au transfert, au retour ou au dépôt ;
//   - modifier, déplacer ou supprimer ce qui est déposé ou choisi ;
//   - écrire ailleurs que sous artifacts/ : celui du parent au transfert, de
//     l'agent rouvert au retour, de l'agent affiché à l'ajout (un nom en `..`
//     compris) ;
//   - suivre un lien : ni un lien sous artifacts/, ni un artifacts/ qui serait un
//     lien, chez l'enfant comme chez le parent, ni un lien déposé ou choisi, seul
//     ou dans un dossier ;
//   - lire un fichier désigné par un chemin venu de la page (I-37) : conv:vibeRun
//     ne prend jamais de chemin, et ce que reçoit conv:vibeDrop est revérifié.
// Le parcours lui-même (numéros, rapport, liens passés) :
// technicals/file-tree/tests/invariants/file-tree.test.ts ; le pont :
// tests/invariants/vibe-drop.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, réglages et fichiers sur disque, vrais liens
// symboliques, vrais droits, git réel sur un dépôt d'essai et son worktree) ; faux :
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
const outOf = (id: string) => path.join(fake.userData, 'vibecoder-out', id);
const arts = (id: string) => path.join(outOf(id), 'artifacts');
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
// artifacts-left.json, sur le disque : { id de l'agent retiré → son dossier résolu }.
const left = (): Record<string, string> => {
  const file = path.join(fake.userData, 'artifacts-left.json');
  return fs.existsSync(file) ? JSON.parse(read(file)) : {};
};
// Tout le profil, sauf les artifacts/ de cet agent.
function outsideArts(id: string) {
  const under = path.relative(fake.userData, arts(id));
  return Object.entries(snapshot(fake.userData)).filter(([name]) => name !== under && !name.startsWith(under + path.sep));
}
// Les artifacts/ de cet agent remplacés par un lien.
function linkArts(id: string, target: string) {
  fs.rmSync(arts(id), { recursive: true, force: true });
  fs.mkdirSync(outOf(id), { recursive: true });
  fs.symlinkSync(target, arts(id));
}

// Les droits retirés sont rendus, pour que le dossier temporaire s'efface.
const locked: string[] = [];
const lock = (p: string) => { fs.chmodSync(p, 0o555); locked.push(p); };
const unlock = () => { for (const p of locked.splice(0)) fs.chmodSync(p, 0o755); };

const AGENT = { model: 'opus', effort: 'high', mode: 'default', sessionId: null };

beforeEach(() => {
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
});
afterEach(() => { unlock(); vi.useRealTimers(); process.chdir(fake.cwd); });

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
// Un nouvel agent rouvert sur le dossier d'un agent retiré : même dossier, nouvel id.
const reopened = async (id: string) => ({ ...await agentOf(id), id: 'a9' });

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

describe('au transfert (Retirer cet agent) : rien de perdu, rien d’écrasé', () => {
  it('témoin : l’artefact de l’enfant arrive chez le parent, sous son chemin', async () => {
    write(path.join(arts('a2'), 'maquettes', 'accueil.html'), 'PAGE');
    const { removeAgent } = await import('app/controllers');

    await removeAgent('a2');

    // chez le parent, avec son sous-dossier
    expect(read(path.join(arts('a1'), 'maquettes', 'accueil.html'))).toBe('PAGE');
    // plus chez l'enfant
    expect(contents(arts('a2'))).not.toContain('PAGE');
  });

  it('un artefact du même nom chez le parent : il garde son texte, celui de l’enfant arrive', async () => {
    write(path.join(arts('a1'), 'rapport.md'), 'PARENT');
    write(path.join(arts('a2'), 'rapport.md'), 'ENFANT');
    const { retireArtifacts } = await import('app/controllers');

    await retireArtifacts(await agentOf('a2'), await agentOf('a1'));

    // celui du parent n'a pas changé
    expect(read(path.join(arts('a1'), 'rapport.md'))).toBe('PARENT');
    // celui de l'enfant est arrivé
    expect(contents(arts('a1'))).toContain('ENFANT');
  });

  // L'appli quittée en route : les fichiers restants reviendront, si l'entrée est déjà là.
  it('l’entrée est posée avant tout transfert', async () => {
    write(path.join(arts('a2'), 'rapport.md'), 'ENFANT');
    const { retireArtifacts } = await import('app/controllers');

    const pending = retireArtifacts(await agentOf('a2'), await agentOf('a1'));
    const atOnce = Object.keys(left());
    await pending;

    // elle était sur le disque dès l'appel
    expect(atOnce).toContain('a2');
  });

  it('rien n’est écrit ailleurs que sous les artifacts/ du parent', async () => {
    write(path.join(arts('a2'), 'rapport.md'), 'ENFANT');
    write(path.join(arts('a4'), 'plan.md'), 'AUTRE');
    const before = { other: snapshot(arts('a4')), project: snapshot(repo), child: snapshot(worktree) };
    const { retireArtifacts } = await import('app/controllers');

    await retireArtifacts(await agentOf('a2'), await agentOf('a1'));

    // témoin : il est arrivé
    expect(contents(arts('a1'))).toContain('ENFANT');
    // les artefacts d'un autre agent n'ont pas changé
    expect(snapshot(arts('a4'))).toEqual(before.other);
    // le dossier du parent n'a rien reçu
    expect(snapshot(repo)).toEqual(before.project);
    // le dossier de l'enfant n'a rien reçu
    expect(snapshot(worktree)).toEqual(before.child);
  });

  // Le relevé s'arrête à 1 000 (LIST_MAX) ; le 1 001ᵉ serait perdu avec le dossier de l'enfant.
  it('plus de 1 000 artefacts, puis les sorties effacées : tous sont chez le parent', async () => {
    const count = 1001;
    for (let i = 0; i < count; i++) write(path.join(arts('a2'), `f${i}.md`), `F${i}`);
    const { eraseOutputs, retireArtifacts } = await import('app/controllers');

    await retireArtifacts(await agentOf('a2'), await agentOf('a1'));
    await eraseOutputs('a2');

    // autant d'artefacts à l'arrivée qu'au départ
    expect(Object.keys(snapshot(arts('a1')))).toHaveLength(count);
  });

  // Le retrait, et le retour lancé pendant : le retour attend, le fichier n'est perdu d'aucun côté.
  it('un retour lancé pendant le retrait sur le même dossier : l’artefact n’est pas perdu', async () => {
    write(path.join(arts('a2'), 'rapport.md'), 'ENFANT');
    const { retireArtifacts, returnArtifacts } = await import('app/controllers');

    await Promise.all([retireArtifacts(await agentOf('a2'), await agentOf('a1')), returnArtifacts(await reopened('a2'))]);

    // il est chez le parent, ou chez l'agent rouvert
    expect([...contents(arts('a1')), ...contents(arts('a9'))]).toContain('ENFANT');
  });
});

posix('au transfert : un transfert qui échoue laisse le fichier sur le disque', () => {
  // Le sous-dossier du parent est en lecture seule : la copie de ce fichier-là échoue.
  function blocked() {
    write(path.join(arts('a2'), 'sous', 'x.md'), 'BLOQUE');
    write(path.join(outOf('a2'), 'commit.md'), 'SORTIE');
    fs.mkdirSync(path.join(arts('a1'), 'sous'), { recursive: true });
    lock(path.join(arts('a1'), 'sous'));
  }

  it('le fichier reste chez l’enfant, avec son texte, et la promesse ne rejette pas', async () => {
    blocked();
    const { retireArtifacts } = await import('app/controllers');

    await retireArtifacts(await agentOf('a2'), await agentOf('a1'));

    // il est toujours là
    expect(read(path.join(arts('a2'), 'sous', 'x.md'))).toBe('BLOQUE');
  });

  it('l’entrée reste, pour qu’il revienne', async () => {
    blocked();
    const { retireArtifacts } = await import('app/controllers');

    await retireArtifacts(await agentOf('a2'), await agentOf('a1'));

    // l'entrée de l'enfant est toujours là
    expect(Object.keys(left())).toContain('a2');
  });

  // removeChild efface les sorties ensuite : pas ce qui n'a pas pu partir.
  it('les sorties effacées ensuite : le fichier reste, le reste des sorties part', async () => {
    blocked();
    const { eraseOutputs, retireArtifacts } = await import('app/controllers');

    await retireArtifacts(await agentOf('a2'), await agentOf('a1'));
    await eraseOutputs('a2');

    // il est toujours là
    expect(read(path.join(arts('a2'), 'sous', 'x.md'))).toBe('BLOQUE');
    // témoin : l'effacement a bien eu lieu
    expect(fs.existsSync(path.join(outOf('a2'), 'commit.md'))).toBe(false);
  });

  // Il n'a pas pu partir : il revient quand on rouvre un agent sur ce dossier.
  it('il revient à l’agent rouvert sur ce dossier', async () => {
    blocked();
    const { retireArtifacts, returnArtifacts } = await import('app/controllers');
    await retireArtifacts(await agentOf('a2'), await agentOf('a1'));

    await returnArtifacts(await reopened('a2'));

    // il est chez l'agent rouvert
    expect(read(path.join(arts('a9'), 'sous', 'x.md'))).toBe('BLOQUE');
  });
});

describe('sans parent : rien ne part', () => {
  it('retiré sans parent : les artefacts restent à leur place', async () => {
    write(path.join(arts('a3'), 'rapport.md'), 'SEUL');
    const before = snapshot(arts('a3'));
    const { retireArtifacts } = await import('app/controllers');

    await retireArtifacts(await agentOf('a3'), null);

    // rien n'a bougé
    expect(snapshot(arts('a3'))).toEqual(before);
  });

  it('retiré sans parent : l’entrée relie ses artefacts à son dossier résolu', async () => {
    write(path.join(arts('a3'), 'rapport.md'), 'SEUL');
    const { retireArtifacts } = await import('app/controllers');

    await retireArtifacts(await agentOf('a3'), null);

    // l'entrée donne le dossier de l'agent
    expect(left().a3).toBe(fs.realpathSync.native(solo));
  });

  it('les sorties effacées : les artefacts restent, le reste part', async () => {
    write(path.join(arts('a3'), 'rapport.md'), 'SEUL');
    write(path.join(outOf('a3'), 'commit.md'), 'SORTIE');
    const { eraseOutputs, retireArtifacts } = await import('app/controllers');

    await retireArtifacts(await agentOf('a3'), null);
    await eraseOutputs('a3');

    // l'artefact est toujours là
    expect(read(path.join(arts('a3'), 'rapport.md'))).toBe('SEUL');
    // témoin : l'effacement a bien eu lieu
    expect(fs.existsSync(path.join(outOf('a3'), 'commit.md'))).toBe(false);
  });

});

describe('removeChild (le relevé, Retirer le worktree) : les artefacts ne partent pas avec les sorties', () => {
  // Le relevé retire seul le robot dont le parent est parti (F-110), par removeChild, sans parent.
  it('le robot d’une PR retiré par le relevé, son parent parti : ses artefacts restent', async () => {
    addAgent({ id: 'a5', dir: other, temp: { parent: 'parti', pr: 7 } });
    write(path.join(arts('a5'), 'rapport.md'), 'ROBOT');
    const { syncWorktrees } = await import('app/controllers');

    await syncWorktrees();

    // témoin : le robot est bien parti
    expect(await ids()).not.toContain('a5');
    // son artefact est toujours là
    expect(read(path.join(arts('a5'), 'rapport.md'))).toBe('ROBOT');
  });

  // La fiche de la PR a disparu, le parent est là : le relevé le retire, l'artefact va au parent.
  it('le robot d’une PR retiré par le relevé, son parent là : ses artefacts vont au parent', async () => {
    addAgent({ id: 'a5', dir: other, temp: { parent: 'a1', pr: 7 } });
    write(path.join(arts('a5'), 'rapport.md'), 'ROBOT');
    const { syncWorktrees } = await import('app/controllers');

    await syncWorktrees();

    // témoin : le robot est bien parti
    expect(await ids()).not.toContain('a5');
    // son artefact est chez le parent
    expect(contents(arts('a1'))).toContain('ROBOT');
  });

  it('Retirer le worktree : les artefacts de l’enfant sont chez le parent, le worktree est parti', async () => {
    write(path.join(arts('a2'), 'rapport.md'), 'ENFANT');
    const { removeWorktreeChild } = await import('app/controllers');

    await removeWorktreeChild(await agentOf('a2'));

    // témoin : l'enfant est bien parti
    expect(await ids()).not.toContain('a2');
    // son artefact est chez le parent
    expect(contents(arts('a1'))).toContain('ENFANT');
  });
});

describe('au retour : rien de perdu, rien d’écrasé', () => {
  it('témoin : un agent rouvert sur ce dossier (+) retrouve les artefacts', async () => {
    write(path.join(arts('a3'), 'maquettes', 'accueil.html'), 'PAGE');
    const { newAgent, removeAgent } = await import('app/controllers');
    const { loadConfig } = await import('app/settings');
    await removeAgent('a3');

    newAgent(solo);

    const id = loadConfig().agents.find((a) => a.dir === solo)!.id;
    // ils sont arrivés, sous leur chemin
    await vi.waitFor(() => expect(read(path.join(arts(id), 'maquettes', 'accueil.html'))).toBe('PAGE'), { timeout: slow(2000) });
  });

  it('un artefact du même nom chez l’agent rouvert : il garde son texte, l’autre arrive', async () => {
    write(path.join(arts('a3'), 'rapport.md'), 'LAISSE');
    write(path.join(arts('a9'), 'rapport.md'), 'ROUVERT');
    const { retireArtifacts, returnArtifacts } = await import('app/controllers');
    await retireArtifacts(await agentOf('a3'), null);

    await returnArtifacts(await reopened('a3'));

    // le sien n'a pas changé
    expect(read(path.join(arts('a9'), 'rapport.md'))).toBe('ROUVERT');
    // celui laissé est arrivé
    expect(contents(arts('a9'))).toContain('LAISSE');
  });

  // Le worktree est déjà parti quand on retire son robot : le lien vers son dossier ne doit pas se perdre.
  it('le dossier déjà parti au retrait, recréé ensuite : les artefacts reviennent', async () => {
    write(path.join(arts('a3'), 'rapport.md'), 'LAISSE');
    const { retireArtifacts, returnArtifacts } = await import('app/controllers');
    const gone = await agentOf('a3');
    fs.rmSync(solo, { recursive: true });
    await retireArtifacts(gone, null);
    fs.mkdirSync(solo);

    await returnArtifacts({ ...gone, id: 'a9' });

    // ils sont chez l'agent rouvert
    expect(contents(arts('a9'))).toContain('LAISSE');
  });

  it('rien n’est écrit ailleurs que sous les artifacts/ de l’agent rouvert', async () => {
    write(path.join(arts('a3'), 'rapport.md'), 'LAISSE');
    write(path.join(arts('a4'), 'plan.md'), 'AUTRE');
    const { retireArtifacts, returnArtifacts } = await import('app/controllers');
    await retireArtifacts(await agentOf('a3'), null);
    const before = { other: snapshot(arts('a4')), parent: fs.existsSync(arts('a1')), project: snapshot(solo) };

    await returnArtifacts(await reopened('a3'));

    // témoin : il est arrivé
    expect(contents(arts('a9'))).toContain('LAISSE');
    // les artefacts d'un autre agent n'ont pas changé
    expect(snapshot(arts('a4'))).toEqual(before.other);
    // le parent n'a rien reçu
    expect(fs.existsSync(arts('a1'))).toBe(before.parent);
    // le dossier de l'agent n'a rien reçu
    expect(snapshot(solo)).toEqual(before.project);
  });
});

posix('au retour : un retour qui échoue laisse le fichier sur le disque', () => {
  it('le fichier reste, l’entrée aussi, et il revient à la tentative suivante', async () => {
    write(path.join(arts('a3'), 'sous', 'x.md'), 'BLOQUE');
    fs.mkdirSync(path.join(arts('a9'), 'sous'), { recursive: true });
    lock(path.join(arts('a9'), 'sous'));
    const { retireArtifacts, returnArtifacts } = await import('app/controllers');
    await retireArtifacts(await agentOf('a3'), null);

    await returnArtifacts(await reopened('a3'));

    // il est toujours là, avec son texte
    expect(read(path.join(arts('a3'), 'sous', 'x.md'))).toBe('BLOQUE');
    // l'entrée reste
    expect(Object.keys(left())).toContain('a3');

    unlock();
    await returnArtifacts(await reopened('a3'));

    // la tentative suivante le ramène
    expect(read(path.join(arts('a9'), 'sous', 'x.md'))).toBe('BLOQUE');
  });

});

posix('au retour : le dossier résolu, même atteint par un lien', () => {
  // Le dossier d'un worktree atteint par un lien (/home → /var/home) : même dossier, sous un autre chemin.
  it('le dossier parti au retrait, atteint par un lien : il revient à l’agent rouvert sur le vrai chemin', async () => {
    const linked = path.join(fake.userData, 'lien-home');
    fs.symlinkSync(fake.userData, linked);
    write(path.join(arts('a3'), 'rapport.md'), 'LAISSE');
    const { retireArtifacts, returnArtifacts } = await import('app/controllers');
    const gone = { ...await agentOf('a3'), dir: path.join(linked, 'seul') };
    fs.rmSync(solo, { recursive: true });
    await retireArtifacts(gone, null);
    fs.mkdirSync(solo);

    await returnArtifacts({ ...await agentOf('a3'), id: 'a9', dir: solo });

    // ils sont chez l'agent rouvert
    expect(contents(arts('a9'))).toContain('LAISSE');
  });
});

posix('au transfert : un lien n’est jamais suivi', () => {
  it('les artifacts/ de l’enfant sont un lien : le dehors n’arrive pas chez le parent, et reste intact', async () => {
    linkArts('a2', outside);
    const before = snapshot(outside);
    const { retireArtifacts } = await import('app/controllers');

    await retireArtifacts(await agentOf('a2'), await agentOf('a1'));

    // le dehors n'est pas chez le parent
    expect(contents(arts('a1'))).not.toContain(SECRET);
    // le dehors n'a pas changé
    expect(snapshot(outside)).toEqual(before);
  });

  it('les artifacts/ de l’enfant sont un lien, les sorties effacées : le dehors reste intact', async () => {
    linkArts('a2', outside);
    const before = snapshot(outside);
    const { eraseOutputs, retireArtifacts } = await import('app/controllers');

    await retireArtifacts(await agentOf('a2'), await agentOf('a1'));
    await eraseOutputs('a2');

    // le dehors n'a pas changé
    expect(snapshot(outside)).toEqual(before);
  });

  it('les artifacts/ du parent sont un lien : rien n’arrive dans sa cible, le fichier reste chez l’enfant', async () => {
    write(path.join(arts('a2'), 'rapport.md'), 'ENFANT');
    linkArts('a1', outside);
    const before = snapshot(outside);
    const { retireArtifacts } = await import('app/controllers');

    await retireArtifacts(await agentOf('a2'), await agentOf('a1'));

    // le dehors n'a pas changé
    expect(snapshot(outside)).toEqual(before);
    // le fichier est toujours chez l'enfant
    expect(read(path.join(arts('a2'), 'rapport.md'))).toBe('ENFANT');
  });

  it('un lien sous les artifacts/ de l’enfant : sa cible n’arrive pas chez le parent, et reste intacte', async () => {
    write(path.join(arts('a2'), 'rapport.md'), 'ENFANT');
    fs.symlinkSync(secret, path.join(arts('a2'), 'lien.md'));
    const { retireArtifacts } = await import('app/controllers');

    await retireArtifacts(await agentOf('a2'), await agentOf('a1'));

    // témoin : le fichier ordinaire est arrivé
    expect(contents(arts('a1'))).toContain('ENFANT');
    // la cible n'est pas chez le parent
    expect(contents(arts('a1'))).not.toContain(SECRET);
    // la cible n'a pas changé
    expect(read(secret)).toBe(SECRET);
  });

  it('un lien sous les artifacts/ du parent, au nom d’un sous-dossier : rien n’arrive dans sa cible', async () => {
    write(path.join(arts('a2'), 'sous', 'x.md'), 'ENFANT');
    fs.mkdirSync(arts('a1'), { recursive: true });
    fs.symlinkSync(outside, path.join(arts('a1'), 'sous'));
    const before = snapshot(outside);
    const { retireArtifacts } = await import('app/controllers');

    await retireArtifacts(await agentOf('a2'), await agentOf('a1'));

    // le dehors n'a pas changé
    expect(snapshot(outside)).toEqual(before);
    // le fichier est quelque part chez l'un ou l'autre
    expect([...contents(arts('a1')), ...contents(arts('a2'))]).toContain('ENFANT');
  });
});

posix('au retour : un lien n’est jamais suivi', () => {
  // L'agent retiré a remplacé ses artifacts/ par un lien : ce qu'il désigne n'arrive pas.
  it('les artifacts/ laissés sont un lien : le dehors n’arrive pas, et reste intact', async () => {
    write(path.join(arts('a3'), 'rapport.md'), 'LAISSE');
    const { retireArtifacts, returnArtifacts } = await import('app/controllers');
    await retireArtifacts(await agentOf('a3'), null);
    linkArts('a3', outside);
    const before = snapshot(outside);

    await returnArtifacts(await reopened('a3'));

    // le dehors n'est pas chez l'agent rouvert
    expect(contents(arts('a9'))).not.toContain(SECRET);
    // le dehors n'a pas changé
    expect(snapshot(outside)).toEqual(before);
  });

  it('un lien sous les artifacts/ laissés : sa cible n’arrive pas, et reste intacte', async () => {
    write(path.join(arts('a3'), 'rapport.md'), 'LAISSE');
    fs.symlinkSync(secret, path.join(arts('a3'), 'lien.md'));
    const { retireArtifacts, returnArtifacts } = await import('app/controllers');
    await retireArtifacts(await agentOf('a3'), null);

    await returnArtifacts(await reopened('a3'));

    // témoin : le fichier ordinaire est arrivé
    expect(contents(arts('a9'))).toContain('LAISSE');
    // la cible n'est pas chez l'agent rouvert
    expect(contents(arts('a9'))).not.toContain(SECRET);
    // la cible n'a pas changé
    expect(read(secret)).toBe(SECRET);
  });

  it('les artifacts/ de l’agent rouvert sont un lien : rien n’arrive dans sa cible, le fichier et l’entrée restent', async () => {
    write(path.join(arts('a3'), 'rapport.md'), 'LAISSE');
    linkArts('a9', outside);
    const before = snapshot(outside);
    const { retireArtifacts, returnArtifacts } = await import('app/controllers');
    await retireArtifacts(await agentOf('a3'), null);

    await returnArtifacts(await reopened('a3'));

    // le dehors n'a pas changé
    expect(snapshot(outside)).toEqual(before);
    // le fichier est toujours là
    expect(read(path.join(arts('a3'), 'rapport.md'))).toBe('LAISSE');
    // l'entrée reste
    expect(Object.keys(left())).toContain('a3');
  });
});

describe('à l’ajout : copié sous les artifacts/ de l’agent, l’original intact', () => {
  it('témoin : un fichier déposé arrive sous ses artifacts/', async () => {
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

  it('rien n’est écrit ailleurs que sous les artifacts/ de cet agent', async () => {
    write(path.join(drops, 'lot', 'a.md'), 'A');
    fs.mkdirSync(outOf('a1'), { recursive: true });
    const before = outsideArts('a1');
    const { addArtifacts } = await import('app/controllers');

    await addArtifacts(await agentOf('a1'), [path.join(drops, 'lot')]);

    // témoin : la copie est arrivée
    expect(contents(arts('a1'))).toContain('A');
    // rien d'autre n'a changé
    expect(outsideArts('a1')).toEqual(before);
  });

  // Son nom de base est `..` : le mettre sous artifacts/, c'est écrire au-dessus.
  it('un chemin dont le nom est `..` : rien n’est écrit', async () => {
    write(path.join(drops, 'x.md'), 'DEPOSE');
    fs.mkdirSync(path.join(drops, 'sous'));
    const before = snapshot(fake.userData);
    const { addArtifacts } = await import('app/controllers');

    const r = await addArtifacts(await agentOf('a1'), [`${drops}${path.sep}sous${path.sep}..`]);

    // refusé
    expect(r.ok).toBe(false);
    // rien n'a changé, sous artifacts/ ni ailleurs
    expect(snapshot(fake.userData)).toEqual(before);
  });

  // path.resolve l'effacerait, et le chemin aurait l'air sain.
  it('un chemin avec un `..` au milieu : le fichier n’est pas lu', async () => {
    fs.mkdirSync(path.join(drops, 'sous'));
    const { addArtifacts } = await import('app/controllers');

    const r = await addArtifacts(await agentOf('a1'), [`${drops}${path.sep}sous${path.sep}..${path.sep}..${path.sep}dehors${path.sep}secret.md`]);

    // refusé
    expect(r.ok).toBe(false);
    // le fichier n'est pas sous artifacts/
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
    // le fichier n'est pas sous artifacts/
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  it('autre chose qu’une liste : rien n’est lu', async () => {
    const { addArtifacts } = await import('app/controllers');

    const r = await addArtifacts(await agentOf('a1'), secret);

    // refusé
    expect(r.ok).toBe(false);
    // le fichier n'est pas sous artifacts/
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  // Un File construit par la page : le pont envoie un chemin vide.
  it('un chemin vide : rien n’est lu', async () => {
    const { addArtifacts } = await import('app/controllers');

    const r = await addArtifacts(await agentOf('a1'), ['']);

    // refusé
    expect(r.ok).toBe(false);
    // rien sous artifacts/
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
    // la cible n'est pas sous artifacts/
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  it('un lien vers un dossier, seul : son contenu n’est pas copié', async () => {
    fs.symlinkSync(outside, path.join(drops, 'lien'));
    const { addArtifacts } = await import('app/controllers');

    const r = await addArtifacts(await agentOf('a1'), [path.join(drops, 'lien')]);

    // refusé
    expect(r.ok).toBe(false);
    // le contenu de la cible n'est pas sous artifacts/
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  // lstat sur `lien/` suit le lien : ce / de fin ne doit pas le faire entrer.
  it('un lien vers un dossier, avec un / de fin : son contenu n’est pas copié', async () => {
    fs.symlinkSync(outside, path.join(drops, 'lien'));
    const { addArtifacts } = await import('app/controllers');

    const r = await addArtifacts(await agentOf('a1'), [`${path.join(drops, 'lien')}${path.sep}`]);

    // refusé
    expect(r.ok).toBe(false);
    // le contenu de la cible n'est pas sous artifacts/
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  it('un lien vers un fichier, dans un dossier : passé, les autres fichiers arrivent', async () => {
    write(path.join(drops, 'lot', 'a.md'), 'A');
    fs.symlinkSync(secret, path.join(drops, 'lot', 'lien.md'));
    const { addArtifacts } = await import('app/controllers');

    await addArtifacts(await agentOf('a1'), [path.join(drops, 'lot')]);

    // témoin : le fichier ordinaire est arrivé
    expect(contents(arts('a1'))).toContain('A');
    // la cible n'est pas sous artifacts/
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  it('un lien vers un dossier, dans un dossier : on n’y entre pas', async () => {
    write(path.join(drops, 'lot', 'a.md'), 'A');
    fs.symlinkSync(outside, path.join(drops, 'lot', 'lien'));
    const { addArtifacts } = await import('app/controllers');

    await addArtifacts(await agentOf('a1'), [path.join(drops, 'lot')]);

    // témoin : le fichier ordinaire est arrivé
    expect(contents(arts('a1'))).toContain('A');
    // le contenu de la cible n'est pas sous artifacts/
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  it('les artifacts/ de l’agent sont un lien : rien n’arrive dans sa cible', async () => {
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
  it('témoin : un fichier choisi arrive sous les artifacts/, l’original reste', async () => {
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

    // rien sous artifacts/
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
    // la cible n'est pas sous artifacts/
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
    // rien sous artifacts/
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });

  it('témoin : un dépôt (conv:vibeDrop) arrive sous les artifacts/ de l’agent affiché, et de lui seul', async () => {
    const file = path.join(drops, 'rapport.md');
    write(file, 'DEPOSE');
    write(path.join(arts('a4'), 'plan.md'), 'AUTRE');
    const before = snapshot(arts('a4'));
    await open();
    const { dropOnArtifacts } = await import('app/controllers');

    dropOnArtifacts([file]);

    // il est sous les artifacts/ de l'agent affiché
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
    // le fichier n'est sous aucun artifacts/
    expect(contents(path.join(fake.userData, 'vibecoder-out'))).not.toContain(SECRET);
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
    // le fichier n'est pas sous artifacts/
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
    // le fichier n'est pas sous artifacts/
    expect(contents(arts('a1'))).not.toContain(SECRET);
  });
});
