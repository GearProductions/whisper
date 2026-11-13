/** dir-size — la taille d'un dossier sur le disque, et sa surveillance
 *  (décision du 13 novembre : la borne du dossier temporaire d'une course).
 *  dirSize : la somme des tailles de ses fichiers, sous-dossiers compris, sans
 *  suivre les liens ; un dossier absent, ou un fichier disparu en route : 0 pour
 *  lui, jamais d'erreur. watchDirSize : le mesure tous les `everyMs` ; au-delà de
 *  `max` octets, onOver une seule fois et la surveillance s'arrête ; rend de quoi
 *  l'arrêter (sans effet après coup). Une mesure à la fois, jamais deux en
 *  parallèle.
 *  Ne connaît pas : les courses, les réglages, Electron.
 *  Utilisé par : app/controllers (run-tmp). */

import { lstat, readdir } from 'node:fs/promises';
import path from 'node:path';

// La taille de `dir` en octets (0 : absent). Les liens ne sont ni suivis ni comptés ;
// ce qui disparaît pendant la lecture vaut 0.
export async function dirSize(dir: string): Promise<number> {
  const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
  const sizes = await Promise.all(
    entries.map(async (e) => {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) return dirSize(p);
      if (!e.isFile()) return 0;
      return (await lstat(p).catch(() => null))?.size ?? 0;
    }),
  );
  return sizes.reduce((a, b) => a + b, 0);
}

// Surveille `dir` : onOver(octets mesurés) au premier dépassement de `max`, puis plus rien. Rend stop().
// Le prochain tour n'est armé qu'une fois la mesure finie : jamais deux mesures en parallèle.
export function watchDirSize(dir: string, o: { max: number; everyMs: number }, onOver: (bytes: number) => void): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;
  const tick = async () => {
    const bytes = await dirSize(dir);
    if (stopped) return;
    if (bytes > o.max) {
      stopped = true;
      onOver(bytes);
      return;
    }
    timer = setTimeout(tick, o.everyMs);
  };
  timer = setTimeout(tick, o.everyMs);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
