/** commands — le registre des commandes de VibeCoder, l'API du moteur : la
 *  table (resources/vibecoder/commands.json), lue et vérifiée, et son
 *  exécuteur (execute).
 *  Ne connaît pas : Electron, le disque, les portes.
 *  Utilisé par : ses tests ; app/controllers (commands), app/settings. */
export * from './schema';
export * from './table';
export * from './reads';
export * from './skill-text';
export * from './execute';
export * from './caller';
