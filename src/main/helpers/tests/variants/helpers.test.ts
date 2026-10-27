import { describe, expect, it } from 'vitest';
import { detectLanguage, oneLine, splitCommand, tail, withDir } from 'helpers';

describe('splitCommand', () => {
  it('arguments et guillemets', () => {
    expect(splitCommand('distrobox enter dev -- mise exec -- claude')).toEqual(['distrobox', 'enter', 'dev', '--', 'mise', 'exec', '--', 'claude']);
    expect(splitCommand(`"/opt/mon claude/claude" --x 'a b'`)).toEqual(['/opt/mon claude/claude', '--x', 'a b']);
    expect(splitCommand('')).toEqual([]);
    expect(splitCommand(null)).toEqual([]);
  });
  it('rien d’interprété', () => {
    expect(splitCommand('claude; rm -rf $HOME > /tmp/x')).toEqual(['claude;', 'rm', '-rf', '$HOME', '>', '/tmp/x']);
  });
});

describe('withDir', () => {
  it('un argument {dir} entier remplacé, jamais au milieu d’un mot', () => {
    expect(withDir(['konsole', '--workdir', '{dir}', '--x={dir}', 'a{dir}'], '/a b; c')).toEqual(['konsole', '--workdir', '/a b; c', '--x={dir}', 'a{dir}']);
    expect(withDir(['wt', '-d', '{dir}', '{dir}'], '/p')).toEqual(['wt', '-d', '/p', '/p']);
  });
});

describe('detectLanguage', () => {
  const langs = ['fr', 'en'];
  it.each([
    ['Le fichier est dans le dossier, mais il ne compile pas.', 'fr'],
    ['The build is broken and we can’t ship it.', 'en'],
    ['On lance le build avec npm puis on fait le merge de la pull request.', 'fr'],
    ['', 'fr'],
  ])('%s → %s', (text, lang) => expect(detectLanguage(text, langs)).toBe(lang));
  it('indécis sans français : la première langue', () => expect(detectLanguage('', ['en', 'de'])).toBe('en'));
});

it('oneLine', () => expect(oneLine('  a\n\tb  c ')).toBe('a b c'));

it('tail', () => {
  expect(tail('a\nb\nc\n\n', 2, 100)).toBe('b\nc');
  expect(tail('a\nbcdef', 5, 3)).toBe('def');
  expect(tail('', 3, 10)).toBe('');
});
