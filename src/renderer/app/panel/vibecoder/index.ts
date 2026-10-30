/** vibecoder — l'écran VibeCoder du panneau (un agent en mode IDE), la barre
 *  de sa colonne conversation, et les rappels qu'il attend ; le panneau Artefacts (ArtifactsView), un fichier d'un commit (CommitFile), l'affichage d'un code (CodeView), d'un diff (DiffView), du diff d'un fichier de module (ModuleDiffView), la note éditable (NoteEditor), le « @ » du champ (useArtifactMention) ;
 *  pour le fil et la zone de saisie de la conversation : un texte Markdown rendu (MarkdownView), une icône (Icon). */
export { useArtifactMention } from './artifact-mention';
export { ArtifactsView } from './artifacts-view';
export { CodeView } from './code-view';
export { CommitFile } from './commit-file';
export { DiffView } from './diff-view';
export { Icon } from './icons';
export { MarkdownView } from './markdown-view';
export { ModuleDiffView } from './module-diff-view';
export { NoteEditor } from './note-editor';
export { SkillsBar } from './skills-bar';
export type { VibeActs } from './step-views';
export { VibeCoder, type Side } from './vibe-coder';
