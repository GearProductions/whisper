/** commands — le registre des commandes de VibeCoder, l'API du moteur : la
 *  table (resources/vibecoder/commands.json), lue et vérifiée.
 *  Ne connaît pas : Electron, le disque, les portes.
 *  Utilisé par : ses tests ; l'exécuteur (étape 2). */
export * from './schema';
export * from './table';
export * from './reads';
export * from './skill-text';
