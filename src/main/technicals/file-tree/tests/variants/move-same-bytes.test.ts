// Variants du déplacement repris après une coupure : un même nom et les mêmes
// octets, la source est effacée sans rien copier. Les invariants (rien ne se
// perd, rien ne s'écrase) : ../invariants/move-same-bytes.test.ts.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { moveContents } from 'technicals/file-tree';

const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const read = (file: string) => fs.readFileSync(file, 'utf8');
const names = (dir: string) => fs.readdirSync(dir, { recursive: true }).map(String).sort();

let tmp = '';
let from = '';    // ce qu'on déplace
let root = '';    // la racine d'arrivée

beforeEach(() => {
  tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-same-bytes-var-')));
  from = path.join(tmp, 'ancien');
  root = path.join(tmp, 'projet');
  fs.mkdirSync(from);
  fs.mkdirSync(root);
});
afterEach(() => fs.rmSync(tmp, { recursive: true, force: true }));

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
});
