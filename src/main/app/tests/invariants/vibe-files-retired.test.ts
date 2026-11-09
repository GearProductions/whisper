// Invariant du ménage au démarrage (note 0.13.0,
// docs/tickets/fix/0.13.0-fix-and-improvements.md, sujet 10, « Ce que ça ne doit pas
// faire ») : supprimer un fichier retouché par l'utilisateur, ou absent du manifeste.
// Ici, le vrai chemin du démarrage (ensureVibeFiles), là où removeRetired et syncDefaults
// se suivent ; le détail des cas : core/vibecoder/tests/invariants/defaults-retired.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai principal et le vrai disque, par le décor commun (app/tests/harness) : le
// profil et des fichiers livrés d'essai dans un dossier temporaire ; faux : Electron (le
// dossier du profil) et l'emplacement des fichiers livrés.
import fs from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeElectron, profile, repoResources, write } from 'app/tests/harness';

let userData = '';
let resources = '';

const electron = fakeElectron();
vi.mock('electron', () => electron.module);

vi.mock('technicals/paths', () => repoResources(() => resources));

const SKILL = '---\nname: note\nmodel: opus\neffort: high\n---\nle skill\n';
// Un fichier des fichiers livrés, et le même chez l'utilisateur.
const shipped = (rel: string) => path.join(resources, 'vibecoder', rel);
const installed = (rel: string) => path.join(userData, 'vibecoder', rel);
const FILE = 'plugin/skills/note/SKILL.md';
const VARIANT = 'plugin/skills/note--sonnet/SKILL.md';
const AGENT = 'plugin/agents/relecteur.md';
const start = async () => (await import('app/settings')).ensureVibeFiles();
// La version suivante de l'appli ne livre plus ces fichiers.
const retire = (...rels: string[]) => { for (const rel of rels) fs.rmSync(shipped(rel)); };

beforeEach(async () => {
  vi.resetModules();
  userData = profile('whisper-retires-');
  resources = path.join(userData, 'livre');
  write(shipped(FILE), SKILL);
  write(shipped(AGENT), 'un agent\n');
  write(shipped('plugin/skills/garde/SKILL.md'), '---\nname: garde\n---\ngardé\n');
  await start();
});

describe('au démarrage, le plugin installé suit le dépôt, sauf ce qui est à l’utilisateur', () => {
  it('témoin : un skill plus livré, jamais retouché, part avec ses variantes et son dossier vide', async () => {
    // témoin : il a bien une variante, générée au démarrage d'avant
    expect(fs.existsSync(installed(VARIANT))).toBe(true);
    retire(FILE);

    await start();

    // le fichier n'est plus là
    expect(fs.existsSync(installed(FILE))).toBe(false);
    // son dossier vide non plus
    expect(fs.existsSync(path.dirname(installed(FILE)))).toBe(false);
    // sa variante non plus
    expect(fs.existsSync(installed(VARIANT))).toBe(false);
  });

  it('un skill plus livré mais retouché : il reste, avec sa retouche', async () => {
    fs.writeFileSync(installed(FILE), 'ma version\n');
    retire(FILE);

    await start();

    // sa retouche est toujours là
    expect(fs.readFileSync(installed(FILE), 'utf8')).toBe('ma version\n');
  });

  it('un agent plus livré mais retouché : il reste, aux démarrages suivants aussi', async () => {
    fs.writeFileSync(installed(AGENT), 'ma version\n');
    retire(AGENT);

    await start();
    await start();

    // sa retouche est toujours là
    expect(fs.readFileSync(installed(AGENT), 'utf8')).toBe('ma version\n');
  });

  it('un fichier écrit à la main dans le dossier d’un skill retiré : il reste, et le dossier avec', async () => {
    write(path.join(path.dirname(installed(FILE)), 'mes-notes.md'), 'à moi\n');
    retire(FILE);

    await start();

    // il est toujours là
    expect(fs.readFileSync(path.join(path.dirname(installed(FILE)), 'mes-notes.md'), 'utf8')).toBe('à moi\n');
  });

  it('un skill écrit à la main : il reste', async () => {
    write(installed('plugin/skills/perso/SKILL.md'), 'à moi\n');
    retire(AGENT);

    await start();

    // il est toujours là
    expect(fs.readFileSync(installed('plugin/skills/perso/SKILL.md'), 'utf8')).toBe('à moi\n');
  });

  it('un manifeste illisible : rien de plus livré n’est supprimé', async () => {
    fs.writeFileSync(installed('.defaults.json'), '{ pas du json');
    retire(FILE);

    await start();

    // le fichier est toujours là
    expect(fs.existsSync(installed(FILE))).toBe(true);
  });
});
