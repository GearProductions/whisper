/** note — ce que la vue de la note calcule : les lignes que l'agent a
 *  ajoutées ou changées (leurs blocs sont surlignés), le diff brut replié
 *  autour des changements, la marque de chaque ligne de « Ce que ça ne doit
 *  pas faire », un extrait d'une ligne (la cible d'une remarque).
 *  Ne connaît pas : le DOM, React. Utilisé par : app/panel/vibecoder (note-view, invariants-view). */
import type { MustNotMark } from 'technicals/bridge';
import type { DiffLine } from './diff';

// Les lignes du texte actuel (depuis 0) ajoutées ou changées dans le diff ; une ligne vide ne compte pas.
export function changedLines(diff: DiffLine[]): Set<number> {
  const out = new Set<number>();
  let n = 0;
  for (const l of diff) {
    if (l.kind === 'removed') continue;
    if (l.kind === 'added' && l.text.trim()) out.add(n);
    n++;
  }
  return out;
}

export type Fold = DiffLine | { kind: 'skip'; count: number };

// Le diff, chaque suite de lignes gardées repliée en « n lignes » sauf `context`
// lignes de chaque côté d'un changement (une seule ligne à replier reste affichée).
export function foldDiff(diff: DiffLine[], context = 3): Fold[] {
  const out: Fold[] = [];
  for (let i = 0; i < diff.length;) {
    if (diff[i].kind !== 'same') { out.push(diff[i++]); continue; }
    let j = i;
    while (j < diff.length && diff[j].kind === 'same') j++;
    const head = i === 0 ? 0 : context, tail = j === diff.length ? 0 : context;
    if (j - i > head + tail + 1) out.push(...diff.slice(i, i + head), { kind: 'skip', count: j - i - head - tail }, ...diff.slice(j - tail, j));
    else out.push(...diff.slice(i, j));
    i = j;
  }
  return out;
}

// La rubrique comme le principal la reconnaît (main/core/vibecoder/note.ts) : un titre ##, casse,
// accents et apostrophes ignorés ; ses lignes, les puces jusqu'au ## suivant (hors blocs de code).
const MUST_NOT = /^(ce que ca ne doit|what it (must|should)(n't| not| never))/;
export const BULLET = /^\s*(?:[-*+]|\d+[.)])\s+/;   // une ligne de liste (review-flow, review-view)
const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[’`]/g, '\'');
const oneLine = (s: string) => s.replace(/\s+/g, ' ').trim();

// La marque de chaque ligne de « Ce que ça ne doit pas faire », par numéro de
// ligne (depuis 0) de sa puce : la ligne de `mustNot` (dans l'ordre) dont le
// texte commence par celui de la puce (la marque est souvent sur une ligne de suite).
export function mustNotTags(md: string, mustNot: { text: string; mark: MustNotMark }[]): Map<number, MustNotMark> {
  const tags = new Map<number, MustNotMark>();
  let inside = false, fence = false, k = 0;
  md.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const h = fence ? null : /^##\s+(.*?)\s*$/.exec(line);
    if (h) inside = MUST_NOT.test(norm(h[1]));
    const text = inside && !h && BULLET.test(line) ? oneLine(line.replace(BULLET, '')) : '';
    const at = text ? mustNot.findIndex((m, j) => j >= k && m.text.startsWith(text)) : -1;
    if (at < 0) return;
    tags.set(i, mustNot[at].mark);
    k = at + 1;
  });
  return tags;
}

// Un texte sur une ligne, coupé à `max` caractères (« … » compris).
export function excerpt(text: string, max: number): string {
  const line = oneLine(text);
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
