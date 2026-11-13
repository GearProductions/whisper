/** note — ce que la vue de la note calcule : les lignes que l'agent a
 *  ajoutées ou changées (leurs blocs sont surlignés), les lignes retirées par
 *  groupes (removedGroups) et leur place, avant le bloc ou l'élément de liste
 *  qui les suit (placeRemoved : rendues à part, barrées), le diff brut replié
 *  autour des changements, la marque de chaque ligne de « Ce que ça ne doit
 *  pas faire », la ligne d'une de ces puces (pour y aller depuis un cas d'invariant), un extrait
 *  d'une ligne (la cible d'une remarque).
 *  Ne connaît pas : le DOM, React. Utilisé par : app/panel/vibecoder (note-view, invariants-view). */
import type { MustNotMark } from 'technicals/bridge';
import type { DiffLine } from './diff';
import type { Block } from './markdown';

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

// Des lignes retirées d'un même endroit : leur texte, et la ligne du texte actuel (depuis 0) qui les suit
// (le nombre de lignes du texte actuel : à la fin).
export type Removed = { at: number; lines: string[] };

// Les suites de lignes retirées du diff, dans l'ordre ; une suite de lignes vides seules ne compte pas.
export function removedGroups(diff: DiffLine[]): Removed[] {
  void diff;
  throw new Error('not implemented');
}

// Où rendre les retirées : before, par la ligne (depuis 0) du bloc de premier niveau ou de l'élément de liste
// (à toute profondeur) devant lequel elles vont, leur Markdown (les groupes du même endroit à la suite,
// désindentés de leur retrait commun) ; end : après le dernier bloc (null : rien).
export type RemovedPlaces = { before: Map<number, string>; end: string | null };

// Un groupe va devant le bloc ou l'élément qui commence à sa ligne, ou qui la contient (au milieu d'un
// paragraphe, d'un tableau, d'un code, d'un élément : devant lui entier ; l'élément le plus profond) ;
// sur une ligne vide entre deux blocs : devant le suivant ; après le dernier : end.
export function placeRemoved(removed: Removed[], blocks: Block[]): RemovedPlaces {
  void removed; void blocks;
  throw new Error('not implemented');
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

// Les puces de la rubrique, dans l'ordre : leur ligne (depuis 0), le texte de la première ligne, et le texte
// entier (lignes de suite non vides jointes, comme mustNot).
function mustNotBullets(md: string): { line: number; first: string; text: string }[] {
  const out: { line: number; first: string; text: string }[] = [];
  let inside = false, fence = false, cur: (typeof out)[number] | null = null;
  md.split(/\r?\n/).forEach((line, i) => {
    if (/^\s*(```|~~~)/.test(line)) fence = !fence;
    const h = fence ? null : /^##\s+(.*?)\s*$/.exec(line);
    if (h) { inside = MUST_NOT.test(norm(h[1])); cur = null; return; }
    if (!inside) return;
    if (BULLET.test(line)) out.push(cur = { line: i, first: oneLine(line.replace(BULLET, '')), text: line.replace(BULLET, '') });
    else if (cur && line.trim()) cur.text += ` ${line.trim()}`;
  });
  return out.map((b) => ({ ...b, text: oneLine(b.text) }));
}

// La marque de chaque ligne de « Ce que ça ne doit pas faire », par numéro de
// ligne (depuis 0) de sa puce : la ligne de `mustNot` (dans l'ordre) dont le
// texte commence par celui de la puce (la marque est souvent sur une ligne de suite).
export function mustNotTags(md: string, mustNot: { text: string; mark: MustNotMark }[]): Map<number, MustNotMark> {
  const tags = new Map<number, MustNotMark>();
  let k = 0;
  for (const { line, first } of mustNotBullets(md)) {
    const at = mustNot.findIndex((m, j) => j >= k && m.text.startsWith(first));
    if (at < 0) continue;
    tags.set(line, mustNot[at].mark);
    k = at + 1;
  }
  return tags;
}

// La ligne (depuis 0) de la puce de « Ce que ça ne doit pas faire » dont le texte (ses lignes de suite
// jointes, comme mustNot) est `text` ; plus dans la note (modifiée depuis), ou rubrique absente : null.
// Deux puces identiques : la première.
export function mustNotLine(md: string, text: string): number | null {
  return mustNotBullets(md).find((b) => b.text === text)?.line ?? null;
}

// Un texte sur une ligne, coupé à `max` caractères (« … » compris).
export function excerpt(text: string, max: number): string {
  const line = oneLine(text);
  return line.length > max ? `${line.slice(0, max - 1)}…` : line;
}
