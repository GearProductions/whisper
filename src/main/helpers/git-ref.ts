/** git-ref — un ref sûr : [A-Za-z0-9._/-], ni « - » en tête, ni « .. » ; il
 *  peut devenir un argument de git ou une variable d'environnement sans jamais
 *  être une option ni sortir de refs/.
 *  Ne connaît pas : git, les processus.
 *  Utilisé par : core/runner, core/vibecoder, technicals/git. */

export const okRef = (ref: string) => /^(?!-)(?!.*\.\.)[A-Za-z0-9._/-]+$/.test(ref);
