/** run-tmp — le dossier temporaire d'une course sur le disque (décision du 13
 *  novembre) : le créer vide à son lancement (openRunTmp : <sorties>/tmp/<clé>,
 *  runTmpDir ; celui qu'une course précédente de même clé aurait laissé, l'appli
 *  tuée en route, est vidé d'abord ; un échec ne bloque pas la course : null, elle
 *  part sans, comme vibeOutDir, I-29), le surveiller pendant qu'elle court
 *  (watchRunTmp : technicals/dir-size tous les RUN_TMP_EVERY_MS, onOver au
 *  premier dépassement de la borne passée, cfg.runTmpMax), l'effacer à sa fin
 *  quelle qu'elle soit (dropRunTmp : jamais d'erreur, un dossier absent compris).
 *  Ne connaît pas : l'état des courses, le SDK, la page, la réponse d'une course.
 *  Utilisé par : controllers/runs (startRun, finish, runOp, closeRuns). */
import fs from 'node:fs';
import { runTmpDir } from 'core/vibecoder';
import { watchDirSize } from 'technicals/dir-size';
import { vibeOutDir } from 'app/settings';

// Tous les combien le dossier temporaire d'une course est mesuré.
export const RUN_TMP_EVERY_MS = 5_000;

// Le dossier temporaire, vide, de la course `key` de l'agent ; null : pas pu le créer.
export function openRunTmp(agentId: string, key: string): string | null {
  const dir = runTmpDir(vibeOutDir(agentId), key);
  try {
    fs.rmSync(dir, { recursive: true, force: true });   // celui d'une course de même clé, l'appli tuée en route
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  } catch { return null; }
}

// Surveille `dir` : onOver au premier dépassement de `max` octets. Rend stop().
export function watchRunTmp(dir: string, max: number, onOver: () => void): () => void {
  return watchDirSize(dir, { max, everyMs: RUN_TMP_EVERY_MS }, () => onOver());
}

// Efface `dir` et son contenu, sans erreur.
export function dropRunTmp(dir: string): void {
  try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* rien à faire : une prochaine course de même clé le vide */ }
}
