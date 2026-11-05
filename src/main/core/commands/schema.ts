/** schema — le sous-ensemble de JSON Schema dont la table a besoin, sans
 *  bibliothèque : le type, la liste de ses mots-clés (SCHEMA_KEYS : un autre
 *  fait refuser la table) et schemaError, qui dit la première faute d'une
 *  valeur et son chemin.
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
  enum?: (string | number | null)[];
  minimum?: number;
  maxLength?: number;
  maxItems?: number;
  pattern?: string;
};

export const SCHEMA_KEYS = [
  'type', 'description', 'properties', 'required', 'additionalProperties',
  'items', 'enum', 'minimum', 'maxLength', 'maxItems', 'pattern',
];

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

const isType = (type: string, v: unknown): boolean => {
  switch (type) {
    case 'object': return isObject(v);
    case 'array': return Array.isArray(v);
    case 'string': return typeof v === 'string';
    case 'integer': return Number.isInteger(v);
    case 'number': return typeof v === 'number' && Number.isFinite(v);
    case 'boolean': return typeof v === 'boolean';
    case 'null': return v === null;
    default: return false;
  }
};

/** La première faute de `value` contre `schema`, avec son chemin (« args.module :
 *  integer attendu »), ou null : conforme. `at` : le chemin de `value` (vide : « (racine) »). */
export function schemaError(schema: JsonSchema, value: unknown, at = ''): string | null {
  const here = at || '(racine)';
  const types = [schema.type].flat();
  if (!types.some((t) => isType(t, value))) return `${here} : ${types.join(' ou ')} attendu`;
  if (schema.enum && !schema.enum.includes(value as string | number | null)) {
    return `${here} : l'une de ${schema.enum.join(', ')} attendue`;
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) {
    return `${here} : ${schema.minimum} au moins`;
  }
  if (typeof value === 'string') {
    if (schema.maxLength !== undefined && value.length > schema.maxLength) return `${here} : ${schema.maxLength} caractères au plus`;
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) return `${here} : ne suit pas ${schema.pattern}`;
  }
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) return `${here} : ${schema.maxItems} éléments au plus`;
    if (schema.items) {
      for (const [i, item] of value.entries()) {
        const error = schemaError(schema.items, item, `${at}[${i}]`);
        if (error) return error;
      }
    }
  }
  if (isObject(value)) {
    const object = value;
    const has = (o: object, key: string) => Object.hasOwn(o, key);
    const child = (key: string) => (at ? `${at}.${key}` : key);
    for (const key of schema.required ?? []) {
      if (!has(object, key)) return `${child(key)} : requis`;
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (!has(object, key)) continue;
      const error = schemaError(sub, object[key], child(key));
      if (error) return error;
    }
    if (schema.additionalProperties === false) {
      const unknown = Object.keys(object).find((key) => !has(schema.properties ?? {}, key));
      if (unknown) return `${child(unknown)} : inconnu`;
    }
  }
  return null;
}
