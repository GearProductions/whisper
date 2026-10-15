/** step-views — l'aiguillage des étapes : la vue de chaque étape du parcours,
 *  et ce qu'elle reçoit (StepProps : le relevé, l'étape, les libellés, les
 *  rappels de l'écran). Toutes prennent pour l'instant la vue générique
 *  (step-view) ; une vue dédiée (note, forme, invariants…) remplace son entrée.
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : vibe-coder, panel-app (VibeActs). */
import type { ComponentType } from 'react';
import type { Strings } from 'core/vibecoder';
import type { VibeArgs, VibePatch, VibeStep, VibeStepId, VibeView } from 'technicals/bridge';
import { StepView } from './step-view';

// Les rappels de l'écran, que panel-app relie au pont.
export type VibeActs = {
  run(id: string, args?: VibeArgs): void;      // une action du relevé : envoyée (le champ si elle en a besoin), ou préparée
  prefill(id: string, quote: string): void;    // une action 'prefill' : {{quote}}, ce qu'on cite
  set(patch: VibePatch): void;
  mark(target: string, verdict: 'ok' | 'ko' | null): void;
  draft(op: { add?: { target: string; text: string }; remove?: number }): void;
  open(id: string): void;                      // un fichier du relevé, par son id
  openLink(url: string): void;
  refresh(): void;
};

export type StepProps = { view: VibeView; step: VibeStep; t: Strings; act: VibeActs; busy: boolean };

export const STEP_VIEWS: Record<VibeStepId, ComponentType<StepProps>> = {
  note: StepView, forme: StepView, invariants: StepView, modules: StepView, revue: StepView, pr: StepView,
  commits: StepView, ecran: StepView,
};
