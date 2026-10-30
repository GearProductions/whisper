// Invariant du chemin d'un dépôt (note 0.13.0,
// docs/tickets/feat/0.13.0-ameliorer-artefacts.md, « Ce que ça ne doit pas
// faire » : « Lire un fichier désigné par un chemin venu de la page (I-37) » ;
// « Écrire ailleurs que sous artifacts/ […] un nom en `..` compris » ; « Suivre
// un lien »). Le pont lit le chemin dans le File (tests/invariants/vibe-drop.test.ts) ;
// le principal revérifie ce qu'il reçoit : ni relatif, ni `..`, ni NUL, ni racine.
// Protégé : si un test échoue, corriger le code.
//
// droppedPaths est pure : appelée telle quelle.
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { droppedPaths } from 'core/vibecoder';

const top = path.resolve(path.sep);
const abs = (...parts: string[]) => path.join(top, ...parts);
const SECRET = abs('etc', 'secret');

describe('droppedPaths : ce que le principal accepte du pont', () => {
  it('témoin : un chemin absolu passe, tel quel', () => {
    const { paths } = droppedPaths([SECRET]);

    // il est retenu
    expect(paths).toEqual([SECRET]);
  });

  it('un chemin relatif : refusé', () => {
    const { paths } = droppedPaths(['etc/secret']);

    // rien n'est retenu
    expect(paths).toEqual([]);
  });

  it('un chemin relatif qui remonte : refusé', () => {
    const { paths } = droppedPaths(['../../etc/secret']);

    // rien n'est retenu
    expect(paths).toEqual([]);
  });

  // path.resolve l'effacerait, et le chemin aurait l'air sain.
  it('un segment `..` au milieu d’un chemin absolu : refusé', () => {
    const { paths } = droppedPaths([`${top}tmp${path.sep}..${path.sep}etc${path.sep}secret`]);

    // rien n'est retenu
    expect(paths).toEqual([]);
  });

  // Son nom de base serait `..` : la copie écrirait au-dessus de artifacts/.
  it('un chemin qui finit par `..` : refusé', () => {
    const { paths } = droppedPaths([`${top}tmp${path.sep}sous${path.sep}..`]);

    // rien n'est retenu
    expect(paths).toEqual([]);
  });

  it('un chemin qui finit par `../` : refusé', () => {
    const { paths } = droppedPaths([`${top}tmp${path.sep}sous${path.sep}..${path.sep}`]);

    // rien n'est retenu
    expect(paths).toEqual([]);
  });

  // `..` dans un nom n'est pas un segment : ces fichiers-là sont bien ceux de l'utilisateur.
  it('un nom qui contient `..` sans en être un (..rapport.md) : accepté', () => {
    const file = abs('tmp', '..rapport.md');

    const { paths } = droppedPaths([file]);

    // il est retenu
    expect(paths).toEqual([file]);
  });

  it('un NUL dans le chemin : refusé', () => {
    const { paths } = droppedPaths([`${SECRET}\0.md`]);

    // rien n'est retenu
    expect(paths).toEqual([]);
  });

  // Tout le disque : son nom de base est vide.
  it('la racine : refusée', () => {
    const { paths } = droppedPaths([top]);

    // rien n'est retenu
    expect(paths).toEqual([]);
  });

  // lstat sur `lien/` suit le lien : les / de fin ne doivent pas arriver jusqu'au disque.
  it('un / de fin : retiré', () => {
    const { paths } = droppedPaths([`${SECRET}${path.sep}`]);

    // le chemin retenu n'a plus son / de fin
    expect(paths).toEqual([SECRET]);
  });

  // Un File construit par la page rend un chemin vide.
  it('un chemin vide : compté comme sans chemin, rien de retenu', () => {
    const { paths, noPath } = droppedPaths(['']);

    // rien n'est retenu
    expect(paths).toEqual([]);
    // il est compté
    expect(noPath).toBeGreaterThan(0);
  });

  it('autre chose qu’une chaîne dans la liste : compté comme sans chemin, rien de retenu', () => {
    const { paths, noPath } = droppedPaths([{ path: SECRET }]);

    // rien n'est retenu
    expect(paths).toEqual([]);
    // il est compté
    expect(noPath).toBeGreaterThan(0);
  });

  it('un mauvais à côté d’un bon : seul le bon passe', () => {
    const { paths } = droppedPaths(['etc/secret', SECRET]);

    // le relatif n'est pas retenu
    expect(paths).toEqual([SECRET]);
  });

  it('autre chose qu’une liste (une chaîne seule) : rien de retenu', () => {
    const { paths } = droppedPaths(SECRET);

    // rien n'est retenu
    expect(paths).toEqual([]);
  });
});
