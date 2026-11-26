/** screen — les choix de l'écran VibeCoder qui ne sont pas des validations :
 *  la largeur de la colonne de la conversation (300 px au moins,
 *  60 % de l'écran au plus) ; les actions qui tournent (isRunning, runningRuns : en
 *  cours ou en attente d'autorisation, ni arrêtées ni finies).
 *  Plus de rangée d'actions d'étape (stepActions retirée, note 0.16.0-revue-essentielle) : le relecteur n'a plus qu'un
 *  geste, « Préparer la revue », au fil d'Ariane ; chaque lecture reste lançable par la CLI.
 *  Ne connaît pas : le DOM, React, le pont. Utilisé par : app/panel/vibecoder (vibe-coder, status-bar ;
 *  runs-view : isRunning) ; core/vibecoder (status-line : runningRuns). */
import type { VibeRun } from 'technicals/bridge';

export const CONV_MIN = 300;
const CONV_MAX = 0.6;

// La largeur de la colonne de la conversation, d'après celle voulue et celle de l'écran.
export function convWidth(wanted: number, total: number): number {
  return Math.round(Math.max(CONV_MIN, Math.min(wanted, total * CONV_MAX)));
}

// Une action qui tourne : en cours ou qui attend une autorisation.
export const isRunning = (r: VibeRun) => r.state === 'running' || r.state === 'asking';

// Les actions qui tournent, dans l'ordre reçu.
export function runningRuns(runs: VibeRun[]): VibeRun[] {
  return runs.filter(isRunning);
}
