/** screen — les choix de l'écran VibeCoder qui ne sont pas des validations :
 *  la rangée des actions d'une étape (stepActions : les siennes, et à l'étape
 *  en cours Vibe en Créer puis celle mise en avant ; sans les masquées, celles
 *  que la vue montre elle-même ni celles qui citent) ; le modèle d'une
 *  action en sous-contexte (le conseillé par défaut ; un autre
 *  seulement s'il est des siens, et envoyé seulement s'il diffère du
 *  conseillé) ; la largeur de la colonne de la conversation (300 px au moins,
 *  60 % de l'écran au plus) ; les actions qui tournent (runningRuns : en
 *  cours ou en attente d'autorisation, ni arrêtées ni finies).
 *  Ne connaît pas : le DOM, React, le pont. Utilisé par : app/panel/vibecoder (vibe-coder, model-pick, step-parts, status-bar). */
import type { VibeAction, VibeRun, VibeStep, VibeView } from 'technicals/bridge';

export type ModelPicks = Record<string, string>;   // par id d'action, le modèle choisi

// Le modèle affiché pour une action : celui choisi s'il est des siens, sinon le conseillé ('' : celui de l'agent).
export function chosenModel(a: VibeAction, picks: ModelPicks): string {
  const m = Object.hasOwn(picks, a.id) ? picks[a.id] : '';
  return a.models.includes(m) ? m : a.model ?? '';
}

// args.model d'une action : le modèle choisi, seulement s'il n'est pas le conseillé.
export function modelArg(a: VibeAction, picks: ModelPicks): string | undefined {
  const m = chosenModel(a, picks);
  return m && m !== a.model ? m : undefined;
}

export const CONV_MIN = 300;
const CONV_MAX = 0.6;

// La largeur de la colonne de la conversation, d'après celle voulue et celle de l'écran.
export function convWidth(wanted: number, total: number): number {
  return Math.round(Math.max(CONV_MIN, Math.min(wanted, total * CONV_MAX)));
}

type StepAction = { a: VibeAction; tone: 'vibe' | 'accent' | 'plain' };

// Une action qui cite ({{quote}}) part d'un bloc ou d'un cas, pas d'un bouton à elle.
const cites = (a: VibeAction) => a.kind === 'prefill' && !!a.text?.includes('{{quote}}');

// La rangée d'une étape : ses actions ; à l'étape en cours, Vibe (Créer) d'abord, puis celle mise en avant.
export function stepActions(view: VibeView, step: VibeStep, own: string[]): StepAction[] {
  const current = step.status === 'current';
  const tone = (a: VibeAction): StepAction['tone'] =>
    !current ? 'plain' : a.id === 'vibe' && view.flow === 'create' ? 'vibe' : a.primary ? 'accent' : 'plain';
  const rank = { vibe: 0, accent: 1, plain: 2 };
  return view.actions
    .filter((a) => !a.hidden && !cites(a) && !own.includes(a.id) && (a.step === step.id || tone(a) !== 'plain'))
    .map((a) => ({ a, tone: tone(a) }))
    .sort((x, y) => rank[x.tone] - rank[y.tone]);
}

// Les actions qui tournent (en cours ou qui attendent une autorisation), dans l'ordre reçu.
export function runningRuns(runs: VibeRun[]): VibeRun[] {
  return runs.filter((r) => r.state === 'running' || r.state === 'asking');
}
