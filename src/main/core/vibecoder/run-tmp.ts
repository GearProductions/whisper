/** run-tmp — le dossier temporaire d'une course (décision du 13 novembre) : où
 *  il est (runTmpDir : <sorties>/tmp/<clé de la course>, une fuite dit de quelle
 *  course elle vient), l'environnement que la course reçoit à son lancement
 *  (runEnv : celui du robot, sinon celui du processus, recopié — le SDK ne
 *  fusionne pas —, plus CLAUDE_CODE_TMPDIR ; un fork y ajoute
 *  CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1), et la ligne en tête de la réponse
 *  d'une course arrêtée parce que ce dossier a dépassé sa borne (tmpLine).
 *  Pur. Ne connaît pas : le disque (ni création, ni mesure, ni effacement), le
 *  SDK, la borne configurée (passée).
 *  Utilisé par : app/controllers (runs, run-tmp). */
import type { VibeLang } from 'shared/bridge';

// Le dossier temporaire de la course `key` (runKey) sous les sorties `out` de son agent.
export function runTmpDir(out: string, key: string): string {
  void out; void key;
  throw new Error('not implemented');
}

// L'environnement d'une course : `base` (celui du robot, sinon process.env) recopié, plus
// CLAUDE_CODE_TMPDIR = tmp ; forked : plus CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1. `base` intact.
export function runEnv(base: NodeJS.ProcessEnv, o: { tmp: string; forked: boolean }): NodeJS.ProcessEnv {
  void base; void o;
  throw new Error('not implemented');
}

// La ligne en tête de la réponse d'une course arrêtée : son dossier temporaire a dépassé `max` octets
// (la borne dite en Go ou en Mo, lisible).
export function tmpLine(max: number, lang: VibeLang): string {
  void max; void lang;
  throw new Error('not implemented');
}
