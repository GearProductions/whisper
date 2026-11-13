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
import { join } from 'node:path';
import type { VibeLang } from 'shared/bridge';

// Le dossier temporaire de la course `key` (runKey) sous les sorties `out` de son agent.
export const runTmpDir = (out: string, key: string): string => join(out, 'tmp', key);

// L'environnement d'une course : `base` (celui du robot, sinon process.env) recopié, plus
// CLAUDE_CODE_TMPDIR = tmp ; forked : plus CLAUDE_CODE_DISABLE_BACKGROUND_TASKS=1. `base` intact.
export function runEnv(base: NodeJS.ProcessEnv, o: { tmp: string; forked: boolean }): NodeJS.ProcessEnv {
  return { ...base, CLAUDE_CODE_TMPDIR: o.tmp, ...(o.forked && { CLAUDE_CODE_DISABLE_BACKGROUND_TASKS: '1' }) };
}

const SIZE: Record<VibeLang, { go: string; mo: string; locale: string }> = {
  fr: { go: 'Go', mo: 'Mo', locale: 'fr-FR' },
  en: { go: 'GB', mo: 'MB', locale: 'en-US' },
};

// La ligne en tête de la réponse d'une course arrêtée : son dossier temporaire a dépassé `max` octets
// (la borne dite en Go ou en Mo, lisible).
export function tmpLine(max: number, lang: VibeLang): string {
  const u = SIZE[lang];
  const big = max >= 1024 ** 3;
  const size = `${(max / 1024 ** (big ? 3 : 2)).toLocaleString(u.locale, { maximumFractionDigits: 1, useGrouping: false })} ${big ? u.go : u.mo}`;
  return lang === 'fr'
    ? `Le dossier temporaire de l’action a dépassé ${size} : l’action a été arrêtée.`
    : `The action’s temporary folder exceeded ${size}: the action was stopped.`;
}
