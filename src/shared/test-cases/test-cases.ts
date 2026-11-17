/** test-cases — ce que le principal et la page lisent pareil des cas d'un test (note 0.15.0-invariants-par-cas) : la clé
 *  de chaque cas (caseKeys : son titre, ou, pour un titre en double, son titre et son numéro d'ordre « n° 2 »…), qui
 *  range sa validation et sa lecture ; le bloc d'un cas pour sa validation (caseBlock : de sa ligne à celle qui le
 *  ferme, trouvée par l'indentation, sans analyser le code) ; le texte des blocs et du code commun (blockTexts : hors de
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
