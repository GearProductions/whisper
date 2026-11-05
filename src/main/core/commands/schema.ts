/** schema — le sous-ensemble de JSON Schema dont la table a besoin, sans
 *  bibliothèque : le type, la liste de ses mots-clés (SCHEMA_KEYS : un autre
 *  fait refuser la table) et schemaError, qui dit la première faute d'une
 *  valeur et son chemin (en anglais), et coerce, la conversion tolérante sans
 *  ambiguïté des chaînes qu'un modèle écrit pour un nombre ou un booléen.
 *  Ne connaît pas : les commandes, VibeCoder.
 *  Utilisé par : core/commands (table, execute, ses tests). */
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

/** La première faute de `value` contre `schema`, avec son chemin, en anglais (un modèle la
 *  lit, la langue de l'appli n'y est pour rien) : « args.module: integer expected » ; null :
 *  conforme. `at` : le chemin de `value` (vide : « (root) »). */
export function schemaError(schema: JsonSchema, value: unknown, at = ''): string | null {
  const here = at || '(root)';
  const types = [schema.type].flat();
  if (!types.some((t) => isType(t, value))) return `${here}: ${types.join(' or ')} expected`;
  if (schema.enum && !schema.enum.includes(value as string | number | null)) {
    return `${here}: one of ${schema.enum.join(', ')} expected`;
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) {
    return `${here}: minimum is ${schema.minimum}`;
  }
  if (typeof value === 'string') {
    if (schema.maxLength !== undefined && value.length > schema.maxLength) return `${here}: at most ${schema.maxLength} characters`;
    if (schema.pattern !== undefined && !new RegExp(schema.pattern, 'u').test(value)) return `${here}: does not match ${schema.pattern}`;
  }
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) return `${here}: at most ${schema.maxItems} items`;
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
      if (!has(object, key)) return `${child(key)}: required`;
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (!has(object, key)) continue;
      const error = schemaError(sub, object[key], child(key));
      if (error) return error;
    }
    if (schema.additionalProperties === false) {
      const unknown = Object.keys(object).find((key) => !has(schema.properties ?? {}, key));
      if (unknown) return `${child(unknown)}: unknown`;
    }
  }
  return null;
}

const READS: Record<string, (text: string) => unknown> = {
  integer: (t) => (/^-?\d+$/.test(t) && Number.isSafeInteger(Number(t)) ? Number(t) : t),
  number: (t) => (/^-?\d+(\.\d+)?$/.test(t) ? Number(t) : t),
  boolean: (t) => (t === 'true' ? true : t === 'false' ? false : t),
};

/** `value` converti selon `schema`, sans ambiguïté : une chaîne d'entier (« -3 »), de nombre
 *  (« 1.5 »), « true » / « false » pour integer, number, boolean, dans properties et items.
 *  Un type en liste qui admet string, ou une chaîne qui ne se lit pas : laissée (schemaError
 *  dira la faute). Une clé hors properties est laissée ; `value` n'est jamais modifiée (copie). */
export function coerce(schema: JsonSchema, value: unknown): unknown {
  if (typeof value === 'string') {
    const types = [schema.type].flat();
    if (types.includes('string')) return value;
    return types.map((t) => READS[t]?.(value)).find((v) => v !== value && v !== undefined) ?? value;
  }
  if (Array.isArray(value) && schema.items) return value.map((item) => coerce(schema.items as JsonSchema, item));
  if (isObject(value) && schema.properties) {
    const out = { ...value };
    for (const [key, sub] of Object.entries(schema.properties)) {
      if (Object.hasOwn(value, key)) out[key] = coerce(sub, value[key]);
    }
    return out;
  }
  return value;
}
