// Invariants de l'écriture d'un contenu déposé (note 0.15.0,
// docs/tickets/feat/0.15.0-socket-interface.md, « Ce que ça ne doit pas
// faire ») : copier un fichier déposé autrement qu'aujourd'hui — jamais
// écraser, un lien jamais suivi (technicals/file-tree). Les chemins déposés
// (copyInto) sont gardés par file-tree.test.ts (note 0.13.0) ; ce ticket
// ajoute un dépôt par contenu (add-artifact : un nom et des octets, pour un
// client sans accès au disque), écrit par writeInto : il suit les mêmes
// règles, y compris ne rien écrire ailleurs que sous la racine.
// Protégé : si un test échoue, corriger le code.
//
// Sur le vrai disque : dossiers temporaires, vrais liens symboliques. Aucun fs
// simulé.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import { writeInto } from 'technicals/file-tree';

const write = (file: string, content: string) => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, content); };
const read = (file: string) => fs.readFileSync(file, 'utf8');
// Liens de fichier : sans équivalent simple sous Windows.
const posix = it.skipIf(process.platform === 'win32');

let root = '';    // la racine d'arrivée (le dossier des artefacts)
let out = '';     // un dossier hors de la racine, à ne pas toucher
// Les contenus des fichiers directement sous un dossier.
const contents = (dir: string) => fs.readdirSync(dir).map((n) => path.join(dir, n)).filter((p) => fs.lstatSync(p).isFile()).map(read);
const bytes = (text: string) => Buffer.from(text);

beforeEach(() => {
  const tmp = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-write-into-')));
  root = path.join(tmp, 'artefacts');
  out = path.join(tmp, 'dehors');
  fs.mkdirSync(root);
  write(path.join(out, 'garde.md'), 'à garder\n');
});

describe('writeInto : jamais d’écrasement, aucun lien suivi', () => {
  it('témoin : un nom libre, le contenu est écrit sous la racine', async () => {
    await writeInto(root, 'rapport.md', bytes('nouveau\n'));

    // le contenu est arrivé sous la racine
    expect(contents(root)).toContain('nouveau\n');
  });

  it('un nom pris par un fichier : l’ancien reste intact, le nouveau arrive à côté', async () => {
    write(path.join(root, 'rapport.md'), 'ancien\n');

    await writeInto(root, 'rapport.md', bytes('nouveau\n'));

    // l'ancien fichier n'a pas changé
    expect(read(path.join(root, 'rapport.md'))).toBe('ancien\n');
    // le nouveau contenu est arrivé sous un autre nom
    expect(contents(root)).toContain('nouveau\n');
  });

  // Écrire par ce nom écrirait dans le fichier visé, hors de la racine.
  posix('un nom pris par un lien vers un fichier hors de la racine : le fichier visé reste intact', async () => {
    fs.symlinkSync(path.join(out, 'garde.md'), path.join(root, 'rapport.md'));

    await writeInto(root, 'rapport.md', bytes('nouveau\n'));

    // le fichier visé par le lien n'a pas changé
    expect(read(path.join(out, 'garde.md'))).toBe('à garder\n');
  });

  // Une racine qui est un lien mènerait l'écriture dans sa cible.
  posix('une racine qui est un lien : rien n’est écrit dans sa cible', async () => {
    const linked = path.join(path.dirname(root), 'lien');
    fs.symlinkSync(out, linked);

    const report = await writeInto(linked, 'rapport.md', bytes('nouveau\n'));

    // la cible du lien n'a rien reçu
    expect(fs.readdirSync(out)).toEqual(['garde.md']);
    // l'échec est rapporté
    expect(report.failed).not.toEqual([]);
  });

  // Un nom qui remonte hors de la racine.
  it('un nom en « .. » : rien n’est écrit hors de la racine', async () => {
    await writeInto(root, path.join('..', 'dehors', 'garde.md'), bytes('nouveau\n'));

    // le fichier hors de la racine n'a pas changé
    expect(read(path.join(out, 'garde.md'))).toBe('à garder\n');
    // rien n'est arrivé à côté de lui
    expect(fs.readdirSync(out)).toEqual(['garde.md']);
  });
});
