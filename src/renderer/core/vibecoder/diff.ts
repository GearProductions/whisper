/** diff — les lignes d'un texte comparées à sa version précédente : gardées,
 *  ajoutées, retirées (ce que l'agent a changé dans la note).
 *  Ne connaît pas : le DOM, React. Utilisé par : app/panel/vibecoder (la note). */

export type DiffLine = { kind: 'same' | 'added' | 'removed'; text: string };

// Squelette : chaque fonction s'écrit dans le commit de son module.
const todo = (..._args: unknown[]): never => { throw new Error('à implémenter'); };

export function lineDiff(before: string, after: string): DiffLine[] { return todo(before, after); }
