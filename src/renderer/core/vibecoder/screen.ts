/** screen — les choix de l'écran VibeCoder qui ne sont pas des validations :
 *  la rangée des actions d'une étape (stepActions : les siennes, et à l'étape
 *  en cours celle mise en avant d'abord ; sans Vibe (son bouton est au fil d'Ariane), les masquées,
 *  celles que la vue montre elle-même ni celles qui citent) ; la largeur de la colonne de la conversation (300 px au moins,
 *  60 % de l'écran au plus) ; les actions qui tournent (isRunning, runningRuns : en
 *  cours ou en attente d'autorisation, ni arrêtées ni finies).
 *  L'écran de l'essentiel (note 0.16.0-ecran-essentiel) : stepActions ne rend plus rien au créateur — aucun bouton
 *  d'action dans une étape, pas même celle mise en avant : une action se demande à l'agent, qui a la CLI — ; au
 *  relecteur, la rangée d'avant, inchangée.
 *  La revue essentielle (note 0.16.0-revue-essentielle) : plus de rangée d'actions pour personne — stepActions est
 *  retirée (le relecteur n'a plus qu'un geste, « Préparer la revue », au fil d'Ariane ; chaque lecture reste lançable
 *  par la CLI) ; restent la largeur de la colonne et les actions qui tournent.
 *  Ne connaît pas : le DOM, React, le pont. Utilisé par : app/panel/vibecoder (vibe-coder, status-bar ;
 *  runs-view : isRunning) ; core/vibecoder (status-line : runningRuns). */
import type { VibeAction, VibeRun, VibeStep, VibeView } from 'technicals/bridge';

export const CONV_MIN = 300;
const CONV_MAX = 0.6;

// La largeur de la colonne de la conversation, d'après celle voulue et celle de l'écran.
export function convWidth(wanted: number, total: number): number {
  return Math.round(Math.max(CONV_MIN, Math.min(wanted, total * CONV_MAX)));
}

type StepAction = { a: VibeAction; tone: 'accent' | 'plain' };

// Une action qui cite ({{quote}}) part d'un bloc ou d'un cas, pas d'un bouton à elle.
const cites = (a: VibeAction) => a.kind === 'prefill' && !!a.text?.includes('{{quote}}');

// La rangée d'une étape, au relecteur seulement : ses actions ; à l'étape en cours, celle mise en avant d'abord. Jamais Vibe.
export function stepActions(view: VibeView, step: VibeStep, own: string[]): StepAction[] {
  if (view.flow !== 'review') return [];
  const tone = (a: VibeAction): StepAction['tone'] => (step.status === 'current' && a.primary ? 'accent' : 'plain');
  return view.actions
    .filter((a) => a.id !== 'vibe' && !a.hidden && !cites(a) && !own.includes(a.id) && (a.step === step.id || tone(a) !== 'plain'))
    .map((a) => ({ a, tone: tone(a) }))
    .sort((x, y) => +(x.tone === 'plain') - +(y.tone === 'plain'));
}

// Une action qui tourne : en cours ou qui attend une autorisation.
export const isRunning = (r: VibeRun) => r.state === 'running' || r.state === 'asking';

// Les actions qui tournent, dans l'ordre reçu.
export function runningRuns(runs: VibeRun[]): VibeRun[] {
  return runs.filter(isRunning);
}
