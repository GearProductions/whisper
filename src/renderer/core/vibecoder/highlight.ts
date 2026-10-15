/** highlight — la coloration du pseudo-code des lectures d'invariants :
 *  mots-clés, chaînes, commentaires, nombres ; le reste en texte.
 *  Ne connaît pas : le DOM, React, le langage du test lu.
 *  Utilisé par : app/panel/vibecoder (invariants). */

export type Token = { kind: 'keyword' | 'string' | 'comment' | 'number' | 'text'; text: string };

const KEYWORDS = new Set(('it describe test expect const let await async return if else for of in true false '
  + 'null undefined new function throw import from not toBe toEqual toContain toThrow').split(' '));

// Commentaire (/* non fermé : jusqu'à la fin), chaîne (' ou " non fermée :
// jusqu'à la fin de la ligne ; ` : jusqu'à la fin), nombre, mot.
const TOKEN = /(?<comment>\/\/.*|\/\*[\s\S]*?(?:\*\/|$))|(?<string>'(?:\\.|[^'\\\n])*'?|"(?:\\.|[^"\\\n])*"?|`(?:\\[\s\S]|[^`\\])*`?)|(?<number>\b\d+(?:\.\d+)?\b)|(?<word>[\p{L}_$][\p{L}\p{N}_$]*)/gu;

// Les morceaux, bout à bout, redonnent le code tel quel.
export function tokens(code: string): Token[] {
  const out: Token[] = [];
  const push = (kind: Token['kind'], text: string) => {
    const last = out[out.length - 1];
    if (kind === 'text' && last?.kind === 'text') last.text += text;
    else if (text) out.push({ kind, text });
  };
  let at = 0;
  for (const m of code.matchAll(TOKEN)) {
    push('text', code.slice(at, m.index));
    at = m.index + m[0].length;
    const g = m.groups!;
    push(g.comment != null ? 'comment' : g.string != null ? 'string' : g.number != null ? 'number' : KEYWORDS.has(m[0]) ? 'keyword' : 'text', m[0]);
  }
  push('text', code.slice(at));
  return out;
}
