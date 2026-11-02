/** vibecoder — ce que l'écran VibeCoder calcule, sans le DOM : l'arborescence des
 *  artefacts et des fichiers (nœuds, lignes visibles, dossiers, ids, noms, touches, presse-papiers et menu), le Markdown
 *  (jamais de HTML), les lignes changées, la coloration du
 *  pseudo-code, les libellés ; les
 *  sorties des skills lues sans s'y fier, les lignes de l'étape Modules, ce
 *  que Relire prend de l'utilisateur ; la note (ses changements, ses marques),
 *  les réponses aux questions, la Forme par dossier, les cas d'invariants et
 *  leur pseudo-code, la validation qu'attend l'étape en cours ; ce qui s'écrit
 *  dans le champ (une action « préparer »), le champ dont une action emporte
 *  le texte ; une durée, une taille de fichier en clair ; le modèle choisi d'une action, les
 *  actions qui tournent, la largeur de la colonne de la conversation ; la saisie de l'écran gardée
 *  par agent ; la recherche de la vue des branches et les PR où se demander en
 *  relecture. */
export * from './artifact-clipboard';
export * from './artifact-tree';
export * from './diff';
export * from './field';
export * from './file-tree';
export * from './forme';
export * from './highlight';
export * from './i18n';
export * from './ide-files';
export * from './invariants';
export * from './kept';
export * from './markdown';
export * from './module-row';
export * from './note';
export * from './outputs';
export * from './questions';
export * from './review-flow';
export * from './screen';
export * from './search';
export * from './tree-keys';
export * from './validation';
