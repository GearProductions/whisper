/** table — la table des commandes, lue et vérifiée : chaque commande, son nom,
 *  sa description (anglais, pour un modèle), lecture ou écriture, ouverte aux
 *  agents ou non (fermée : seulement la liste d'exceptions AGENT_CLOSED, sa
 *  raison écrite), le schéma de ses arguments et, pour une lecture, de sa
 *  réponse. parseCommands refuse une table fautive en nommant chaque faute.
 *  Ne connaît pas : Electron, le disque (le texte est donné), le catalogue des
 *  actions.
 *  Utilisé par : ses tests ; l'exécuteur (étape 2). */
import { SCHEMA_KEYS, isObject, type JsonSchema } from './schema';

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

const JSON_TYPES = ['object', 'array', 'string', 'integer', 'number', 'boolean', 'null'];
const ROBOT_KEYS = ['agentId', 'agent'];

/** Les fautes d'un schéma, à tout niveau (properties, items) : un nœud sans type,
 *  un mot-clé hors SCHEMA_KEYS, une propriété qui nomme un robot. `at` : son chemin. */
function schemaFaults(node: unknown, at: string): string[] {
  if (!isObject(node)) return [`${at} : un schéma (objet) attendu`];
  const faults: string[] = [];
  if (!('type' in node)) faults.push(`${at} : sans type`);
  else if (![node.type].flat().every((t) => JSON_TYPES.includes(t as string))) faults.push(`${at} : type inconnu`);
  if (node.enum !== undefined && !Array.isArray(node.enum)) faults.push(`${at} : enum doit être une liste`);
  for (const key of Object.keys(node)) {
    if (!SCHEMA_KEYS.includes(key)) faults.push(`${at} : mot-clé « ${key} » inconnu`);
  }
  if (isObject(node.properties)) {
    for (const [key, sub] of Object.entries(node.properties)) {
      if (ROBOT_KEYS.includes(key)) faults.push(`${at}.${key} : un id de robot n'a rien à faire dans le contrat`);
      faults.push(...schemaFaults(sub, `${at}.${key}`));
    }
  } else if (node.properties !== undefined) faults.push(`${at} : properties doit être un objet`);
  if (node.items !== undefined) faults.push(...schemaFaults(node.items, `${at}[]`));
  return faults;
}

/** Lit le texte d'une table et la vérifie. Lève une Error qui nomme chaque faute
 *  (et sa commande), pas seulement la première. Ouverte par défaut : tout `agent`
 *  autre que le booléen false est ouvert. */
export function parseCommands(text: string): CommandTable {
  let table: unknown;
  try {
    table = JSON.parse(text);
  } catch (error) {
    throw new Error(`Table des commandes illisible : ${(error as Error).message}`);
  }
  if (!isObject(table)) throw new Error('Table des commandes : un objet attendu');
  if (table.schemaVersion !== 1) throw new Error(`Table des commandes : schemaVersion ${JSON.stringify(table.schemaVersion)} inconnue (1 attendue)`);
  const faults: string[] = [];
  if (typeof table.target !== 'string' || !table.target.trim()) faults.push('target : texte non vide attendu');
  if (!Array.isArray(table.commands)) throw new Error([...faults, 'commands : liste attendue'].join('\n'));

  const seen = new Set<string>();
  for (const [i, c] of table.commands.entries()) {
    if (!isObject(c) || typeof c.name !== 'string' || !c.name) {
      faults.push(`commands[${i}] : name (texte non vide) attendu`);
      continue;
    }
    const at = `commande ${c.name}`;
    if (seen.has(c.name)) faults.push(`${at} : nom déjà pris`);
    seen.add(c.name);
    if (typeof c.description !== 'string' || !c.description.trim()) faults.push(`${at} : description vide`);
    if (c.kind !== 'read' && c.kind !== 'write') faults.push(`${at} : kind read ou write attendu`);
    const closed = c.agent === false;
    if (closed && !AGENT_CLOSED.includes(c.name)) faults.push(`${at} : fermée aux agents hors de la liste d'exceptions (${AGENT_CLOSED.join(', ')})`);
    if (closed && (typeof c.reason !== 'string' || !c.reason.trim())) faults.push(`${at} : fermée sans reason`);
    if (!closed && AGENT_CLOSED.includes(c.name)) faults.push(`${at} : ouverte aux agents, elle doit être fermée (agent: false)`);

    faults.push(...schemaFaults(c.args, `${at} args`));
    if (isObject(c.args) && (c.args.type !== 'object' || c.args.additionalProperties !== false)) {
      faults.push(`${at} args : un objet avec additionalProperties: false attendu`);
    }
    if (c.response !== undefined) faults.push(...schemaFaults(c.response, `${at} response`));
    else if (c.kind === 'read') faults.push(`${at} : une lecture sans response`);
  }
  if (faults.length) throw new Error(`Table des commandes refusée :\n- ${faults.join('\n- ')}`);
  return table as unknown as CommandTable;
}
