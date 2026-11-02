// Variantes de file-tree : ce que les invariants laissent de côté (rapport, numéros, cachés).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import fsp from 'node:fs/promises';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { copyInto, moveContents, moveInto, renameItem } from 'technicals/file-tree';

let tmp = '';
let root = '';
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const read = (file: string) => fs.readFileSync(file, 'utf8');

beforeEach(() => {
  tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-file-tree-var-')));
  root = path.join(tmp, 'parent', 'artifacts');
});
afterEach(() => { vi.restoreAllMocks(); fs.rmSync(tmp, { recursive: true, force: true }); });

describe('copyInto', () => {
  it('rapporte les fichiers copiés, sous la racine', async () => {
    write(path.join(tmp, 'lot', 'a.md'), 'A');
    write(path.join(tmp, 'lot', 'sous', 'b.md'), 'B');

    const report = await copyInto(path.join(tmp, 'lot'), root);

    expect(report.copied.sort()).toEqual([path.join(root, 'lot', 'a.md'), path.join(root, 'lot', 'sous', 'b.md')]);
    expect(report.failed).toEqual([]);
  });

  it('un dossier hors-nom pris par un fichier : il prend le numéro 2', async () => {
    write(path.join(root, 'a'), 'FICHIER');
    write(path.join(tmp, 'a', 'x.md'), 'X');

    await copyInto(path.join(tmp, 'a'), root);

    expect(read(path.join(root, 'a-2', 'x.md'))).toBe('X');
    expect(read(path.join(root, 'a'))).toBe('FICHIER');
  });

  it('un dossier caché déposé : passé, rapporté, rien n’est créé', async () => {
    write(path.join(tmp, '.git', 'x'), 'X');

    const report = await copyInto(path.join(tmp, '.git'), root);

    expect(report.hidden).toEqual([path.join(tmp, '.git')]);
    expect(fs.existsSync(root)).toBe(false);
  });

  it('un dossier caché dans un dossier : passé, les autres arrivent', async () => {
    write(path.join(tmp, 'lot', '.cache', 'x'), 'X');
    write(path.join(tmp, 'lot', 'a.md'), 'A');

    const report = await copyInto(path.join(tmp, 'lot'), root);

    expect(report.hidden).toEqual([path.join(tmp, 'lot', '.cache')]);
    expect(fs.existsSync(path.join(root, 'lot', '.cache'))).toBe(false);
    expect(read(path.join(root, 'lot', 'a.md'))).toBe('A');
  });

  it('une source qui contient la racine : refusée, rien n’est copié', async () => {
    write(path.join(tmp, 'a.md'), 'A');

    const report = await copyInto(tmp, root);

    expect(report.failed).toHaveLength(1);
    expect(report.copied).toEqual([]);
    expect(fs.readdirSync(root)).toEqual([]);
  });

  it('une source qui est la racine : refusée', async () => {
    write(path.join(root, 'a.md'), 'A');

    const report = await copyInto(root, root);

    expect(report.failed).toHaveLength(1);
    expect(fs.readdirSync(root)).toEqual(['a.md']);
  });

  it('une source absente : échec rapporté', async () => {
    const report = await copyInto(path.join(tmp, 'absent'), root);

    expect(report.failed).toHaveLength(1);
  });
});

describe('moveContents', () => {
  it('une source absente : rien', async () => {
    const report = await moveContents(path.join(tmp, 'absent'), root);

    expect(report).toEqual({ copied: [], links: [], hidden: [], failed: [] });
  });

  it('les dossiers vidés sont retirés', async () => {
    write(path.join(tmp, 'from', 'a', 'b', 'x.md'), 'X');

    await moveContents(path.join(tmp, 'from'), root);

    expect(read(path.join(root, 'a', 'b', 'x.md'))).toBe('X');
    expect(fs.readdirSync(path.join(tmp, 'from'))).toEqual([]);
  });

  it('un dossier qui garde un caché n’est pas retiré', async () => {
    write(path.join(tmp, 'from', 'a', '.cache', 'x'), 'X');
    write(path.join(tmp, 'from', 'a', 'y.md'), 'Y');

    await moveContents(path.join(tmp, 'from'), root);

    expect(read(path.join(tmp, 'from', 'a', '.cache', 'x'))).toBe('X');
    expect(fs.existsSync(path.join(tmp, 'from', 'a', 'y.md'))).toBe(false);
  });

  it('mêmes octets sous un nom pris : rien dans copied, la source part', async () => {
    write(path.join(root, 'a.md'), 'A');
    write(path.join(tmp, 'from', 'a.md'), 'A');

    const report = await moveContents(path.join(tmp, 'from'), root);

    expect(report.copied).toEqual([]);
    expect(fs.readdirSync(root)).toEqual(['a.md']);
    expect(fs.existsSync(path.join(tmp, 'from', 'a.md'))).toBe(false);
  });

  it('les mêmes octets sous le numéro 2 : reconnus aussi', async () => {
    write(path.join(root, 'a.md'), 'AUTRE');
    write(path.join(root, 'a-2.md'), 'A');
    write(path.join(tmp, 'from', 'a.md'), 'A');

    await moveContents(path.join(tmp, 'from'), root);

    expect(fs.readdirSync(root).sort()).toEqual(['a-2.md', 'a.md']);
    expect(fs.existsSync(path.join(tmp, 'from', 'a.md'))).toBe(false);
  });
});

describe('copyInto, mêmes octets', () => {
  it('ajouter deux fois numérote', async () => {
    write(path.join(tmp, 'a.md'), 'A');

    await copyInto(path.join(tmp, 'a.md'), root);
    await copyInto(path.join(tmp, 'a.md'), root);

    expect(fs.readdirSync(root).sort()).toEqual(['a-2.md', 'a.md']);
  });
});

describe('copyInto, dossier numéroté', () => {
  it('un dossier du même nom : jamais mêlé, il prend le numéro 2', async () => {
    write(path.join(root, 'lot', 'a.md'), 'ANCIEN');
    write(path.join(tmp, 'lot', 'a.md'), 'NOUVEAU');

    await copyInto(path.join(tmp, 'lot'), root);

    expect(read(path.join(root, 'lot', 'a.md'))).toBe('ANCIEN');
    expect(read(path.join(root, 'lot-2', 'a.md'))).toBe('NOUVEAU');
  });
});

describe('moveInto', () => {
  it('un fichier arrive, la source est effacée', async () => {
    write(path.join(tmp, 'a.md'), 'A');

    const report = await moveInto(path.join(tmp, 'a.md'), root);

    expect(report.copied).toEqual([path.join(root, 'a.md')]);
    expect(fs.existsSync(path.join(tmp, 'a.md'))).toBe(false);
  });

  it('un dossier arrive sous un numéro libre, la source est retirée', async () => {
    write(path.join(root, 'lot', 'a.md'), 'ANCIEN');
    write(path.join(tmp, 'lot', 'sous', 'a.md'), 'NOUVEAU');

    await moveInto(path.join(tmp, 'lot'), root);

    expect(read(path.join(root, 'lot', 'a.md'))).toBe('ANCIEN');
    expect(read(path.join(root, 'lot-2', 'sous', 'a.md'))).toBe('NOUVEAU');
    expect(fs.existsSync(path.join(tmp, 'lot'))).toBe(false);
  });

  it('une racine dans la source : refusée, rien n’est effacé', async () => {
    write(path.join(tmp, 'lot', 'a.md'), 'A');

    const report = await moveInto(path.join(tmp, 'lot'), path.join(tmp, 'lot', 'sous'));

    expect(report.failed).toHaveLength(1);
    expect(read(path.join(tmp, 'lot', 'a.md'))).toBe('A');
  });

  it('une racine qui est la source : refusée', async () => {
    write(path.join(tmp, 'lot', 'a.md'), 'A');

    const report = await moveInto(path.join(tmp, 'lot'), path.join(tmp, 'lot'));

    expect(report.failed).toHaveLength(1);
    expect(read(path.join(tmp, 'lot', 'a.md'))).toBe('A');
  });

  it('un échec de copie : la source reste', async () => {
    write(path.join(tmp, 'lot', 'a.md'), 'A');
    write(root, 'fichier'); // la racine est un fichier

    const report = await moveInto(path.join(tmp, 'lot'), root);

    expect(report.failed).toHaveLength(1);
    expect(read(path.join(tmp, 'lot', 'a.md'))).toBe('A');
  });
});

describe('renameItem', () => {
  it('un fichier renommé : l’ancien nom a disparu', async () => {
    write(path.join(tmp, 'a.md'), 'A');

    expect(await renameItem(path.join(tmp, 'a.md'), 'b.md')).toBe('ok');

    expect(read(path.join(tmp, 'b.md'))).toBe('A');
    expect(fs.existsSync(path.join(tmp, 'a.md'))).toBe(false);
  });

  it('un nom pris : taken, rien ne change, pas de numéro', async () => {
    write(path.join(tmp, 'a.md'), 'A');
    write(path.join(tmp, 'b.md'), 'B');

    expect(await renameItem(path.join(tmp, 'a.md'), 'b.md')).toBe('taken');

    expect(read(path.join(tmp, 'a.md'))).toBe('A');
    expect(read(path.join(tmp, 'b.md'))).toBe('B');
    expect(fs.readdirSync(tmp).sort()).toEqual(['a.md', 'b.md']);
  });

  it('un nom pris par un dossier : taken', async () => {
    write(path.join(tmp, 'a.md'), 'A');
    fs.mkdirSync(path.join(tmp, 'b.md'));

    expect(await renameItem(path.join(tmp, 'a.md'), 'b.md')).toBe('taken');
    expect(read(path.join(tmp, 'a.md'))).toBe('A');
  });

  it('un dossier renommé avec son contenu', async () => {
    write(path.join(tmp, 'lot', 'sous', 'a.md'), 'A');

    expect(await renameItem(path.join(tmp, 'lot'), 'neuf')).toBe('ok');

    expect(read(path.join(tmp, 'neuf', 'sous', 'a.md'))).toBe('A');
    expect(fs.existsSync(path.join(tmp, 'lot'))).toBe(false);
  });

  it('un dossier avec un dossier caché : left, le caché reste dans la source', async () => {
    write(path.join(tmp, 'lot', 'a.md'), 'A');
    write(path.join(tmp, 'lot', '.cache', 'x'), 'X');

    expect(await renameItem(path.join(tmp, 'lot'), 'neuf')).toBe('left');

    expect(read(path.join(tmp, 'neuf', 'a.md'))).toBe('A');
    expect(read(path.join(tmp, 'lot', '.cache', 'x'))).toBe('X');
  });

  it('un dossier dont le nom est pris : taken, intact', async () => {
    write(path.join(tmp, 'lot', 'a.md'), 'A');
    write(path.join(tmp, 'neuf', 'b.md'), 'B');

    expect(await renameItem(path.join(tmp, 'lot'), 'neuf')).toBe('taken');

    expect(read(path.join(tmp, 'lot', 'a.md'))).toBe('A');
    expect(fs.readdirSync(path.join(tmp, 'neuf'))).toEqual(['b.md']);
  });

  it('un nom avec un séparateur : refusé', async () => {
    write(path.join(tmp, 'a.md'), 'A');

    await expect(renameItem(path.join(tmp, 'a.md'), '../b.md')).rejects.toThrow();
    expect(read(path.join(tmp, 'a.md'))).toBe('A');
  });

  it('un lien : refusé, sa cible est intacte', async () => {
    write(path.join(tmp, 'cible.md'), 'C');
    fs.symlinkSync(path.join(tmp, 'cible.md'), path.join(tmp, 'lien.md'));

    await expect(renameItem(path.join(tmp, 'lien.md'), 'b.md')).rejects.toThrow();
    expect(read(path.join(tmp, 'cible.md'))).toBe('C');
  });
});

describe('renameItem, la casse seule', () => {
  // Un disque insensible à la casse : créer `rapport.md` tant que `Rapport.md` existe lève EEXIST.
  const caseInsensitive = (src: string) => {
    const clash = (target: unknown) => String(target).toLowerCase() === src.toLowerCase() && fs.existsSync(src);
    const eexist = () => Object.assign(new Error('EEXIST'), { code: 'EEXIST' });
    const copyFile = fsp.copyFile, mkdir = fsp.mkdir;
    vi.spyOn(fsp, 'copyFile').mockImplementation(async (a, b, m) => { if (clash(b)) throw eexist(); return copyFile(a, b, m); });
    vi.spyOn(fsp, 'mkdir').mockImplementation(async (p, o) => { if (clash(p)) throw eexist(); return mkdir(p, o as never); });
  };

  it('un fichier : Rapport.md → rapport.md par un nom provisoire, ok', async () => {
    write(path.join(tmp, 'Rapport.md'), 'R');
    caseInsensitive(path.join(tmp, 'Rapport.md'));

    expect(await renameItem(path.join(tmp, 'Rapport.md'), 'rapport.md')).toBe('ok');

    expect(fs.readdirSync(tmp)).toEqual(['rapport.md']);
    expect(read(path.join(tmp, 'rapport.md'))).toBe('R');
  });

  it('un dossier avec son contenu', async () => {
    write(path.join(tmp, 'Lot', 'a.md'), 'A');
    caseInsensitive(path.join(tmp, 'Lot'));

    expect(await renameItem(path.join(tmp, 'Lot'), 'lot')).toBe('ok');

    expect(fs.readdirSync(tmp)).toEqual(['lot']);
    expect(read(path.join(tmp, 'lot', 'a.md'))).toBe('A');
  });

  it('le nom provisoire est pris : taken, rien ne change', async () => {
    write(path.join(tmp, 'Rapport.md'), 'R');
    write(path.join(tmp, 'rapport.md.renommage'), 'T');
    caseInsensitive(path.join(tmp, 'Rapport.md'));

    expect(await renameItem(path.join(tmp, 'Rapport.md'), 'rapport.md')).toBe('taken');

    expect(fs.readdirSync(tmp).sort()).toEqual(['Rapport.md', 'rapport.md.renommage']);
    expect(read(path.join(tmp, 'Rapport.md'))).toBe('R');
    expect(read(path.join(tmp, 'rapport.md.renommage'))).toBe('T');
  });

  // Sur un disque insensible à la casse (Windows, macOS), les deux noms sont un seul fichier.
  it.skipIf(process.platform === 'win32' || process.platform === 'darwin')('Linux, les deux noms existent vraiment : taken, rien d’écrasé', async () => {
    write(path.join(tmp, 'Rapport.md'), 'R');
    write(path.join(tmp, 'rapport.md'), 'r');

    expect(await renameItem(path.join(tmp, 'Rapport.md'), 'rapport.md')).toBe('taken');

    expect(read(path.join(tmp, 'Rapport.md'))).toBe('R');
    expect(read(path.join(tmp, 'rapport.md'))).toBe('r');
    expect(fs.readdirSync(tmp).sort()).toEqual(['Rapport.md', 'rapport.md']);
  });
});
