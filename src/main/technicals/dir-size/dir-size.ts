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

// La taille de `dir` en octets (0 : absent).
export async function dirSize(dir: string): Promise<number> {
  void dir;
  throw new Error('not implemented');
}

// Surveille `dir` : onOver(octets mesurés) au premier dépassement de `max`, puis plus rien. Rend stop().
export function watchDirSize(dir: string, o: { max: number; everyMs: number }, onOver: (bytes: number) => void): () => void {
  void dir; void o; void onOver;
  throw new Error('not implemented');
}
