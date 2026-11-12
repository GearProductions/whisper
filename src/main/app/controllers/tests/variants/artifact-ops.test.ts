// Variants de la gestion des artefacts comme des fichiers (note 0.13.0) : renommer, créer, supprimer
// (noms confirmés, corbeille injectée), déplacer, coller, dupliquer — les cas aux bords (racine, nom
// pris, dossier dans lui-même, déjà là, plusieurs éléments) ; les invariants passent par runVibeAction.
// Sur le vrai contrôleur et de vrais fichiers (userData temporaire) ; faux : Electron et
// controllers/vibecoder (l'agent affiché et son dernier relevé, relevés du disque par le cas).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { VibeView } from 'shared/bridge';
import type { AgentConfig } from 'core/agents';
import { artifactDirs, artifactList } from 'core/vibecoder';

const fake = vi.hoisted(() => ({ userData: '', dir: '', shown: 'a1' as string | null, view: null as unknown }));
vi.mock('electron', () => ({ app: { getPath: () => fake.userData }, shell: { trashItem: async () => {} } }));
vi.mock('app/controllers/agents', () => ({ viewAgent: () => (fake.shown ? { id: fake.shown, dir: fake.dir } : null) }));
vi.mock('app/controllers/vibecoder', () => ({
  lastView: (id: string) => (id === fake.shown ? fake.view : null),
}));

const { projectArtifactsPath } = await import('app/controllers/artifacts');
const ops = await import('app/controllers/artifact-ops');

const write = (file: string, text: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, text); };
let arts = '';
let agent: AgentConfig;
let trashed: string[] = [];
const trash = async (f: string) => { trashed.push(f); };
// Un chemin sous le dossier d'artefacts écrit avec des /, comme le relevé (Windows : \).
const slash = (n: string) => n.split(path.sep).join('/');
// Tout sous le dossier d'artefacts : chemin → texte (dossier : null).
const tree = () => Object.fromEntries(fs.readdirSync(arts, { recursive: true }).map(String).map(slash).sort()
  .map((n) => [n, fs.statSync(path.join(arts, n)).isDirectory() ? null : fs.readFileSync(path.join(arts, n), 'utf8')]));
// Le relevé que la page a reçu : les artefacts et les dossiers du disque.
function survey() {
  const all = fs.readdirSync(arts, { recursive: true, withFileTypes: true }).map((e) => ({ e, name: slash(path.relative(arts, path.join(e.parentPath, e.name))) }));
  const files = all.filter(({ e }) => e.isFile()).map(({ name }) => ({ name, size: 1, time: 1 }));
  fake.view = { artifacts: artifactList('a1', files, 10), artifactDirs: artifactDirs(all.filter(({ e }) => e.isDirectory()).map(({ name }) => name)) } as Partial<VibeView>;
}
const view = () => fake.view as VibeView;
const f = (name: string) => view().artifacts!.find((a) => a.name === name)!.id;
const d = (name: string) => view().artifactDirs!.find((x) => x.name === name)!.id;

beforeEach(() => {
  fake.userData = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-artifact-ops-')));
  fake.shown = 'a1';
  fake.dir = path.join(fake.userData, 'projet');
  fs.mkdirSync(fake.dir, { recursive: true });
  agent = { id: 'a1', dir: fake.dir, name: 'essai', model: '', effort: '', mode: 'default', sessionId: null };
  arts = projectArtifactsPath(fake.dir);
  trashed = [];
  write(path.join(arts, 'notes.md'), 'N');
  write(path.join(arts, 'plan.md'), 'P');
  write(path.join(arts, 'a', 'x.md'), 'X');
  write(path.join(arts, 'a', 'b', 'y.md'), 'Y');
  write(path.join(arts, 'z', 'notes.md'), 'Z');
  survey();
});

describe('renommer', () => {
  it('un fichier et un dossier, sur place', async () => {
    expect((await ops.renameArtifact(agent, f('notes.md'), 'n2.md')).ok).toBe(true);
    expect((await ops.renameArtifact(agent, d('a'), 'c')).ok).toBe(true);
    expect(tree()).toMatchObject({ 'n2.md': 'N', 'c/x.md': 'X', 'c/b/y.md': 'Y' });
    expect(tree()).not.toHaveProperty('notes.md');
  });

  it('un nom pris : refusé, rien ne change', async () => {
    const before = tree();
    expect((await ops.renameArtifact(agent, f('notes.md'), 'plan.md')).ok).toBe(false);
    expect((await ops.renameArtifact(agent, d('a'), 'z')).ok).toBe(false);
    expect(tree()).toEqual(before);
  });

  it('le même nom : rien à faire, sans échec', async () => {
    expect(await ops.renameArtifact(agent, f('notes.md'), 'notes.md')).toMatchObject({ ok: true });
    expect(tree()['notes.md']).toBe('N');
  });

  it('un dossier au nom caché, un autre agent : refusés', async () => {
    const before = tree();
    expect((await ops.renameArtifact(agent, d('a'), '.cache')).ok).toBe(false);
    fake.shown = 'a2';
    expect((await ops.renameArtifact(agent, f('notes.md'), 'n2.md')).ok).toBe(false);
    expect(tree()).toEqual(before);
  });
});

describe('créer', () => {
  it('un fichier vide à la racine, un dossier dans un dossier', async () => {
    expect((await ops.newArtifact(agent, undefined, 'vide.md', false)).ok).toBe(true);
    expect((await ops.newArtifact(agent, d('a'), 'sous', true)).ok).toBe(true);
    expect(tree()).toMatchObject({ 'vide.md': '', 'a/sous': null });
  });

  it('le premier artefact : le dossier du projet est créé', async () => {
    fs.rmSync(arts, { recursive: true });
    expect((await ops.newArtifact(agent, undefined, 'premier.md', false)).ok).toBe(true);
    expect(tree()).toEqual({ 'premier.md': '' });
  });

  it('un nom pris, fichier ou dossier : refusé, l’existant intact ; un dossier caché : refusé', async () => {
    expect((await ops.newArtifact(agent, undefined, 'notes.md', false)).ok).toBe(false);
    expect((await ops.newArtifact(agent, undefined, 'a', true)).ok).toBe(false);
    expect((await ops.newArtifact(agent, undefined, '.h', true)).ok).toBe(false);
    expect(tree()['notes.md']).toBe('N');
    expect(tree()).not.toHaveProperty('.h');
  });
});

describe('supprimer', () => {
  it('chaque élément confirmé part à la corbeille, avec son chemin', async () => {
    const r = await ops.trashArtifacts(agent, [f('notes.md'), d('a')], ['notes.md', 'a'], trash);
    expect(r.ok).toBe(true);
    expect(trashed).toEqual([path.join(arts, 'notes.md'), path.join(arts, 'a')]);
  });

  it('un dossier et un de ses fichiers : le dossier seul part', async () => {
    const r = await ops.trashArtifacts(agent, [d('a'), f('a/x.md')], ['a', 'a/x.md'], trash);
    expect(r.ok).toBe(true);
    expect(trashed).toEqual([path.join(arts, 'a')]);
  });

  it('une corbeille qui échoue sur un élément : les autres partent, le tout est en échec', async () => {
    const r = await ops.trashArtifacts(agent, [f('notes.md'), f('plan.md')], ['notes.md', 'plan.md'],
      async (file) => { if (file.endsWith('notes.md')) throw new Error('non'); trashed.push(file); });
    expect(r.ok).toBe(false);
    expect(r.detail).toContain('notes.md');
    expect(trashed).toEqual([path.join(arts, 'plan.md')]);
  });

  it('un id inconnu, une liste vide, des noms en trop : rien ne part', async () => {
    expect((await ops.trashArtifacts(agent, ['a99'], ['x'], trash)).ok).toBe(false);
    expect((await ops.trashArtifacts(agent, [], [], trash)).ok).toBe(false);
    expect((await ops.trashArtifacts(agent, 'a0', ['notes.md'], trash)).ok).toBe(false);
    expect((await ops.trashArtifacts(agent, [f('notes.md')], ['notes.md', 'plan.md'], trash)).ok).toBe(false);
    expect(trashed).toEqual([]);
  });
});

describe('déplacer', () => {
  it('plusieurs éléments vers un dossier, puis vers la racine', async () => {
    expect((await ops.moveArtifacts(agent, [f('notes.md'), d('a/b')], d('z'))).ok).toBe(true);
    expect(tree()).toMatchObject({ 'z/notes.md': 'Z', 'z/notes-2.md': 'N', 'z/b/y.md': 'Y' });
    survey();
    expect((await ops.moveArtifacts(agent, [f('z/b/y.md')], undefined)).ok).toBe(true);
    expect(tree()).toMatchObject({ 'y.md': 'Y' });
  });

  it('un dossier dans lui-même ou dessous : refusé, rien ne change', async () => {
    const before = tree();
    expect((await ops.moveArtifacts(agent, [d('a')], d('a'))).ok).toBe(false);
    expect((await ops.moveArtifacts(agent, [d('a')], d('a/b'))).ok).toBe(false);
    expect(tree()).toEqual(before);
  });

  it('déjà dans ce dossier : rien, sans échec ni numéro', async () => {
    expect(await ops.moveArtifacts(agent, [f('notes.md')], undefined)).toMatchObject({ ok: true, line: 'Moved 0.' });
    expect(await ops.moveArtifacts(agent, [f('a/x.md')], d('a'))).toMatchObject({ ok: true });
    expect(Object.keys(tree())).not.toContain('a/x-2.md');
  });

  it('un dossier de destination inconnu ou un id de fichier : refusé', async () => {
    const before = tree();
    expect((await ops.moveArtifacts(agent, [f('notes.md')], 'd99')).ok).toBe(false);
    expect((await ops.moveArtifacts(agent, [f('notes.md')], f('plan.md'))).ok).toBe(false);
    expect(tree()).toEqual(before);
  });
});

// Chaque refus ou échec porte sa clé (reason) : runDirect la rend à la commande.
describe('chaque refus avec sa clé', () => {
  const unknown = { ok: false, reason: 'unknown-artifact' };
  const refused = { ok: false, reason: 'refused' };

  it('renommer : id inconnu, nom avec /, nom pris, un lien sous le dossier', async () => {
    expect(await ops.renameArtifact(agent, 'a99', 'x.md')).toMatchObject(unknown);
    expect(await ops.renameArtifact(agent, undefined, 'x.md')).toMatchObject(unknown);
    expect(await ops.renameArtifact(agent, f('notes.md'), 'a/b.md')).toMatchObject({ ok: false, reason: 'name' });
    expect(await ops.renameArtifact(agent, f('notes.md'), 7)).toMatchObject({ ok: false, reason: 'name' });
    expect(await ops.renameArtifact(agent, f('notes.md'), 'plan.md')).toMatchObject(refused);
    // un id inconnu l'emporte sur un mauvais nom
    expect(await ops.renameArtifact(agent, 'a99', 'a/b')).toMatchObject(unknown);
    // un autre agent : le relevé de l'agent affiché ne dit rien de ses ids
    fake.shown = 'a2';
    expect(await ops.renameArtifact(agent, f('notes.md'), 'n2.md')).toMatchObject(unknown);
  });

  it('un succès ne porte pas de clé', async () => {
    expect((await ops.renameArtifact(agent, f('notes.md'), 'n2.md')).reason).toBeUndefined();
    expect((await ops.renameArtifact(agent, f('plan.md'), 'plan.md')).reason).toBeUndefined();
    expect((await ops.newArtifact(agent, undefined, 'vide.md', false)).reason).toBeUndefined();
    expect((await ops.moveArtifacts(agent, [f('plan.md'), f('a/x.md')], d('z'))).reason).toBeUndefined();
  });

  it('créer : dossier inconnu, nom pris, nom caché', async () => {
    expect(await ops.newArtifact(agent, 'd99', 'n.md', false)).toMatchObject(unknown);
    // l'id d'un fichier n'est pas un dossier d'arrivée
    expect(await ops.newArtifact(agent, f('notes.md'), 'n.md', false)).toMatchObject(unknown);
    expect(await ops.newArtifact(agent, undefined, 'notes.md', false)).toMatchObject(refused);
    expect(await ops.newArtifact(agent, undefined, 'a', true)).toMatchObject(refused);
    expect(await ops.newArtifact(agent, undefined, '.h', true)).toMatchObject({ ok: false, reason: 'name' });
    expect(await ops.newArtifact(agent, undefined, '../x.md', false)).toMatchObject({ ok: false, reason: 'name' });
    // un dossier inconnu l'emporte sur un mauvais nom
    expect(await ops.newArtifact(agent, 'd99', '../x', false)).toMatchObject(unknown);
  });

  // Un dossier sans droit d'écriture : le disque refuse la création (pas sous Windows, ni en root).
  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)('créer : le disque en échec porte failed', async () => {
    const z = path.join(arts, 'z');
    fs.chmodSync(z, 0o500);
    try {
      expect(await ops.newArtifact(agent, d('z'), 'n.md', false)).toMatchObject({ ok: false, reason: 'failed' });
      expect(await ops.newArtifact(agent, d('z'), 'sous', true)).toMatchObject({ ok: false, reason: 'failed' });
    } finally { fs.chmodSync(z, 0o700); }
  });

  it('déplacer, coller, dupliquer, supprimer : un id inconnu, même derrière un connu', async () => {
    const before = tree();
    expect(await ops.moveArtifacts(agent, ['a99'], undefined)).toMatchObject(unknown);
    expect(await ops.moveArtifacts(agent, [f('notes.md'), 'a99'], d('z'))).toMatchObject(unknown);
    expect(await ops.copyArtifacts(agent, ['a99'], undefined)).toMatchObject(unknown);
    expect(await ops.copyArtifacts(agent, [f('notes.md'), 'a99'], d('z'))).toMatchObject(unknown);
    expect(await ops.duplicateArtifacts(agent, ['a99'])).toMatchObject(unknown);
    expect(await ops.duplicateArtifacts(agent, [f('notes.md'), 'a99'])).toMatchObject(unknown);
    expect(await ops.trashArtifacts(agent, ['a99'], ['x'], trash)).toMatchObject(unknown);
    expect(await ops.trashArtifacts(agent, [f('notes.md'), 'a99'], ['notes.md', 'x'], trash)).toMatchObject(unknown);
    expect(await ops.duplicateArtifacts(agent, [])).toMatchObject(unknown);
    expect(await ops.duplicateArtifacts(agent, 'a0')).toMatchObject(unknown);
    expect(tree()).toEqual(before);
    expect(trashed).toEqual([]);
  });

  it('déplacer et coller vers un dossier inconnu : unknown-artifact, rien ne bouge, même à plusieurs', async () => {
    const before = tree();
    for (const op of [ops.moveArtifacts, ops.copyArtifacts]) {
      expect(await op(agent, [f('notes.md'), f('plan.md')], 'd99')).toMatchObject(unknown);
      // l'id d'un fichier n'est pas un dossier d'arrivée
      expect(await op(agent, [f('notes.md')], f('plan.md'))).toMatchObject(unknown);
      // un id qui est un chemin
      expect(await op(agent, [f('notes.md')], '..')).toMatchObject(unknown);
    }
    expect(tree()).toEqual(before);
  });

  it('déplacer un dossier dans lui-même ou dessous : refused', async () => {
    const before = tree();
    expect(await ops.moveArtifacts(agent, [d('a')], d('a'))).toMatchObject(refused);
    expect(await ops.moveArtifacts(agent, [d('a')], d('a/b'))).toMatchObject(refused);
    expect(tree()).toEqual(before);
  });

  it('déplacer : un élément refusé n’arrête pas les autres, le tout est refused', async () => {
    const r = await ops.moveArtifacts(agent, [d('a'), f('notes.md')], d('a/b'));
    expect(r).toMatchObject(refused);
    expect(tree()).toMatchObject({ 'a/b/notes.md': 'N' });
  });

  it('un élément devenu un lien depuis le relevé : refused', async () => {
    const id = f('notes.md');
    fs.rmSync(path.join(arts, 'notes.md'));
    fs.symlinkSync(path.join(arts, 'plan.md'), path.join(arts, 'notes.md'));
    expect(await ops.duplicateArtifacts(agent, [id])).toMatchObject(refused);
    expect(await ops.renameArtifact(agent, id, 'n2.md')).toMatchObject(refused);
  });

  it('copier un dossier dans lui-même : refused (un échec dans each)', async () => {
    expect(await ops.copyArtifacts(agent, [d('a')], d('a/b'))).toMatchObject(refused);
  });

  it('supprimer : des noms qui diffèrent, refused, rien ne part', async () => {
    expect(await ops.trashArtifacts(agent, [f('notes.md'), f('plan.md')], ['notes.md', 'autre.md'], trash)).toMatchObject(refused);
    expect(await ops.trashArtifacts(agent, [f('notes.md')], 'notes.md', trash)).toMatchObject(refused);
    expect(await ops.trashArtifacts(agent, [f('notes.md')], undefined, trash)).toMatchObject(refused);
    expect(trashed).toEqual([]);
  });

  it('supprimer : une corbeille qui lève sur un élément, refused, les autres partis', async () => {
    const r = await ops.trashArtifacts(agent, [f('notes.md'), f('plan.md')], ['notes.md', 'plan.md'],
      async (file) => { if (file.endsWith('notes.md')) throw new Error('non'); trashed.push(file); });
    expect(r).toMatchObject(refused);
    expect(trashed).toEqual([path.join(arts, 'plan.md')]);
  });
});

describe('coller, dupliquer', () => {
  it('coller : la copie arrive, l’original reste, un nom pris prend un numéro', async () => {
    expect((await ops.copyArtifacts(agent, [f('notes.md'), f('plan.md')], d('z'))).ok).toBe(true);
    expect(tree()).toMatchObject({ 'notes.md': 'N', 'z/notes.md': 'Z', 'z/notes-2.md': 'N', 'z/plan.md': 'P' });
  });

  it('coller un dossier dans lui-même : en échec, sans boucle', async () => {
    const r = await ops.copyArtifacts(agent, [d('a')], d('a/b'));
    expect(r.ok).toBe(false);
    expect(Object.keys(tree()).filter((n) => n.startsWith('a/b/a'))).toEqual([]);
  });

  it('dupliquer : chacun dans son dossier, sous un numéro', async () => {
    expect((await ops.duplicateArtifacts(agent, [f('a/x.md'), d('a/b'), f('plan.md')])).ok).toBe(true);
    expect(tree()).toMatchObject({ 'a/x-2.md': 'X', 'a/b-2/y.md': 'Y', 'plan-2.md': 'P', 'a/x.md': 'X' });
  });

  it('un autre agent, un id inconnu : refusés', async () => {
    fake.shown = 'a2';
    expect((await ops.duplicateArtifacts(agent, [f('notes.md')])).ok).toBe(false);
    fake.shown = 'a1';
    expect((await ops.duplicateArtifacts(agent, ['../notes.md'])).ok).toBe(false);
    expect(Object.keys(tree())).not.toContain('notes-2.md');
  });
});
