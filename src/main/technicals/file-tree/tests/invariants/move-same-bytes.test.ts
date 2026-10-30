// Invariant du déplacement repris après une coupure (note 0.13.0,
// docs/tickets/fix/0.13.0-fix-and-improvements.md, sujet 8, « Ce que ça ne doit pas
// faire ») : perdre ou écraser un artefact en le déplaçant vers le dossier du projet.
// Forme : un nom pris par un fichier ordinaire de mêmes taille et octets efface la
// source sans rien copier ; tout le reste garde les deux. Effacer une source que
// l'arrivée ne contient pas vraiment, c'est la perdre.
// Les cas de noms différents : file-tree.test.ts, qui ne change pas.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai disque : dossiers temporaires, vrais liens symboliques, vrais droits.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { moveContents } from 'technicals/file-tree';

const write = (file: string, content: string | Buffer) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const read = (file: string) => fs.readFileSync(file, 'utf8');
const posix = describe.skipIf(process.platform === 'win32');

let from = '';    // ce qu'on déplace
let root = '';    // la racine d'arrivée
let tmp = '';

// Les chemins sous un dossier ; tous les fichiers ordinaires, et leur texte.
const names = (dir: string) => fs.readdirSync(dir, { recursive: true }).map(String).sort();
const texts = (dir: string) => names(dir)
  .filter((n) => fs.lstatSync(path.join(dir, n)).isFile())
  .map((n) => read(path.join(dir, n)));

// Les droits retirés sont rendus, pour que le dossier temporaire s'efface.
const locked: string[] = [];
const lock = (p: string) => { fs.chmodSync(p, 0o000); locked.push(p); };
const unlock = () => { for (const p of locked.splice(0)) fs.chmodSync(p, 0o644); };

beforeEach(() => {
  tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-same-bytes-')));
  from = path.join(tmp, 'ancien');
  root = path.join(tmp, 'projet');
  fs.mkdirSync(from);
  fs.mkdirSync(root);
});
afterEach(unlock);

describe('un même nom et les mêmes octets : la coupure entre la copie et l’effacement', () => {
  it('la source est effacée, et aucun rapport-2.md n’apparaît', async () => {
    write(path.join(root, 'rapport.md'), 'RAPPORT');
    write(path.join(from, 'rapport.md'), 'RAPPORT');

    await moveContents(from, root);

    // la source n'est plus là
    expect(fs.existsSync(path.join(from, 'rapport.md'))).toBe(false);
    // à l'arrivée, un seul fichier
    expect(names(root)).toEqual(['rapport.md']);
    // il a gardé son texte
    expect(read(path.join(root, 'rapport.md'))).toBe('RAPPORT');
  });

  it('dans un sous-dossier : pareil', async () => {
    write(path.join(root, 'sous', 'rapport.md'), 'RAPPORT');
    write(path.join(from, 'sous', 'rapport.md'), 'RAPPORT');

    await moveContents(from, root);

    // la source n'est plus là
    expect(fs.existsSync(path.join(from, 'sous', 'rapport.md'))).toBe(false);
    // à l'arrivée, rien de plus
    expect(names(root)).toEqual(['sous', path.join('sous', 'rapport.md')]);
  });

  // Rien à comparer : deux fichiers vides sont bien les mêmes.
  it('deux fichiers vides : la source est effacée, aucun numéro', async () => {
    write(path.join(root, 'vide.md'), '');
    write(path.join(from, 'vide.md'), '');

    await moveContents(from, root);

    // la source n'est plus là
    expect(fs.existsSync(path.join(from, 'vide.md'))).toBe(false);
    // à l'arrivée, un seul fichier
    expect(names(root)).toEqual(['vide.md']);
  });

  it('deux déplacements en même temps, mêmes nom et octets : le fichier reste à l’arrivée', async () => {
    const other = path.join(tmp, 'autre');
    write(path.join(from, 'rapport.md'), 'RAPPORT');
    write(path.join(other, 'rapport.md'), 'RAPPORT');

    await Promise.all([moveContents(from, root), moveContents(other, root)]);

    // son texte est à l'arrivée, quel que soit celui qui a copié
    expect(texts(root)).toContain('RAPPORT');
  });
});

describe('un même nom, mais pas les mêmes octets : les deux restent', () => {
  // Une comparaison de la seule taille prendrait celui-ci pour le même, et perdrait la source.
  it('même taille, octets différents : l’existant garde son texte, la source arrive', async () => {
    write(path.join(root, 'rapport.md'), 'AAAAAAA');
    write(path.join(from, 'rapport.md'), 'BBBBBBB');

    await moveContents(from, root);

    // l'existant n'a pas changé
    expect(read(path.join(root, 'rapport.md'))).toBe('AAAAAAA');
    // la source est arrivée
    expect(texts(root)).toContain('BBBBBBB');
  });

  // Lus par morceaux : la différence est au-delà de tout premier morceau.
  it('de gros fichiers qui ne diffèrent qu’à leur dernier octet : les deux restent', async () => {
    const size = 3 * 1024 * 1024;
    const mine = Buffer.alloc(size, 'a');
    const theirs = Buffer.alloc(size, 'a');
    theirs[size - 1] = 'b'.charCodeAt(0);
    write(path.join(root, 'gros.bin'), mine);
    write(path.join(from, 'gros.bin'), theirs);

    await moveContents(from, root);

    // l'existant n'a pas changé
    expect(fs.readFileSync(path.join(root, 'gros.bin')).equals(mine)).toBe(true);
    // la source est arrivée, sous un autre nom
    expect(names(root).some((n) => fs.readFileSync(path.join(root, n)).equals(theirs))).toBe(true);
  });

  // La coupure pendant la copie : le début de la source, sous son nom. Risque accepté : la copie tronquée reste.
  it('une copie tronquée : elle reste, la source arrive entière sous le numéro libre', async () => {
    write(path.join(root, 'rapport.md'), 'RAPP');
    write(path.join(from, 'rapport.md'), 'RAPPORT');

    await moveContents(from, root);

    // la copie tronquée n'a pas changé
    expect(read(path.join(root, 'rapport.md'))).toBe('RAPP');
    // la source est arrivée, entière
    expect(texts(root)).toContain('RAPPORT');
    // elle n'est plus à la source
    expect(fs.existsSync(path.join(from, 'rapport.md'))).toBe(false);
  });

  it('un dossier porte ce nom : son contenu reste, la source arrive', async () => {
    write(path.join(root, 'rapport.md', 'dedans.md'), 'DEDANS');
    write(path.join(from, 'rapport.md'), 'RAPPORT');

    await moveContents(from, root);

    // le contenu du dossier n'a pas changé
    expect(read(path.join(root, 'rapport.md', 'dedans.md'))).toBe('DEDANS');
    // la source est arrivée
    expect(texts(root)).toContain('RAPPORT');
  });
});

posix('un fichier qu’on ne peut pas comparer n’est pas le même', () => {
  // Le lien mène à un fichier de mêmes octets : ce n'est pas un fichier ordinaire de l'arrivée, effacer la source la perdrait.
  it('un lien sous la racine, vers un fichier de mêmes octets : la source n’est pas perdue', async () => {
    const target = path.join(tmp, 'dehors.md');
    write(target, 'RAPPORT');
    fs.symlinkSync(target, path.join(root, 'rapport.md'));
    write(path.join(from, 'rapport.md'), 'RAPPORT');

    await moveContents(from, root);
    fs.rmSync(target);

    // le texte est encore quelque part, à la source ou à l'arrivée, sans passer par le lien
    expect([...texts(from), ...texts(root)]).toContain('RAPPORT');
  });

  it('l’existant illisible, de même taille : la source n’est pas perdue', async () => {
    const existing = path.join(root, 'rapport.md');
    write(existing, 'RAPPORT');
    write(path.join(from, 'rapport.md'), 'RAPPORT');
    lock(existing);

    await moveContents(from, root);
    unlock();

    // la source est encore là, ou elle est arrivée sous un autre nom
    expect([...texts(from), ...names(root).filter((n) => n !== 'rapport.md').map((n) => read(path.join(root, n)))]).toContain('RAPPORT');
  });

  it('la source illisible, de même taille : elle reste, intacte', async () => {
    const source = path.join(from, 'rapport.md');
    write(path.join(root, 'rapport.md'), 'AUTRE__');
    write(source, 'RAPPORT');
    lock(source);

    await moveContents(from, root);
    unlock();

    // elle n'a pas été effacée
    expect(read(source)).toBe('RAPPORT');
    // l'existant n'a pas changé
    expect(read(path.join(root, 'rapport.md'))).toBe('AUTRE__');
  });
});
