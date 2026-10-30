// Invariants de la copie et du déplacement sur le disque (note 0.13.0,
// docs/tickets/feat/0.13.0-ameliorer-artefacts.md, « Ce que ça ne doit pas
// faire ») :
//   - perdre un artefact : rien n'est effacé avant d'être arrivé, un transfert
//     qui échoue laisse le fichier sur le disque ;
//   - écraser un fichier existant ;
//   - modifier, déplacer ou supprimer ce qui est déposé : c'est copié, l'original
//     reste intact ;
//   - écrire ailleurs que sous la racine (un nom en `..` compris) ;
//   - suivre un lien : ni un lien sous la source, ni une source ou une racine qui
//     serait un lien, seul ou dans un dossier.
// Le côté des agents (parent, retour, ajout) : app/controllers/tests/invariants/artifact-moves.test.ts.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai disque : dossiers temporaires, vrais liens symboliques, vrais droits
// (chmod) pour qu'une copie échoue en route. Aucun fs simulé.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyInto, hasFiles, moveContents } from 'technicals/file-tree';

const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const read = (file: string) => fs.readFileSync(file, 'utf8');
// Liens de fichier et droits : sans équivalent simple sous Windows.
const posix = describe.skipIf(process.platform === 'win32');

let tmp = '';     // tout le cas se passe ici
let src = '';     // ce qu'on dépose (copyInto)
let from = '';    // ce qu'on déplace (moveContents)
let root = '';    // la racine d'arrivée, pas encore créée
let out = '';     // un dossier hors de tout, à ne pas toucher

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
// Tout le cas, sauf ce qu'il y a sous la racine.
function outsideRoot() {
  const under = path.relative(tmp, root);
  return Object.entries(snapshot(tmp)).filter(([name]) => name !== under && !name.startsWith(under + path.sep));
}

// Les droits retirés sont rendus, pour que le dossier temporaire s'efface.
const locked: string[] = [];
const lock = (p: string, mode = 0o555) => { fs.chmodSync(p, mode); locked.push(p); };
const unlock = () => { for (const p of locked.splice(0)) fs.chmodSync(p, fs.lstatSync(p).isDirectory() ? 0o755 : 0o644); };

beforeEach(() => {
  tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-file-tree-')));
  src = path.join(tmp, 'depose');
  from = path.join(tmp, 'sorties', 'enfant');
  root = path.join(tmp, 'sorties', 'parent', 'artifacts');
  out = path.join(tmp, 'dehors');
  fs.mkdirSync(src, { recursive: true });
  fs.mkdirSync(from, { recursive: true });
  fs.mkdirSync(path.dirname(root), { recursive: true });
  fs.mkdirSync(out, { recursive: true });
});
afterEach(unlock);

describe('copyInto : jamais d’écrasement', () => {
  it('un fichier du même nom : l’existant garde son texte', async () => {
    write(path.join(root, 'rapport.md'), 'ANCIEN');
    write(path.join(src, 'rapport.md'), 'NOUVEAU');

    await copyInto(path.join(src, 'rapport.md'), root);

    // l'existant n'a pas changé
    expect(read(path.join(root, 'rapport.md'))).toBe('ANCIEN');
  });

  it('un fichier du même nom : le nouveau arrive quand même', async () => {
    write(path.join(root, 'rapport.md'), 'ANCIEN');
    write(path.join(src, 'rapport.md'), 'NOUVEAU');

    await copyInto(path.join(src, 'rapport.md'), root);

    // le nouveau est quelque part sous la racine
    expect(contents(root)).toContain('NOUVEAU');
  });

  // Le premier numéro est pris aussi : le nouveau ne doit écraser aucun des deux.
  it('rapport.md et rapport-2.md déjà là : aucun des deux n’est écrasé', async () => {
    write(path.join(root, 'rapport.md'), 'UN');
    write(path.join(root, 'rapport-2.md'), 'DEUX');
    write(path.join(src, 'rapport.md'), 'NOUVEAU');

    await copyInto(path.join(src, 'rapport.md'), root);

    // le premier n'a pas changé
    expect(read(path.join(root, 'rapport.md'))).toBe('UN');
    // le deuxième n'a pas changé
    expect(read(path.join(root, 'rapport-2.md'))).toBe('DEUX');
    // le nouveau est arrivé
    expect(contents(root)).toContain('NOUVEAU');
  });

  it('un dossier mêlé à celui du même nom : le fichier existant garde son texte', async () => {
    write(path.join(root, 'maquettes', 'accueil.html'), 'ANCIEN');
    write(path.join(src, 'maquettes', 'accueil.html'), 'NOUVEAU');

    await copyInto(path.join(src, 'maquettes'), root);

    // l'existant n'a pas changé
    expect(read(path.join(root, 'maquettes', 'accueil.html'))).toBe('ANCIEN');
  });

  it('un dossier mêlé à celui du même nom : ses fichiers arrivent tous', async () => {
    write(path.join(root, 'maquettes', 'accueil.html'), 'ANCIEN');
    write(path.join(src, 'maquettes', 'accueil.html'), 'NOUVEAU');
    write(path.join(src, 'maquettes', 'autre.html'), 'AUTRE');

    await copyInto(path.join(src, 'maquettes'), root);

    // celui en conflit est arrivé
    expect(contents(root)).toContain('NOUVEAU');
    // l'autre aussi
    expect(contents(root)).toContain('AUTRE');
  });

  // Un fichier porte le nom du dossier à mêler : ni l'un ni l'autre ne se perd.
  it('un fichier qui porte le nom du dossier déposé : il reste un fichier, avec son texte', async () => {
    write(path.join(root, 'a'), 'ANCIEN');
    write(path.join(src, 'a', 'x.md'), 'NOUVEAU');

    await copyInto(path.join(src, 'a'), root);

    // le fichier n'a pas changé
    expect(read(path.join(root, 'a'))).toBe('ANCIEN');
    // le contenu du dossier est arrivé ailleurs
    expect(contents(root)).toContain('NOUVEAU');
  });

  // L'inverse : un dossier porte le nom du fichier déposé.
  it('un dossier qui porte le nom du fichier déposé : son contenu reste, le fichier arrive', async () => {
    write(path.join(root, 'a', 'x.md'), 'ANCIEN');
    write(path.join(src, 'a'), 'NOUVEAU');

    await copyInto(path.join(src, 'a'), root);

    // le contenu du dossier n'a pas changé
    expect(read(path.join(root, 'a', 'x.md'))).toBe('ANCIEN');
    // le fichier est arrivé
    expect(contents(root)).toContain('NOUVEAU');
  });
});

describe('moveContents : jamais d’écrasement', () => {
  it('témoin : un fichier arrive sous son chemin, et la source est effacée', async () => {
    write(path.join(from, 'maquettes', 'accueil.html'), 'PAGE');

    await moveContents(from, root);

    // arrivé, sous-dossier compris
    expect(read(path.join(root, 'maquettes', 'accueil.html'))).toBe('PAGE');
    // la source n'a plus ce fichier
    expect(fs.existsSync(path.join(from, 'maquettes', 'accueil.html'))).toBe(false);
  });

  it('un fichier du même nom : l’existant garde son texte, le nouveau arrive', async () => {
    write(path.join(root, 'rapport.md'), 'ANCIEN');
    write(path.join(from, 'rapport.md'), 'NOUVEAU');

    await moveContents(from, root);

    // l'existant n'a pas changé
    expect(read(path.join(root, 'rapport.md'))).toBe('ANCIEN');
    // le nouveau est arrivé
    expect(contents(root)).toContain('NOUVEAU');
  });

  it('un fichier du même nom dans un sous-dossier : l’existant garde son texte, le nouveau arrive', async () => {
    write(path.join(root, 'sous', 'rapport.md'), 'ANCIEN');
    write(path.join(from, 'sous', 'rapport.md'), 'NOUVEAU');

    await moveContents(from, root);

    // l'existant n'a pas changé
    expect(read(path.join(root, 'sous', 'rapport.md'))).toBe('ANCIEN');
    // le nouveau est arrivé
    expect(contents(root)).toContain('NOUVEAU');
  });

  // Un rename ou une écriture sans contrôle : le second écraserait le premier.
  it('deux déplacements en même temps, même nom, même racine : aucun des deux n’est perdu', async () => {
    const other = path.join(tmp, 'sorties', 'autre');
    write(path.join(from, 'rapport.md'), 'UN');
    write(path.join(other, 'rapport.md'), 'DEUX');

    await Promise.all([moveContents(from, root), moveContents(other, root)]);

    const everywhere = [...contents(root), ...contents(from), ...contents(other)];
    // le premier est quelque part
    expect(everywhere).toContain('UN');
    // le second aussi
    expect(everywhere).toContain('DEUX');
  });
});

describe('moveContents : rien de perdu', () => {
  // Le 1 001ᵉ passe le plafond de la liste des artefacts (LIST_MAX) : le déplacement n'en a pas.
  it('plus de 1 000 fichiers : tous arrivent', async () => {
    const count = 1001;
    for (let i = 0; i < count; i++) write(path.join(from, `f${i}.md`), `F${i}`);

    await moveContents(from, root);

    // autant de fichiers à l'arrivée qu'au départ
    expect(Object.keys(snapshot(root))).toHaveLength(count);
  });

  // Un fichier caché est un artefact comme les autres : il n'est pas laissé derrière.
  it('un fichier caché arrive comme les autres', async () => {
    write(path.join(from, '.env'), 'CACHE');

    await moveContents(from, root);

    // il est sous la racine
    expect(contents(root)).toContain('CACHE');
  });

  // Il n'est pas transféré : il n'est pas non plus effacé avec le dossier vidé.
  it('un dossier caché, pas transféré, n’est pas effacé', async () => {
    write(path.join(from, '.cache', 'x'), 'CACHE');

    await moveContents(from, root);

    // il reste à la source
    expect(read(path.join(from, '.cache', 'x'))).toBe('CACHE');
    // il n'est pas arrivé
    expect(contents(root)).not.toContain('CACHE');
  });
});

posix('moveContents : une copie qui échoue en route ne perd rien', () => {
  // Le sous-dossier d'arrivée est en lecture seule : la copie de ce fichier-là échoue.
  it('le fichier qui n’a pas pu arriver reste à la source, intact', async () => {
    write(path.join(from, 'sous', 'x.md'), 'BLOQUE');
    fs.mkdirSync(path.join(root, 'sous'), { recursive: true });
    lock(path.join(root, 'sous'));

    await moveContents(from, root);

    // le fichier est toujours là, avec son texte
    expect(read(path.join(from, 'sous', 'x.md'))).toBe('BLOQUE');
  });

  it('l’échec est dans le rapport, la promesse ne rejette pas', async () => {
    write(path.join(from, 'sous', 'x.md'), 'BLOQUE');
    fs.mkdirSync(path.join(root, 'sous'), { recursive: true });
    lock(path.join(root, 'sous'));

    const report = await moveContents(from, root);

    // au moins un échec rapporté
    expect(report.failed.length).toBeGreaterThan(0);
  });

  it('les fichiers suivants arrivent quand même', async () => {
    write(path.join(from, 'a.md'), 'AVANT');
    write(path.join(from, 'sous', 'x.md'), 'BLOQUE');
    write(path.join(from, 'z.md'), 'APRES');
    fs.mkdirSync(path.join(root, 'sous'), { recursive: true });
    lock(path.join(root, 'sous'));

    await moveContents(from, root);

    // celui d'avant est arrivé
    expect(contents(root)).toContain('AVANT');
    // celui d'après aussi
    expect(contents(root)).toContain('APRES');
  });

  // La source ne se lit pas : la copie échoue, et rien n'efface le fichier.
  it('un fichier illisible reste à la source', async () => {
    write(path.join(from, 'x.md'), 'ILLISIBLE');
    lock(path.join(from, 'x.md'), 0o000);

    const report = await moveContents(from, root);
    unlock();

    // le fichier est toujours là, avec son texte
    expect(read(path.join(from, 'x.md'))).toBe('ILLISIBLE');
    // l'échec est rapporté
    expect(report.failed.length).toBeGreaterThan(0);
  });

  // La racine ne peut pas être créée : rien n'arrive, donc rien ne part.
  it('une racine impossible à créer : tout reste à la source', async () => {
    write(path.join(from, 'x.md'), 'RESTE');
    lock(path.dirname(root));

    const report = await moveContents(from, root);

    // le fichier est toujours là
    expect(read(path.join(from, 'x.md'))).toBe('RESTE');
    // l'échec est rapporté
    expect(report.failed.length).toBeGreaterThan(0);
  });

  // Arrivé mais pas effaçable : il peut rester aux deux endroits, jamais à aucun.
  it('une source impossible à effacer : le fichier reste au moins d’un côté', async () => {
    write(path.join(from, 'sous', 'x.md'), 'COLLE');
    lock(path.join(from, 'sous'));

    await moveContents(from, root);

    // il est quelque part
    expect([...contents(root), ...contents(from)]).toContain('COLLE');
  });
});

describe('copyInto : l’original reste intact', () => {
  it('un fichier : à sa place, même texte, même date', async () => {
    const file = path.join(src, 'rapport.md');
    write(file, 'ORIGINAL');
    const before = fs.statSync(file).mtimeMs;

    await copyInto(file, root);

    // même texte
    expect(read(file)).toBe('ORIGINAL');
    // même date de modification
    expect(fs.statSync(file).mtimeMs).toBe(before);
  });

  it('un dossier : tout y reste, à la même place, avec le même texte', async () => {
    write(path.join(src, 'lot', 'a.md'), 'A');
    write(path.join(src, 'lot', 'sous', 'b.md'), 'B');
    const before = snapshot(src);

    await copyInto(path.join(src, 'lot'), root);

    // rien n'a bougé ni changé
    expect(snapshot(src)).toEqual(before);
  });

  // Un lien dur ou une copie partagée : toucher à la copie toucherait l'original.
  it('écrire dans la copie ne change pas l’original', async () => {
    const file = path.join(src, 'rapport.md');
    write(file, 'ORIGINAL');
    await copyInto(file, root);

    fs.appendFileSync(path.join(root, 'rapport.md'), ' RETOUCHE');

    // l'original n'a pas suivi
    expect(read(file)).toBe('ORIGINAL');
  });

  it('un conflit de nom : l’original reste intact', async () => {
    const file = path.join(src, 'rapport.md');
    write(file, 'ORIGINAL');
    write(path.join(root, 'rapport.md'), 'ANCIEN');

    await copyInto(file, root);

    // même texte
    expect(read(file)).toBe('ORIGINAL');
  });
});

posix('copyInto : une copie qui échoue en route ne perd rien', () => {
  it('une racine en lecture seule : l’original reste, l’échec est rapporté, la promesse ne rejette pas', async () => {
    const file = path.join(src, 'rapport.md');
    write(file, 'ORIGINAL');
    fs.mkdirSync(root, { recursive: true });
    lock(root);

    const report = await copyInto(file, root);

    // l'original est toujours là
    expect(read(file)).toBe('ORIGINAL');
    // l'échec est rapporté
    expect(report.failed.length).toBeGreaterThan(0);
  });

  it('un dossier dont un fichier échoue : les suivants arrivent', async () => {
    write(path.join(src, 'lot', 'a.md'), 'AVANT');
    write(path.join(src, 'lot', 'm.md'), 'ILLISIBLE');
    write(path.join(src, 'lot', 'z.md'), 'APRES');
    lock(path.join(src, 'lot', 'm.md'), 0o000);

    const report = await copyInto(path.join(src, 'lot'), root);

    // l'échec est rapporté
    expect(report.failed.length).toBeGreaterThan(0);
    // celui d'avant est arrivé
    expect(contents(root)).toContain('AVANT');
    // celui d'après aussi
    expect(contents(root)).toContain('APRES');
  });
});

describe('rien n’est écrit hors de la racine', () => {
  it('témoin : un dossier déposé n’écrit que sous la racine', async () => {
    write(path.join(src, 'lot', 'sous', 'a.md'), 'A');
    const before = outsideRoot();

    await copyInto(path.join(src, 'lot'), root);

    // il est arrivé
    expect(contents(root)).toContain('A');
    // rien d'autre n'a changé
    expect(outsideRoot()).toEqual(before);
  });

  // Son nom de base est `..` : le mettre sous la racine, c'est écrire dans le parent de la racine.
  it('un dossier dont le nom est `..` : rien n’est écrit dans le parent de la racine', async () => {
    write(path.join(src, 'x.md'), 'DEPOSE');
    fs.mkdirSync(path.join(src, 'sous'));
    fs.mkdirSync(root, { recursive: true });
    const before = outsideRoot();

    await copyInto(`${src}${path.sep}sous${path.sep}..`, root);

    // rien n'a changé hors de la racine
    expect(outsideRoot()).toEqual(before);
  });

  it('moveContents : rien n’arrive hors de la racine, le reste ne bouge pas', async () => {
    write(path.join(from, 'sous', 'a.md'), 'A');
    write(path.join(out, 'garde.md'), 'GARDE');
    const before = snapshot(out);

    await moveContents(from, root);

    // il est arrivé
    expect(contents(root)).toContain('A');
    // le dehors n'a pas changé
    expect(snapshot(out)).toEqual(before);
  });
});

posix('copyInto : un lien n’est jamais suivi', () => {
  beforeEach(() => { write(path.join(out, 'secret.md'), 'SECRET'); });

  it('un lien vers un fichier, seul : sa cible n’est pas copiée', async () => {
    fs.symlinkSync(path.join(out, 'secret.md'), path.join(src, 'lien.md'));

    const report = await copyInto(path.join(src, 'lien.md'), root);

    // la cible n'est pas sous la racine
    expect(contents(root)).not.toContain('SECRET');
    // le lien est rapporté comme passé
    expect(report.links.length).toBeGreaterThan(0);
  });

  it('un lien vers un dossier, seul : son contenu n’est pas copié', async () => {
    fs.symlinkSync(out, path.join(src, 'lien'));

    await copyInto(path.join(src, 'lien'), root);

    // le contenu de la cible n'est pas sous la racine
    expect(contents(root)).not.toContain('SECRET');
  });

  it('un lien vers un fichier, dans un dossier : passé, les autres fichiers arrivent', async () => {
    write(path.join(src, 'lot', 'a.md'), 'A');
    fs.symlinkSync(path.join(out, 'secret.md'), path.join(src, 'lot', 'lien.md'));

    const report = await copyInto(path.join(src, 'lot'), root);

    // témoin : le fichier ordinaire est arrivé
    expect(contents(root)).toContain('A');
    // la cible n'est pas sous la racine
    expect(contents(root)).not.toContain('SECRET');
    // le lien est rapporté comme passé
    expect(report.links.length).toBeGreaterThan(0);
  });

  it('un lien vers un dossier, dans un dossier : on n’y entre pas', async () => {
    write(path.join(src, 'lot', 'a.md'), 'A');
    fs.symlinkSync(out, path.join(src, 'lot', 'lien'));

    await copyInto(path.join(src, 'lot'), root);

    // témoin : le fichier ordinaire est arrivé
    expect(contents(root)).toContain('A');
    // le contenu de la cible n'est pas sous la racine
    expect(contents(root)).not.toContain('SECRET');
  });

  it('une racine qui est un lien : rien n’arrive dans sa cible, l’échec est rapporté', async () => {
    write(path.join(src, 'a.md'), 'A');
    fs.symlinkSync(out, root);
    const before = snapshot(out);

    const report = await copyInto(path.join(src, 'a.md'), root);

    // la cible n'a pas changé
    expect(snapshot(out)).toEqual(before);
    // l'échec est rapporté
    expect(report.failed.length).toBeGreaterThan(0);
  });

  // Un lien cassé : créer la racine « à travers » lui créerait sa cible.
  it('une racine qui est un lien cassé : sa cible n’est pas créée', async () => {
    write(path.join(src, 'a.md'), 'A');
    fs.symlinkSync(path.join(out, 'absent'), root);

    const report = await copyInto(path.join(src, 'a.md'), root);

    // la cible n'existe toujours pas
    expect(fs.existsSync(path.join(out, 'absent'))).toBe(false);
    // l'échec est rapporté
    expect(report.failed.length).toBeGreaterThan(0);
  });

  // Écrire sous ce nom écrirait dans la cible du lien.
  it('un lien sous la racine qui porte le nom du fichier : sa cible garde son texte', async () => {
    write(path.join(src, 'rapport.md'), 'NOUVEAU');
    fs.mkdirSync(root, { recursive: true });
    fs.symlinkSync(path.join(out, 'secret.md'), path.join(root, 'rapport.md'));

    await copyInto(path.join(src, 'rapport.md'), root);

    // la cible n'a pas changé
    expect(read(path.join(out, 'secret.md'))).toBe('SECRET');
    // le nouveau est arrivé, sous un autre nom
    expect(contents(root)).toContain('NOUVEAU');
  });

  // Un lien cassé semble libre (stat dit absent) : écrire sous ce nom créerait sa cible.
  it('un lien cassé sous la racine qui porte le nom du fichier : sa cible n’est pas créée', async () => {
    write(path.join(src, 'rapport.md'), 'NOUVEAU');
    fs.mkdirSync(root, { recursive: true });
    fs.symlinkSync(path.join(out, 'absent.md'), path.join(root, 'rapport.md'));

    await copyInto(path.join(src, 'rapport.md'), root);

    // la cible n'existe toujours pas
    expect(fs.existsSync(path.join(out, 'absent.md'))).toBe(false);
    // le nouveau est arrivé, sous un autre nom
    expect(contents(root)).toContain('NOUVEAU');
  });

  // Se mêler à ce « dossier » écrirait dans la cible du lien.
  it('un lien sous la racine qui porte le nom du dossier déposé : rien n’arrive dans sa cible', async () => {
    write(path.join(src, 'a', 'x.md'), 'NOUVEAU');
    fs.mkdirSync(root, { recursive: true });
    fs.symlinkSync(out, path.join(root, 'a'));
    const before = snapshot(out);

    await copyInto(path.join(src, 'a'), root);

    // la cible n'a pas changé
    expect(snapshot(out)).toEqual(before);
    // le contenu est arrivé ailleurs sous la racine
    expect(contents(root)).toContain('NOUVEAU');
  });
});

posix('moveContents : un lien n’est jamais suivi', () => {
  beforeEach(() => { write(path.join(out, 'secret.md'), 'SECRET'); });

  it('une source qui est un lien : rien n’est transféré, sa cible est intacte', async () => {
    const linked = path.join(tmp, 'sorties', 'lien');
    fs.symlinkSync(out, linked);
    const before = snapshot(out);

    await moveContents(linked, root);

    // la cible n'a pas changé
    expect(snapshot(out)).toEqual(before);
    // rien n'est arrivé
    expect(contents(root)).not.toContain('SECRET');
  });

  it('un lien vers un fichier sous la source : pas transféré, sa cible est intacte', async () => {
    write(path.join(from, 'a.md'), 'A');
    fs.symlinkSync(path.join(out, 'secret.md'), path.join(from, 'lien.md'));

    await moveContents(from, root);

    // témoin : le fichier ordinaire est arrivé
    expect(contents(root)).toContain('A');
    // la cible n'est pas sous la racine
    expect(contents(root)).not.toContain('SECRET');
    // la cible n'a pas changé
    expect(read(path.join(out, 'secret.md'))).toBe('SECRET');
  });

  it('un lien vers un dossier sous la source : on n’y entre pas, sa cible est intacte', async () => {
    write(path.join(from, 'a.md'), 'A');
    fs.symlinkSync(out, path.join(from, 'lien'));

    await moveContents(from, root);

    // témoin : le fichier ordinaire est arrivé
    expect(contents(root)).toContain('A');
    // la cible n'est pas sous la racine
    expect(contents(root)).not.toContain('SECRET');
    // la cible n'a pas changé
    expect(read(path.join(out, 'secret.md'))).toBe('SECRET');
  });

  it('une racine qui est un lien : rien n’arrive dans sa cible, tout reste à la source', async () => {
    write(path.join(from, 'a.md'), 'A');
    fs.symlinkSync(out, root);
    const before = snapshot(out);

    const report = await moveContents(from, root);

    // la cible n'a pas changé
    expect(snapshot(out)).toEqual(before);
    // le fichier est toujours à la source
    expect(read(path.join(from, 'a.md'))).toBe('A');
    // l'échec est rapporté
    expect(report.failed.length).toBeGreaterThan(0);
  });

  // Écrire sous ce nom écrirait dans la cible, et la source partirait.
  it('un lien sous la racine qui porte le nom du fichier : sa cible garde son texte, le fichier n’est pas perdu', async () => {
    write(path.join(from, 'rapport.md'), 'NOUVEAU');
    fs.mkdirSync(root, { recursive: true });
    fs.symlinkSync(path.join(out, 'secret.md'), path.join(root, 'rapport.md'));

    await moveContents(from, root);

    // la cible n'a pas changé
    expect(read(path.join(out, 'secret.md'))).toBe('SECRET');
    // le fichier est quelque part
    expect([...contents(root), ...contents(from)]).toContain('NOUVEAU');
  });

  it('un lien sous la racine qui porte le nom d’un sous-dossier : rien n’arrive dans sa cible, le fichier n’est pas perdu', async () => {
    write(path.join(from, 'a', 'x.md'), 'NOUVEAU');
    fs.mkdirSync(root, { recursive: true });
    fs.symlinkSync(out, path.join(root, 'a'));
    const before = snapshot(out);

    await moveContents(from, root);

    // la cible n'a pas changé
    expect(snapshot(out)).toEqual(before);
    // le fichier est quelque part
    expect([...contents(root), ...contents(from)]).toContain('NOUVEAU');
  });
});

// Le retrait s'en sert pour oublier un dossier : un faux « plus rien » y perdrait des artefacts.
describe('hasFiles : ne dit « plus rien » que s’il ne reste rien', () => {
  it('un fichier dans un sous-dossier : il en reste', async () => {
    write(path.join(from, 'a', 'b', 'x.md'), 'X');

    const has = await hasFiles(from);

    // il est vu
    expect(has).toBe(true);
  });

  it('un fichier caché : il en reste', async () => {
    write(path.join(from, '.env'), 'X');

    const has = await hasFiles(from);

    // il est vu
    expect(has).toBe(true);
  });
});

posix('hasFiles : un lien n’est pas suivi', () => {
  beforeEach(() => { write(path.join(out, 'secret.md'), 'SECRET'); });

  it('un dossier qui est un lien vers des fichiers : rien', async () => {
    const linked = path.join(tmp, 'sorties', 'lien');
    fs.symlinkSync(out, linked);

    const has = await hasFiles(linked);

    // sa cible ne compte pas
    expect(has).toBe(false);
  });

  it('un dossier qui ne contient qu’un lien vers un dossier : rien', async () => {
    fs.symlinkSync(out, path.join(from, 'lien'));

    const has = await hasFiles(from);

    // sa cible ne compte pas
    expect(has).toBe(false);
  });
});
