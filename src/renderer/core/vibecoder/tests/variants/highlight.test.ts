import { describe, expect, it } from 'vitest';
import { tokens, type Token } from 'core/vibecoder';

const code = [
  'describe(\'la note\', () => {',
  '  it(\'garde l\\\'ordre\', async () => {',
  '    // étant donné une note',
  '    const note = await lire("a.md"); /* quand */',
  '    expect(note.lignes).toEqual([1, 2.5]); // alors',
  '    expect(`${note}`).not.toBe(null);',
  '  });',
  '});',
].join('\n');
const of = (kind: Token['kind'], c: string) => tokens(c).filter((t) => t.kind === kind).map((t) => t.text);

describe('tokens', () => {
  it('bout à bout, les morceaux redonnent le code tel quel', () => {
    for (const c of [code, '', '\'non fermée\nsuite', '/* jamais fermé\nx', '`a\n${b}', 'é → ✓ \t\r\n']) {
      expect(tokens(c).map((t) => t.text).join('')).toBe(c);
    }
  });

  it('mots-clés : ceux de Vitest et de TypeScript', () => {
    expect(of('keyword', code)).toEqual(['describe', 'it', 'async', 'const', 'await', 'expect', 'toEqual', 'expect', 'not', 'toBe', 'null']);
  });

  it('un mot qui contient un mot-clé : du texte', () => {
    expect(of('keyword', 'item notice inédit forêt toBeNull')).toEqual([]);
  });

  it('chaînes entre \', " et `, échappements compris', () => {
    expect(of('string', '\'l\\\'a\' "b\\"c" `d${e}`')).toEqual(['\'l\\\'a\'', '"b\\"c"', '`d${e}`']);
  });

  it('chaîne \' ou " non fermée : jusqu\'à la fin de la ligne', () => {
    expect(tokens('\'a\nb')).toEqual([{ kind: 'string', text: '\'a' }, { kind: 'text', text: '\nb' }]);
  });

  it('commentaires : // jusqu\'à la fin de la ligne, /* … */ sur plusieurs', () => {
    expect(of('comment', 'a // b\nc /* d\ne */ f')).toEqual(['// b', '/* d\ne */']);
  });

  it('nombres entiers et décimaux ; x1 reste un mot', () => {
    expect(of('number', 'f(1, 2.5, x1)')).toEqual(['1', '2.5']);
  });

  it('# : un commentaire jusqu\'à la fin de la ligne', () => {
    expect(of('comment', 'then refused   # result is null\nx')).toEqual(['# result is null']);
  });

  it('une apostrophe dans un mot n\'ouvre pas de chaîne', () => {
    expect(of('string', 'given the user\'s file and the users\' cap')).toEqual([]);
    expect(of('string', 'a \'cap\' b')).toEqual(['\'cap\'']);
  });

  it('le reste : un seul morceau de texte', () => {
    expect(tokens('a + b')).toEqual([{ kind: 'text', text: 'a + b' }]);
  });
});
