/** screen — les choix de l'écran VibeCoder qui ne sont pas des validations :
 *  les actions de l'écran Vibe (note sans note, vibe, base, release — sans
 *  les masquées ni les absentes du relevé) ; le modèle d'une action en sous-contexte (le conseillé par défaut ; un autre
 *  seulement s'il est des siens, et envoyé seulement s'il diffère du
 *  conseillé) ; la largeur de la colonne de la conversation (300 px au moins,
 *  60 % de l'écran au plus).
 *  Ne connaît pas : le DOM, React, le pont. Utilisé par : app/panel/vibecoder (vibe-coder, model-pick, vibe-screen). */
import type { VibeAction, VibeView } from 'technicals/bridge';

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

// Les ids des actions de l'écran Vibe, dans l'ordre ; note seulement sans note.
export function vibeScreenActions(view: VibeView): string[] {
  const ids = view.note ? ['vibe', 'base', 'release'] : ['note', 'vibe', 'base', 'release'];
  return ids.filter((id) => view.actions.some((a) => a.id === id && !a.hidden));
}
