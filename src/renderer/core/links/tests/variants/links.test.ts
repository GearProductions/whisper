import { describe, expect, it } from 'vitest';
import { splitLinks } from 'core/links';

describe('splitLinks', () => {
  it('texte sans lien : un segment', () => {
    expect(splitLinks('bonjour')).toEqual([{ text: 'bonjour' }]);
    expect(splitLinks('')).toEqual([]);
  });

  it('ponctuation de fin de phrase hors du lien', () => {
    expect(splitLinks('voir https://a.example/x.')).toEqual([
      { text: 'voir ' }, { text: 'https://a.example/x', url: 'https://a.example/x' }, { text: '.' },
    ]);
  });

  it('parenthèse fermante sans ouvrante hors du lien', () => {
    expect(splitLinks('(https://a.example/x)')).toEqual([
      { text: '(' }, { text: 'https://a.example/x', url: 'https://a.example/x' }, { text: ')' },
    ]);
    expect(splitLinks('https://fr.wikipedia.org/wiki/A_(b)')[0].url).toBe('https://fr.wikipedia.org/wiki/A_(b)');
  });

  it('lien Markdown : son titre', () => {
    expect(splitLinks('[la PR](https://github.com/x/y/pull/1) ok')).toEqual([
      { text: 'la PR', url: 'https://github.com/x/y/pull/1' }, { text: ' ok' },
    ]);
  });
});
