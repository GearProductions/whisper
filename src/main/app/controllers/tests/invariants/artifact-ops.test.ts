// Invariants de la gestion des artefacts comme des fichiers (note 0.13.0,
// docs/tickets/feat/0.13.0-gestion-artefacts.md, « Ce que ça ne doit pas faire ») :
//   - renommer, créer, déplacer, coller, déposer ou supprimer hors du dossier
//     d'artefacts du projet, un nom en `..`, absolu, avec un séparateur ou un NUL
//     compris, un id de dossier en forme de chemin aussi (I-37, I-39) ;
//   - effacer définitivement : une suppression passe toujours par la corbeille du
//     système ;
//   - suivre un lien, ni un lien sous le dossier, ni un dossier qui serait un lien
//     (I-37) ;
//   - écraser un artefact existant en renommant, déplaçant, collant ou dupliquant ;
//   - supprimer un autre élément que ceux confirmés : les ids `a<i>` / `d<i>` glissent
//     quand la liste change, un robot peut écrire entre le relevé et le clic.
// Les actions arrivent comme la page les envoie (conv:vibeRun, { direct: true }) :
// rename-artifact, new-artifact-file, new-artifact-folder, move-artifacts,
// copy-artifacts (Coller), duplicate-artifacts, trash-artifacts ; le dépôt par
// dropOnArtifacts(chemins, dossier). La page ne donne que des ids du dernier relevé,
// le nom tapé et les noms confirmés. Le dépôt à la racine, le transfert et le pont :
// artifact-moves.test.ts, tests/invariants/vibe-drop.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal (contrôleurs, fenêtres, état, réglages et fichiers sur disque,
// vrais liens symboliques, git réel sur un dépôt d'essai), par le décor commun
// (app/tests/harness) ; faux : Electron (fenêtres qui relèvent ce qu'on leur envoie ; la
// corbeille du système, shell.trashItem, qui range ce qu'on lui donne dans un dossier à part
// et relève les chemins reçus) et le SDK de Claude Code (aucun tour ne commence ici).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, closeAll, fakeClaude, fakeElectron, openPanel, profile, repo, repoResources, settle, slow, write, writeConfig } from 'app/tests/harness';

// La corbeille du système (shell.trashItem) : le reste du faux d'Electron est celui du décor commun.
const fake = {
  // Les chemins donnés à la corbeille du système, et ce qu'elle en fait.
  trashed: [] as string[],
  trash: async (_file: string) => {},
};
const electron = fakeElectron({ shell: { trashItem: (file: string) => { fake.trashed.push(file); return fake.trash(file); } } });
const claude = fakeClaude();   // aucun tour ici ; un message reçu ne fait rien
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

const read = (file: string) => fs.readFileSync(file, 'utf8');
// Liens de fichier : sans équivalent simple sous Windows.
const posix = describe.skipIf(process.platform === 'win32');

let userData = '';  // le profil d'essai
let dir = '';       // le dépôt de l'agent affiché
let arts = '';      // le dossier d'artefacts de son projet
let outside = '';   // un dossier hors de tout, à ne pas toucher
let secret = '';    // un fichier de ce dossier
let elsewhere = ''; // un autre dossier hors de tout, qui a un accueil.html comme maquettes/
let drops = '';     // ce que l'utilisateur dépose depuis le gestionnaire de fichiers
let bin = '';       // la corbeille du système (factice)

const NOTES = 'NOTES_TEXTE';
const PLAN = 'PLAN_TEXTE';
const ACCUEIL = 'ACCUEIL_TEXTE';
const ARCHIVE = 'ARCHIVE_TEXTE';
const VIEUX = 'VIEUX_TEXTE';
const COMMIT = 'AU_DESSUS_DES_ARTEFACTS';
const SECRET = 'SECRET_DEHORS';
const AILLEURS = 'AILLEURS_TEXTE';
const DEPOSE = 'DEPOSE_TEXTE';

// Tout ce qu'il y a sous un dossier, sans suivre aucun lien : chemin → contenu.
function snapshot(root: string) {
  const found: Record<string, string> = {};
  if (!fs.existsSync(root)) return found;
  for (const name of fs.readdirSync(root, { recursive: true }).map(String)) {
    const p = path.join(root, name);
    const st = fs.lstatSync(p);
    found[name] = st.isSymbolicLink() ? `lien:${fs.readlinkSync(p)}` : st.isDirectory() ? 'dossier' : read(p);
  }
  return found;
}
// Les contenus sous un dossier, où qu'ils soient.
const contents = (root: string) => Object.values(snapshot(root));
// Combien de fichiers sous un dossier portent ce texte.
const copiesOf = (root: string, text: string) => contents(root).filter((c) => c === text).length;
// Tout le profil hors du dossier d'artefacts, sauf ce que l'appli y tient pour elle (réglages,
// sorties des agents) et la corbeille factice.
function aroundArts() {
  const under = path.relative(userData, arts);
  const skipped = [under, 'vibecoder-out', path.relative(userData, bin)];
  return Object.entries(snapshot(userData))
    .filter(([name]) => name !== 'config.json' && !skipped.some((s) => name === s || name.startsWith(s + path.sep)));
}
// Un élément du dossier d'artefacts remplacé par un lien vers la cible.
function linkInArts(name: string, target: string) {
  fs.rmSync(path.join(arts, name), { recursive: true, force: true });
  fs.symlinkSync(target, path.join(arts, name));
}

// Ce que la page reçoit : le dernier relevé.
type Item = { id: string; name: string };
type View = { artifacts?: Item[]; artifactDirs?: Item[]; actions?: { id: string }[] };
const panel = () => electron.windows.at(-1)!;
const survey = () => panel().sent.filter(([ch]) => ch === 'conv:vibe').at(-1)![1] as View;
const shownActions = () => (survey().actions ?? []).map((a) => a.id);
// L'id que le dernier relevé donne à cet artefact ; sans lui, le cas ne peut pas commencer.
function idOf(name: string) {
  const a = (survey().artifacts ?? []).find((x) => x.name === name);
  if (!a) throw new Error(`le relevé ne donne aucun artefact ${name}`);
  return a.id;
}
// L'id que le dernier relevé donne à ce dossier ; sans lui, le cas ne peut pas commencer.
function dirOf(name: string) {
  const d = (survey().artifactDirs ?? []).find((x) => x.name === name);
  if (!d) throw new Error(`le relevé ne donne aucun dossier ${name}`);
  return d.id;
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  fake.trashed = [];
  userData = profile('whisper-artifact-ops-');
  dir = path.join(userData, 'projet');
  outside = path.join(userData, 'dehors');
  secret = path.join(outside, 'secret.md');
  elsewhere = path.join(userData, 'ailleurs');
  drops = path.join(userData, 'depose');
  bin = path.join(userData, 'corbeille');
  // La corbeille factice : elle range ce qu'on lui donne (le lien lui-même, s'il en est un).
  fs.mkdirSync(bin, { recursive: true });
  fake.trash = async (file: string) => { fs.renameSync(file, path.join(bin, `${fake.trashed.length}-${path.basename(file)}`)); };
  write(secret, SECRET);
  write(path.join(elsewhere, 'accueil.html'), AILLEURS);
  write(path.join(drops, 'rapport.md'), DEPOSE);
  repo(dir);
  writeConfig(userData, [
    { id: 'a1', dir, name: 'essai', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder',
      vibe: { flow: 'create', autonomy: 'guide', pr: null } },
  ]);
  const { projectArtifactsPath } = await import('app/controllers');
  arts = projectArtifactsPath(dir);
  // Les artefacts : deux fichiers à la racine, un dossier, un dossier qui a déjà un notes.md et un
  // maquettes/ ; juste au-dessus du dossier d'artefacts, un fichier, pour un `..` qui remonterait.
  write(path.join(arts, 'notes.md'), NOTES);
  write(path.join(arts, 'plan.md'), PLAN);
  write(path.join(arts, 'maquettes', 'accueil.html'), ACCUEIL);
  write(path.join(arts, 'archives', 'notes.md'), ARCHIVE);
  write(path.join(arts, 'archives', 'maquettes', 'vieux.html'), VIEUX);
  write(path.join(arts, '..', 'commit.md'), COMMIT);
});
afterEach(closeAll);

// Le panneau ouvert sur l'agent a1, en VibeCoder, son premier relevé reçu.
const open = () => openPanel('a1');
// Un nouveau relevé, comme celui des 4 s.
async function resurvey() {
  const { refreshVibe } = await import('app/controllers');
  await refreshVibe({ now: true });
  await settle();
}

// Une action envoyée par la page au clic (conv:vibeRun, { direct: true }).
async function run(action: string, args: object) {
  await click(action, { direct: true, ...args });
  await settle();
}
const rename = (id: unknown, name: unknown) => run('rename-artifact', { artifacts: [id], name });
const newFile = (folder: unknown, name: unknown) => run('new-artifact-file', { folder, name });
const newFolder = (folder: unknown, name: unknown) => run('new-artifact-folder', { folder, name });
const move = (ids: unknown[], folder: unknown) => run('move-artifacts', { artifacts: ids, folder });
const paste = (ids: unknown[], folder: unknown) => run('copy-artifacts', { artifacts: ids, folder });
const duplicate = (ids: unknown[]) => run('duplicate-artifacts', { artifacts: ids });
const trash = (ids: unknown, names: unknown) => run('trash-artifacts', { artifacts: ids, names });
// Un dépôt depuis le gestionnaire de fichiers, lâché sur ce dossier (conv:vibeDrop).
async function drop(paths: unknown, folder: unknown) {
  const { dropOnArtifacts } = await import('app/controllers');
  const dropOn: (paths: unknown, folder: unknown) => unknown = dropOnArtifacts;
  dropOn(paths, folder);
  await settle();
}

describe('rester dans le dossier d’artefacts du projet : renommer (I-37, I-39)', () => {
  it('témoin : un nom simple, l’artefact le prend, à sa place', async () => {
    await open();

    await rename(idOf('notes.md'), 'compte-rendu.md');

    // l'artefact porte le nouveau nom, avec son texte
    expect(read(path.join(arts, 'compte-rendu.md'))).toBe(NOTES);
  });

  it('le nom `..` : rien ne change, ni dehors ni dedans', async () => {
    await open();
    const before = aroundArts();
    const inside = snapshot(arts);

    await rename(idOf('notes.md'), '..');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('rename-artifact');
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
    // rien n'a changé dans le dossier d'artefacts
    expect(snapshot(arts)).toEqual(inside);
  });

  it('un nom qui remonte (../vole.md) : rien n’est écrit hors du dossier d’artefacts', async () => {
    await open();
    const before = aroundArts();

    await rename(idOf('notes.md'), '../vole.md');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('rename-artifact');
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
  });

  it('un nom absolu : rien n’est écrit hors du dossier d’artefacts', async () => {
    await open();
    const before = aroundArts();

    await rename(idOf('notes.md'), path.join(outside, 'vole.md'));

    // témoin : l'action existe bien
    expect(shownActions()).toContain('rename-artifact');
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
  });

  // Un `/` ne sortirait pas ici, mais rangerait l'artefact dans un sous-dossier : un nom seul, refusé.
  it('un nom avec un séparateur / : rien ne change', async () => {
    await open();
    const inside = snapshot(arts);

    await rename(idOf('notes.md'), 'maquettes/notes.md');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('rename-artifact');
    // rien n'a changé dans le dossier d'artefacts
    expect(snapshot(arts)).toEqual(inside);
  });

  // Un caractère permis sous Linux, un séparateur sous Windows : refusé partout.
  it('un nom avec un séparateur \\ : rien ne change', async () => {
    await open();
    const inside = snapshot(arts);

    await rename(idOf('notes.md'), 'maquettes\\notes.md');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('rename-artifact');
    // rien n'a changé dans le dossier d'artefacts
    expect(snapshot(arts)).toEqual(inside);
  });

  it('un nom avec un NUL : rien ne change', async () => {
    await open();
    const inside = snapshot(arts);

    await rename(idOf('notes.md'), 'notes\0.md');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('rename-artifact');
    // rien n'a changé dans le dossier d'artefacts
    expect(snapshot(arts)).toEqual(inside);
  });

  it('un id en forme de chemin qui remonte (../commit.md) : rien ne change hors du dossier d’artefacts', async () => {
    await open();
    const before = aroundArts();

    await rename('../commit.md', 'vole.md');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('rename-artifact');
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
  });

  it('un id en forme de chemin absolu : rien ne change hors du dossier d’artefacts', async () => {
    await open();
    const before = aroundArts();

    await rename(secret, 'vole.md');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('rename-artifact');
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
  });
});

describe('rester dans le dossier d’artefacts du projet : nouveau fichier, nouveau dossier (I-37, I-39)', () => {
  it('témoin : un nom simple dans un dossier, le fichier y est créé', async () => {
    await open();

    await newFile(dirOf('maquettes'), 'idee.md');

    // le fichier est dans ce dossier
    expect(fs.existsSync(path.join(arts, 'maquettes', 'idee.md'))).toBe(true);
  });

  it('un nom de fichier qui remonte (../vole.md) : rien n’est écrit hors du dossier d’artefacts', async () => {
    await open();
    const before = aroundArts();

    await newFile(undefined, '../vole.md');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('new-artifact-file');
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
  });

  it('un nom de fichier absolu : rien n’est écrit hors du dossier d’artefacts', async () => {
    await open();
    const before = aroundArts();

    await newFile(undefined, path.join(outside, 'vole.md'));

    // témoin : l'action existe bien
    expect(shownActions()).toContain('new-artifact-file');
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
  });

  it('un nom de fichier avec un NUL : rien ne change', async () => {
    await open();
    const inside = snapshot(arts);

    await newFile(undefined, 'vole\0.md');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('new-artifact-file');
    // rien n'a changé dans le dossier d'artefacts
    expect(snapshot(arts)).toEqual(inside);
  });

  it('un nom de dossier qui remonte (../vole) : rien n’est écrit hors du dossier d’artefacts', async () => {
    await open();
    const before = aroundArts();

    await newFolder(undefined, '../vole');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('new-artifact-folder');
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
  });

  it('un nom de dossier absolu : rien n’est écrit hors du dossier d’artefacts', async () => {
    await open();
    const before = aroundArts();

    await newFolder(undefined, path.join(outside, 'vole'));

    // témoin : l'action existe bien
    expect(shownActions()).toContain('new-artifact-folder');
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
  });

  it('un id de dossier en forme de chemin qui remonte (..) : rien n’est écrit hors du dossier d’artefacts', async () => {
    await open();
    const before = aroundArts();

    await newFile('..', 'vole.md');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('new-artifact-file');
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
  });

  it('un id de dossier en forme de chemin absolu : rien n’est écrit hors du dossier d’artefacts', async () => {
    await open();
    const before = aroundArts();

    await newFolder(outside, 'vole');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('new-artifact-folder');
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
  });
});

describe('rester dans le dossier d’artefacts du projet : déplacer, coller, dupliquer (I-37, I-39)', () => {
  it('témoin : déplacer un artefact dans un dossier, il y arrive et quitte sa place', async () => {
    await open();

    await move([idOf('notes.md')], dirOf('maquettes'));

    // il est dans le dossier, avec son texte
    expect(read(path.join(arts, 'maquettes', 'notes.md'))).toBe(NOTES);
    // il n'est plus à sa place
    expect(fs.existsSync(path.join(arts, 'notes.md'))).toBe(false);
  });

  it('déplacer vers un id de dossier qui remonte (..) : rien hors du dossier d’artefacts, l’artefact reste', async () => {
    await open();
    const before = aroundArts();

    await move([idOf('notes.md')], '..');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('move-artifacts');
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
    // l'artefact n'est pas perdu
    expect(contents(arts)).toContain(NOTES);
  });

  it('déplacer vers un id de dossier en chemin absolu : rien hors du dossier d’artefacts, l’artefact reste', async () => {
    await open();
    const before = aroundArts();

    await move([idOf('notes.md')], outside);

    // témoin : l'action existe bien
    expect(shownActions()).toContain('move-artifacts');
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
    // l'artefact n'est pas perdu
    expect(contents(arts)).toContain(NOTES);
  });

  it('déplacer un id en chemin absolu hors de tout : le fichier n’est ni pris ni lu', async () => {
    await open();
    const before = aroundArts();

    await move([secret], dirOf('maquettes'));

    // témoin : l'action existe bien
    expect(shownActions()).toContain('move-artifacts');
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
    // son texte n'est pas entré dans le dossier d'artefacts
    expect(contents(arts)).not.toContain(SECRET);
  });

  it('témoin : coller un artefact dans un dossier, il y est copié et reste à sa place', async () => {
    await open();

    await paste([idOf('notes.md')], dirOf('maquettes'));

    // la copie est dans le dossier
    expect(read(path.join(arts, 'maquettes', 'notes.md'))).toBe(NOTES);
    // l'original est à sa place
    expect(read(path.join(arts, 'notes.md'))).toBe(NOTES);
  });

  it('coller vers un id de dossier qui remonte (../..) : rien hors du dossier d’artefacts', async () => {
    await open();
    const before = aroundArts();

    await paste([idOf('notes.md')], '../..');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('copy-artifacts');
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
  });

  it('coller un id en chemin absolu hors de tout : le fichier n’est pas lu', async () => {
    await open();

    await paste([secret], dirOf('maquettes'));

    // témoin : l'action existe bien
    expect(shownActions()).toContain('copy-artifacts');
    // son texte n'est pas entré dans le dossier d'artefacts
    expect(contents(arts)).not.toContain(SECRET);
  });

  it('dupliquer un id qui remonte (../commit.md) : rien hors du dossier d’artefacts, le fichier n’est pas lu', async () => {
    await open();
    const before = aroundArts();

    await duplicate(['../commit.md']);

    // témoin : l'action existe bien
    expect(shownActions()).toContain('duplicate-artifacts');
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
    // son texte n'est pas entré dans le dossier d'artefacts
    expect(contents(arts)).not.toContain(COMMIT);
  });
});

describe('rester dans le dossier d’artefacts du projet : déposer dans un dossier (I-37, I-39)', () => {
  it('témoin : un fichier lâché sur un dossier y est copié', async () => {
    await open();

    await drop([path.join(drops, 'rapport.md')], dirOf('maquettes'));

    // il est dans ce dossier, avec son texte
    expect(read(path.join(arts, 'maquettes', 'rapport.md'))).toBe(DEPOSE);
  });

  it('un id de dossier qui remonte (../..) : rien n’est écrit hors du dossier d’artefacts', async () => {
    await open();
    const before = aroundArts();

    await drop([path.join(drops, 'rapport.md')], '../..');

    // témoin : le dépôt a bien eu lieu, dans le dossier d'artefacts
    await vi.waitFor(() => expect(contents(arts)).toContain(DEPOSE), { timeout: slow(2000) });
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
  });

  it('un id de dossier en chemin absolu : rien n’est écrit hors du dossier d’artefacts', async () => {
    await open();
    const before = aroundArts();

    await drop([path.join(drops, 'rapport.md')], outside);

    // témoin : le dépôt a bien eu lieu, dans le dossier d'artefacts
    await vi.waitFor(() => expect(contents(arts)).toContain(DEPOSE), { timeout: slow(2000) });
    // rien n'a changé hors du dossier d'artefacts
    expect(aroundArts()).toEqual(before);
  });
});

describe('rester dans le dossier d’artefacts du projet : supprimer (I-37, I-39)', () => {
  it('un id en chemin absolu hors de tout, son « nom » confirmé : rien ne part à la corbeille', async () => {
    await open();

    await trash([secret], [secret]);

    // témoin : l'action existe bien
    expect(shownActions()).toContain('trash-artifacts');
    // rien n'a été donné à la corbeille
    expect(fake.trashed).toEqual([]);
    // le fichier est à sa place
    expect(read(secret)).toBe(SECRET);
  });

  it('un id qui remonte (../commit.md), son « nom » confirmé : rien ne part à la corbeille', async () => {
    await open();

    await trash(['../commit.md'], ['../commit.md']);

    // témoin : l'action existe bien
    expect(shownActions()).toContain('trash-artifacts');
    // rien n'a été donné à la corbeille
    expect(fake.trashed).toEqual([]);
    // le fichier est à sa place
    expect(read(path.join(arts, '..', 'commit.md'))).toBe(COMMIT);
  });
});

describe('jamais effacé définitivement : une suppression passe par la corbeille du système', () => {
  it('témoin : un artefact confirmé quitte le dossier et se retrouve dans la corbeille', async () => {
    await open();

    await trash([idOf('notes.md')], ['notes.md']);

    // il n'est plus dans le dossier d'artefacts
    expect(fs.existsSync(path.join(arts, 'notes.md'))).toBe(false);
    // son texte est dans la corbeille
    expect(contents(bin)).toContain(NOTES);
  });

  it('un dossier confirmé : tout ce qu’il contenait est dans la corbeille', async () => {
    await open();

    await trash([dirOf('maquettes')], ['maquettes']);

    // témoin : il n'est plus dans le dossier d'artefacts
    expect(fs.existsSync(path.join(arts, 'maquettes'))).toBe(false);
    // son contenu est dans la corbeille
    expect(contents(bin)).toContain(ACCUEIL);
  });

  it('une sélection confirmée : chaque élément parti est dans la corbeille', async () => {
    await open();

    await trash([idOf('notes.md'), idOf('plan.md')], ['notes.md', 'plan.md']);

    // témoin : ils ne sont plus dans le dossier d'artefacts
    expect(contents(arts)).not.toContain(PLAN);
    // le premier est dans la corbeille
    expect(contents(bin)).toContain(NOTES);
    // le second aussi
    expect(contents(bin)).toContain(PLAN);
  });

  // Pas de corbeille sur ce système (ou elle refuse) : rien ne doit être effacé à sa place.
  it('la corbeille échoue : l’artefact reste, avec son texte', async () => {
    fake.trash = async () => { throw new Error('corbeille indisponible'); };
    await open();

    await trash([idOf('notes.md')], ['notes.md']);

    // témoin : la corbeille a bien été sollicitée
    expect(fake.trashed.length).toBeGreaterThan(0);
    // l'artefact est toujours là, avec son texte
    expect(read(path.join(arts, 'notes.md'))).toBe(NOTES);
  });

  it('la corbeille échoue sur un dossier : tout son contenu reste', async () => {
    fake.trash = async () => { throw new Error('corbeille indisponible'); };
    await open();
    const inside = snapshot(path.join(arts, 'maquettes'));

    await trash([dirOf('maquettes')], ['maquettes']);

    // témoin : la corbeille a bien été sollicitée
    expect(fake.trashed.length).toBeGreaterThan(0);
    // le dossier est toujours là, tel quel
    expect(snapshot(path.join(arts, 'maquettes'))).toEqual(inside);
  });
});

describe('ne supprimer que ce qui est confirmé', () => {
  // Un robot écrit aaa.md, trié avant : au relevé suivant, l'id qu'avait notes.md désigne un autre fichier.
  it('les ids ont glissé depuis la confirmation : rien ne part à la corbeille', async () => {
    await open();
    const id = idOf('notes.md');
    write(path.join(arts, 'aaa.md'), 'ROBOT');
    await resurvey();
    const inside = snapshot(arts);

    await trash([id], ['notes.md']);

    // témoin : l'action existe bien
    expect(shownActions()).toContain('trash-artifacts');
    // témoin : l'id désigne bien un autre artefact au dernier relevé
    expect(idOf('notes.md')).not.toBe(id);
    // rien n'a été donné à la corbeille
    expect(fake.trashed).toEqual([]);
    // rien n'a changé dans le dossier d'artefacts
    expect(snapshot(arts)).toEqual(inside);
  });

  // Un robot crée le dossier aaa : au relevé suivant, l'id qu'avait archives désigne un autre dossier.
  it('les ids de dossier ont glissé depuis la confirmation : rien ne part à la corbeille', async () => {
    await open();
    const id = dirOf('archives');
    fs.mkdirSync(path.join(arts, 'aaa'));
    write(path.join(arts, 'aaa', 'robot.md'), 'ROBOT');
    await resurvey();
    const inside = snapshot(arts);

    await trash([id], ['archives']);

    // témoin : l'id désigne bien un autre dossier au dernier relevé
    expect(dirOf('archives')).not.toBe(id);
    // rien n'a été donné à la corbeille
    expect(fake.trashed).toEqual([]);
    // rien n'a changé dans le dossier d'artefacts
    expect(snapshot(arts)).toEqual(inside);
  });

  it('un seul nom confirmé diffère : rien ne part, pas même les autres', async () => {
    await open();
    const inside = snapshot(arts);

    await trash([idOf('notes.md'), idOf('plan.md')], ['notes.md', 'autre.md']);

    // témoin : l'action existe bien
    expect(shownActions()).toContain('trash-artifacts');
    // rien n'a été donné à la corbeille
    expect(fake.trashed).toEqual([]);
    // rien n'a changé dans le dossier d'artefacts
    expect(snapshot(arts)).toEqual(inside);
  });

  it('les noms confirmés dans un autre ordre que les ids : rien ne part', async () => {
    await open();
    const inside = snapshot(arts);

    await trash([idOf('notes.md'), idOf('plan.md')], ['plan.md', 'notes.md']);

    // témoin : l'action existe bien
    expect(shownActions()).toContain('trash-artifacts');
    // rien n'a été donné à la corbeille
    expect(fake.trashed).toEqual([]);
    // rien n'a changé dans le dossier d'artefacts
    expect(snapshot(arts)).toEqual(inside);
  });

  it('moins de noms confirmés que d’ids : rien ne part', async () => {
    await open();
    const inside = snapshot(arts);

    await trash([idOf('notes.md'), idOf('plan.md')], ['notes.md']);

    // témoin : l'action existe bien
    expect(shownActions()).toContain('trash-artifacts');
    // rien n'a été donné à la corbeille
    expect(fake.trashed).toEqual([]);
    // rien n'a changé dans le dossier d'artefacts
    expect(snapshot(arts)).toEqual(inside);
  });

  it('aucun nom confirmé : rien ne part', async () => {
    await open();
    const inside = snapshot(arts);

    await trash([idOf('notes.md')], undefined);

    // témoin : l'action existe bien
    expect(shownActions()).toContain('trash-artifacts');
    // rien n'a été donné à la corbeille
    expect(fake.trashed).toEqual([]);
    // rien n'a changé dans le dossier d'artefacts
    expect(snapshot(arts)).toEqual(inside);
  });

  it('le nom confirmé en chaîne plutôt qu’en liste : rien ne part', async () => {
    await open();
    const inside = snapshot(arts);

    await trash([idOf('notes.md')], 'notes.md');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('trash-artifacts');
    // rien n'a été donné à la corbeille
    expect(fake.trashed).toEqual([]);
    // rien n'a changé dans le dossier d'artefacts
    expect(snapshot(arts)).toEqual(inside);
  });
});

posix('ne suivre aucun lien : un artefact devenu un lien après le relevé (I-37)', () => {
  it('le renommer : la cible n’est ni touchée ni copiée dans le dossier d’artefacts', async () => {
    await open();
    const id = idOf('notes.md');
    linkInArts('notes.md', secret);
    const before = snapshot(outside);

    await rename(id, 'compte-rendu.md');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('rename-artifact');
    // la cible n'a pas changé
    expect(snapshot(outside)).toEqual(before);
    // son texte n'est pas entré dans le dossier d'artefacts
    expect(contents(arts)).not.toContain(SECRET);
  });

  it('le déplacer dans un dossier : sa cible n’y est pas copiée', async () => {
    await open();
    const id = idOf('notes.md');
    linkInArts('notes.md', secret);

    await move([id], dirOf('maquettes'));

    // témoin : l'action existe bien
    expect(shownActions()).toContain('move-artifacts');
    // son texte n'est pas entré dans le dossier d'artefacts
    expect(contents(arts)).not.toContain(SECRET);
  });

  it('le coller dans un dossier : sa cible n’y est pas copiée', async () => {
    await open();
    const id = idOf('notes.md');
    linkInArts('notes.md', secret);

    await paste([id], dirOf('maquettes'));

    // témoin : l'action existe bien
    expect(shownActions()).toContain('copy-artifacts');
    // son texte n'est pas entré dans le dossier d'artefacts
    expect(contents(arts)).not.toContain(SECRET);
  });

  it('le dupliquer : sa cible n’est pas copiée', async () => {
    await open();
    const id = idOf('notes.md');
    linkInArts('notes.md', secret);

    await duplicate([id]);

    // témoin : l'action existe bien
    expect(shownActions()).toContain('duplicate-artifacts');
    // son texte n'est pas entré dans le dossier d'artefacts
    expect(contents(arts)).not.toContain(SECRET);
  });

  it('le supprimer : la cible n’est pas donnée à la corbeille', async () => {
    await open();
    const id = idOf('notes.md');
    linkInArts('notes.md', secret);

    await trash([id], ['notes.md']);

    // témoin : l'action existe bien
    expect(shownActions()).toContain('trash-artifacts');
    // la cible est à sa place, avec son texte
    expect(read(secret)).toBe(SECRET);
    // la corbeille n'a pas reçu la cible
    expect(contents(bin)).not.toContain(SECRET);
  });
});

posix('ne suivre aucun lien : un dossier devenu un lien après le relevé (I-37)', () => {
  it('y créer un fichier : rien n’arrive dans la cible', async () => {
    await open();
    const id = dirOf('maquettes');
    linkInArts('maquettes', outside);
    const before = snapshot(outside);

    await newFile(id, 'vole.md');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('new-artifact-file');
    // la cible n'a pas changé
    expect(snapshot(outside)).toEqual(before);
  });

  it('y créer un dossier : rien n’arrive dans la cible', async () => {
    await open();
    const id = dirOf('maquettes');
    linkInArts('maquettes', outside);
    const before = snapshot(outside);

    await newFolder(id, 'vole');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('new-artifact-folder');
    // la cible n'a pas changé
    expect(snapshot(outside)).toEqual(before);
  });

  it('y déplacer un artefact : rien n’arrive dans la cible, l’artefact reste', async () => {
    await open();
    const id = dirOf('maquettes');
    linkInArts('maquettes', outside);
    const before = snapshot(outside);

    await move([idOf('notes.md')], id);

    // témoin : l'action existe bien
    expect(shownActions()).toContain('move-artifacts');
    // la cible n'a pas changé
    expect(snapshot(outside)).toEqual(before);
    // l'artefact n'est pas perdu
    expect(read(path.join(arts, 'notes.md'))).toBe(NOTES);
  });

  it('y coller un artefact : rien n’arrive dans la cible', async () => {
    await open();
    const id = dirOf('maquettes');
    linkInArts('maquettes', outside);
    const before = snapshot(outside);

    await paste([idOf('notes.md')], id);

    // témoin : l'action existe bien
    expect(shownActions()).toContain('copy-artifacts');
    // la cible n'a pas changé
    expect(snapshot(outside)).toEqual(before);
  });

  it('y déposer un fichier : rien n’arrive dans la cible', async () => {
    await open();
    const id = dirOf('maquettes');
    linkInArts('maquettes', outside);
    const before = snapshot(outside);

    await drop([path.join(drops, 'rapport.md')], id);

    // témoin : le relevé montre bien l'action du dépôt
    expect(shownActions()).toContain('add-artifact');
    // la cible n'a pas changé
    expect(snapshot(outside)).toEqual(before);
  });

  // maquettes/ mène ailleurs, où un accueil.html existe : l'id de maquettes/accueil.html y mènerait.
  it('renommer un artefact sous ce dossier : la cible n’est pas touchée', async () => {
    await open();
    const id = idOf('maquettes/accueil.html');
    linkInArts('maquettes', elsewhere);
    const before = snapshot(elsewhere);

    await rename(id, 'vole.html');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('rename-artifact');
    // la cible n'a pas changé
    expect(snapshot(elsewhere)).toEqual(before);
  });

  it('supprimer un artefact sous ce dossier : rien de la cible ne part à la corbeille', async () => {
    await open();
    const id = idOf('maquettes/accueil.html');
    linkInArts('maquettes', elsewhere);
    const before = snapshot(elsewhere);

    await trash([id], ['maquettes/accueil.html']);

    // témoin : l'action existe bien
    expect(shownActions()).toContain('trash-artifacts');
    // la cible n'a pas changé
    expect(snapshot(elsewhere)).toEqual(before);
  });

  it('le supprimer lui-même : rien de sa cible ne part à la corbeille', async () => {
    await open();
    const id = dirOf('maquettes');
    linkInArts('maquettes', elsewhere);
    const before = snapshot(elsewhere);

    await trash([id], ['maquettes']);

    // témoin : l'action existe bien
    expect(shownActions()).toContain('trash-artifacts');
    // la cible n'a pas changé
    expect(snapshot(elsewhere)).toEqual(before);
  });

  it('le dossier d’artefacts lui-même devenu un lien : un nouveau fichier n’arrive pas dans la cible', async () => {
    await open();
    fs.rmSync(arts, { recursive: true, force: true });
    fs.symlinkSync(outside, arts);
    const before = snapshot(outside);

    await newFile(undefined, 'vole.md');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('new-artifact-file');
    // la cible n'a pas changé
    expect(snapshot(outside)).toEqual(before);
  });
});

posix('ne suivre aucun lien : un lien dans un dossier copié ou déplacé (I-37)', () => {
  it('coller un dossier qui contient un lien : sa cible n’est pas copiée', async () => {
    await open();
    fs.symlinkSync(secret, path.join(arts, 'maquettes', 'lien.md'));

    await paste([dirOf('maquettes')], dirOf('archives'));

    // témoin : le reste du dossier est copié
    expect(copiesOf(arts, ACCUEIL)).toBe(2);
    // son texte n'est pas entré dans le dossier d'artefacts
    expect(contents(arts)).not.toContain(SECRET);
  });

  it('dupliquer un dossier qui contient un lien : sa cible n’est pas copiée', async () => {
    await open();
    fs.symlinkSync(secret, path.join(arts, 'maquettes', 'lien.md'));

    await duplicate([dirOf('maquettes')]);

    // témoin : le reste du dossier est copié
    expect(copiesOf(arts, ACCUEIL)).toBe(2);
    // son texte n'est pas entré dans le dossier d'artefacts
    expect(contents(arts)).not.toContain(SECRET);
  });

  it('déplacer un dossier qui contient un lien : sa cible n’est pas copiée', async () => {
    await open();
    fs.symlinkSync(secret, path.join(arts, 'maquettes', 'lien.md'));

    await move([dirOf('maquettes')], dirOf('archives'));

    // témoin : l'action existe bien
    expect(shownActions()).toContain('move-artifacts');
    // son texte n'est pas entré dans le dossier d'artefacts
    expect(contents(arts)).not.toContain(SECRET);
  });
});

describe('ne jamais écraser un artefact existant', () => {
  it('renommer avec le nom d’un autre artefact : les deux gardent leur texte', async () => {
    await open();

    await rename(idOf('notes.md'), 'plan.md');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('rename-artifact');
    // l'artefact qui portait déjà ce nom a gardé son texte
    expect(read(path.join(arts, 'plan.md'))).toBe(PLAN);
    // l'artefact renommé n'est pas perdu
    expect(contents(arts)).toContain(NOTES);
  });

  it('renommer un dossier avec le nom d’un autre : celui-ci n’est pas touché, rien n’est mêlé', async () => {
    await open();
    const archives = snapshot(path.join(arts, 'archives'));

    await rename(dirOf('maquettes'), 'archives');

    // témoin : l'action existe bien
    expect(shownActions()).toContain('rename-artifact');
    // le dossier qui portait déjà ce nom n'a pas changé
    expect(snapshot(path.join(arts, 'archives'))).toEqual(archives);
    // le contenu du dossier renommé n'est pas perdu
    expect(contents(arts)).toContain(ACCUEIL);
  });

  it('déplacer dans un dossier où le nom est pris : l’existant garde son texte, le déplacé arrive', async () => {
    await open();

    await move([idOf('notes.md')], dirOf('archives'));

    // témoin : le déplacé est arrivé dans le dossier
    expect(contents(path.join(arts, 'archives'))).toContain(NOTES);
    // l'existant a gardé son texte
    expect(read(path.join(arts, 'archives', 'notes.md'))).toBe(ARCHIVE);
  });

  it('déplacer un dossier là où un dossier du même nom existe : celui-ci n’est pas touché, rien n’est mêlé', async () => {
    await open();
    const existing = snapshot(path.join(arts, 'archives', 'maquettes'));

    await move([dirOf('maquettes')], dirOf('archives'));

    // témoin : le contenu déplacé est arrivé dans le dossier
    expect(contents(path.join(arts, 'archives'))).toContain(ACCUEIL);
    // le dossier existant n'a pas changé
    expect(snapshot(path.join(arts, 'archives', 'maquettes'))).toEqual(existing);
  });

  it('coller dans un dossier où le nom est pris : l’existant garde son texte, la copie arrive', async () => {
    await open();

    await paste([idOf('notes.md')], dirOf('archives'));

    // témoin : la copie est arrivée dans le dossier
    expect(contents(path.join(arts, 'archives'))).toContain(NOTES);
    // l'existant a gardé son texte
    expect(read(path.join(arts, 'archives', 'notes.md'))).toBe(ARCHIVE);
  });

  it('coller là d’où il vient : l’original garde son texte, la copie arrive à côté', async () => {
    await open();

    await paste([idOf('notes.md')], undefined);

    // témoin : la copie est arrivée
    expect(copiesOf(arts, NOTES)).toBe(2);
    // l'original a gardé son texte
    expect(read(path.join(arts, 'notes.md'))).toBe(NOTES);
  });

  it('coller un dossier là où un dossier du même nom existe : celui-ci n’est pas touché, rien n’est mêlé', async () => {
    await open();
    const existing = snapshot(path.join(arts, 'archives', 'maquettes'));

    await paste([dirOf('maquettes')], dirOf('archives'));

    // témoin : la copie est arrivée dans le dossier
    expect(contents(path.join(arts, 'archives'))).toContain(ACCUEIL);
    // le dossier existant n'a pas changé
    expect(snapshot(path.join(arts, 'archives', 'maquettes'))).toEqual(existing);
  });

  it('dupliquer un artefact : l’original garde son texte, le double arrive', async () => {
    await open();

    await duplicate([idOf('notes.md')]);

    // témoin : le double est arrivé
    expect(copiesOf(arts, NOTES)).toBe(2);
    // l'original a gardé son texte
    expect(read(path.join(arts, 'notes.md'))).toBe(NOTES);
  });

  it('dupliquer un dossier : l’original n’est pas touché, le double arrive', async () => {
    await open();
    const original = snapshot(path.join(arts, 'maquettes'));

    await duplicate([dirOf('maquettes')]);

    // témoin : le double est arrivé
    expect(copiesOf(arts, ACCUEIL)).toBe(2);
    // l'original n'a pas changé
    expect(snapshot(path.join(arts, 'maquettes'))).toEqual(original);
  });
});
