/** test-files — les fichiers de test d'une branche : lequel est un test, lequel un
 *  test d'invariant (rangé sous tests/invariants/), les titres de ses cas (it,
 *  test, #[test], def test_…), et son empreinte git, qui nomme sa lecture
 *  (<sorties>/invariants/<blob>.md).
 *  Ne connaît pas : le disque, git (textes et chemins passés).
 *  Utilisé par : core/vibecoder (journey), app/controllers/vibecoder (blobSha
 *  d'un fichier pas encore commité). */

// Squelette : chaque fonction s'écrit dans le commit de son module.
const todo = (..._args: unknown[]): never => { throw new Error('à implémenter'); };

// Un fichier de test, quel que soit son langage (Vitest, Rust, Python…).
export function isTest(path: string): boolean { return todo(path); }

export function isInvariantTest(path: string): boolean { return todo(path); }

// Les titres des cas, dans l'ordre du fichier, tels qu'écrits.
export function caseTitles(src: string): string[] { return todo(src); }

// L'empreinte git (blob) d'un contenu : sha1 de « blob <octets>\0<contenu> », en UTF-8.
export function blobSha(text: string): string { return todo(text); }
