// Invariant des fichiers de VibeCoder chez l'utilisateur (userData/vibecoder/).
// Protégé : si un test échoue, corriger le code.
//   Note 0.8.0, « Ce que ça ne doit pas faire » : remplacer un fichier de
//   userData/vibecoder/ que l'utilisateur a modifié. Et, de « Configuration » :
//   un fichier jamais modifié suit les mises à jour de l'appli ; un fichier
//   supprimé revient par défaut.
// Sur du réel : un dossier temporaire, un disque sur node:fs.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { syncDefaults, type DefaultFile, type Disk } from 'core/vibecoder';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'vibecoder-defauts-'));
afterAll(() => fs.rmSync(tmp, { recursive: true, force: true }));

// Le disque de l'appli : lire (null si absent), écrire (dossiers créés).
const disk: Disk = {
  read: (p) => { try { return fs.readFileSync(p, 'utf8'); } catch { return null; } },
  write: (p, content) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, content); },
};

// Un dossier neuf par cas.
let n = 0;
const freshDir = () => path.join(tmp, `cas-${n++}`);

// Un fichier livré, en trois versions successives de l'appli.
const FILE = 'plugin/skills/note/SKILL.md';
const v1: DefaultFile[] = [{ path: FILE, content: '---\nname: note\n---\nversion 1\n' }];
const v2: DefaultFile[] = [{ path: FILE, content: '---\nname: note\n---\nversion 2\n' }];
const v3: DefaultFile[] = [{ path: FILE, content: '---\nname: note\n---\nversion 3\n' }];
const read = (dir: string) => fs.readFileSync(path.join(dir, FILE), 'utf8');
const edit = (dir: string, content: string) => fs.writeFileSync(path.join(dir, FILE), content);

describe('fichiers par défaut de VibeCoder', () => {
  it('un fichier absent est écrit', () => {
    const dir = freshDir();
    syncDefaults(dir, v1, disk);
    // il existe désormais, tel que livré
    expect(read(dir)).toBe(v1[0].content);
  });

  it('un fichier supprimé revient par défaut', () => {
    const dir = freshDir();
    syncDefaults(dir, v1, disk);
    fs.rmSync(path.join(dir, FILE));
    syncDefaults(dir, v1, disk);
    // supprimé par l'utilisateur, il est réécrit tel que livré
    expect(read(dir)).toBe(v1[0].content);
  });

  it('un fichier jamais modifié suit le nouveau défaut', () => {
    const dir = freshDir();
    syncDefaults(dir, v1, disk);
    syncDefaults(dir, v2, disk);
    // inchangé depuis que nous l'avons écrit : il prend la nouvelle version
    expect(read(dir)).toBe(v2[0].content);
  });

  it('un fichier modifié par l’utilisateur n’est pas remplacé quand le défaut change', () => {
    const dir = freshDir();
    syncDefaults(dir, v1, disk);
    edit(dir, 'ma version\n');
    syncDefaults(dir, v2, disk);
    // sa retouche reste, la nouvelle version ne passe pas
    expect(read(dir)).toBe('ma version\n');
  });

  it('un fichier modifié par l’utilisateur n’est pas remplacé non plus aux versions suivantes', () => {
    const dir = freshDir();
    syncDefaults(dir, v1, disk);
    edit(dir, 'ma version\n');
    syncDefaults(dir, v2, disk);
    syncDefaults(dir, v3, disk);
    // garder sa retouche une fois ne la fait pas passer pour la nôtre ensuite
    expect(read(dir)).toBe('ma version\n');
  });

  it('un fichier que nous n’avons jamais écrit (aucune entrée au manifeste) n’est pas remplacé', () => {
    const dir = freshDir();
    disk.write(path.join(dir, FILE), 'écrit à la main\n');
    syncDefaults(dir, v1, disk);
    // déjà là sans que nous l'ayons écrit : gardé
    expect(read(dir)).toBe('écrit à la main\n');
  });

  it('manifeste illisible : aucun fichier existant n’est remplacé', () => {
    const dir = freshDir();
    syncDefaults(dir, v1, disk);
    fs.writeFileSync(path.join(dir, '.defaults.json'), '{ pas du json');
    syncDefaults(dir, v2, disk);
    // sans manifeste, rien ne dit que le fichier est encore le nôtre : gardé
    expect(read(dir)).toBe(v1[0].content);
  });
});
