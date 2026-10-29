/** dictation-field — où et quoi insérer d'une dictée dans le panneau : la zone
 *  de texte multiligne qui a le clavier (pas le champ de la conversation, ni
 *  une zone en lecture seule ou grisée ; un éditeur CodeMirror ou un <input>
 *  n'en sont pas), et le texte à y insérer à la place de la sélection.
 *  Ne connaît pas : le pont, React, VibeCoder. Utilisé par : app/panel (panel-app). */

export function dictationField(active: Element | null, input: HTMLElement | null): HTMLTextAreaElement | null {
  return active instanceof HTMLTextAreaElement && active !== input && !active.readOnly && !active.disabled ? active : null;
}

type Field = { value: string; selectionStart: number; selectionEnd: number; maxLength: number };

/** Une espace si le texte avant le curseur ne finit pas par un blanc, puis la
 *  dictée, coupé à la place qui reste sous maxLength (-1 : sans limite ; '' : plus de place,
 *  ou place pour l'espace seule). */
export function dictationText({ value, selectionStart, selectionEnd, maxLength }: Field, text: string) {
  const before = value.slice(0, selectionStart);
  const s = `${before && !/\s$/.test(before) ? ' ' : ''}${text}`;
  if (maxLength < 0) return s;
  const cut = s.slice(0, Math.max(0, maxLength - (value.length - (selectionEnd - selectionStart)))); // la sélection est remplacée
  return cut.trim() ? cut : '';
}
