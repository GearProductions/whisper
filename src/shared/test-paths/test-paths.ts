/** test-paths — où se rangent les tests d'invariants : sous tests/invariants/ (isInvariantPath). Une seule copie du motif,
 *  lue pareil par le principal et par la page.
 *  Ne connaît pas : Electron, le DOM, le pont, ce qui fait un fichier de test (isTest, main/core/vibecoder).
 *  Utilisé par : main/core/vibecoder (test-files : isInvariantTest), renderer/app/panel/vibecoder (invariants-view). */

export const isInvariantPath = (path: string) => /(^|\/)tests\/invariants\//.test(path);
