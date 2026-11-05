// Variantes de schema : chaque mot-clé du sous-ensemble, la faute (en anglais) et son chemin ; coerce, la conversion tolérante sans ambiguïté.
import { describe, expect, it } from 'vitest';
import { SCHEMA_KEYS, coerce, schemaError, type JsonSchema } from 'core/commands';

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
    ['un type faux', { module: 1.5 }, 'module: integer expected'],
    ['un tableau pour un objet', [], '(root): object expected'],
    ['une clé héritée n\'est pas présente', { module: 1, constructor: 1 }, 'constructor: unknown'],
    ['un champ requis absent', {}, 'module: required'],
    ['un champ inconnu', { module: 1, extra: 1 }, 'extra: unknown'],
    ['sous le minimum', { module: 0 }, 'module: minimum is 1'],
    ['trop long', { module: 1, name: 'abcdef' }, 'name: at most 5 characters'],
    ['hors du motif', { module: 1, name: 'AB' }, 'name: does not match ^[a-z]+$'],
    ['hors de l\'énumération', { module: 1, mode: 'c' }, 'mode: one of a, b expected'],
    ['trop d\'éléments', { module: 1, tags: ['a', 'b', 'c'] }, 'tags: at most 2 items'],
    ['un élément fautif', { module: 1, tags: ['a', 2] }, 'tags[1]: string expected'],
    ['une liste de types sans correspondance', { module: 1, either: 'x' }, 'either: integer or null expected'],
  ])('refuse %s', (_name, value, error) => {
    expect(schemaError(args, value)).toBe(error);
  });

  it('préfixe le chemin donné', () => {
    expect(schemaError(args, { module: 'x' }, 'args')).toBe('args.module: integer expected');
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

describe('coerce', () => {
  const read = (schema: JsonSchema, value: unknown) => coerce(schema, value);

  it('integer : « 2 » et « -3 » convertis, « 2.5 » et « abc » laissés, que schemaError refuse', () => {
    const int: JsonSchema = { type: 'integer' };
    expect(read(int, '2')).toBe(2);
    expect(read(int, '-3')).toBe(-3);
    for (const bad of ['2.5', 'abc', '', ' 2', '+2', '1e3']) {
      expect(read(int, bad)).toBe(bad);
      expect(schemaError(int, read(int, bad))).toBe('(root): integer expected');
    }
  });

  it('number : « 1.5 » converti ; boolean : « true » et « false » convertis, « yes » et « 1 » laissés', () => {
    expect(read({ type: 'number' }, '1.5')).toBe(1.5);
    expect(read({ type: 'number' }, 'abc')).toBe('abc');
    expect(read({ type: 'boolean' }, 'true')).toBe(true);
    expect(read({ type: 'boolean' }, 'false')).toBe(false);
    expect(read({ type: 'boolean' }, 'yes')).toBe('yes');
    expect(read({ type: 'boolean' }, '1')).toBe('1');
  });

  it('un type en liste avec string : rien de converti', () => {
    expect(read({ type: ['string', 'integer'] }, '2')).toBe('2');
    expect(read({ type: ['integer', 'string'] }, 'true')).toBe('true');
    expect(read({ type: ['integer', 'null'] }, '2')).toBe(2);
  });

  it('dans properties et items, à toute profondeur ; une clé hors properties laissée telle quelle', () => {
    const schema: JsonSchema = {
      type: 'object',
      properties: {
        n: { type: 'integer' },
        deep: { type: 'object', properties: { list: { type: 'array', items: { type: 'object', properties: { ok: { type: 'boolean' } } } } } },
        nums: { type: 'array', items: { type: 'number' } },
      },
    };
    expect(read(schema, { n: '4', deep: { list: [{ ok: 'true' }, { ok: 'no' }] }, nums: ['1', '2.5', 'x'], other: '7', constructor: '8' })).toEqual({
      n: 4, deep: { list: [{ ok: true }, { ok: 'no' }] }, nums: [1, 2.5, 'x'], other: '7', constructor: '8',
    });
  });

  it('la valeur donnée n\'est pas modifiée (une copie)', () => {
    const schema: JsonSchema = { type: 'object', properties: { n: { type: 'integer' }, l: { type: 'array', items: { type: 'integer' } } } };
    const given = { n: '1', l: ['2'] };
    const out = read(schema, given);
    expect(given).toEqual({ n: '1', l: ['2'] });
    expect(out).not.toBe(given);
    expect(out).toEqual({ n: 1, l: [2] });
  });

  it('une valeur qui n\'a pas la forme du schéma est rendue telle quelle', () => {
    const schema: JsonSchema = { type: 'object', properties: { n: { type: 'integer' } } };
    expect(read(schema, null)).toBeNull();
    expect(read(schema, ['1'])).toEqual(['1']);
    expect(read({ type: 'array', items: { type: 'integer' } }, { 0: '1' })).toEqual({ 0: '1' });
  });
});

describe('SCHEMA_KEYS', () => {
  it('liste les mots-clés du sous-ensemble', () => {
    expect(SCHEMA_KEYS).toContain('additionalProperties');
    expect(SCHEMA_KEYS).not.toContain('oneOf');
  });
});
