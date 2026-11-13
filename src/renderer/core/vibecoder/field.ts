/** field — les champs de VibeCoder : ce qu'il écrit dans le champ de la
 *  conversation (une action « préparer » : son texte, {{quote}} remplacé par
 *  ce qu'on cite, sur une ligne de 300 caractères au plus — un bloc de code,
 *  lui, en entier, ses lignes gardées, et à la suite d'un texte sans
 *  {{quote}} — ajouté à la ligne) ; les lignes entières d'un code que couvre
 *  une sélection (le bloc cité) ; les actions qui emportent le champ de la
 *  conversation et ses pièces jointes, cliquées à l'écran (takesConversation :
 *  Rédiger la note, Nouvelle demande ; jamais Poser la forme ni Écrire les
 *  invariants). Plus de champ d'étape (note 0.15.0-ecran-epure).
 *  Ne connaît pas : le DOM, React, le pont.
 *  Utilisé par : app/panel/panel-app, app/panel/vibecoder (vibe-coder,
 *  code-view). */
import type { VibeAction } from 'technicals/bridge';
import { excerpt } from './note';

const QUOTE_MAX = 300;

/** Le champ, suivi du texte d'une action « préparer » (à la ligne s'il n'est pas vide). block : la
 *  citation est un bloc de code, gardée entière (F-98), et mise à la suite d'un texte sans {{quote}}
 *  (Retour → fixup). */
export function withPrefill(field: string, template: string, quote: string, block = false): string {
  const cited = block ? quote : excerpt(quote, QUOTE_MAX);
  const text = block && !template.includes('{{quote}}')
    ? `${template.trimEnd()}\n${quote}`
    : template.replaceAll('{{quote}}', () => cited);
  return field.trim() ? `${field.trimEnd()}\n${text}` : text;
}

/** Les lignes entières de `code` que couvre la sélection [start, end) (positions de caractères,
 *  comme selectionStart/End) ; start = end : la ligne du clic. Une sélection qui finit au début
 *  d'une ligne ne la prend pas. */
export function codeBlock(code: string, start: number, end: number): string {
  const a = Math.min(start, end);
  let b = Math.max(start, end);
  if (b > a && code[b - 1] === '\n') b--;
  const from = a > 0 ? code.lastIndexOf('\n', a - 1) + 1 : 0;
  const to = code.indexOf('\n', b);
  return code.slice(from, to < 0 ? code.length : to);
}

// Les actions dont la vue donne elle-même le texte (Appliquer : la remarque, ou rien pour toutes).
const VIEW_TEXT = ['apply'];

/** L'action, cliquée à l'écran, emporte le champ de la conversation et ses pièces jointes : un message
 *  (send) qui exige un texte (needs 'text') ; jamais une action qui le prend seulement s'il y en a un
 *  (usesText : Poser la forme, Écrire les invariants partent sans texte), ni celle dont la vue donne le texte (apply). */
export function takesConversation(a: Pick<VibeAction, 'id' | 'kind' | 'needs'>): boolean {
  return a.kind === 'send' && a.needs === 'text' && !VIEW_TEXT.includes(a.id);
}
