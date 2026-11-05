/** table — la table des commandes, lue et vérifiée : chaque commande, son nom,
 *  sa description (anglais, pour un modèle), lecture ou écriture, ouverte aux
 *  agents ou non (fermée : seulement la liste d'exceptions AGENT_CLOSED, sa
 *  raison écrite), le schéma de ses arguments et, pour une lecture, de sa
 *  réponse. parseCommands refuse une table fautive en nommant chaque faute.
 *  Squelette : parseCommands n'est pas encore écrit.
 *  Ne connaît pas : Electron, le disque (le texte est donné), le catalogue des
 *  actions.
 *  Utilisé par : ses tests ; l'exécuteur (étape 2). */
import type { JsonSchema } from './schema';

export type CommandDef = {
  name: string;
  description: string;
  kind: 'read' | 'write';
  agent: boolean;
  reason?: string;
  args: JsonSchema;
  response?: JsonSchema;
};

export type CommandTable = { schemaVersion: 1; target: string; commands: CommandDef[] };

/** La liste d'exceptions de cette étape : répondre à une demande d'autorisation
 *  d'une course (I-13 à I-18). */
export const AGENT_CLOSED = ['run.allow', 'run.always', 'run.deny'];

export function parseCommands(_text: string): CommandTable {
  throw new Error('not implemented');
}
