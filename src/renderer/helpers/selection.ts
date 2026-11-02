/** selection — sélection multiple dans une liste ordonnée (clic, Ctrl, Maj).
 *  Ne connaît pas : les artefacts, le DOM. Fonctions pures.
 *  Utilisé par : app/panel/vibecoder (artifacts-view). */

export type Selection = { keys: string[]; anchor: string | null };

// Clic seul : key seule. Ctrl : bascule key. Maj : de l'ancre à key, dans l'ordre affiché
// (sans ancre connue, key seule). L'ancre ne bouge pas sous Maj.
export function select(sel: Selection, order: string[], key: string, mods: { ctrl: boolean; shift: boolean }): Selection {
  if (mods.shift) {
    const a = sel.anchor === null ? -1 : order.indexOf(sel.anchor);
    const b = order.indexOf(key);
    if (a >= 0 && b >= 0) return { keys: order.slice(Math.min(a, b), Math.max(a, b) + 1), anchor: sel.anchor };
  } else if (mods.ctrl) {
    const keys = sel.keys.includes(key) ? sel.keys.filter((k) => k !== key) : [...sel.keys, key];
    return { keys, anchor: key };
  }
  return { keys: [key], anchor: key };
}

// Retire les clés qui ne sont plus dans order ; même référence si rien ne change.
export function keptSelection(sel: Selection, order: string[]): Selection {
  const keys = sel.keys.filter((k) => order.includes(k));
  const anchor = sel.anchor !== null && order.includes(sel.anchor) ? sel.anchor : null;
  return keys.length === sel.keys.length && anchor === sel.anchor ? sel : { keys, anchor };
}
