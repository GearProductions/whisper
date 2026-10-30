// Invariants du panneau Artefacts (note 0.13.0,
// docs/tickets/feat/0.13.0-panneau-artifacts.md, « Ce que ça ne doit pas
// faire ») ; les artefacts sont dans le dossier du projet (note
// docs/tickets/fix/0.13.0-fix-and-improvements.md, sujet 8 : seule retouche acceptée,
// ces règles gardées) :
//   - lire, pour l'afficher ou l'ouvrir, un fichier hors du dossier du projet, ou
//     désigné par un chemin venu de la page plutôt que par son id dans la liste
//     (I-37, étendu aux artefacts) ;
//   - exécuter un script d'un artefact, ou le laisser joindre le réseau — ici
//     le schéma vibe-artifact:// : il ne sert que l'id d'un artefact du dernier
//     relevé de l'agent affiché (jamais un chemin, ni ../), une page HTML ou SVG
//     part avec l'en-tête CSP sandbox sans script ni réseau, et toute réponse
//     porte X-Content-Type-Options: nosniff (et un media, affiché hors bac à
//     sable, ne part jamais avec un type de page) ; le cadre de la page :
//     renderer/app/panel/vibecoder/tests/invariants/artifacts-view.test.ts ;
//   - copier un artefact autrement qu'au clic de son bouton, ou ailleurs que
//     dans le dossier choisi dans la boîte de dialogue (I-39 : le principal ne
//     modifie le dépôt qu'au clic) ;
//   - remplacer un fichier existant sans que l'utilisateur l'ait accepté.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur
// disque, git réel sur un dépôt d'essai, un lien réel qui sort des artefacts,
// le vrai serveur du schéma) ; faux : Electron (fenêtres qui relèvent ce qu'on
// leur envoie ; protocol.handle qui garde le gestionnaire du schéma, appelé
// avec une vraie Request ; boîtes de dialogue qui répondent ce que le cas
// règle), l'éditeur (relève ce qu'on lui fait ouvrir) et le SDK de Claude Code
// (aucun tour ne commence ici). Le schéma est branché comme au démarrage :
// serveFiles('vibe-artifact', resolveArtifact).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Box = { buttons: string[]; defaultId?: number; cancelId?: number };
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
    // Le gestionnaire de chaque schéma (protocol.handle).
    schemes: new Map<string, (req: Request) => Response | Promise<Response>>(),
    // Les dossiers demandés (showOpenDialog), et la réponse : le dossier choisi, ou annulé.
    picks: [] as unknown[],
    pick: { canceled: true, filePaths: [] as string[] },
    // Les questions posées (showMessageBox), et le bouton que l'utilisateur choisit.
    asked: [] as Box[],
    answer: (o: Box) => o.cancelId ?? 0,
    // Les fichiers ouverts dans l'éditeur.
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
  dialog: {
    showOpenDialog: async (...a: unknown[]) => { fake.picks.push(a.at(-1)); return fake.pick; },
    showMessageBox: async (...a: unknown[]) => { const o = a.at(-1) as Box; fake.asked.push(o); return { response: fake.answer(o) }; },
  },
  shell: {}, clipboard: {}, nativeImage: {},
}));

// Claude Code : aucun tour ici ; un message reçu ne fait rien.
vi.mock('technicals/claude', () => ({
  launcher: () => ({ executable: 'claude' }),
  loadSdk: async () => ({
    getSessionInfo: async () => null,
    getSessionMessages: async () => [],
    query: () => Object.assign((async function* run() {}()), { setPermissionMode: async () => {}, setModel: async () => {}, interrupt: async () => {} }),
  }),
}));

// L'éditeur : relève ce qu'on lui fait ouvrir.
vi.mock('technicals/editor', () => ({
  findEditor: () => ({ name: 'éditeur', open: () => {}, openFile: (file: string) => { fake.edited.push(file); } }),
}));

vi.mock('technicals/paths', async (original) => ({
  ...await original<typeof import('technicals/paths')>(),
  resourcePath: (name: string) => `${process.cwd()}/resources/${name}`,
}));

const git = (cwd: string, ...args: string[]) => execFileSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@t', ...args], { cwd, stdio: 'pipe' });
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const settle = () => new Promise((r) => setTimeout(r, 300));
let dir = '';        // le dépôt de l'agent
let out = '';        // ses sorties
let arts = '';       // les artefacts de son projet
let chosen = '';     // le dossier que l'utilisateur choisit dans la boîte de dialogue
let secret = '';     // un fichier hors de tout

// Ce que la page reçoit : le relevé (conv:vibe) et le texte d'un fichier (conv:vibeCode).
type Artifact = { id: string; name: string; url: string | null };
const panel = () => fake.windows.at(-1)!;
const survey = () => panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as { artifacts?: Artifact[] };
const codes = () => panel().sent.filter(([ch]) => ch === 'conv:vibeCode').map(([, c]) => c as { id: string; text: string | null } | null);
// Les textes de fichier poussés à la page.
const texts = () => codes().flatMap((c) => (c && c.text !== null ? [c.text] : []));
// Les noms des artefacts du dernier relevé.
const names = () => (survey().artifacts ?? []).map((a) => a.name);
// L'artefact que le dernier relevé donne sous ce nom ; sans lui, le cas ne peut pas commencer.
function artifact(name: string) {
  const a = (survey().artifacts ?? []).find((x) => x.name === name);
  if (!a) throw new Error(`le relevé ne donne aucun artefact ${name}`);
  return a;
}
const idOf = (name: string) => artifact(name).id;
// Ce que git voit changé dans le dépôt de l'agent.
const changed = () => git(dir, 'status', '--porcelain').toString();
// Ce qu'il y a dans le dossier choisi (sous-dossiers compris).
const inChosen = () => fs.readdirSync(chosen, { recursive: true }).map(String).sort();
// Un artefact remplacé par un lien qui mène hors de tout.
const linkOut = (name: string) => { fs.rmSync(path.join(arts, name)); fs.symlinkSync(secret, path.join(arts, name)); };
// Les fichiers ouverts dans l'éditeur, tels que sur le disque.
const editedReal = () => fake.edited.map((f) => fs.realpathSync.native(f));

const NOTES = 'NOTES_TEXTE';
const COMMIT = 'COMMIT_HORS_ARTEFACTS';
const SECRET = 'SECRET_DEHORS';
const PLAN = 'PLAN_AUTRE_AGENT';
// Une page avec un script et une ressource du réseau.
const PAGE = '<html><body>ACCUEIL<script>fetch("https://exemple.fr")</script><img src="https://exemple.fr/x.png"></body></html>';
const SVG = '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script><text>SCHEMA</text></svg>';
// Une « image » qui contient du HTML : elle ne doit jamais devenir une page.
const CAPTURE = '<html><script>alert(1)</script>CAPTURE</html>';

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  fake.windows = [];
  fake.schemes = new Map();
  fake.picks = [];
  fake.asked = [];
  fake.edited = [];
  fake.answer = (o) => o.cancelId ?? 0;
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-artifacts-')));
  // Hors de tout : un secret.
  secret = path.join(fake.userData, 'secret.txt');
  write(secret, SECRET);
  // Le dépôt de l'agent, sur une branche.
  dir = path.join(fake.userData, 'projet');
  fs.mkdirSync(dir, { recursive: true });
  git(dir, 'init', '-q', '-b', 'main');
  write(path.join(dir, 'README.md'), 'projet');
  git(dir, 'add', '.');
  git(dir, 'commit', '-q', '-m', 'init');
  git(dir, 'checkout', '-q', '-b', 'feat/0.13.0-essai');
  // Un autre agent, sur un autre projet.
  fs.mkdirSync(path.join(fake.userData, 'autre'), { recursive: true });
  const { projectArtifactsPath } = await import('app/controllers');
  // Ses sorties : un fichier hors des artefacts ; le dossier de son projet : les artefacts (un sous-dossier
  // compris) ; juste au-dessus de ce dossier, un autre fichier, pour un `../` qui remonterait.
  out = path.join(fake.userData, 'vibecoder-out', 'a1');
  arts = projectArtifactsPath(dir);
  write(path.join(out, 'commit.md'), COMMIT);
  write(path.join(arts, '..', 'commit.md'), COMMIT);
  write(path.join(arts, 'notes.md'), NOTES);
  write(path.join(arts, 'maquettes', 'accueil.html'), PAGE);
  write(path.join(arts, 'schema.svg'), SVG);
  write(path.join(arts, 'capture.png'), CAPTURE);
  // L'artefact de l'autre projet, jamais affiché.
  write(path.join(projectArtifactsPath(path.join(fake.userData, 'autre')), 'plan.html'), PLAN);
  // Le dossier que l'utilisateur choisira, hors du dépôt.
  chosen = path.join(fake.userData, 'choisi');
  fs.mkdirSync(chosen, { recursive: true });
  fake.pick = { canceled: false, filePaths: [chosen] };
  write(path.join(fake.userData, 'config.json'), JSON.stringify({
    agentsEnabled: true,
    agents: [
      { id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
        vibe: { flow: 'create', autonomy: 'guide', pr: null } },
      { id: 'a2', dir: path.join(fake.userData, 'autre'), name: 'autre', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
        vibe: { flow: 'create', autonomy: 'guide', pr: null } },
    ],
  }));
});
afterEach(() => { vi.useRealTimers(); });

// Le panneau ouvert sur l'agent a1, en VibeCoder, son premier relevé reçu.
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

// La page suit un artefact (choisi dans la liste).
async function follow(id: unknown) {
  const { followCode } = await import('app/controllers');
  followCode(id);
  await settle();
}

// Ouvrir dans l'éditeur, tel que la page l'envoie.
async function openInEditor(id: unknown) {
  const { openVibeItem } = await import('app/controllers');
  await openVibeItem(id);
  await settle();
}

// Une action envoyée par la page : { direct: true } est le clic de son bouton.
async function run(id: string, args: object) {
  const { runVibeAction } = await import('app/controllers');
  runVibeAction(id, args);
  await settle();
}
// Le clic sur Copier dans le projet.
const copy = (artifactId: unknown) => run('copy-artifact', { direct: true, artifact: artifactId });

// Une requête au schéma, branché comme au démarrage ; la réponse du principal.
async function request(url: string) {
  const { serveFiles } = await import('technicals/file-scheme');
  const { resolveArtifact } = await import('app/controllers');
  serveFiles('vibe-artifact', resolveArtifact);
  return await fake.schemes.get('vibe-artifact')!(new Request(url));
}
// L'adresse d'un artefact, telle que le relevé la donne ; sans elle, le cas ne peut pas commencer.
function urlOf(name: string) {
  const u = artifact(name).url;
  if (!u) throw new Error(`le relevé ne donne aucune adresse à ${name}`);
  return u;
}

// Les directives d'un en-tête Content-Security-Policy : nom → ses valeurs.
const directives = (csp: string) => new Map(csp.split(';').map((d) => d.trim().split(/\s+/)).filter((d) => d[0]).map(([n, ...v]) => [n.toLowerCase(), v]));
// Les sources qu'une page hors réseau peut avoir : aucune adresse ni origine, seulement 'none', le style en ligne et data:.
const OFFLINE = ["'none'", "'unsafe-inline'", 'data:'];
// Les sources de l'en-tête (hors sandbox) qui ouvriraient le réseau.
const networked = (csp: string) => [...directives(csp)].filter(([n]) => n !== 'sandbox').flatMap(([, v]) => v).filter((s) => !OFFLINE.includes(s));
const cspOf = (res: Response) => res.headers.get('content-security-policy') ?? '';

describe('afficher un artefact : par son id dans le dernier relevé, rien hors du dossier du projet (I-37)', () => {
  it('témoin : l’id d’un artefact Markdown, son texte est poussé à la page', async () => {
    await open();

    await follow(idOf('notes.md'));

    // la page reçoit le texte de l'artefact tel qu'il est sur le disque
    expect(texts()).toContain(fs.readFileSync(path.join(arts, 'notes.md'), 'utf8'));
  });

  it('le relevé liste les artefacts sans leur texte', async () => {
    await open();

    const sent = JSON.stringify(survey());

    // témoin : l'artefact est bien listé
    expect(names()).toContain('notes.md');
    // son texte n'y est pas
    expect(sent).not.toContain(NOTES);
  });

  it('un fichier des sorties n’est pas un artefact', async () => {
    await open();

    // témoin : les artefacts sont bien listés
    expect(names()).toContain('notes.md');
    // le fichier des sorties n'y est pas
    expect(names()).not.toContain('commit.md');
  });

  it('le nom d’un artefact à la place de son id : rien n’est lu', async () => {
    await open();

    await follow('notes.md');

    // témoin : le relevé liste bien l'artefact, que son id désignerait
    expect(names()).toContain('notes.md');
    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  it('un chemin qui remonte hors du dossier du projet (../commit.md) : rien n’est lu', async () => {
    await open();

    await follow('../commit.md');

    // témoin : le relevé liste bien l'artefact, que son id désignerait
    expect(names()).toContain('notes.md');
    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  it('un chemin absolu, celui d’un artefact : rien n’est lu', async () => {
    await open();

    await follow(path.join(arts, 'notes.md'));

    // témoin : le relevé liste bien l'artefact, que son id désignerait
    expect(names()).toContain('notes.md');
    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  it('un chemin absolu hors de tout : rien n’est lu', async () => {
    await open();

    await follow(secret);

    // témoin : le relevé liste bien l'artefact, que son id désignerait
    expect(names()).toContain('notes.md');
    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  it('un id d’artefact absent du dernier relevé : rien n’est lu', async () => {
    await open();

    await follow('a99');

    // témoin : le relevé liste bien l'artefact, que son id désignerait
    expect(names()).toContain('notes.md');
    // aucun texte de fichier poussé
    expect(texts()).toEqual([]);
  });

  // Le relevé a listé l'artefact ; il devient ensuite un lien vers le dehors.
  it('un artefact remplacé, après le relevé, par un lien qui sort : le dehors n’est pas lu', async () => {
    await open();
    const id = idOf('notes.md');
    linkOut('notes.md');

    await follow(id);

    // le secret du dehors n'est jamais poussé
    expect(JSON.stringify(codes())).not.toContain(SECRET);
  });
});

describe('ouvrir un artefact dans l’éditeur : par son id dans le dernier relevé, rien hors du dossier du projet (I-37)', () => {
  it('témoin : l’id d’un artefact, l’éditeur ouvre ce fichier du dossier du projet', async () => {
    await open();

    await openInEditor(idOf('notes.md'));

    // l'éditeur ouvre ce fichier-là, et lui seul
    expect(editedReal()).toEqual([fs.realpathSync.native(path.join(arts, 'notes.md'))]);
  });

  it('le nom d’un artefact à la place de son id : rien n’est ouvert', async () => {
    await open();

    await openInEditor('notes.md');

    // témoin : le relevé liste bien l'artefact, que son id désignerait
    expect(names()).toContain('notes.md');
    // l'éditeur n'ouvre rien
    expect(fake.edited).toEqual([]);
  });

  it('un chemin qui remonte hors du dossier du projet (../commit.md) : rien n’est ouvert', async () => {
    await open();

    await openInEditor('../commit.md');

    // témoin : le relevé liste bien l'artefact, que son id désignerait
    expect(names()).toContain('notes.md');
    // l'éditeur n'ouvre rien
    expect(fake.edited).toEqual([]);
  });

  it('un chemin absolu hors de tout : rien n’est ouvert', async () => {
    await open();

    await openInEditor(secret);

    // témoin : le relevé liste bien l'artefact, que son id désignerait
    expect(names()).toContain('notes.md');
    // l'éditeur n'ouvre rien
    expect(fake.edited).toEqual([]);
  });

  it('un artefact remplacé, après le relevé, par un lien qui sort : rien n’est ouvert', async () => {
    await open();
    const id = idOf('notes.md');
    linkOut('notes.md');

    await openInEditor(id);

    // l'éditeur n'ouvre rien
    expect(fake.edited).toEqual([]);
  });
});

describe('le schéma vibe-artifact:// ne sert que l’id d’un artefact du dernier relevé de l’agent affiché (I-37)', () => {
  it('témoin : l’adresse que le relevé donne à une image, son contenu est servi', async () => {
    await open();

    const res = await request(urlOf('capture.png'));

    // le corps est le fichier tel qu'il est sur le disque
    expect(await res.text()).toBe(fs.readFileSync(path.join(arts, 'capture.png'), 'utf8'));
  });

  it('le nom d’un artefact à la place de son id : rien n’est servi', async () => {
    await open();

    const res = await request('vibe-artifact://a1/capture.png');

    // la réponse est un refus
    expect(res.ok).toBe(false);
    // le contenu de l'artefact n'y est pas
    expect(await res.text()).not.toContain('CAPTURE');
  });

  // Encodé : ni le parseur d'URL ni la requête ne le résolvent avant le principal.
  it('un chemin qui remonte hors du dossier du projet (..%2Fcommit.md) : rien n’est servi', async () => {
    await open();

    const res = await request('vibe-artifact://a1/..%2Fcommit.md');

    // la réponse est un refus
    expect(res.ok).toBe(false);
    // le fichier des sorties n'y est pas
    expect(await res.text()).not.toContain(COMMIT);
  });

  it('un id suivi d’un chemin qui remonte (a0%2F..%2F..%2Fcommit.md) : rien n’est servi', async () => {
    await open();

    const res = await request('vibe-artifact://a1/a0%2F..%2F..%2Fcommit.md');

    // la réponse est un refus
    expect(res.ok).toBe(false);
    // le fichier des sorties n'y est pas
    expect(await res.text()).not.toContain(COMMIT);
  });

  it('un chemin absolu hors de tout : rien n’est servi', async () => {
    await open();

    const res = await request(`vibe-artifact://a1/${encodeURIComponent(secret)}`);

    // la réponse est un refus
    expect(res.ok).toBe(false);
    // le secret n'y est pas
    expect(await res.text()).not.toContain(SECRET);
  });

  it('un id d’artefact absent du dernier relevé : rien n’est servi', async () => {
    await open();

    const res = await request('vibe-artifact://a1/a99');

    // la réponse est un refus
    expect(res.ok).toBe(false);
  });

  it('l’id d’un artefact d’un agent d’un autre projet, pas affiché : rien n’est servi', async () => {
    await open();

    const res = await request('vibe-artifact://a2/a0');

    // la réponse est un refus
    expect(res.ok).toBe(false);
    // l'artefact de l'autre projet n'y est pas
    expect(await res.text()).not.toContain(PLAN);
  });

  // Le relevé a donné son adresse ; il devient ensuite un lien vers le dehors.
  it('un artefact remplacé, après le relevé, par un lien qui sort : le dehors n’est pas servi', async () => {
    await open();
    const url = urlOf('capture.png');
    linkOut('capture.png');

    const res = await request(url);

    // le secret du dehors n'y est pas
    expect(await res.text()).not.toContain(SECRET);
  });
});

describe('une page HTML ou SVG part avec l’en-tête CSP sandbox, sans script ni réseau', () => {
  it('une page HTML', async () => {
    await open();

    const csp = cspOf(await request(urlOf('maquettes/accueil.html')));

    // la page est mise en bac à sable
    expect(directives(csp).get('sandbox')).toBeDefined();
    // le bac à sable ne permet pas les scripts
    expect(directives(csp).get('sandbox')).not.toContain('allow-scripts');
    // tout ce qui n'est pas permis est refusé
    expect(directives(csp).get('default-src')).toEqual(["'none'"]);
    // aucune source n'ouvre le réseau
    expect(networked(csp)).toEqual([]);
  });

  it('un SVG', async () => {
    await open();

    const csp = cspOf(await request(urlOf('schema.svg')));

    // la page est mise en bac à sable
    expect(directives(csp).get('sandbox')).toBeDefined();
    // le bac à sable ne permet pas les scripts
    expect(directives(csp).get('sandbox')).not.toContain('allow-scripts');
    // tout ce qui n'est pas permis est refusé
    expect(directives(csp).get('default-src')).toEqual(["'none'"]);
    // aucune source n'ouvre le réseau
    expect(networked(csp)).toEqual([]);
  });
});

describe('un artefact qui n’est pas une page ne part jamais comme une page (il s’affiche hors bac à sable)', () => {
  // Son extension en fait une image ; son contenu est du HTML avec un script.
  it('une image qui contient du HTML', async () => {
    await open();

    const res = await request(urlOf('capture.png'));

    // témoin : l'image est servie
    expect(res.ok).toBe(true);
    // son type n'est ni HTML, ni SVG, ni XML : Chromium ne l'exécute pas comme une page
    expect(res.headers.get('content-type') ?? '').not.toMatch(/html|svg|xml/i);
  });
});

describe('toute réponse du schéma porte X-Content-Type-Options: nosniff', () => {
  // L'image contient du HTML : sans nosniff, Chromium pourrait la deviner page.
  it('une image servie', async () => {
    await open();

    const res = await request(urlOf('capture.png'));

    // le navigateur ne devine pas le type
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('une page servie', async () => {
    await open();

    const res = await request(urlOf('maquettes/accueil.html'));

    // le navigateur ne devine pas le type
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('un refus', async () => {
    await open();

    const res = await request('vibe-artifact://a1/a99');

    // le navigateur ne devine pas le type
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

describe('copier un artefact : seulement au clic, seulement dans le dossier choisi (I-39)', () => {
  it('témoin : le clic, le dossier choisi, l’artefact y est copié sous son nom', async () => {
    await open();

    await copy(idOf('notes.md'));

    // le dossier choisi reçoit l'artefact tel qu'il est sur le disque
    expect(fs.readFileSync(path.join(chosen, 'notes.md'), 'utf8')).toBe(fs.readFileSync(path.join(arts, 'notes.md'), 'utf8'));
  });

  it('le dossier choisi ne reçoit que l’artefact, sous son nom de base, et le dépôt est inchangé', async () => {
    await open();

    await copy(idOf('maquettes/accueil.html'));

    // rien d'autre dans le dossier choisi, pas même son sous-dossier
    expect(inChosen()).toEqual(['accueil.html']);
    // rien n'a changé dans le dépôt de l'agent
    expect(changed()).toBe('');
  });

  it('la boîte de dialogue annulée : rien n’est copié', async () => {
    fake.pick = { canceled: true, filePaths: [] };
    await open();

    await copy(idOf('notes.md'));

    // le dossier choisi reste vide
    expect(inChosen()).toEqual([]);
    // rien n'a changé dans le dépôt de l'agent
    expect(changed()).toBe('');
  });

  it('sans clic : relever, afficher, ouvrir un artefact ne copie rien', async () => {
    const { refreshVibe } = await import('app/controllers');
    await open();

    await follow(idOf('notes.md'));
    await openInEditor(idOf('notes.md'));
    await refreshVibe({ now: true });
    await settle();

    // aucune boîte de dialogue n'a demandé de dossier
    expect(fake.picks).toEqual([]);
    // le dossier choisi reste vide
    expect(inChosen()).toEqual([]);
  });

  // Sans { direct: true } : l'action telle que l'agent la ferait, pas le clic de l'appli.
  it('sans le clic de l’appli (pas direct) : rien n’est copié', async () => {
    await open();

    await run('copy-artifact', { artifact: idOf('notes.md') });

    // aucune boîte de dialogue n'a demandé de dossier
    expect(fake.picks).toEqual([]);
    // le dossier choisi reste vide
    expect(inChosen()).toEqual([]);
  });

  it('le nom d’un artefact à la place de son id : rien n’est copié', async () => {
    await open();

    await copy('notes.md');

    // témoin : le relevé liste bien l'artefact, que son id désignerait
    expect(names()).toContain('notes.md');
    // le dossier choisi reste vide
    expect(inChosen()).toEqual([]);
  });

  it('un chemin qui remonte hors du dossier du projet (../commit.md) : rien n’est copié', async () => {
    await open();

    await copy('../commit.md');

    // témoin : le relevé liste bien l'artefact, que son id désignerait
    expect(names()).toContain('notes.md');
    // le dossier choisi reste vide
    expect(inChosen()).toEqual([]);
  });

  it('un chemin absolu hors de tout : rien n’est copié', async () => {
    await open();

    await copy(secret);

    // témoin : le relevé liste bien l'artefact, que son id désignerait
    expect(names()).toContain('notes.md');
    // le dossier choisi reste vide
    expect(inChosen()).toEqual([]);
  });

  it('un artefact remplacé, après le relevé, par un lien qui sort : le dehors n’est pas copié', async () => {
    await open();
    const id = idOf('notes.md');
    linkOut('notes.md');

    await copy(id);

    // le secret du dehors n'arrive pas dans le dossier choisi
    expect(inChosen().map((f) => fs.readFileSync(path.join(chosen, f), 'utf8')).join()).not.toContain(SECRET);
  });
});

describe('un fichier du même nom dans le dossier choisi n’est remplacé qu’avec l’accord de l’utilisateur', () => {
  // Échap ferme la boîte : Electron répond cancelId (0 s'il n'est pas donné).
  it('la question fermée sans choisir : le fichier existant est inchangé', async () => {
    write(path.join(chosen, 'notes.md'), 'MIEN');
    await open();

    await copy(idOf('notes.md'));

    // témoin : l'utilisateur a bien été interrogé
    expect(fake.asked.length).toBeGreaterThan(0);
    // le fichier existant garde son texte
    expect(fs.readFileSync(path.join(chosen, 'notes.md'), 'utf8')).toBe('MIEN');
  });

  // Entrée valide le bouton par défaut (defaultId, 0 s'il n'est pas donné).
  it('le bouton par défaut validé : le fichier existant est inchangé', async () => {
    fake.answer = (o) => o.defaultId ?? 0;
    write(path.join(chosen, 'notes.md'), 'MIEN');
    await open();

    await copy(idOf('notes.md'));

    // témoin : l'utilisateur a bien été interrogé
    expect(fake.asked.length).toBeGreaterThan(0);
    // le fichier existant garde son texte
    expect(fs.readFileSync(path.join(chosen, 'notes.md'), 'utf8')).toBe('MIEN');
  });

  it('témoin : Remplacer choisi, le fichier existant devient l’artefact', async () => {
    fake.answer = (o) => o.buttons.findIndex((b) => /rempla|replace/i.test(b));
    write(path.join(chosen, 'notes.md'), 'MIEN');
    await open();

    await copy(idOf('notes.md'));

    // le fichier du dossier choisi porte le texte de l'artefact
    expect(fs.readFileSync(path.join(chosen, 'notes.md'), 'utf8')).toBe(fs.readFileSync(path.join(arts, 'notes.md'), 'utf8'));
  });
});
