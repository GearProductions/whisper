/** diff — les lignes d'un texte comparées à sa version précédente : gardées,
 *  ajoutées, retirées (ce que l'agent a changé dans la note).
 *  Ne connaît pas : le DOM, React. Utilisé par : app/panel/vibecoder (la note). */

export type DiffLine = { kind: 'same' | 'added' | 'removed'; text: string };

const LIMIT = 2000;
const split = (s: string) => (s ? s.split(/\r?\n/) : []);
const as = (kind: DiffLine['kind'], texts: string[]): DiffLine[] => texts.map((text) => ({ kind, text }));

// Le début et la fin communs gardés ; au milieu, la plus longue sous-suite
// commune (retirées avant ajoutées).
export function lineDiff(before: string, after: string): DiffLine[] {
  const a = split(before), b = split(after);
  let start = 0, end = 0;
  while (start < a.length && start < b.length && a[start] === b[start]) start++;
  while (end < a.length - start && end < b.length - start && a[a.length - 1 - end] === b[b.length - 1 - end]) end++;
  const x = a.slice(start, a.length - end), y = b.slice(start, b.length - end);
  return [...as('same', a.slice(0, start)), ...middle(x, y), ...as('same', a.slice(a.length - end))];
}

function middle(x: string[], y: string[]): DiffLine[] {
  // ponytail: table n × m ; au-delà de 2 000 lignes d'un côté, tout le milieu retiré puis ajouté (Myers si ça gêne).
  if (x.length > LIMIT || y.length > LIMIT) return [...as('removed', x), ...as('added', y)];
  const w = y.length + 1;
  const lcs = new Uint16Array((x.length + 1) * w); // lcs[i * w + j] : pour x[i..] et y[j..]
  for (let i = x.length - 1; i >= 0; i--) {
    for (let j = y.length - 1; j >= 0; j--) {
      lcs[i * w + j] = x[i] === y[j] ? lcs[(i + 1) * w + j + 1] + 1 : Math.max(lcs[(i + 1) * w + j], lcs[i * w + j + 1]);
    }
  }
  const out: DiffLine[] = [];
  for (let i = 0, j = 0; i < x.length || j < y.length;) {
    if (i < x.length && j < y.length && x[i] === y[j]) { out.push({ kind: 'same', text: x[i] }); i++; j++; }
    else if (j === y.length || (i < x.length && lcs[(i + 1) * w + j] >= lcs[i * w + j + 1])) out.push({ kind: 'removed', text: x[i++] });
    else out.push({ kind: 'added', text: y[j++] });
  }
  return out;
}
