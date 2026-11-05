/** table — la table des commandes, lue et vérifiée : chaque commande, son nom,
 *  sa description (anglais, pour un modèle), lecture ou écriture, ouverte aux
 *  agents ou non (fermée : seulement la liste d'exceptions AGENT_CLOSED, sa
 *  raison écrite), le schéma de ses arguments et, pour une lecture, de sa
 *  réponse ; et `errors`, la liste des erreurs (code en kebab-case, message et
 *  todo en anglais, sans langue d'appli ; absente : vide). parseCommands refuse une table
 *  fautive en nommant chaque faute.
 *  Ne connaît pas : Electron, le disque (le texte est donné), le catalogue des
 *  actions, les codes d'ERROR_CODES (l'exécuteur les compare à la liste).
 *  Utilisé par : execute, app/settings ; ses tests. */
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

/** Une erreur : ce qui s'est passé (message) et quoi faire (todo), pour un modèle. */
export type ErrorDef = { code: string; message: string; todo: string };

export type CommandTable = { schemaVersion: 1; target: string; errors: ErrorDef[]; commands: CommandDef[] };

/** La liste d'exceptions de cette étape : répondre à une demande d'autorisation
 *  d'une course (I-13 à I-18). */
export const AGENT_CLOSED = ['run.allow', 'run.always', 'run.deny'];

const JSON_TYPES = ['object', 'array', 'string', 'integer', 'number', 'boolean', 'null'];
const KEBAB = /^[a-z][a-z0-9]*(-[a-z0-9]+)*$/;
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
  table.errors ??= [];   // absente : aucune erreur décrite (une table d'essai) ; la table livrée les a toutes (les tests le vérifient)
  if (!Array.isArray(table.errors)) faults.push('errors : liste attendue');
  else {
    const codes = new Set<string>();
    for (const [i, e] of table.errors.entries()) {
      if (!isObject(e) || typeof e.code !== 'string' || !e.code.trim()) {
        faults.push(`errors[${i}] : code (texte non vide) attendu`);
        continue;
      }
      const at = `erreur ${e.code}`;
      if (codes.has(e.code)) faults.push(`${at} : code déjà pris`);
      codes.add(e.code);
      if (!KEBAB.test(e.code)) faults.push(`${at} : code en kebab-case attendu`);
      for (const key of ['message', 'todo']) {
        if (typeof e[key] !== 'string' || !e[key].trim()) faults.push(`${at} : ${key} vide`);
      }
    }
  }
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
