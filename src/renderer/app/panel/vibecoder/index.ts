/** vibecoder — l'écran VibeCoder du panneau (un agent en mode IDE), la barre
 *  de sa colonne conversation, et les rappels qu'il attend ; le panneau Artefacts (ArtifactsView), un fichier d'un commit (CommitFile), l'affichage d'un code (CodeView), d'un diff (DiffView), du diff d'un fichier de module (ModuleDiffView), la note éditable (NoteEditor). */
export { ArtifactsView } from './artifacts-view';
export { CodeView } from './code-view';
export { CommitFile } from './commit-file';
export { DiffView } from './diff-view';
export { ModuleDiffView } from './module-diff-view';
export { NoteEditor } from './note-editor';
export { SkillsBar } from './skills-bar';
export type { VibeActs } from './step-views';
export { VibeCoder, type Side } from './vibe-coder';
