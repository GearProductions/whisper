// Variantes de file-tree : ce que les invariants laissent de côté (rapport, numéros, cachés).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { copyInto, moveContents } from 'technicals/file-tree';

let tmp = '';
let root = '';
const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const read = (file: string) => fs.readFileSync(file, 'utf8');

beforeEach(() => {
  tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-file-tree-var-')));
  root = path.join(tmp, 'parent', 'artifacts');
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

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
