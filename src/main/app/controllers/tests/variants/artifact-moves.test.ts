// Variants de l'ajout d'un artefact (note 0.13.0, docs/tickets/feat/0.13.0-ameliorer-artefacts.md) : la copie
// dans le dossier du projet (un artefact du même nom reste, l'original ne bouge pas ; le témoin « le fichier
// déposé arrive » est protégé) et les liens à l'ajout, seuls ou dans un dossier. Déplacés de invariants/artifact-moves.test.ts (0.15.0,
// assainissement : un cas déplacé garde son assertion) ; les chemins venus de la page et le dossier du projet
// y restent protégés.
//
// Sur le vrai principal (contrôleurs, réglages et fichiers sur disque, vrais liens symboliques, git réel sur
// un dépôt d'essai), par le décor commun (app/tests/harness) ; faux : Electron et le SDK de Claude Code
// (aucun tour ne commence ici).
import fs from 'node:fs';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { closeAll, fakeClaude, fakeElectron, profile, repo as initRepo, repoResources, write, writeConfig } from 'app/tests/harness';

const electron = fakeElectron();
const claude = fakeClaude();   // aucun tour ici ; un message reçu ne fait rien
vi.mock('electron', () => electron.module);
vi.mock('technicals/claude', () => claude.module);
vi.mock('technicals/paths', () => repoResources());

const read = (file: string) => fs.readFileSync(file, 'utf8');
// Liens de fichier : sans équivalent simple sous Windows.
const posix = describe.skipIf(process.platform === 'win32');

let repo = '';      // le dossier de a1, un dépôt git
let drops = '';     // ce que l'utilisateur dépose, hors de tout
let outside = '';   // un dossier hors de tout, à ne pas toucher
let secret = '';    // un fichier hors de tout
let projects: Record<string, string> = {};

const SECRET = 'SECRET_DEHORS';
// Le dossier d'artefacts du projet de chaque agent.
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
// Le dossier du projet de cet agent remplacé par un lien.
function linkArts(id: string, target: string) {
  fs.rmSync(arts(id), { recursive: true, force: true });
  fs.mkdirSync(path.dirname(arts(id)), { recursive: true });
  fs.symlinkSync(target, arts(id));
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] }); // le relevé des 4 s ne tourne pas
  const root = profile('whisper-artifact-moves-v-');
  repo = path.join(root, 'projet');
  drops = path.join(root, 'depose');
  outside = path.join(root, 'dehors');
  secret = path.join(outside, 'secret.md');
  fs.mkdirSync(drops, { recursive: true });
  write(secret, SECRET);
  initRepo(repo);
  writeConfig(root, [
    { id: 'a1', dir: repo, name: 'parent', model: 'opus', effort: 'high', mode: 'default', sessionId: null, view: 'vibecoder', vibe: { flow: 'create', autonomy: 'guide', pr: null } },
  ]);
  const { projectArtifactsPath } = await import('app/controllers');
  projects = { a1: projectArtifactsPath(repo) };
});
afterEach(closeAll);

const agentOf = async (id: string) => {
  const { loadConfig } = await import('app/settings');
  const agent = loadConfig().agents.find((a) => a.id === id);
  if (!agent) throw new Error(`pas d'agent ${id} dans la config`);
  return agent;
};

describe('à l’ajout : copié dans le dossier du projet, l’original intact', () => {
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
