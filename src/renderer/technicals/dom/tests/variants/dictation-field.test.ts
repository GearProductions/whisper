// @vitest-environment happy-dom
// dictationField : une zone de texte modifiable, pas le champ de la conversation, ni un <input>
// ou un éditeur CodeMirror ; dictationText : l'espace avant la dictée, la place sous maxLength.
import { EditorView } from '@codemirror/view';
import { expect, it } from 'vitest';
import { dictationField, dictationText } from 'technicals/dom';

const el = (tag: string) => document.body.appendChild(document.createElement(tag));
const area = (props: Partial<Pick<HTMLTextAreaElement, 'readOnly' | 'disabled' | 'value'>> = {}) =>
  Object.assign(el('textarea') as HTMLTextAreaElement, props);

it('dictationField : seulement une zone de texte modifiable, hors champ de la conversation', () => {
  const input = area();
  const zone = area();
  expect(dictationField(zone, input)).toBe(zone);
  expect(dictationField(input, input)).toBeNull();
  expect(dictationField(area({ readOnly: true }), input)).toBeNull();
  expect(dictationField(area({ disabled: true }), input)).toBeNull();
  expect(dictationField(el('input'), input)).toBeNull();
  expect(dictationField(document.body, input)).toBeNull();
  expect(dictationField(null, input)).toBeNull();
  const cm = new EditorView({ doc: 'x', parent: el('div') });
  expect(dictationField(cm.contentDOM, input)).toBeNull();
});

const field = (value: string, at = value.length, end = at, maxLength = -1) => ({ value, selectionStart: at, selectionEnd: end, maxLength });

it('dictationText : une espace si le texte avant le curseur ne finit pas par un blanc', () => {
  expect(dictationText(field(''), 'bonjour')).toBe('bonjour');
  expect(dictationText(field('Salut'), 'bonjour')).toBe(' bonjour');
  expect(dictationText(field('Salut '), 'bonjour')).toBe('bonjour');
  expect(dictationText(field('Salut\n'), 'bonjour')).toBe('bonjour');
  expect(dictationText(field('Salut', 0), 'bonjour')).toBe('bonjour');      // en tête
  expect(dictationText(field('a b', 2), 'c')).toBe('c');                    // après le blanc, avant la suite
});

it('dictationText : coupé à la place qui reste, la sélection comprise ; -1 sans limite', () => {
  expect(dictationText(field('ab', 2, 2, -1), 'x'.repeat(5000))).toHaveLength(5001);
  expect(dictationText(field('ab', 2, 2, 5), 'cdef')).toBe(' cd');
  expect(dictationText(field('abcd', 1, 3, 6), 'xyz')).toBe(' xyz');        // 'bc' remplacé : 4 places
  expect(dictationText(field('abcde', 5, 5, 5), 'x')).toBe('');
  expect(dictationText(field('abcd', 4, 4, 5), 'x')).toBe('');              // place pour l'espace seule
  expect(dictationText(field('abcdef', 6, 6, 5), 'x')).toBe('');             // déjà au-delà
});

it('dictationText : maxLength lu sur une vraie zone (absent : -1)', () => {
  const zone = area({ value: 'ab' });
  expect(dictationText(zone, 'c')).toBe(' c');
  zone.maxLength = 4;
  expect(dictationText(zone, 'cd')).toBe(' c');
});
