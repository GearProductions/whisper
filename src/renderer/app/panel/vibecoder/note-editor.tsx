/** note-editor — la note éditable façon Obsidian (CodeMirror 6, liveMarkdown) :
 *  ce qui est tapé se met en forme au fil de la frappe ; 💬 par bloc
 *  (blockQuotes, lineButtons), liseré vert des changements de l'agent
 *  (lineMarks), pastilles des marques de « Ce que ça ne doit pas faire »
 *  (lineBadges) ; Ctrl+S → onSave ; locked : lecture seule, le motif en titre.
 *  En texte, jamais en HTML (I-40).
 *  Ne connaît pas : le pont, le relevé.
 *  Utilisé par : note-view. */
import type { ReactNode } from 'react';

export function NoteEditor(_props: {
  text: string;
  locked: string | null;
  changed?: Set<number>;
  tags: { line: number; text: string; title: string; cls: string }[];
  onChange(text: string): void;
  onSave(): void;
  onQuote?(text: string): void;
  onOpenLink(url: string): void;
}): ReactNode {
  throw new Error('not implemented');
}
