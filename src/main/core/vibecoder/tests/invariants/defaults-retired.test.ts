// Invariant du ménage des fichiers par défaut (note 0.13.0,
// docs/tickets/fix/0.13.0-fix-and-improvements.md, sujet 10, « Ce que ça ne doit pas
// faire ») : supprimer un fichier retouché par l'utilisateur, ou absent du manifeste
// (illisible, le manifeste ne donne droit à aucune suppression). Forme : removeRetired ;
// une entrée hors des défauts, au sha1 identique, part avec les variantes de son skill ;
// retouché : gardé, entrée retirée ; illisible : entrée gardée ; manifeste illisible ou
// chemin hors du dossier : rien.
// Protégé : si un test échoue, corriger le code.
//
// Sur du réel : un dossier temporaire, un disque sur node:fs (mêmes règles que celui de
// l'appli : null si le fichier manque, une erreur s'il est illisible), vrais droits.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { removeRetired, skillVariants, syncDefaults, type DefaultFile } from 'core/vibecoder';

const disk = {
  read: (p: string) => {
    try { return fs.readFileSync(p, 'utf8'); } catch (err) { if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null; throw err; }
  },
  write: (p: string, content: string) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); },
  remove: (p: string) => { fs.rmSync(p); },
};
const posix = describe.skipIf(process.platform === 'win32');

const FILE = 'plugin/skills/note/SKILL.md';
const SKILL = '---\nname: note\nmodel: opus\neffort: high\n---\nle skill\n';
const KEPT = 'plugin/skills/garde/SKILL.md';
const OLD: DefaultFile[] = [{ path: FILE, content: SKILL }, { path: KEPT, content: 'gardé\n' }];
// La version suivante de l'appli : `note` n'est plus livré.
const NEW: DefaultFile[] = [{ path: KEPT, content: 'gardé\n' }];

let tmp = '';
let dir = '';
const at = (rel: string) => path.join(dir, rel);
const manifestFile = () => at('.defaults.json');
const manifest = () => Object.keys(JSON.parse(fs.readFileSync(manifestFile(), 'utf8')) as object);
// Les défauts écrits par la version d'avant, comme au démarrage.
const installed = () => { syncDefaults(dir, OLD, disk); };
// Les variantes du skill, écrites comme au démarrage, hors manifeste.
const withVariants = () => {
  const variants = skillVariants('note', SKILL);
  for (const v of variants) disk.write(at(v.path), v.content);
  return variants.map((v) => v.path);
};

// Les droits retirés sont rendus, pour que le dossier temporaire s'efface.
const locked: string[] = [];
const lock = (p: string) => { fs.chmodSync(p, 0o000); locked.push(p); };
const unlock = () => { for (const p of locked.splice(0)) fs.chmodSync(p, 0o644); };

beforeEach(() => {
  tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'vibecoder-retires-')));
  dir = path.join(tmp, 'vibecoder');
});
afterEach(unlock);

describe('un fichier du manifeste, plus livré, jamais retouché : il part', () => {
  it('témoin : le fichier est supprimé, et son entrée retirée', () => {
    installed();

    removeRetired(dir, NEW, disk);

    // il n'est plus là
    expect(fs.existsSync(at(FILE))).toBe(false);
    // le manifeste ne le connaît plus
    expect(manifest()).not.toContain(FILE);
  });

  it('témoin : un SKILL.md part avec ses variantes', () => {
    installed();
    const variants = withVariants();

    removeRetired(dir, NEW, disk);

    // témoin : le skill a bien des variantes
    expect(variants.length).toBeGreaterThan(0);
    // aucune ne reste
    expect(variants.filter((v) => fs.existsSync(at(v)))).toEqual([]);
  });

  it('un fichier encore livré : il reste', () => {
    installed();

    removeRetired(dir, NEW, disk);

    // il est toujours là, avec son texte
    expect(fs.readFileSync(at(KEPT), 'utf8')).toBe('gardé\n');
  });
});

describe('un fichier retouché par l’utilisateur n’est jamais supprimé', () => {
  it('retouché : il reste, avec sa retouche', () => {
    installed();
    fs.writeFileSync(at(FILE), 'ma version\n');

    removeRetired(dir, NEW, disk);

    // sa retouche est toujours là
    expect(fs.readFileSync(at(FILE), 'utf8')).toBe('ma version\n');
  });

  // L'entrée retirée : le manifeste ne le prend plus pour le nôtre, même s'il retrouve un jour notre texte.
  it('retouché, puis remis au texte livré : il n’est plus à nous, il reste', () => {
    installed();
    fs.writeFileSync(at(FILE), 'ma version\n');
    removeRetired(dir, NEW, disk);
    fs.writeFileSync(at(FILE), SKILL);

    removeRetired(dir, NEW, disk);

    // il est toujours là
    expect(fs.readFileSync(at(FILE), 'utf8')).toBe(SKILL);
  });

  it('retouché : un démarrage de plus ne le supprime pas', () => {
    installed();
    fs.writeFileSync(at(FILE), 'ma version\n');

    removeRetired(dir, NEW, disk);
    removeRetired(dir, NEW, disk);

    // sa retouche est toujours là
    expect(fs.readFileSync(at(FILE), 'utf8')).toBe('ma version\n');
  });
});

describe('un fichier absent du manifeste n’est jamais supprimé', () => {
  it('un fichier écrit à la main, à côté du skill retiré : il reste', () => {
    installed();
    disk.write(at('plugin/skills/note/mes-notes.md'), 'à moi\n');

    removeRetired(dir, NEW, disk);

    // il est toujours là
    expect(fs.readFileSync(at('plugin/skills/note/mes-notes.md'), 'utf8')).toBe('à moi\n');
    // témoin : le skill retiré est parti
    expect(fs.existsSync(at(FILE))).toBe(false);
  });

  it('un skill écrit à la main, jamais livré : il reste', () => {
    installed();
    disk.write(at('plugin/skills/perso/SKILL.md'), 'à moi\n');

    removeRetired(dir, NEW, disk);

    // il est toujours là
    expect(fs.readFileSync(at('plugin/skills/perso/SKILL.md'), 'utf8')).toBe('à moi\n');
  });

  // Le début du nom est le même : seules les variantes partent, celles d'un modèle.
  it('des skills à soi au nom voisin (note--perso, notebook) : ils restent', () => {
    installed();
    withVariants();
    disk.write(at('plugin/skills/note--perso/SKILL.md'), 'à moi\n');
    disk.write(at('plugin/skills/notebook/SKILL.md'), 'à moi aussi\n');

    removeRetired(dir, NEW, disk);

    // le premier est toujours là
    expect(fs.readFileSync(at('plugin/skills/note--perso/SKILL.md'), 'utf8')).toBe('à moi\n');
    // le second aussi
    expect(fs.readFileSync(at('plugin/skills/notebook/SKILL.md'), 'utf8')).toBe('à moi aussi\n');
  });

  // Un fichier qui n'est pas un SKILL.md n'a pas de variantes : celles du skill d'à côté restent.
  it('un fichier retiré à côté d’un skill encore livré : les variantes de ce skill restent', () => {
    const other = 'plugin/skills/note/reference.md';
    syncDefaults(dir, [...OLD, { path: other, content: 'réf\n' }], disk);
    const variants = withVariants();

    removeRetired(dir, OLD, disk);

    // témoin : le fichier retiré est parti
    expect(fs.existsSync(at(other))).toBe(false);
    // les variantes restent
    expect(variants.filter((v) => !fs.existsSync(at(v)))).toEqual([]);
  });
});

describe('sans manifeste lisible : aucune suppression', () => {
  it('un manifeste qui n’est pas du JSON : rien n’est supprimé', () => {
    installed();
    fs.writeFileSync(manifestFile(), '{ pas du json');

    removeRetired(dir, NEW, disk);

    // le fichier est toujours là
    expect(fs.existsSync(at(FILE))).toBe(true);
  });

  it('un manifeste qui n’est pas du JSON : les variantes ne partent pas non plus', () => {
    installed();
    const variants = withVariants();
    fs.writeFileSync(manifestFile(), '{ pas du json');

    removeRetired(dir, NEW, disk);

    // aucune variante n'a disparu
    expect(variants.filter((v) => !fs.existsSync(at(v)))).toEqual([]);
  });

  it('un manifeste qui n’est pas un objet : rien n’est supprimé', () => {
    installed();
    fs.writeFileSync(manifestFile(), '["plugin/skills/note/SKILL.md"]');

    removeRetired(dir, NEW, disk);

    // le fichier est toujours là
    expect(fs.existsSync(at(FILE))).toBe(true);
  });

  it('pas de manifeste : rien n’est supprimé', () => {
    installed();
    fs.rmSync(manifestFile());

    removeRetired(dir, NEW, disk);

    // le fichier est toujours là
    expect(fs.existsSync(at(FILE))).toBe(true);
  });
});

describe('un chemin du manifeste hors du dossier : rien', () => {
  // Le fichier du dehors a le texte livré : seul le chemin peut le protéger.
  it('un chemin qui remonte : le fichier du dehors reste', () => {
    const outside = path.join(tmp, 'dehors.md');
    fs.writeFileSync(outside, SKILL);
    installed();
    fs.writeFileSync(manifestFile(), fs.readFileSync(manifestFile(), 'utf8').replace(FILE, '../dehors.md'));

    removeRetired(dir, NEW, disk);

    // il est toujours là
    expect(fs.readFileSync(outside, 'utf8')).toBe(SKILL);
  });

  it('un chemin absolu : le fichier du dehors reste', () => {
    const outside = path.join(tmp, 'dehors.md');
    fs.writeFileSync(outside, SKILL);
    installed();
    fs.writeFileSync(manifestFile(), fs.readFileSync(manifestFile(), 'utf8').replace(FILE, outside.split(path.sep).join('/')));

    removeRetired(dir, NEW, disk);

    // il est toujours là
    expect(fs.readFileSync(outside, 'utf8')).toBe(SKILL);
  });

  // Son SKILL.md remonte : ses « variantes » seraient à côté, hors du dossier.
  it('un SKILL.md qui remonte : les variantes de son chemin, au dehors, restent', () => {
    const outside = path.join(tmp, 'skills', 'note', 'SKILL.md');
    const variant = path.join(tmp, 'skills', 'note--sonnet', 'SKILL.md');
    disk.write(outside, SKILL);
    disk.write(variant, 'à moi\n');
    installed();
    fs.writeFileSync(manifestFile(), fs.readFileSync(manifestFile(), 'utf8').replace(FILE, '../skills/note/SKILL.md'));

    removeRetired(dir, NEW, disk);

    // le fichier du dehors est toujours là
    expect(fs.readFileSync(outside, 'utf8')).toBe(SKILL);
    // sa « variante » aussi
    expect(fs.readFileSync(variant, 'utf8')).toBe('à moi\n');
  });
});

posix('un fichier illisible n’est ni supprimé ni oublié', () => {
  it('il reste, et son entrée aussi', () => {
    installed();
    lock(at(FILE));

    removeRetired(dir, NEW, disk);
    unlock();

    // il est toujours là, avec son texte
    expect(fs.readFileSync(at(FILE), 'utf8')).toBe(SKILL);
    // le manifeste le connaît encore
    expect(manifest()).toContain(FILE);
  });
});
