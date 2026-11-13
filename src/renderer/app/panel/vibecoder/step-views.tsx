/** step-views — l'aiguillage des étapes : la vue de chaque étape du parcours,
 *  et ce qu'elle reçoit (StepProps : le relevé, l'étape, les libellés, les
 *  rappels de l'écran, le fichier de module
 *  suivi, les modifications gardées des fichiers suivis, les pièces jointes du questionnaire,
 *  la ligne de la note où aller et le rappel qui y mène ; StepHead y prend les actions de l'étape ;
 *  plus de champ d'étape : text, setText et ses pièces retirés, note 0.15.0-ecran-epure). Un seul
 *  parcours, une vue par étape, pour les deux rôles (view.flow, décidé par
 *  l'appli) : chaque vue montre en lecture seule ce que le relecteur ne fait
 *  pas (Revue : Relire à l'écran ; Modules : les commits ; PR : le brouillon).
 *  Ne connaît pas : le pont (rappels passés). Utilisé par : vibe-coder, panel-app (VibeActs). */
import type { ComponentType, Dispatch, SetStateAction } from 'react';
import type { Piece } from 'core/conversation';
import type { Answer, Answers, Strings } from 'core/vibecoder';
import type { Attached, VibeArgs, VibeCode, VibePatch, VibeProcessOp, VibeRunOp, VibeStep, VibeStepId, VibeView } from 'technicals/bridge';
import type { Drafts } from './file-draft';
import { FormeView } from './forme-view';
import { InvariantsView } from './invariants-view';
import { ModulesView } from './modules-view';
import { NoteView } from './note-view';
import { PrView } from './pr-view';
import { ReviewView } from './review-view';
import type { StepPieces } from './step-parts';

// Les rappels de l'écran, que panel-app relie au pont.
export type VibeActs = {
  // Une action du relevé : envoyée (avec le texte de son champ, fieldOf), ou préparée ; true : partie.
  run(id: string, args?: VibeArgs): Promise<boolean>;
  prefill(id: string, quote: string, block?: boolean): void; // une action 'prefill' : {{quote}}, ce qu'on cite (block : en entier, F-98)
  follow(id: string | null): void;             // suivre un fichier du relevé par son id : module (m<rang>/<i>), note (n), test (t<i>), en relecteur fichier d'un commit (c<rang>/<i>) ; null : plus aucun
  save(id: string, text: string): Promise<boolean>; // Enregistrer le fichier suivi ; true : enregistré (refusé : le motif en barre d'état)
  drop(files: File[], folder?: string): void;  // Artefacts : des fichiers déposés sur l'arborescence, copiés dans le dossier visé (un id d<i> du relevé ; absent : la racine ; refusé : le motif en barre d'état)
  set(patch: VibePatch): void;
  mark(target: string, verdict: 'ok' | 'ko' | null): void;
  draft(op: { add?: { target: string; text: string }; edit?: { id: number; text: string }; remove?: number }): void; // relecteur : le brouillon de revue
  open(id: string, line?: number): void;       // par son id : un fichier du relevé (à la ligne), un commit (c<rang>, son diff ;
                                               // gh:c<rang>, sa page sur GitHub)
  openLink(url: string): void;
  refresh(): void;
  attach(into: (what: Attached) => void): void; // le trombone d'un champ : le choix du dialogue va à `into` (le champ qui l'a ouvert)
  pieces(files: File[]): Promise<Piece[]>;       // des File (collés, déposés) en pièces jointes, comme pour la conversation
  process(op: VibeProcessOp, index?: number): void;  // Processus : une commande par son rang, ou 'edit' (le fichier du projet)
  runOp(id: string, op: VibeRunOp): void;      // Actions : une course par l'id de son action (arrêter, garder, annuler, autoriser…)
};

export type StepProps = StepPieces & {         // les pièces du champ de l'étape (vibe-coder les tient, par champ)
  questions: StepPieces;                       // celles du questionnaire de la note, qui partent avec « Envoyer les réponses »
  view: VibeView; step: VibeStep; t: Strings; act: VibeActs; busy: boolean;
  answers: Answers;                            // les réponses en cours aux questions ouvertes (vibe-coder les tient)
  onAnswer(question: string, a: Answer): void;
  verdict: NonNullable<VibeArgs['verdict']>;   // relecteur : le verdict choisi pour la revue (vibe-coder le tient)
  onVerdict(v: NonNullable<VibeArgs['verdict']>): void;
  text: string;                                // le champ de l'étape (vibe-coder le tient, par étape, tant que l'écran vit)
  setText(text: string): void;
  code: VibeCode | null;                       // le fichier suivi (act.follow : module, note, test), tel que le principal le pousse
  drafts: readonly [Drafts, Dispatch<SetStateAction<Drafts>>]; // les modifications gardées, par chemin (vibe-coder les tient, par agent : useFileDraft)
  noteFocus?: string | null;                   // la ligne de « Ce que ça ne doit pas faire » où aller (son texte, mustNot), à l'étape Note ; null : aucune
  goToNote?(line: string | null): void;        // passer à l'étape Note sur cette ligne (Invariants : un cas) ; null : la ligne atteinte, oubliée (NoteView)
};

export const STEP_VIEWS: Record<VibeStepId, ComponentType<StepProps>> = {
  note: NoteView, forme: FormeView, invariants: InvariantsView,
  modules: ModulesView,
  revue: ReviewView,
  pr: PrView,
};
