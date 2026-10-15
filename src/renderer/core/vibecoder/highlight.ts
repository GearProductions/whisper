/** highlight — la coloration du pseudo-code des lectures d'invariants :
 *  mots-clés, chaînes, commentaires, nombres ; le reste en texte.
 *  Ne connaît pas : le DOM, React, le langage du test lu.
 *  Utilisé par : app/panel/vibecoder (invariants). */

export type Token = { kind: 'keyword' | 'string' | 'comment' | 'number' | 'text'; text: string };

// Squelette : chaque fonction s'écrit dans le commit de son module.
const todo = (..._args: unknown[]): never => { throw new Error('à implémenter'); };

export function tokens(code: string): Token[] { return todo(code); }
