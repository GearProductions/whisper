/** schema — le sous-ensemble de JSON Schema dont la table a besoin, sans
 *  bibliothèque. Squelette : le type seul ; SCHEMA_KEYS et schemaError
 *  viennent avec le commit du module.
 *  Ne connaît pas : les commandes, VibeCoder.
 *  Utilisé par : core/commands (table, ses tests). */
type JsonType = 'object' | 'array' | 'string' | 'integer' | 'number' | 'boolean' | 'null';

export type JsonSchema = {
  type: JsonType | JsonType[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: false;
  items?: JsonSchema;
  enum?: (string | number)[];
  minimum?: number;
  maxLength?: number;
  maxItems?: number;
  pattern?: string;
};
