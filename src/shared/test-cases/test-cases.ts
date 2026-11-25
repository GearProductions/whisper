/** test-cases — ce que le principal et la page lisent pareil des cas d'un test (note 0.15.0-invariants-par-cas) : la clé
 *  de chaque cas (caseKeys : son titre, ou, pour un titre en double, son titre et son numéro d'ordre « n° 2 »…), qui
 *  range sa validation et sa lecture ; le bloc d'un cas pour sa validation (caseBlock : de sa ligne à celle qui le
 *  ferme, trouvée par l'indentation, sans analyser le code) ; quel cas de la lecture est celui d'un cas (readingRanks) et combien en sont lus (readCount) ; le texte des blocs et du code commun (blockTexts : hors de
 *  tout bloc ; les lignes vides ne comptent nulle part). Une seule copie, du texte seul.
 *  Ne connaît pas : Electron, le DOM, le pont, les empreintes (le principal hache), la découpe de l'écran (caseRange,
 *  renderer/core/vibecoder), où sont les cas dans le texte (caseHeads, main/core/vibecoder).
 *  Utilisé par : main/core/vibecoder (test-files, case-marks), renderer/core/vibecoder (invariants, ide-files,
 *  review-flow, validation), renderer/app/panel/vibecoder (invariants-view). */

// Les lignes d'un cas dans son fichier (1…, bornes comprises).
export type CaseSpan = { from: number; to: number };

// La clé de chaque cas, dans l'ordre des titres : un titre unique, tel quel ; un titre en double, tel quel pour le
// premier, puis « <titre> n° 2 », « <titre> n° 3 »… ; une clé déjà rendue (un vrai titre « t n° 2 ») est sautée : jamais deux
// cas de même clé.
export function caseKeys(titles: string[]): string[] {
  const count = new Map<string, number>(), taken = new Set<string>();
  return titles.map((title) => {
    let n = count.get(title) ?? 0, key: string;
    do key = ++n === 1 ? title : `${title} n° ${n}`; while (taken.has(key));
    count.set(title, n);
    taken.add(key);
    return key;
  });
}

// Pour chaque cas, le rang de sa lecture parmi les cas lus (readTitles : leurs titres) : celle de même clé, sinon celle
// de même rang si la lecture a autant de cas et que celui-ci ne porte le titre d'aucun autre ; null : pas lu.
export function readingRanks(cases: string[], readTitles: string[]): (number | null)[] {
  const readKeys = caseKeys(readTitles);
  return caseKeys(cases).map((key, i) => {
    const at = readKeys.indexOf(key);
    return at >= 0 ? at : readTitles.length === cases.length && !cases.includes(readTitles[i]) ? i : null;
  });
}

// Combien de cas d'un test sa lecture couvre sans qu'ils soient périmés (readTitles : les titres lus, null : pas lu ;
// stale : les clés des cas dont le bloc a changé depuis) ; moins que de cas : le test est à lire (ou à relire).
export function readCount(cases: string[], readTitles: string[] | null, stale: string[] = []): number {
  if (!readTitles) return 0;
  const keys = caseKeys(cases);
  return readingRanks(cases, readTitles).filter((r, i) => r !== null && !stale.includes(keys[i])).length;
}

// Le bloc du cas dont la ligne est `from` et la ligne de son titre `title` (son it(, son fn, son def), dans `lines`
// (le texte coupé en lignes) : de `from` à la ligne qui le ferme — après `title`, la première ligne non vide indentée
// comme `from` ou moins, en sautant celle qui commence par `)` et finit par `{` ou `:` ; comprise si elle est indentée
// comme `from` et commence par `}` ou `)`, exclue sinon ; sans elle, jusqu'à la fin du texte.
// L'indentation se compte en caractères (une tabulation vaut une espace).
export function caseBlock(lines: string[], from: number, title: number): CaseSpan {
  const indent = (line: string) => line.length - line.trimStart().length;
  const base = indent(lines[from - 1] ?? '');
  for (let i = title; i < lines.length; i++) {   // lines[i] : la ligne i + 1, la première après le titre
    const line = lines[i].trim();
    if (!line || indent(lines[i]) > base) continue;
    if (line.startsWith(')') && /[{:]$/.test(line)) continue;
    return { from, to: indent(lines[i]) === base && /^[})]/.test(line) ? i + 1 : i };
  }
  return { from, to: lines.length };
}

// Le texte du bloc de chaque cas (heads : sa ligne et celle de son titre, dans l'ordre du fichier) et celui du code
// commun (les lignes hors de tout bloc), sans leurs lignes vides.
export function blockTexts(source: string, heads: { from: number; title: number }[]): { blocks: string[]; common: string } {
  const lines = source.split('\n');
  const inBlock = new Set<number>();
  const blocks = heads.map((head) => {
    const { from, to } = caseBlock(lines, head.from, head.title);
    for (let n = from; n <= to; n++) inBlock.add(n);
    return lines.slice(from - 1, to).filter((l) => l.trim()).join('\n');
  });
  const common = lines.filter((l, i) => l.trim() && !inBlock.has(i + 1)).join('\n');
  return { blocks, common };
}
