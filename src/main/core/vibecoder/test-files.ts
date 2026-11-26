/** test-files — les fichiers de test d'une branche : lequel est un test, lequel un
 *  test d'invariant (rangé sous tests/invariants/), les titres de ses cas (it,
 *  test, #[test], def test_…) et leur ligne, la ligne de leur titre (caseHeads), et son empreinte git, qui nomme sa lecture
 *  (<sorties>/invariants/<blob>.md) ; l'empreinte du bloc de chaque cas et du code commun (caseBlocks, note
 *  0.15.0-invariants-par-cas) ; et sa lecture, cas par cas (caseReading) : celle de son empreinte, sinon la plus
 *  récente de son fichier, périmée pour les cas dont le bloc a changé depuis, pour tous si le code commun a changé
 *  (l'empreinte des blocs lus et du code commun, retenue à côté de la lecture : <sorties>/invariants/<blob>.json).
 *  Ne connaît pas : le disque, git (textes, chemins et lectures passés), les validations.
 *  Utilisé par : core/vibecoder (journey, case-marks), app/controllers/vibecoder (les tests
 *  de la branche et l'empreinte de chacun ; blobSha : aussi l'empreinte de ce
 *  qu'on valide ; caseBlocks : les empreintes des blocs lus). */
import { createHash } from 'node:crypto';
import { blockTexts, caseKeys } from 'shared/test-cases';
import { isInvariantPath } from 'shared/test-paths';

// Un fichier de test, quel que soit son langage : Vitest / Jest (*.test.ts,
// *.spec.js…), pytest (test_*.py, *_test.py), Go (*_test.go), Rust (un .rs sous tests/).
export const isTest = (path: string) =>
  /\.(test|spec)\.[cm]?[jt]sx?$/.test(path) || /(^|\/)test_[^/]*\.py$|_test\.(py|go)$/.test(path) || /(^|\/)tests\/.*\.rs$/.test(path);

export const isInvariantTest = (path: string) => isTest(path) && isInvariantPath(path);

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

// La ligne (1…) de chaque cas, dans l'ordre de caseTitles : là où commence son it / test, son #[test], son def (from), et
// celle de son titre (title : la fin de son it(… 'titre', de son fn, de son def).
export function caseHeads(src: string): { from: number; title: number }[] {
  let line = 1;
  let at = 0;
  const lineAt = (index: number) => {
    for (; at < index; at++) if (src[at] === '\n') line++;
    return line;
  };
  return [...src.matchAll(CASE)].map((m) => ({ from: lineAt(m.index), title: lineAt(m.index + m[0].length) }));
}

// La ligne (à partir de 1) de chaque cas, dans l'ordre de caseTitles.
export const caseLines = (src: string): number[] => caseHeads(src).map((h) => h.from);

// Les clés des cas (caseKeys de shared/test-cases), l'empreinte (blobSha) du bloc de chacun et celle du code commun
// (blockTexts de shared/test-cases, d'après caseHeads), dans l'ordre de caseTitles.
export function caseBlocks(src: string): { keys: string[]; blocks: string[]; common: string } {
  const { blocks, common } = blockTexts(src, caseHeads(src));
  return { keys: caseKeys(caseTitles(src)), blocks: blocks.map(blobSha), common: blobSha(common) };
}

// Une lecture rangée : son empreinte de test (blob), son texte, sa date ; blocks, l'empreinte du bloc de chaque cas lu,
// par clé (absent : une lecture d'avant cette version, ou pas encore retenue) ; common, celle du code commun lu (absent :
// pas retenue).
export type ReadingRecord = { blob: string; text: string; time: number; blocks?: Record<string, string>; common?: string };

// La lecture d'un test : celle de son empreinte (stale : []), sinon la plus récente dont la première ligne est
// « # <chemin du test> », stale : les clés des cas dont le bloc d'aujourd'hui n'est pas celui retenu ; toutes si le code
// commun (setup, helpers, en-tête) n'est pas celui retenu, ou sans blocks ni common ; null : aucune.
export function caseReading(
  test: { path: string; blob: string; text: string },
  readings: ReadingRecord[],
): { text: string; stale: string[] } | null {
  const own = readings.find((r) => r.blob === test.blob);
  if (own) return { text: own.text, stale: [] };
  const last = readings
    .filter((r) => r.text.split('\n', 1)[0].trimEnd() === `# ${test.path}`)
    .reduce<ReadingRecord | null>((a, r) => (a && a.time >= r.time ? a : r), null);
  if (!last) return null;
  const { keys, blocks, common } = caseBlocks(test.text);
  return { text: last.text, stale: last.common !== common ? keys : keys.filter((k, i) => last.blocks?.[k] !== blocks[i]) };
}

// L'empreinte git (blob) d'un contenu : sha1 de « blob <octets>\0<contenu> », en UTF-8 (un Buffer : ses octets tels quels).
export function blobSha(text: string | Buffer): string {
  const body = typeof text === 'string' ? Buffer.from(text, 'utf8') : text;
  return createHash('sha1').update(`blob ${body.length}\0`).update(body).digest('hex');
}
