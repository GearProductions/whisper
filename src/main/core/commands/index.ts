/** commands — le registre des commandes de VibeCoder, l'API du moteur : la
 *  table (resources/vibecoder/commands.json), lue et vérifiée. Le barrel
 *  s'allonge d'un fichier à chaque commit (schéma, table, lectures, texte des
 *  skills).
 *  Ne connaît pas : Electron, le disque, les portes.
 *  Utilisé par : ses tests ; l'exécuteur (étape 2). */
export * from './schema';
export * from './table';
