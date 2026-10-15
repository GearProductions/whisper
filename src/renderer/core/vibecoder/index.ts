/** vibecoder — ce que l'écran VibeCoder calcule, sans le DOM : le Markdown
 *  (jamais de HTML), les lignes changées, la coloration, les libellés ; les
 *  sorties des skills lues sans s'y fier, les lignes de l'étape Modules, ce
 *  que Relire prend de l'utilisateur ; la note (ses changements, ses marques),
 *  les réponses aux questions, la Forme par dossier, les cas d'invariants et
 *  leur pseudo-code, la validation qu'attend l'étape en cours ; ce qui s'écrit
 *  dans le champ (une action « préparer », une pastille de skill). */
export * from './diff';
export * from './field';
export * from './forme';
export * from './highlight';
export * from './i18n';
export * from './invariants';
export * from './markdown';
export * from './module-row';
export * from './note';
export * from './outputs';
export * from './questions';
export * from './review-flow';
export * from './validation';
