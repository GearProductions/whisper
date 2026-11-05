// Variantes de schema : chaque mot-clé du sous-ensemble, la faute et son chemin.
import { describe, expect, it } from 'vitest';
import { SCHEMA_KEYS, schemaError, type JsonSchema } from 'core/commands';

const args: JsonSchema = {
  type: 'object',
  properties: {
    module: { type: 'integer', minimum: 1 },
    name: { type: 'string', maxLength: 5, pattern: '^[a-z]+$' },
    mode: { type: 'string', enum: ['a', 'b'] },
    tags: { type: 'array', maxItems: 2, items: { type: 'string' } },
    either: { type: ['integer', 'null'] },
  },
  required: ['module'],
  additionalProperties: false,
};

describe('schemaError', () => {
  it('accepte une valeur conforme', () => {
    expect(schemaError(args, { module: 2, name: 'abc', mode: 'a', tags: ['x'], either: null })).toBeNull();
    expect(schemaError(args, { module: 2, either: 3 })).toBeNull();
  });

  it.each<[string, unknown, string]>([
    ['un type faux', { module: 1.5 }, 'module : integer attendu'],
    ['un tableau pour un objet', [], '(racine) : object attendu'],
    ['une clé héritée n\'est pas présente', { module: 1, constructor: 1 }, 'constructor : inconnu'],
    ['un champ requis absent', {}, 'module : requis'],
    ['un champ inconnu', { module: 1, extra: 1 }, 'extra : inconnu'],
    ['sous le minimum', { module: 0 }, 'module : 1 au moins'],
    ['trop long', { module: 1, name: 'abcdef' }, 'name : 5 caractères au plus'],
    ['hors du motif', { module: 1, name: 'AB' }, 'name : ne suit pas ^[a-z]+$'],
    ['hors de l\'énumération', { module: 1, mode: 'c' }, "mode : l'une de a, b attendue"],
    ['trop d\'éléments', { module: 1, tags: ['a', 'b', 'c'] }, 'tags : 2 éléments au plus'],
    ['un élément fautif', { module: 1, tags: ['a', 2] }, 'tags[1] : string attendu'],
    ['une liste de types sans correspondance', { module: 1, either: 'x' }, 'either : integer ou null attendu'],
  ])('refuse %s', (_name, value, error) => {
    expect(schemaError(args, value)).toBe(error);
  });

  it('préfixe le chemin donné', () => {
    expect(schemaError(args, { module: 'x' }, 'args')).toBe('args.module : integer attendu');
  });

  it('distingue nombre, entier, null', () => {
    expect(schemaError({ type: 'number' }, 1.5)).toBeNull();
    expect(schemaError({ type: 'number' }, NaN)).not.toBeNull();
    expect(schemaError({ type: 'null' }, null)).toBeNull();
    expect(schemaError({ type: 'boolean' }, 0)).not.toBeNull();
  });

  it('une énumération qui peut valoir null le liste, comme JSON Schema', () => {
    expect(schemaError({ type: ['string', 'null'], enum: ['a', null] }, null)).toBeNull();
    expect(schemaError({ type: ['string', 'null'], enum: ['a'] }, null)).not.toBeNull();
  });
});

describe('SCHEMA_KEYS', () => {
  it('liste les mots-clés du sous-ensemble', () => {
    expect(SCHEMA_KEYS).toContain('additionalProperties');
    expect(SCHEMA_KEYS).not.toContain('oneOf');
  });
});
