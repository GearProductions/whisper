/** vibecoder — l'écran VibeCoder du panneau (un agent en mode IDE), la barre
 *  de sa colonne conversation, et les rappels qu'il attend ; le panneau Artefacts (ArtifactsView), un fichier d'un commit (CommitFile), l'affichage d'un code (CodeView), d'un diff (DiffView), du diff d'un fichier de module (ModuleDiffView), la note éditable (NoteEditor), le « @ » du champ (useArtifactMention) ;
 *  pour le fil et la zone de saisie de la conversation : un texte Markdown rendu (MarkdownView), une icône (Icon), le micro et
 *  Envoyer d'un champ (PromptTools), le champ de saisie (PromptField) et le contexte de la dictée (Mic) ; la page des réglages (SettingsPage). */
export { useArtifactMention } from './artifact-mention';
export { AgentNotices } from './agent-notices';
export { ArtifactsView } from './artifacts-view';
export { CodeView } from './code-view';
export { CommitFile } from './commit-file';
export { DiffView } from './diff-view';
export { Icon } from './icons';
export { MarkdownView } from './markdown-view';
export { ModuleDiffView } from './module-diff-view';
export { NoAgent } from './no-agent';
export { NoteEditor } from './note-editor';
export { Palette } from './palette';
export { PromptField } from './prompt-field';
export { Mic, PromptTools, type MicApi } from './prompt-tools';
export { SettingsView as SettingsPage } from './settings-view';
export { SkillsBar } from './skills-bar';
export type { VibeActs } from './step-views';
export { VibeCoder, type Side } from './vibe-coder';
