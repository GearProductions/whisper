/** test-files — les fichiers de test d'une branche : lequel est un test, lequel un
 *  test d'invariant (rangé sous tests/invariants/), les titres de ses cas (it,
 *  test, #[test], def test_…) et leur ligne, et son empreinte git, qui nomme sa lecture
 *  (<sorties>/invariants/<blob>.md).
 *  Ne connaît pas : le disque, git (textes et chemins passés).
 *  Utilisé par : core/vibecoder (journey), app/controllers/vibecoder (les tests
 *  de la branche et l'empreinte de chacun ; blobSha : aussi l'empreinte de ce
 *  qu'on valide). */
import { createHash } from 'node:crypto';

// Un fichier de test, quel que soit son langage : Vitest / Jest (*.test.ts,
// *.spec.js…), pytest (test_*.py, *_test.py), Go (*_test.go), Rust (un .rs sous tests/).
export const isTest = (path: string) =>
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) || /(^|\/)test_[^/]*\.py$|_test\.(py|go)$/.test(path) || /(^|\/)tests\/.*\.rs$/.test(path);

export const isInvariantTest = (path: string) => isTest(path) && /(^|\/)tests\/invariants\//.test(path);

// Un cas : it / test (.only, .skip, .each(…)…) et son titre littéral ; une
// fonction Rust sous #[test] ou #[tokio::test(…)] ; une fonction Python test_….
// ponytail: le tableau d'un .each s'arrête au premier « )( » suivi d'un texte, une parenthèse dans une chaîne peut tromper.
const CASE = new RegExp([
  /(?<![.\w])(?:it|test)(?:\.(?!each\b)\w+)*(?:\.each\s*\([\s\S]*?\))?\s*\(\s*(['"`])((?:\\.|(?!\1)[^\\])*)\1/.source,
  /#\[(?:\w+::)*test\b[^\]]*\]\s*(?:#\[[^\]]*\]\s*)*(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/.source,
  /^[ \t]*(?:async\s+)?def\s+(test\w*)/.source,
].join('|'), 'gm');

// Les titres des cas, dans l'ordre du fichier, tels qu'écrits (échappements ôtés).
export function caseTitles(src: string): string[] {
  return [...src.matchAll(CASE)].map((m) => m[2]?.replace(/\\(.)/g, '$1') ?? m[3] ?? m[4]);
}

// La ligne (à partir de 1) de chaque cas, dans l'ordre de caseTitles : là où
// commence son it / test, son #[test], son def.
export function caseLines(src: string): number[] {
  let line = 1;
  let at = 0;
  return [...src.matchAll(CASE)].map((m) => {
    for (; at < m.index; at++) if (src[at] === '\n') line++;
    return line;
  });
}

// L'empreinte git (blob) d'un contenu : sha1 de « blob <octets>\0<contenu> », en UTF-8.
export function blobSha(text: string): string {
  const body = Buffer.from(text, 'utf8');
  return createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
}
