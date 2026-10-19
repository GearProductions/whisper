/** step-views — l'aiguillage des étapes : la vue de chaque étape du parcours,
 *  et ce qu'elle reçoit (StepProps : le relevé, l'étape, les libellés, les
 *  rappels de l'écran, le texte du champ de l'étape ; StepHead y prend les
 *  actions de l'étape et ce champ). Chaque étape a sa vue ; PR et Revue ont chacune une
 *  vue pour Créer et une pour Relire ; Note et Invariants servent aux deux
 *  (en lecture seule pour Relire).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : vibe-coder, panel-app (VibeActs). */
import type { ComponentType } from 'react';
import type { Answer, Answers, Strings } from 'core/vibecoder';
import type { VibeArgs, VibePatch, VibeProcessOp, VibeRunOp, VibeStep, VibeStepId, VibeView } from 'technicals/bridge';
import { CommitsView } from './commits-view';
import { DraftView } from './draft-view';
import { EcranView } from './ecran-view';
import { FormeView } from './forme-view';
import { InvariantsView } from './invariants-view';
import { ModulesView } from './modules-view';
import { NoteView } from './note-view';
import { PrPicker } from './pr-picker';
import { PrView } from './pr-view';
import { ReviewView } from './review-view';

// Les rappels de l'écran, que panel-app relie au pont.
export type VibeActs = {
  // Une action du relevé : envoyée (avec le texte de son champ, fieldOf), ou préparée ; true : partie.
  run(id: string, args?: VibeArgs): Promise<boolean>;
  prefill(id: string, quote: string): void;    // une action 'prefill' : {{quote}}, ce qu'on cite
  set(patch: VibePatch): void;
  mark(target: string, verdict: 'ok' | 'ko' | null): void;
  draft(op: { add?: { target: string; text: string }; edit?: { id: number; text: string }; remove?: number }): void; // Relire : le brouillon de revue
  open(id: string, line?: number): void;       // par son id : un fichier du relevé (à la ligne), un commit (c<rang>, son diff ;
                                               // c<rang>/<i>, son i-e fichier ; gh:c<rang>, sa page sur GitHub)
  openLink(url: string): void;
  refresh(): void;
  process(op: VibeProcessOp, index?: number): void;  // Processus : une commande par son rang, ou 'edit' (le fichier du projet)
  runOp(id: string, op: VibeRunOp): void;      // Actions : une course par l'id de son action (arrêter, garder, annuler, autoriser…)
};

export type StepProps = {
  view: VibeView; step: VibeStep; t: Strings; act: VibeActs; busy: boolean;
  answers: Answers;                            // les réponses en cours aux questions ouvertes (vibe-coder les tient)
  onAnswer(question: string, a: Answer): void;
  verdict: NonNullable<VibeArgs['verdict']>;   // Relire : le verdict choisi pour la revue (vibe-coder le tient)
  onVerdict(v: NonNullable<VibeArgs['verdict']>): void;
  text: string;                                // le champ de l'étape (vibe-coder le tient, par étape, tant que l'écran vit)
  setText(text: string): void;
};

// PR et Revue : une vue pour Créer, une autre pour Relire.
const byFlow = (create: ComponentType<StepProps>, review: ComponentType<StepProps>) => function ByFlow(p: StepProps) {
  const View = p.view.flow === 'review' ? review : create;
  return <View {...p} />;
};

export const STEP_VIEWS: Record<VibeStepId, ComponentType<StepProps>> = {
  note: NoteView, forme: FormeView, invariants: InvariantsView,
  modules: ModulesView,
  revue: byFlow(ReviewView, DraftView),
  pr: byFlow(PrView, PrPicker),
  commits: CommitsView,
  ecran: EcranView,
};
