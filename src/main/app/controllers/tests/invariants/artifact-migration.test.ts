// Invariants du déplacement des anciens artefacts (note 0.13.0,
// docs/tickets/fix/0.13.0-fix-and-improvements.md, sujet 8, « Ce que ça ne doit pas
// faire ») : perdre ou écraser un artefact en le déplaçant vers le dossier du projet.
// Forme : à chaque démarrage, ce qui reste sous vibecoder-out/<agent>/artifacts/ part ;
// un fichier en échec reste et repart au démarrage suivant, sans autre état ; le
// projet : l'agent de la config, sinon l'entrée d'artifacts-left.json, supprimé une fois
// tout parti ; un agent connu de nulle part : rien ne bouge ; ni lien suivi, ni dossier
// caché déplacé. Les mêmes octets, en détail : technicals/file-tree/tests/invariants/move-same-bytes.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, réglages et fichiers sur disque, vrais liens
// symboliques, vrais droits, git réel sur un dépôt d'essai et son worktree) ; faux :
// Electron et le SDK de Claude Code (aucun tour ne commence ici).
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fake = vi.hoisted(() => ({ cwd: process.cwd(), userData: '' }));

vi.mock('electron', () => ({
  app: { getPath: () => fake.userData },
  BrowserWindow: class {},
  screen: { getDisplayMatching: () => ({ workArea: { x: 0, y: 0, width: 1920, height: 1080 } }) },
  protocol: { registerSchemesAsPrivileged: () => {}, handle: () => {} },
  dialog: { showOpenDialog: async () => ({ canceled: true, filePaths: [] }), showMessageBox: async () => ({ response: 0 }) },
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
// Liens de fichier et droits : sans équivalent simple sous Windows.
const posix = describe.skipIf(process.platform === 'win32');

let repo = '';      // le dossier de a1, un dépôt git
let worktree = '';  // le dossier de a2, un worktree de ce dépôt
let solo = '';      // le dossier de a3, hors git
let outside = '';   // un dossier hors de tout, à ne pas toucher
let secret = '';    // un fichier hors de tout

const SECRET = 'SECRET_DEHORS';
// Les anciens artefacts d'un agent.
const legacy = (id: string) => path.join(fake.userData, 'vibecoder-out', id, 'artifacts');
// Le dossier du projet d'un dossier, sans le créer.
const projectOf = async (dir: string) => (await import('app/controllers')).projectArtifactsPath(dir);
const start = async () => (await import('app/controllers')).moveLegacyArtifacts();

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
const leftFile = () => path.join(fake.userData, 'artifacts-left.json');
const writeLeft = (entries: Record<string, string>) => write(leftFile(), JSON.stringify(entries));

// Les droits retirés sont rendus, pour que le dossier temporaire s'efface.
const locked: string[] = [];
const lock = (p: string) => { fs.chmodSync(p, 0o555); locked.push(p); };
const unlock = () => { for (const p of locked.splice(0)) fs.chmodSync(p, 0o755); };

const AGENT = { model: 'opus', effort: 'high', mode: 'default', sessionId: null };

beforeEach(() => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-artifact-migration-')));
  repo = path.join(fake.userData, 'projet');
  worktree = path.join(fake.userData, 'projet-worktrees', 'enfant');
  solo = path.join(fake.userData, 'seul');
  outside = path.join(fake.userData, 'dehors');
  secret = path.join(outside, 'secret.md');
  fs.mkdirSync(repo, { recursive: true });
  fs.mkdirSync(solo, { recursive: true });
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
      { ...AGENT, id: 'a1', dir: repo, name: 'parent' },
      { ...AGENT, id: 'a2', dir: worktree, name: 'enfant', parent: { id: 'a1' } },
      { ...AGENT, id: 'a3', dir: solo, name: 'seul' },
    ],
  }));
});
afterEach(() => { unlock(); vi.useRealTimers(); });

describe('au démarrage, ce qui reste part vers le dossier de son projet', () => {
  it('témoin : un artefact de l’agent du dépôt arrive, sous son chemin, et quitte l’ancien dossier', async () => {
    write(path.join(legacy('a1'), 'maquettes', 'accueil.html'), 'PAGE');

    await start();

    // arrivé, sous-dossier compris
    expect(read(path.join(await projectOf(repo), 'maquettes', 'accueil.html'))).toBe('PAGE');
    // l'ancien dossier ne l'a plus
    expect(contents(legacy('a1'))).not.toContain('PAGE');
  });

  it('l’agent du dépôt et le robot de son worktree : tout arrive dans le même dossier', async () => {
    write(path.join(legacy('a1'), 'du-depot.md'), 'DEPOT');
    write(path.join(legacy('a2'), 'du-robot.md'), 'ROBOT');

    await start();

    // le dépôt et son worktree ont le même dossier
    expect(await projectOf(worktree)).toBe(await projectOf(repo));
    // les deux y sont
    expect(contents(await projectOf(repo))).toEqual(expect.arrayContaining(['DEPOT', 'ROBOT']));
  });

  it('un dossier hors git est son propre projet : son artefact ne va pas chez le dépôt', async () => {
    write(path.join(legacy('a3'), 'rapport.md'), 'SEUL');

    await start();

    // il est dans le dossier de son projet
    expect(contents(await projectOf(solo))).toContain('SEUL');
    // pas dans celui du dépôt
    expect(contents(await projectOf(repo))).not.toContain('SEUL');
  });

  it('un agent retiré, connu par artifacts-left.json : son artefact va au projet de son dossier', async () => {
    write(path.join(legacy('a7'), 'rapport.md'), 'LAISSE');
    writeLeft({ a7: worktree });

    await start();

    // il est dans le dossier du projet de ce worktree
    expect(contents(await projectOf(repo))).toContain('LAISSE');
    // l'ancien dossier ne l'a plus
    expect(contents(legacy('a7'))).not.toContain('LAISSE');
  });

  it('une entrée dont le dossier a disparu : l’artefact va au dossier de ce chemin', async () => {
    const gone = path.join(fake.userData, 'parti');
    write(path.join(legacy('a7'), 'rapport.md'), 'LAISSE');
    writeLeft({ a7: gone });

    await start();

    // il est dans le dossier de ce chemin
    expect(contents(await projectOf(gone))).toContain('LAISSE');
    // il n'est plus à l'ancienne place
    expect(contents(legacy('a7'))).not.toContain('LAISSE');
  });

  // Une entrée ancienne ne doit pas envoyer l'artefact d'un agent vivant dans un autre projet.
  it('un agent à la fois dans la config et dans artifacts-left.json : la config l’emporte', async () => {
    write(path.join(legacy('a1'), 'rapport.md'), 'DEPOT');
    writeLeft({ a1: solo });

    await start();

    // il est dans le dossier du projet de la config
    expect(contents(await projectOf(repo))).toContain('DEPOT');
    // pas dans celui de l'entrée
    expect(contents(await projectOf(solo))).not.toContain('DEPOT');
  });

  it('un agent connu de nulle part : rien ne bouge', async () => {
    write(path.join(legacy('a8'), 'rapport.md'), 'INCONNU');
    const before = snapshot(legacy('a8'));

    await start();

    // ses artefacts n'ont pas changé
    expect(snapshot(legacy('a8'))).toEqual(before);
    // ils ne sont arrivés dans aucun dossier de projet
    expect(contents(path.join(fake.userData, 'vibecoder-artifacts'))).not.toContain('INCONNU');
  });

  it('artifacts-left.json illisible : la promesse ne rejette pas, l’artefact d’un agent inconnu reste, celui de la config part', async () => {
    write(path.join(legacy('a8'), 'rapport.md'), 'INCONNU');
    write(path.join(legacy('a1'), 'rapport.md'), 'DEPOT');
    write(leftFile(), '{ pas du json');

    await start();

    // celui de l'agent inconnu est toujours là
    expect(read(path.join(legacy('a8'), 'rapport.md'))).toBe('INCONNU');
    // témoin : celui de la config est parti
    expect(contents(await projectOf(repo))).toContain('DEPOT');
  });

  it('une entrée d’artifacts-left.json qui n’est pas un chemin : la promesse ne rejette pas, l’artefact reste', async () => {
    write(path.join(legacy('a7'), 'rapport.md'), 'LAISSE');
    write(leftFile(), JSON.stringify({ a7: 12 }));

    await start();

    // il est toujours là
    expect(read(path.join(legacy('a7'), 'rapport.md'))).toBe('LAISSE');
  });

  // Le relevé s'arrête à 1 000 (LIST_MAX) : le déplacement n'y passe pas.
  it('plus de 1 000 artefacts : tous arrivent', async () => {
    const count = 1001;
    for (let i = 0; i < count; i++) write(path.join(legacy('a1'), `f${i}.md`), `F${i}`);

    await start();

    // autant à l'arrivée qu'au départ
    expect(Object.keys(snapshot(await projectOf(repo)))).toHaveLength(count);
  });

  it('un dossier caché reste à sa place, le fichier d’à côté part', async () => {
    write(path.join(legacy('a1'), '.cache', 'interne.md'), 'CACHE');
    write(path.join(legacy('a1'), 'rapport.md'), 'DEPOT');

    await start();

    // il est toujours à sa place, avec son texte
    expect(read(path.join(legacy('a1'), '.cache', 'interne.md'))).toBe('CACHE');
    // il n'est pas arrivé dans le dossier du projet
    expect(contents(await projectOf(repo))).not.toContain('CACHE');
    // témoin : le fichier d'à côté est parti
    expect(contents(await projectOf(repo))).toContain('DEPOT');
  });

  it('rien n’arrive dans le dépôt ni dans son worktree', async () => {
    write(path.join(legacy('a1'), 'rapport.md'), 'DEPOT');
    write(path.join(legacy('a2'), 'plan.md'), 'ROBOT');

    await start();

    // témoin : ils sont arrivés
    expect(contents(await projectOf(repo))).toEqual(expect.arrayContaining(['DEPOT', 'ROBOT']));
    // git ne voit rien de changé dans le dépôt
    expect(git(repo, 'status', '--porcelain').toString()).toBe('');
    // git ne voit rien de changé dans le worktree
    expect(git(worktree, 'status', '--porcelain').toString()).toBe('');
  });

  it('un second démarrage, sur des dossiers vides : rien ne change', async () => {
    write(path.join(legacy('a1'), 'rapport.md'), 'DEPOT');
    await start();
    const before = snapshot(fake.userData);

    await start();

    // rien n'a changé, nulle part dans le profil
    expect(snapshot(fake.userData)).toEqual(before);
  });
});

describe('au déplacement : jamais d’écrasement', () => {
  it('un artefact du même nom, un autre texte, déjà dans le dossier du projet : il le garde, l’autre arrive', async () => {
    write(path.join(await projectOf(repo), 'rapport.md'), 'DEJA_LA');
    write(path.join(legacy('a1'), 'rapport.md'), 'ANCIEN');

    await start();

    // l'existant n'a pas changé
    expect(read(path.join(await projectOf(repo), 'rapport.md'))).toBe('DEJA_LA');
    // l'autre est arrivé
    expect(contents(await projectOf(repo))).toContain('ANCIEN');
  });

  it('rapport.md et rapport-2.md déjà là : aucun n’est écrasé, le troisième arrive', async () => {
    write(path.join(await projectOf(repo), 'rapport.md'), 'UN');
    write(path.join(await projectOf(repo), 'rapport-2.md'), 'DEUX');
    write(path.join(legacy('a1'), 'rapport.md'), 'TROIS');

    await start();

    // le premier n'a pas changé
    expect(read(path.join(await projectOf(repo), 'rapport.md'))).toBe('UN');
    // le deuxième n'a pas changé
    expect(read(path.join(await projectOf(repo), 'rapport-2.md'))).toBe('DEUX');
    // le troisième est arrivé
    expect(contents(await projectOf(repo))).toContain('TROIS');
  });

  it('le même nom chez l’agent du dépôt et chez son robot, deux textes : les deux arrivent', async () => {
    write(path.join(legacy('a1'), 'rapport.md'), 'DEPOT');
    write(path.join(legacy('a2'), 'rapport.md'), 'ROBOT');

    await start();

    // les deux sont dans le dossier du projet, aucun n'a écrasé l'autre
    expect(contents(await projectOf(repo))).toEqual(expect.arrayContaining(['DEPOT', 'ROBOT']));
  });

  // La coupure entre la copie et l'effacement laisse les deux, et le démarrage suivant reprend.
  it('après une coupure, le même nom et les mêmes octets des deux côtés : la source part, pas de rapport-2.md', async () => {
    write(path.join(await projectOf(repo), 'rapport.md'), 'RAPPORT');
    write(path.join(legacy('a1'), 'rapport.md'), 'RAPPORT');

    await start();

    // à l'arrivée, un seul fichier, avec son texte
    expect(snapshot(await projectOf(repo))).toEqual({ 'rapport.md': 'RAPPORT' });
    // la source n'est plus là
    expect(contents(legacy('a1'))).not.toContain('RAPPORT');
  });

  // La coupure pendant la copie : risque accepté, la copie tronquée reste, rien n'est perdu.
  it('après une coupure, une copie tronquée à l’arrivée : elle reste, la source arrive entière', async () => {
    write(path.join(await projectOf(repo), 'rapport.md'), 'RAPP');
    write(path.join(legacy('a1'), 'rapport.md'), 'RAPPORT');

    await start();

    // la copie tronquée n'a pas changé
    expect(read(path.join(await projectOf(repo), 'rapport.md'))).toBe('RAPP');
    // la source est arrivée, entière
    expect(contents(await projectOf(repo))).toContain('RAPPORT');
  });
});

posix('un déplacement qui échoue laisse le fichier sur le disque, et il repart au démarrage suivant', () => {
  // Le sous-dossier du projet est en lecture seule : la copie de ce fichier-là échoue.
  async function blocked() {
    write(path.join(legacy('a1'), 'sous', 'x.md'), 'BLOQUE');
    write(path.join(legacy('a1'), 'libre.md'), 'LIBRE');
    fs.mkdirSync(path.join(await projectOf(repo), 'sous'), { recursive: true });
    lock(path.join(await projectOf(repo), 'sous'));
  }

  it('le fichier reste à sa place, avec son texte, et la promesse ne rejette pas', async () => {
    await blocked();

    await start();

    // il est toujours là
    expect(read(path.join(legacy('a1'), 'sous', 'x.md'))).toBe('BLOQUE');
    // témoin : le fichier libre est parti
    expect(contents(await projectOf(repo))).toContain('LIBRE');
  });

  it('au démarrage suivant, sans autre état, il repart', async () => {
    await blocked();
    await start();
    unlock();

    await start();

    // il est dans le dossier du projet
    expect(read(path.join(await projectOf(repo), 'sous', 'x.md'))).toBe('BLOQUE');
    // il n'est plus à l'ancienne place
    expect(contents(legacy('a1'))).not.toContain('BLOQUE');
  });

  // Sans entrée, l'agent retiré deviendrait connu de nulle part : son fichier ne repartirait jamais.
  it('un fichier d’un agent retiré qui n’a pas pu partir : artifacts-left.json reste, et il repart au suivant', async () => {
    write(path.join(legacy('a7'), 'sous', 'x.md'), 'BLOQUE');
    writeLeft({ a7: repo });
    fs.mkdirSync(path.join(await projectOf(repo), 'sous'), { recursive: true });
    lock(path.join(await projectOf(repo), 'sous'));

    await start();

    // il est toujours là
    expect(read(path.join(legacy('a7'), 'sous', 'x.md'))).toBe('BLOQUE');
    // l'entrée reste
    expect(JSON.parse(read(leftFile()))).toHaveProperty('a7');

    unlock();
    await start();

    // la tentative suivante le déplace
    expect(read(path.join(await projectOf(repo), 'sous', 'x.md'))).toBe('BLOQUE');
  });

  it('une entrée dont tous les fichiers sont partis, une autre qui garde un fichier : artifacts-left.json reste', async () => {
    write(path.join(legacy('a6'), 'libre.md'), 'LIBRE');
    write(path.join(legacy('a7'), 'sous', 'x.md'), 'BLOQUE');
    writeLeft({ a6: repo, a7: repo });
    fs.mkdirSync(path.join(await projectOf(repo), 'sous'), { recursive: true });
    lock(path.join(await projectOf(repo), 'sous'));

    await start();

    // témoin : celui de la première entrée est parti
    expect(contents(await projectOf(repo))).toContain('LIBRE');
    // le fichier reste, pour l'entrée qui garde un fichier
    expect(JSON.parse(read(leftFile()))).toHaveProperty('a7');
  });

  it('une entrée de plus sans fichier : tout parti, artifacts-left.json est supprimé', async () => {
    write(path.join(legacy('a7'), 'rapport.md'), 'LAISSE');
    writeLeft({ a7: repo, a6: repo });

    await start();

    // témoin : il est parti
    expect(contents(await projectOf(repo))).toContain('LAISSE');
    // le fichier n'a plus de raison d'être
    expect(fs.existsSync(leftFile())).toBe(false);
  });
});

posix('au déplacement : un lien n’est jamais suivi', () => {
  it('les anciens artifacts/ sont un lien : le dehors n’arrive pas, et reste intact', async () => {
    const before = snapshot(outside);
    fs.mkdirSync(path.dirname(legacy('a1')), { recursive: true });
    fs.symlinkSync(outside, legacy('a1'));

    await start();

    // le dehors n'est pas dans le dossier du projet
    expect(contents(await projectOf(repo))).not.toContain(SECRET);
    // le dehors n'a pas changé
    expect(snapshot(outside)).toEqual(before);
  });

  it('un lien sous les anciens artifacts/ : sa cible n’arrive pas, et reste intacte', async () => {
    write(path.join(legacy('a1'), 'rapport.md'), 'DEPOT');
    fs.symlinkSync(secret, path.join(legacy('a1'), 'lien.md'));

    await start();

    // témoin : le fichier ordinaire est arrivé
    expect(contents(await projectOf(repo))).toContain('DEPOT');
    // la cible n'est pas dans le dossier du projet
    expect(contents(await projectOf(repo))).not.toContain(SECRET);
    // la cible n'a pas changé
    expect(read(secret)).toBe(SECRET);
  });

  it('le dossier du projet est un lien : rien n’arrive dans sa cible, le fichier reste', async () => {
    const before = snapshot(outside);
    const root = await projectOf(repo);
    write(path.join(legacy('a1'), 'rapport.md'), 'DEPOT');
    fs.mkdirSync(path.dirname(root), { recursive: true });
    fs.symlinkSync(outside, root);

    await start();

    // le dehors n'a pas changé
    expect(snapshot(outside)).toEqual(before);
    // le fichier est toujours à sa place
    expect(read(path.join(legacy('a1'), 'rapport.md'))).toBe('DEPOT');
  });

  it('un lien sous le dossier du projet, au nom d’un sous-dossier : rien n’arrive dans sa cible', async () => {
    const before = snapshot(outside);
    const root = await projectOf(repo);
    write(path.join(legacy('a1'), 'sous', 'x.md'), 'DEPOT');
    fs.mkdirSync(root, { recursive: true });
    fs.symlinkSync(outside, path.join(root, 'sous'));

    await start();

    // le dehors n'a pas changé
    expect(snapshot(outside)).toEqual(before);
    // le fichier est quelque part, à l'arrivée ou à sa place
    expect([...contents(root), ...contents(legacy('a1'))]).toContain('DEPOT');
  });

  it('une entrée d’artifacts-left.json dont le dossier est un lien : son projet, résolu', async () => {
    const linked = path.join(fake.userData, 'lien-projet');
    fs.symlinkSync(repo, linked);
    write(path.join(legacy('a7'), 'rapport.md'), 'LAISSE');
    writeLeft({ a7: linked });

    await start();

    // il est dans le dossier du projet que le lien désigne
    expect(contents(await projectOf(repo))).toContain('LAISSE');
  });
});
