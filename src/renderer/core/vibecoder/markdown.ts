/** markdown — un texte Markdown (note, sortie d'un skill, réponse) en blocs :
 *  titres, paragraphes, listes (cases à cocher), citations, code, tableaux,
 *  filets ; en ligne : texte, code, gras, italique, liens http(s). Jamais de
 *  HTML : une balise reste du texte, un lien qui n'est pas en http(s) aussi
 *  (I-21).
 *  Ne connaît pas : le DOM, React. Utilisé par : app/panel/vibecoder (markdown-view). */

export type Inline = { kind: 'text' | 'code' | 'strong' | 'em'; text: string } | { kind: 'link'; text: string; href: string };
export type ListItem = { inline: Inline[]; checked: boolean | null; line: number; children: Block[] };
// line : la ligne du texte (depuis 0) où commence le bloc.
export type Block =
  | { kind: 'heading'; level: number; inline: Inline[]; line: number }
  | { kind: 'paragraph'; inline: Inline[]; line: number }
  | { kind: 'list'; ordered: boolean; items: ListItem[]; line: number }
  | { kind: 'quote'; blocks: Block[]; line: number }
  | { kind: 'code'; lang: string; text: string; line: number }
  | { kind: 'table'; head: Inline[][]; rows: Inline[][][]; line: number }
  | { kind: 'rule'; line: number };

// Squelette : chaque fonction s'écrit dans le commit de son module.
const todo = (..._args: unknown[]): never => { throw new Error('à implémenter'); };

export function parseMarkdown(md: string): Block[] { return todo(md); }
